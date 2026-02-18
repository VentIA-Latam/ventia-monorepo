class Api::V1::ConversationsController < Api::V1::BaseController
  before_action :set_conversation, only: [:show, :update, :toggle_status, :destroy]

  def index
    conversations = current_account.conversations
                                   .includes(:contact, :inbox, :labels)
                                   .recent
                                   .page(params[:page] || 1)
                                   .per(params[:per_page] || 25)

    # Filter by status
    conversations = conversations.where(status: params[:status]) if params[:status]

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

    # Filter unread only
    if params[:unread] == 'true'
      conversations = conversations.joins(:messages).where(messages: { status: :unread }).distinct
    end

    render json: {
      success: true,
      data: conversations.map { |c| conversation_json(c) },
      meta: pagination_meta(conversations)
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

  private

  def set_conversation
    @conversation = current_account.conversations.find(params[:id])
  end

  def conversation_params
    params.require(:conversation).permit(:status, :priority, :temperature, :ai_agent_enabled, custom_attributes: {})
  end

  def conversation_json(conversation)
    {
      id: conversation.id,
      uuid: conversation.uuid,
      status: conversation.status,
      priority: conversation.priority,
      temperature: conversation.temperature,
      can_reply: conversation.can_reply?,
      last_activity_at: conversation.last_activity_at,
      last_message_at: conversation.messages.maximum(:created_at),
      contact: {
        id: conversation.contact.id,
        name: conversation.contact.name,
        phone_number: conversation.contact.phone_number
      },
      inbox: {
        id: conversation.inbox.id,
        name: conversation.inbox.name
      },
      labels: conversation.labels.map { |l| { id: l.id, title: l.title, color: l.color } },
      ai_agent_enabled: conversation.ai_agent_enabled,
      messages_count: conversation.messages.count,
      unread_count: conversation.unread_messages.count
    }
  end
end
