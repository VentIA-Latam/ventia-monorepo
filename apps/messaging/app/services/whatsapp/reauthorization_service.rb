class Whatsapp::ReauthorizationService
  def initialize(account:, inbox_id:, phone_number_id:, business_id:)
    @account = account
    @inbox_id = inbox_id
    @phone_number_id = phone_number_id
    @business_id = business_id
  end

  def perform(access_token, phone_info)
    inbox = @account.inboxes.find(@inbox_id)
    channel = inbox.channel

    if phone_info[:phone_number] != channel.phone_number
      raise StandardError, "Phone number mismatch. Expected #{channel.phone_number}, got #{phone_info[:phone_number]}"
    end

    update_channel_config(channel, access_token, phone_info)
    channel.reauthorized! if channel.respond_to?(:reauthorized!)

    channel
  end

  private

  def update_channel_config(channel, access_token, phone_info)
    current_config = channel.provider_config || {}
    channel.provider_config = current_config.merge(
      'api_key' => access_token,
      'phone_number_id' => @phone_number_id,
      'business_account_id' => @business_id,
      'source' => 'embedded_signup'
    )
    channel.save!

    business_name = phone_info[:business_name] || phone_info[:verified_name]
    channel.inbox.update!(name: business_name) if business_name.present?
  end
end
