FactoryBot.define do
  factory :contact_inbox do
    association :contact
    association :inbox
    sequence(:source_id) { |n| "source_#{n}" }
  end
end
