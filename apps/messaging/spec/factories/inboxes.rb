FactoryBot.define do
  factory :inbox do
    association :account
    sequence(:name) { |n| "Inbox #{n}" }

    transient do
      channel { nil }
    end

    after(:build) do |inbox, evaluator|
      channel = evaluator.channel || create(:channel_whatsapp, account: inbox.account)
      inbox.channel = channel
    end
  end
end
