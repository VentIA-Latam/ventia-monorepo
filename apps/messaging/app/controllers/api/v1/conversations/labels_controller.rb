class Api::V1::Conversations::LabelsController < Api::V1::BaseController
  before_action :set_conversation

  def index
    labels = @conversation.labels
    render_success(labels.map { |l| label_json(l) })
  end

  def create
    label = current_account.labels.find(params[:label_id])
    conversation_label = @conversation.conversation_labels.new(label: label)

    if conversation_label.save
      render_success(label_json(label), message: 'Label added', status: :created)
    else
      render_error('Failed to add label', errors: conversation_label.errors.full_messages)
    end
  end

  def destroy
    conversation_label = @conversation.conversation_labels.find_by!(label_id: params[:id])
    conversation_label.destroy!
    render_success(nil, message: 'Label removed')
  end

  private

  def set_conversation
    @conversation = current_account.conversations.find(params[:conversation_id])
  end

  def label_json(label)
    {
      id: label.id,
      title: label.title,
      color: label.color
    }
  end
end
