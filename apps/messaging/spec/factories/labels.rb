FactoryBot.define do
  factory :label do
    association :account
    sequence(:title) { |n| "label-#{n}" }
    color { '#1f93ff' }
  end
end
