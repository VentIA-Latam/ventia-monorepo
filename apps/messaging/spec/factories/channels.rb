FactoryBot.define do
  factory :channel_whatsapp, class: 'Channel::Whatsapp' do
    association :account
    sequence(:phone_number) { |n| "+5191000000#{n}" }
    provider { 'whatsapp_cloud' }
    provider_config do
      {
        'api_key' => 'test_key',
        'phone_number_id' => '123456789',
        'business_account_id' => '123456789',
        'webhook_verify_token' => SecureRandom.hex(16),
        'source' => 'embedded_signup'
      }
    end

    before(:create) do |channel|
      channel.define_singleton_method(:validate_provider_config) { nil }
      channel.define_singleton_method(:sync_templates) { nil }
      channel.define_singleton_method(:setup_webhooks) { nil }
    end
  end

  factory :channel_instagram, class: 'Channel::Instagram' do
    association :account
    sequence(:instagram_id) { |n| "1784142556998070#{n}" }
    access_token { 'test_ig_access_token' }
    provider_config { {} }
  end
end
