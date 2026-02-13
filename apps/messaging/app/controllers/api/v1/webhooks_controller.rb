class Api::V1::WebhooksController < Api::V1::BaseController
  before_action :set_webhook, only: [:show, :update, :destroy]

  def index
    webhooks = current_account.webhooks
    render_success(webhooks.map(&:webhook_data))
  end

  def show
    render_success(@webhook.webhook_data)
  end

  def create
    webhook = current_account.webhooks.new(webhook_params)
    if webhook.save
      render_success(webhook.webhook_data, message: 'Webhook created', status: :created)
    else
      render_error('Failed to create webhook', errors: webhook.errors.full_messages)
    end
  end

  def update
    if @webhook.update(webhook_params)
      render_success(@webhook.webhook_data, message: 'Webhook updated')
    else
      render_error('Failed to update webhook', errors: @webhook.errors.full_messages)
    end
  end

  def destroy
    @webhook.destroy!
    head :no_content
  end

  private

  def set_webhook
    @webhook = current_account.webhooks.find(params[:id])
  end

  def webhook_params
    params.require(:webhook).permit(:url, subscriptions: [])
  end
end
