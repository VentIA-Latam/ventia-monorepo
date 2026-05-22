FactoryBot.define do
  factory :contact_inbox do
    association :contact
    association :inbox
    sequence(:source_id) { |n| "source_#{n}" }

    trait :with_bsuid do
      whatsapp_bsuid { "PE.#{SecureRandom.hex(8).upcase}" }
    end
  end
end
