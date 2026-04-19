FactoryBot.define do
  factory :account do
    sequence(:name) { |n| "Test Account #{n}" }
    sequence(:ventia_tenant_id) { |n| n }
  end
end
