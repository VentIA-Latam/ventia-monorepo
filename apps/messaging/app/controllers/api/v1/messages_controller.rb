class Api::V1::MessagesController < Api::V1::BaseController
  before_action :set_conversation

  def index
    messages = @conversation.messages
                            .order(created_at: :asc)
                            .page(params[:page] || 1)
                            .per(params[:per_page] || 50)

    render json: {
      success: true,
      data: messages.map { |m| message_json(m) },
      meta: pagination_meta(messages)
    }
  end

  def create
    message = @conversation.messages.new(message_params)
    message.account = current_account
    message.inbox = @conversation.inbox
    message.message_type = :outgoing

    if message.save
      # WhatsApp delivery is handled by after_create_commit :send_reply callback → SendReplyJob
      render_success(message_json(message), message: 'Message sent', status: :created)
    else
      render_error('Failed to send message', errors: message.errors.full_messages)
    end
  end

  private

  def set_conversation
    @conversation = current_account.conversations.find(params[:conversation_id])
  end

  def message_params
    params.require(:message).permit(:content, :content_type)
  end

  def message_json(message)
    {
      id: message.id,
      content: message.content,
      message_type: message.message_type,
      content_type: message.content_type,
      status: message.status,
      created_at: message.created_at,
      sender: message.sender&.class&.name == 'Contact' ? {
        type: 'contact',
        id: message.sender.id,
        name: message.sender.name
      } : nil
    }
  end
end
