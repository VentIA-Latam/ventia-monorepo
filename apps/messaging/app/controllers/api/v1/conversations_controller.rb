class Api::V1::ConversationsController < Api::V1::BaseController
  before_action :set_conversation, only: [:show, :update, :toggle_status, :update_stage, :escalate, :update_last_seen, :destroy]

  def index
    conversations = current_account.conversations
                                   .includes(:contact, :inbox, :labels, :assignee, :team, messages: :attachments)
                                   .recent
                                   .page(params[:page] || 1)
                                   .per(params[:per_page] || 25)

    # Filter by status
    conversations = conversations.where(status: params[:status]) if params[:status]

    # Filter by stage (pre_sale / sale)
    conversations = conversations.by_stage(params[:stage]) if params[:stage].present?

    # Filter by conversation type (unattended)
    conversations = conversations.unattended if params[:conversation_type] == 'unattended'

    # Filter by inbox
    conversations = conversations.where(inbox_id: params[:inbox_id]) if params[:inbox_id]

    # Filter by label title
    conversations = conversations.with_label(params[:label]) if params[:label].present?

    # Filter by temperature
    conversations = conversations.where(temperature: params[:temperature]) if params[:temperature].present?

    # Filter by date range (last_activity_at)
    if params[:created_after].present? || params[:created_before].present?
      from = params[:created_after].present? ? Time.parse(params[:created_after]) : Time.at(0)
      to = params[:created_before].present? ? Time.parse(params[:created_before]) : Time.current
      conversations = conversations.in_date_range(from, to)
    end

    # Filter unread only (timestamp-based: incoming messages after agent_last_seen_at)
    if params[:unread] == 'true'
      conversations = conversations.where(
        "agent_last_seen_at IS NULL OR agent_last_seen_at < (SELECT MAX(created_at) FROM messages WHERE messages.conversation_id = conversations.id AND messages.message_type = 0)"
      )
    end

    render json: {
      success: true,
      data: conversations.map { |c| conversation_json(c) },
      meta: pagination_meta(conversations)
    }
  end

  def counts
    base = current_account.conversations
    base = base.where(inbox_id: params[:inbox_id]) if params[:inbox_id]

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
    if @conversation.update(conversation_params)
      render_success(conversation_json(@conversation), message: 'Conversation updated')
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

  private

  def set_conversation
    @conversation = current_account.conversations.find(params[:id])
  end

  def conversation_params
    params.require(:conversation).permit(:status, :stage, :priority, :temperature, :ai_agent_enabled, custom_attributes: {})
  end

  def conversation_json(conversation)
    last_msg = conversation.messages.where.not(message_type: :activity).order(created_at: :desc).first

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
      last_message_at: conversation.messages.maximum(:created_at),
      contact: {
        id: conversation.contact.id,
        name: conversation.contact.name,
        phone_number: conversation.contact.phone_number,
        email: conversation.contact.email
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
      messages_count: conversation.messages.count,
      unread_count: conversation.unread_messages.count,
      last_message: last_msg ? {
        content: last_msg.content&.truncate(100),
        message_type: last_msg.message_type,
        attachment_type: last_msg.attachments.any? ? last_msg.attachments.first.file_type : nil,
        created_at: last_msg.created_at
      } : nil
    }
  end
end
