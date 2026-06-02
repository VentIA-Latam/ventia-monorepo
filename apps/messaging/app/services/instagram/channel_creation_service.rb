# Creates a Channel::Instagram + Inbox from a completed OAuth exchange and
# subscribes the account to messaging webhooks.
class Instagram::ChannelCreationService
  def initialize(account, oauth_result)
    @account = account
    @oauth_result = oauth_result
  end

  def perform
    validate_parameters!

    existing = Channel::Instagram.find_by(instagram_id: @oauth_result[:instagram_id])
    raise "Instagram account @#{@oauth_result[:username]} is already connected" if existing

    channel = create_channel_with_inbox
    Instagram::WebhookSubscriptionService.new(channel).perform
    channel
  end

  private

  def validate_parameters!
    raise ArgumentError, 'Account is required' if @account.blank?
    raise ArgumentError, 'Instagram ID is required' if @oauth_result[:instagram_id].blank?
    raise ArgumentError, 'Access token is required' if @oauth_result[:access_token].blank?
  end

  def create_channel_with_inbox
    ActiveRecord::Base.transaction do
      channel = Channel::Instagram.create!(
        account: @account,
        instagram_id: @oauth_result[:instagram_id],
        username: @oauth_result[:username],
        access_token: @oauth_result[:access_token],
        token_expires_at: @oauth_result[:token_expires_at],
        provider_config: {
          'profile_picture_url' => @oauth_result.dig(:profile, 'profile_picture_url')
        }.compact
      )

      Inbox.create!(
        account: @account,
        name: inbox_name,
        channel: channel
      )

      channel
    end
  end

  def inbox_name
    handle = @oauth_result[:username].presence || @oauth_result[:instagram_id]
    "#{handle} Instagram"
  end
end
