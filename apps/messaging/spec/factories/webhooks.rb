FactoryBot.define do
  factory :webhook do
    account
    sequence(:url) { |n| "https://example.com/webhook-#{n}" }
    subscriptions { ['message_created'] }
  end
end
