require 'rails_helper'

RSpec.describe CampaignRecipient, type: :model do
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'Test', campaign_status: :draft) }

  def build_recipient(overrides = {})
    described_class.new({ campaign: campaign, phone: '+51999888777' }.merge(overrides))
  end

  describe 'validations' do
    it 'is valid with phone E.164 + campaign' do
      expect(build_recipient).to be_valid
    end

    it 'rejects phone sin +' do
      expect(build_recipient(phone: '999888777')).not_to be_valid
    end

    it 'rejects phone con 0 después de +' do
      expect(build_recipient(phone: '+0999888777')).not_to be_valid
    end

    it 'enforces unique phone per campaign' do
      build_recipient.save!
      duplicate = build_recipient
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:phone]).to include('has already been taken')
    end

    it 'allows same phone across different campaigns' do
      build_recipient.save!
      other_campaign = Campaign.create!(account: account, inbox: inbox, title: 'Other', campaign_status: :draft)
      other = described_class.new(campaign: other_campaign, phone: '+51999888777')
      expect(other).to be_valid
    end
  end

  describe 'status enum' do
    it 'defaults to :pending' do
      recipient = build_recipient
      expect(recipient.status).to eq('pending')
    end

    it 'accepts all defined statuses' do
      %w[pending queued sent delivered read failed omitted].each do |status|
        recipient = build_recipient(status: status)
        expect(recipient).to be_valid
      end
    end
  end

  describe 'scopes' do
    let!(:pending)   { build_recipient(phone: '+51900000001', status: :pending).tap(&:save!) }
    let!(:queued)    { build_recipient(phone: '+51900000002', status: :queued).tap(&:save!) }
    let!(:sent)      { build_recipient(phone: '+51900000003', status: :sent).tap(&:save!) }
    let!(:delivered) { build_recipient(phone: '+51900000004', status: :delivered).tap(&:save!) }
    let!(:failed)    { build_recipient(phone: '+51900000005', status: :failed).tap(&:save!) }
    let!(:omitted)   { build_recipient(phone: '+51900000006', status: :omitted).tap(&:save!) }

    it 'terminal includes sent/delivered/read/failed/omitted' do
      expect(described_class.terminal).to contain_exactly(sent, delivered, failed, omitted)
    end

    it 'pending_or_queued excludes terminal states' do
      expect(described_class.pending_or_queued).to contain_exactly(pending, queued)
    end
  end
end
