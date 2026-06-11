FactoryBot.define do
  factory :note do
    association :account
    association :contact
    association :user
    sequence(:content) { |n| "Note content #{n}" }
  end
end
