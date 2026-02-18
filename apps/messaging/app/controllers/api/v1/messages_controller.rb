class Api::V1::MessagesController < Api::V1::BaseController
  before_action :set_conversation

  def index
    messages = @conversation.messages
                            .includes(attachments: { file_attachment: :blob })
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

    uploaded_file = params.dig(:message, :file)
    if uploaded_file.present?
      message.skip_send_reply = true
    end

    if message.save
      if uploaded_file.present?
        file_type = determine_file_type(uploaded_file.content_type)
        message.attachments.create!(
          account: current_account,
          file_type: file_type,
          file: uploaded_file
        )
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
    params.require(:message).permit(:content, :content_type, :file)
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
      status: message.status,
      created_at: message.created_at,
      sender: message.sender&.class&.name == 'Contact' ? {
        type: 'contact',
        id: message.sender.id,
        name: message.sender.name
      } : nil,
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
