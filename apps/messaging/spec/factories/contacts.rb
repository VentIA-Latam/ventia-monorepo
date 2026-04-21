FactoryBot.define do
  factory :contact do
    association :account
    sequence(:name) { |n| "Contact #{n}" }
    sequence(:phone_number) { |n| "+5199000000#{n}" }
    sequence(:email) { |n| "contact#{n}@test.com" }
  end
end
