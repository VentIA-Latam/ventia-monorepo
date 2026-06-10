require 'rails_helper'

RSpec.describe Campaigns::CompletionChecker do
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'T', campaign_status: :running) }

  describe '#maybe_complete!' do
    it 'marca campaign :completed cuando todos los recipients están en estado terminal' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :sent)
      campaign.campaign_recipients.create!(phone: '+51900000002', status: :delivered)
      campaign.campaign_recipients.create!(phone: '+51900000003', status: :omitted)

      described_class.new(campaign).maybe_complete!
      expect(campaign.reload.campaign_status).to eq('completed')
    end

    it 'no marca cuando hay recipients pending o queued' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :sent)
      campaign.campaign_recipients.create!(phone: '+51900000002', status: :queued)

      described_class.new(campaign).maybe_complete!
      expect(campaign.reload.campaign_status).to eq('running')
    end

    it 'es idempotente: invocar dos veces no hace nada la segunda' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :sent)

      described_class.new(campaign).maybe_complete!
      expect(campaign.reload.campaign_status).to eq('completed')

      # No debería tocar
      expect { described_class.new(campaign).maybe_complete! }.not_to change { campaign.reload.updated_at }
    end

    it 'broadcasts :campaign_completed' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :sent)

      listener = double('listener')
      campaign.subscribe(listener)
      expect(listener).to receive(:campaign_completed)
      described_class.new(campaign).maybe_complete!
    end

    it 'no broadcast cuando ya estaba :completed' do
      campaign.update!(campaign_status: :completed)
      listener = double('listener')
      campaign.subscribe(listener)
      expect(listener).not_to receive(:campaign_completed)
      described_class.new(campaign).maybe_complete!
    end

    it 'considera campaña sin recipients como completable' do
      described_class.new(campaign).maybe_complete!
      expect(campaign.reload.campaign_status).to eq('completed')
    end
  end
end
