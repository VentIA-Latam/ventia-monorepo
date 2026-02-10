class Api::V1::InboxesController < Api::V1::BaseController
  before_action :set_inbox, only: [:show, :update, :destroy]

  def index
    inboxes = current_account.inboxes.order_by_name
    render_success(inboxes)
  end

  def show
    render_success(@inbox)
  end

  def create
    inbox = current_account.inboxes.new(inbox_params)

    if inbox.save
      render_success(inbox, message: 'Inbox created successfully', status: :created)
    else
      render_error('Failed to create inbox', errors: inbox.errors.full_messages)
    end
  end

  def update
    if @inbox.update(inbox_params)
      render_success(@inbox, message: 'Inbox updated successfully')
    else
      render_error('Failed to update inbox', errors: @inbox.errors.full_messages)
    end
  end

  def destroy
    @inbox.destroy
    render_success(nil, message: 'Inbox deleted successfully')
  end

  private

  def set_inbox
    @inbox = current_account.inboxes.find(params[:id])
  end

  def inbox_params
    params.require(:inbox).permit(
      :name,
      :greeting_enabled,
      :greeting_message,
      :enable_auto_assignment,
      :allow_messages_after_resolved,
      :working_hours_enabled,
      :out_of_office_message,
      :timezone
    )
  end
end
