FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "Agent #{n}" }
    sequence(:email) { |n| "agent#{n}@test.com" }
    sequence(:ventia_user_id) { |n| n }
  end
end
