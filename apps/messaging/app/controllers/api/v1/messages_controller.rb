class Api::V1::MessagesController < Api::V1::BaseController
  include SearchSnippetSafety

  before_action :set_conversation, except: [:send_by_phone]

  def index
    base = @conversation.messages.includes(attachments: { file_attachment: :blob })

    messages, has_more = if params[:around].present?
                 target = base.find_by(id: params[:around].to_i)
                 if target
                   before = base.where('created_at < ?', target.created_at).reorder(created_at: :desc).limit(10).reverse
                   after  = base.where('created_at > ?', target.created_at).reorder(created_at: :asc).limit(10)
                   [[*before, target, *after], before.size == 10]
                 else
                   [base.reorder(created_at: :desc).limit(20).reverse, true]
                 end
               elsif params[:before].present?
                 msgs = base.reorder(created_at: :desc).where('id < ?', params[:before].to_i).limit(20).reverse
                 [msgs, msgs.size == 20]
               elsif params[:after].present?
                 msgs = base.reorder(created_at: :asc).where('id > ?', params[:after].to_i).limit(100)
                 [msgs, false]
               else
                 msgs = base.reorder(created_at: :desc).limit(20).reverse
                 [msgs, msgs.size == 20]
               end

    render json: {
      success: true,
      data: messages.map { |m| message_json(m) },
      meta: { has_more: has_more }
    }
  end

  def search
    query = params[:q].to_s.strip
    return render json: { success: true, data: [] } if query.blank?

    tsquery = build_snippet_tsquery(query)
    snippet_expr = ActiveRecord::Base.sanitize_sql_array([
      "ts_headline('simple', COALESCE(processed_message_content, content), to_tsquery('simple', ?), ?) AS snippet",
      tsquery,
      SNIPPET_HEADLINE_OPTIONS
    ])

    results = @conversation.messages
      .where.not(message_type: :activity)
      .where("COALESCE(processed_message_content, content) IS NOT NULL")
      .fulltext_search(query)
      .order(created_at: :desc)
      .limit(50)
      .select(:id, :created_at, :message_type, :status, Arel.sql(snippet_expr))
      .map do |msg|
        {
          id: msg.id,
          snippet: sanitize_snippet(msg['snippet']),
          created_at: msg.created_at,
          message_type: msg.message_type,
          status: msg.status
        }
      end

    render json: { success: true, data: results }
  end

  def create
    message = @conversation.messages.new(message_params)
    message.account = current_account
    message.inbox = @conversation.inbox
    message.sender = current_user if current_user

    # Carousel (Instagram generic template) is channel-specific: only Instagram supports it.
    # Validate up-front (fail-fast) so the caller gets a clear 422 and no orphan message is created.
    if message.content_type == 'cards'
      unless @conversation.inbox.channel.is_a?(Channel::Instagram)
        return render_error('cards (carrusel) solo está soportado en Instagram',
                            status: :unprocessable_entity)
      end

      cards = message.content_attributes&.dig('cards')
      if cards.blank? || !cards.is_a?(Array)
        return render_error('content_attributes.cards debe ser un array no vacío',
                            status: :unprocessable_entity)
      end
    end

    # Template message: backend looks up template, interpolates body and builds the snapshot.
    # Client only sends { name, language, processed_params } — see Whatsapp::TemplateMessageBuilder.
    if params.dig(:message, :template_params).present?
      tp = params.require(:message).require(:template_params).permit(
        :name, :language, processed_params: {}
      )

      begin
        built = Whatsapp::TemplateMessageBuilder.new(
          conversation:     @conversation,
          name:             tp[:name],
          language:         tp[:language],
          processed_params: tp[:processed_params]&.to_h
        ).build
        message.assign_attributes(built)
      rescue Whatsapp::TemplateMessageBuilder::TemplateNotFound,
             Whatsapp::TemplateMessageBuilder::MissingBodyVariables => e
        return render_error(e.message)
      end
    else
      message.message_type = :outgoing
    end

    # Contact message: create contact attachment for frontend ContactBubble
    contacts = message.content_attributes&.dig('contacts')
    if contacts.present?
      contacts.each do |contact|
        name_info = contact['name'] || {}
        phones = contact['phones'] || []
        message.attachments.new(
          account: current_account,
          file_type: :contact,
          meta: {
            firstName: name_info['first_name'],
            lastName: name_info['last_name'],
            phone: phones.first&.dig('phone')
          }.compact
        )
      end
    end

    uploaded_file = params.dig(:message, :file)
    if uploaded_file.present?
      message.skip_send_reply = true
      message.attachments.new(
        account: current_account,
        file_type: determine_file_type(uploaded_file.content_type),
        file: uploaded_file
      )
    end

    if message.save
      if uploaded_file.present?
        SendReplyJob.set(wait: 2.seconds).perform_later(message.id)
      end

      render_success(message_json(message.reload), message: 'Message sent', status: :created)
    else
      render_error('Failed to send message', errors: message.errors.full_messages)
    end
  end

  # Envío de template a un teléfono sin requerir conversation_id existente.
  # Crea contact + conversation si no existen, reusa conversación open si la hay.
  # Ver spec: docs/superpowers/specs/2026-06-03-send-by-phone-endpoint-design.md
  def send_by_phone
    inbox = current_account.inboxes.find(params[:inbox_id])

    result = Conversations::EnsureFromPhoneService.new(
      account:         current_account,
      inbox:           inbox,
      phone:           params[:phone],
      template_params: extract_template_params,
      contact_name:    params[:contact_name]
    ).perform

    render_success(
      {
        conversation_id:      result.conversation.id,
        message_id:           result.message.id,
        contact_id:           result.contact.id,
        contact_created:      result.contact_created,
        conversation_created: result.conversation_created
      },
      message: 'Message sent',
      status:  :created
    )
  rescue Conversations::EnsureFromPhoneService::InvalidPhoneError,
         Conversations::EnsureFromPhoneService::InvalidInboxChannelError,
         Whatsapp::TemplateMessageBuilder::TemplateNotFound,
         Whatsapp::TemplateMessageBuilder::MissingBodyVariables,
         ArgumentError => e
    render_error(e.message, status: :unprocessable_entity)
  end

  private

  # Mismo patrón que extract_content_attributes (líneas 169-178): acepta Hash,
  # ActionController::Parameters, o JSON string; cualquier otra cosa → nil para
  # que el servicio raisee ArgumentError mapeado a 422 (no NoMethodError → 500).
  def extract_template_params
    raw = params[:template_params]
    return nil if raw.blank?
    return JSON.parse(raw) if raw.is_a?(String)
    return raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)

    raw.is_a?(Hash) ? raw : nil
  rescue JSON::ParserError
    nil
  end

  def set_conversation
    @conversation = current_account.conversations.find(params[:conversation_id])
  end

  def build_snippet_tsquery(query)
    terms = query.to_s.strip.split.map { |t| "'#{t.gsub("'", "''")}':*" }
    terms.empty? ? "'':*" : terms.join(" & ")
  end

  def message_params
    permitted = params.require(:message).permit(:content, :content_type)
    permitted[:content_attributes] = extract_content_attributes
    permitted
  end

  # Chatwoot pattern: extract content_attributes as a plain hash
  # Supports both Hash params and JSON string
  def extract_content_attributes
    raw = params.dig(:message, :content_attributes)
    return {} if raw.blank?
    return JSON.parse(raw) if raw.is_a?(String)
    return raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)

    raw.is_a?(Hash) ? raw : {}
  rescue JSON::ParserError
    {}
  end

  def determine_file_type(content_type)
    return :image if content_type&.start_with?('image/')
    return :audio if content_type&.start_with?('audio/')
    return :video if content_type&.start_with?('video/')

    :file
  end

  def message_json(message)
    {
      id: message.id,
      content: message.content,
      message_type: message.message_type,
      content_type: message.content_type,
      content_attributes: message.content_attributes,
      additional_attributes: message.additional_attributes,
      status: message.status,
      created_at: message.created_at,
      sender: case message.sender&.class&.name
              when 'Contact'
                { type: 'contact', id: message.sender.id, name: message.sender.name }
              when 'User'
                { type: 'user', id: message.sender.id, name: message.sender.name }
              end,
      attachments: message.attachments.map { |att| attachment_json(att) }
    }
  end

  def attachment_json(att)
    data = {
      id: att.id,
      file_type: att.file_type,
      filename: att.file.attached? ? att.file.filename.to_s : nil,
      file_size: att.file.attached? ? att.file.byte_size : nil,
      extension: att.extension,
      meta: att.meta
    }

    if att.location?
      data[:coordinates_lat] = att.coordinates_lat
      data[:coordinates_long] = att.coordinates_long
      data[:data_url] = att.external_url
    elsif att.file.attached?
      data[:data_url] = att.file_url
    else
      data[:data_url] = att.external_url
    end

    data
  end
end
