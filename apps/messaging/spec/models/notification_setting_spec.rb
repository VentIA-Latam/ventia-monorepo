require 'rails_helper'

RSpec.describe NotificationSetting, type: :model do
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user) { create(:user, ventia_user_id: rand(100_000..999_999)) }

  describe 'defaults' do
    it 'DEFAULT_PUSH_FLAGS is message_ai_off only (4)' do
      expect(NotificationSetting::DEFAULT_PUSH_FLAGS).to eq(4)
    end

    it 'DEFAULT_EMAIL_FLAGS is human_support + payment_review (3)' do
      expect(NotificationSetting::DEFAULT_EMAIL_FLAGS).to eq(3)
    end
  end

  describe '.create_default_for' do
    it 'creates with correct defaults' do
      setting = NotificationSetting.create_default_for(user: user, account: account)

      expect(setting.push_flags).to eq(4)
      expect(setting.email_flags).to eq(3)
    end
  end

  describe '#email_enabled?' do
    let(:setting) { NotificationSetting.create!(user: user, account: account, email_flags: 3, push_flags: 4) }

    it 'returns true for human_support when enabled' do
      expect(setting.email_enabled?(:human_support)).to be true
    end

    it 'returns true for payment_review when enabled' do
      expect(setting.email_enabled?(:payment_review)).to be true
    end

    it 'returns false for message_ai_off (not an email flag)' do
      expect(setting.email_enabled?(:message_ai_off)).to be false
    end
  end

  describe '#push_enabled?' do
    let(:setting) { NotificationSetting.create!(user: user, account: account, email_flags: 3, push_flags: 4) }

    it 'returns false for human_support (moved to email)' do
      expect(setting.push_enabled?(:human_support)).to be false
    end

    it 'returns true for message_ai_off' do
      expect(setting.push_enabled?(:message_ai_off)).to be true
    end
  end

  describe '#email_flags_hash' do
    let(:setting) { NotificationSetting.create!(user: user, account: account, email_flags: 3, push_flags: 4) }

    it 'returns correct hash' do
      expect(setting.email_flags_hash).to eq({
        human_support: true,
        payment_review: true,
        message_ai_off: false,
        message_ai_on: false
      })
    end
  end

  describe '#push_flags_hash' do
    let(:setting) { NotificationSetting.create!(user: user, account: account, email_flags: 3, push_flags: 4) }

    it 'returns correct hash' do
      expect(setting.push_flags_hash).to eq({
        human_support: false,
        payment_review: false,
        message_ai_off: true,
        message_ai_on: false
      })
    end
  end
end
