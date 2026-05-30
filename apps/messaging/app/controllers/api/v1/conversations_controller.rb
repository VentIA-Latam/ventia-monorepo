class Api::V1::ConversationsController < Api::V1::BaseController
  include SearchSnippetSafety

  before_action :set_conversation, only: [:show, :update, :toggle_status, :update_stage, :escalate, :resolve_escalation, :mark_payment_review, :update_last_seen, :destroy]

  def index
    conversations = apply_filters(
      current_account.conversations
                     .includes(:contact, :contact_inbox, :inbox, :labels, :assignee, :team)
                     .recent
    ).page(params[:page] || 1).per(params[:per_page] || 25)

    search_term = params[:search].presence
    stats = precompute_conversation_stats(conversations)

    render json: {
      success: true,
      data: conversations.map { |c| conversation_json(c, search_term: search_term, stats: stats) },
      meta: pagination_meta(conversations)
    }
  end

  def export
    conversations = apply_filters(
      current_account.conversations.includes(:contact).recent
    ).limit(5000)

    render json: {
      success: true,
      data: conversations.map { |c|
        { name: c.contact&.name, phone: c.contact&.phone_number }
      }
    }
  end

  def counts
    base = current_account.conversations
    base = base.where(inbox_id: params[:inbox_id]) if params[:inbox_id]

    ids = parsed_inbox_ids
    base = base.where(inbox_id: ids) if ids.any?

    render json: {
      success: true,
      data: {
        all: base.count,
        sale: base.by_stage(:sale).count,
        unattended: base.unattended.count
      }
    }
  end

  def show
    render_success(conversation_json(@conversation))
  end

  def update
    ai_was_enabled = @conversation.ai_agent_enabled
    if @conversation.update(conversation_params)
      sync_soporte_humano_label if conversation_params.key?(:ai_agent_enabled) && ai_was_enabled != @conversation.ai_agent_enabled
      render_success(conversation_json(@conversation.reload), message: 'Conversation updated')
    else
      render_error('Failed to update conversation', errors: @conversation.errors.full_messages)
    end
  end

  def destroy
    @conversation.destroy!
    head :no_content
  end

  def toggle_status
    @conversation.toggle_status!

    render_success(
      conversation_json(@conversation),
      message: "Conversation #{@conversation.status}"
    )
  end

  def update_stage
    stage = params[:stage]
    unless %w[pre_sale sale].include?(stage)
      return render_error('Invalid stage. Must be pre_sale or sale', status: :unprocessable_entity)
    end

    @conversation.update!(stage: stage)
    render_success(conversation_json(@conversation), message: "Stage updated to #{stage}")
  end

  def escalate
    @conversation.update!(ai_agent_enabled: false)

    label = Label.find_or_create_by!(account_id: current_account.id, title: 'soporte-humano') do |l|
      l.color = '#EF4444'
      l.system = true
      l.show_on_sidebar = true
    end

    unless @conversation.labels.exists?(label.id)
      @conversation.labels << label
    end

    render_success(conversation_json(@conversation.reload), message: 'Conversation escalated to human support')
  end

  def resolve_escalation
    @conversation.update!(ai_agent_enabled: true)

    # Destruir el ConversationLabel directamente para disparar after_destroy_commit
    # → activity message "Etiqueta removida" + broadcast conversation.labels_updated.
    # Mismo patrón que sync_soporte_humano_label (labels.delete() omite callbacks).
    label = current_account.labels.find_by(title: 'soporte-humano')
    join = label && @conversation.conversation_labels.find_by(label_id: label.id)
    join&.destroy!

    render_success(conversation_json(@conversation.reload), message: 'Escalation resolved, AI agent re-enabled')
  end

  def mark_payment_review
    label = Label.find_or_create_by!(account_id: current_account.id, title: 'en-revisión') do |l|
      l.color = '#F59E0B'
      l.system = true
      l.show_on_sidebar = true
    end

    unless @conversation.labels.exists?(label.id)
      @conversation.labels << label
    end

    render_success(conversation_json(@conversation.reload), message: 'Conversation marked for payment review')
  end

  def update_last_seen
    @conversation.update_columns(agent_last_seen_at: Time.current)

    # Broadcast via ActionCable so other agents see unread_count drop
    ActionCableBroadcastJob.perform_later(
      ["account_#{current_account.id}"],
      'conversation.read',
      @conversation.reload.webhook_data.merge(
        agent_last_seen_at: @conversation.agent_last_seen_at.to_i,
        unread_count: @conversation.unread_messages.count
      )
    )

    render_success(conversation_json(@conversation))
  end

  def no_purchase_reason
    reason = params[:reason].to_s.strip
    return render json: { success: false, error: "reason_required" },
                  status: :unprocessable_entity if reason.blank?

    conversation = current_account.conversations.find(params[:id])
    new_attrs = (conversation.custom_attributes || {}).merge("no_purchase_reason" => reason)
    conversation.update!(custom_attributes: new_attrs)

    render json: {
      success: true,
      data: { conversation_id: conversation.id, reason: reason }
    }
  end

  private

  def precompute_conversation_stats(conversations)
    conv_ids = conversations.map(&:id)
    return {} if conv_ids.empty?

    pg_ids = "{#{conv_ids.join(',')}}"

    last_msgs = Message
      .where(conversation_id: conv_ids)
      .where.not(message_type: :activity)
      .select('DISTINCT ON (conversation_id) messages.*')
      .order('conversation_id, created_at DESC')
      .includes(:attachments)

    agg = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql_array([
        <<~SQL, pg_ids
          SELECT conversation_id, COUNT(*) AS cnt, MAX(created_at) AS max_date
          FROM messages
          WHERE conversation_id = ANY(?::int[])
          GROUP BY conversation_id
        SQL
      ])
    )

    unread_rows = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql_array([
        <<~SQL, pg_ids
          SELECT m.conversation_id, COUNT(*) AS unread
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE m.conversation_id = ANY(?::int[])
            AND m.message_type = 0
            AND m.created_at > COALESCE(c.agent_last_seen_at, '1970-01-01')
          GROUP BY m.conversation_id
        SQL
      ])
    )

    counts = {}
    max_dates = {}
    agg.each do |row|
      cid = row['conversation_id'].to_i
      counts[cid] = row['cnt'].to_i
      max_dates[cid] = row['max_date']
    end

    unread = {}
    unread_rows.each { |row| unread[row['conversation_id'].to_i] = row['unread'].to_i }

    {
      last_messages: last_msgs.index_by(&:conversation_id),
      counts: counts,
      max_dates: max_dates,
      unread: unread
    }
  end

  # Parses params[:inbox_ids] from CSV ("12,45") or array ("?inbox_ids[]=12") forms.
  # Coerces to integers and drops anything that parses to 0 (non-numeric strings, blanks).
  def parsed_inbox_ids
    return [] if params[:inbox_ids].blank?

    Array(params[:inbox_ids]).flat_map { |v| v.to_s.split(',') }.map(&:to_i).reject(&:zero?)
  end

  def apply_filters(base)
    base = base.where(status: params[:status]) if params[:status]
    base = base.by_stage(params[:stage]) if params[:stage].present?
    base = base.unattended if params[:conversation_type] == 'unattended'
    base = base.where(inbox_id: params[:inbox_id]) if params[:inbox_id]

    ids = parsed_inbox_ids
    base = base.where(inbox_id: ids) if ids.any?

    base = base.with_label(params[:label]) if params[:label].present?
    base = base.where(temperature: params[:temperature]) if params[:temperature].present?
    base = base.where(ai_agent_enabled: ActiveModel::Type::Boolean.new.cast(params[:ai_agent_enabled])) if params[:ai_agent_enabled].present?

    if params[:search].present?
      term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:search])}%"
      base = base.references(:contact).where(
        "contacts.name ILIKE :q
         OR contacts.phone_number ILIKE :q
         OR contacts.email ILIKE :q
         OR conversations.id IN (
           SELECT DISTINCT conversation_id FROM messages
           WHERE (message_search_ts @@ plainto_tsquery('simple', :raw_term) OR COALESCE(processed_message_content, content) ILIKE :q)
             AND messages.account_id = :account_id
             AND messages.message_type != 2
         )",
        q: term,
        raw_term: params[:search],
        account_id: current_account.id
      )
    end

    if params[:created_after].present? || params[:created_before].present?
      from = params[:created_after].present? ? Time.parse(params[:created_after]) : Time.at(0)
      to   = params[:created_before].present? ? Time.parse(params[:created_before]) : Time.current
      base = base.in_date_range(from, to)
    end

    if params[:unread] == 'true'
      base = base.where(
        "agent_last_seen_at IS NULL OR agent_last_seen_at < (SELECT MAX(created_at) FROM messages WHERE messages.conversation_id = conversations.id AND messages.message_type = 0)"
      )
    end

    base
  end

  def set_conversation
    @conversation = current_account.conversations.find(params[:id])
  end

  def conversation_params
    params.require(:conversation).permit(:status, :stage, :priority, :temperature, :ai_agent_enabled, custom_attributes: {})
  end

  # Sincroniza la etiqueta soporte-humano con el estado del agente IA.
  # Inversa de labels_controller.rb (que sincroniza IA cuando se añade/quita la etiqueta).
  # Importante: destruir el ConversationLabel directamente (no usar labels.delete)
  # para disparar after_destroy_commit → activity message + broadcast en tiempo real.
  def sync_soporte_humano_label
    if @conversation.ai_agent_enabled
      # IA reactivada → quitar soporte-humano si estaba
      label = current_account.labels.find_by(title: 'soporte-humano')
      join = label && @conversation.conversation_labels.find_by(label_id: label.id)
      join&.destroy!
    else
      # IA desactivada → añadir soporte-humano si no estaba
      label = Label.find_or_create_by!(account_id: current_account.id, title: 'soporte-humano') do |l|
        l.color = '#EF4444'
        l.system = true
        l.show_on_sidebar = true
      end
      @conversation.labels << label unless @conversation.labels.exists?(label.id)
    end
  end

  def conversation_json(conversation, search_term: nil, stats: nil)
    if stats
      last_msg       = stats[:last_messages][conversation.id]
      last_message_at = stats[:max_dates][conversation.id]
      messages_count = stats[:counts][conversation.id] || 0
      unread_count   = stats[:unread][conversation.id] || 0
    else
      last_msg       = conversation.messages.where.not(message_type: :activity).order(created_at: :desc).first
      last_message_at = conversation.messages.maximum(:created_at)
      messages_count = conversation.messages.count
      unread_count   = conversation.unread_messages.count
    end

    snippet_data      = build_message_snippet(conversation, search_term)
    message_snippet   = snippet_data&.dig(:snippet)
    matched_message_id = snippet_data&.dig(:message_id)

    {
      id: conversation.id,
      uuid: conversation.uuid,
      status: conversation.status,
      stage: conversation.stage,
      priority: conversation.priority,
      temperature: conversation.temperature,
      can_reply: conversation.can_reply?,
      last_activity_at: conversation.last_activity_at,
      agent_last_seen_at: conversation.agent_last_seen_at,
      created_at: conversation.created_at,
      last_message_at: last_message_at,
      contact: {
        id:               conversation.contact.id,
        name:             conversation.contact.name,
        phone_number:     conversation.contact.phone_number,
        email:            conversation.contact.email,
        identifier:       conversation.contact.identifier,
        whatsapp_bsuid:   conversation.contact_inbox&.whatsapp_bsuid,
        last_activity_at: conversation.contact.last_activity_at
      },
      assignee: conversation.assignee ? {
        id: conversation.assignee.id,
        name: conversation.assignee.name,
        email: conversation.assignee.email
      } : nil,
      team: conversation.team ? {
        id: conversation.team.id,
        name: conversation.team.name
      } : nil,
      inbox_id: conversation.inbox_id,
      inbox: {
        id: conversation.inbox.id,
        name: conversation.inbox.name,
        channel_type: conversation.inbox.channel_type
      },
      labels: conversation.labels.map { |l| { id: l.id, title: l.title, color: l.color, system: l.system } },
      waiting_since: conversation.waiting_since&.to_i,
      first_reply_created_at: conversation.first_reply_created_at&.to_i,
      ai_agent_enabled: conversation.ai_agent_enabled,
      messages_count: messages_count,
      unread_count: unread_count,
      last_message: last_msg ? {
        content: last_msg.content&.truncate(100),
        message_type: last_msg.message_type,
        status: last_msg.status,
        attachment_type: last_msg.attachments.any? ? last_msg.attachments.first.file_type : nil,
        created_at: last_msg.created_at
      } : nil,
      message_snippet: message_snippet,
      matched_message_id: matched_message_id
    }
  end

  def build_snippet_tsquery(query)
    terms = query.to_s.strip.split.map { |t| "'#{t.gsub("'", "''")}':*" }
    terms.empty? ? "'':*" : terms.join(" & ")
  end

  def build_message_snippet(conversation, search_term)
    return nil if search_term.blank?

    sanitized  = search_term.to_s.strip
    ilike_term = "%#{ActiveRecord::Base.sanitize_sql_like(sanitized)}%"
    tsquery    = build_snippet_tsquery(sanitized)

    result = ActiveRecord::Base.connection.execute(
      ActiveRecord::Base.sanitize_sql_array([
        <<~SQL,
          SELECT id, ts_headline(
            'simple',
            COALESCE(processed_message_content, content),
            to_tsquery('simple', ?),
            ?
          ) AS snippet
          FROM messages
          WHERE conversation_id = ?
            AND message_type != 2
            AND COALESCE(processed_message_content, content) IS NOT NULL
            AND (
              message_search_ts @@ plainto_tsquery('simple', ?)
              OR COALESCE(processed_message_content, content) ILIKE ?
            )
          ORDER BY created_at DESC
          LIMIT 1
        SQL
        tsquery,
        SNIPPET_HEADLINE_OPTIONS,
        conversation.id,
        sanitized,
        ilike_term
      ])
    )
    row = result.first
    return nil if row.nil?
    safe_snippet = sanitize_snippet(row['snippet'])
    return nil if safe_snippet.blank?
    { snippet: safe_snippet, message_id: row['id'].to_i }
  end
end
