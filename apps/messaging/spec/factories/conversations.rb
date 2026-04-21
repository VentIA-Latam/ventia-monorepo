FactoryBot.define do
  factory :conversation do
    association :account
    association :contact
    inbox { association :inbox, account: account }
    contact_inbox { association :contact_inbox, contact: contact, inbox: inbox }
    status { :open }
    uuid { SecureRandom.uuid }
    last_activity_at { Time.current }
  end
end
