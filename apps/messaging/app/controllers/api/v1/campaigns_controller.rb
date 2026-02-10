class Api::V1::CampaignsController < Api::V1::BaseController
  before_action :set_campaign, only: [:show, :update, :destroy, :trigger, :pause, :resume]

  def index
    campaigns = current_account.campaigns
                               .includes(:inbox)
                               .order(created_at: :desc)

    render_success(campaigns.map { |c| campaign_json(c) })
  end

  def show
    render_success(campaign_json(@campaign))
  end

  def create
    campaign = current_account.campaigns.new(campaign_params)

    if campaign.save
      render_success(campaign_json(campaign), message: 'Campaign created', status: :created)
    else
      render_error('Failed to create campaign', errors: campaign.errors.full_messages)
    end
  end

  def update
    if @campaign.update(campaign_params)
      render_success(campaign_json(@campaign), message: 'Campaign updated')
    else
      render_error('Failed to update campaign', errors: @campaign.errors.full_messages)
    end
  end

  def destroy
    @campaign.destroy
    render_success(nil, message: 'Campaign deleted')
  end

  def trigger
    if @campaign.can_trigger?
      @campaign.trigger!
      render_success(campaign_json(@campaign), message: 'Campaign triggered successfully')
    else
      render_error('Campaign cannot be triggered')
    end
  end

  def pause
    @campaign.pause!
    render_success(campaign_json(@campaign), message: 'Campaign paused')
  end

  def resume
    @campaign.resume!
    render_success(campaign_json(@campaign), message: 'Campaign resumed')
  end

  private

  def set_campaign
    @campaign = current_account.campaigns.find(params[:id])
  end

  def campaign_params
    params.require(:campaign).permit(
      :title,
      :message,
      :campaign_type,
      :enabled,
      :inbox_id,
      :scheduled_at,
      audience: []
    )
  end

  def campaign_json(campaign)
    {
      id: campaign.id,
      title: campaign.title,
      message: campaign.message,
      campaign_type: campaign.campaign_type,
      campaign_status: campaign.campaign_status,
      enabled: campaign.enabled,
      scheduled_at: campaign.scheduled_at,
      triggered_at: campaign.triggered_at,
      inbox: {
        id: campaign.inbox.id,
        name: campaign.inbox.name
      }
    }
  end
end
