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
    if channel_params.present?
      create_inbox_with_channel
    else
      inbox = current_account.inboxes.new(inbox_params)

      if inbox.save
        render_success(inbox, message: 'Inbox created successfully', status: :created)
      else
        render_error('Failed to create inbox', errors: inbox.errors.full_messages)
      end
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

  def create_inbox_with_channel
    ActiveRecord::Base.transaction do
      channel = build_channel
      inbox = current_account.inboxes.create!(
        name: params[:name].presence || "#{channel.phone_number} WhatsApp",
        channel: channel
      )
      render_success(inbox, message: 'Inbox created successfully', status: :created)
    end
  rescue ActiveRecord::RecordInvalid => e
    render_error('Failed to create inbox', errors: e.record.errors.full_messages)
  rescue ArgumentError => e
    render_error(e.message, status: :bad_request)
  end

  def build_channel
    case channel_params[:type]
    when 'whatsapp'
      current_account.whatsapp_channels.create!(
        phone_number: channel_params[:phone_number],
        provider: channel_params[:provider] || 'whatsapp_cloud',
        provider_config: channel_params[:provider_config]&.to_h || {}
      )
    else
      raise ArgumentError, "Unsupported channel type: #{channel_params[:type]}"
    end
  end

  def channel_params
    params[:channel]&.permit(:type, :phone_number, :provider, provider_config: {})
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
