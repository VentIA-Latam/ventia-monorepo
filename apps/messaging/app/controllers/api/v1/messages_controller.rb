class Api::V1::MessagesController < Api::V1::BaseController
  before_action :set_conversation

  def index
    base = @conversation.messages.includes(attachments: { file_attachment: :blob })

    messages = if params[:before].present?
                 # Load older messages (scroll up)
                 base.reorder(created_at: :desc).where('id < ?', params[:before].to_i).limit(20).reverse
               elsif params[:after].present?
                 # Load newer messages (real-time catch-up)
                 base.reorder(created_at: :asc).where('id > ?', params[:after].to_i).limit(100)
               else
                 # Default: latest 20 messages in chronological order
                 base.reorder(created_at: :desc).limit(20).reverse
               end

    render json: {
      success: true,
      data: messages.map { |m| message_json(m) },
      meta: { has_more: messages.size == 20 }
    }
  end

  def create
    message = @conversation.messages.new(message_params)
    message.account = current_account
    message.inbox = @conversation.inbox
    message.sender = current_user if current_user

    # Template message: set type and store template_params in additional_attributes
    if params.dig(:message, :template_params).present?
      message.message_type = :template
      permitted_template_params = params.require(:message).require(:template_params).permit(
        :name, :namespace, :language,
        processed_params: {}
      )
      message.additional_attributes = { 'template_params' => permitted_template_params.to_h }
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

  private

  def set_conversation
    @conversation = current_account.conversations.find(params[:conversation_id])
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
