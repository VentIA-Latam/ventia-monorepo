require 'rails_helper'

RSpec.describe Campaigns::TriggerJob do
  include ActiveJob::TestHelper

  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'T', campaign_status: :active, enabled: true) }

  before { ActiveJob::Base.queue_adapter = :test }

  describe '#perform' do
    it 'transiciona campaña :active → :running y setea triggered_at' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
      described_class.perform_now(campaign.id)
      campaign.reload
      expect(campaign.campaign_status).to eq('running')
      expect(campaign.triggered_at).not_to be_nil
    end

    it 'pasa todos los recipients :pending → :queued y encola SendRecipientJob' do
      r1 = campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
      r2 = campaign.campaign_recipients.create!(phone: '+51900000002', status: :pending)

      expect { described_class.perform_now(campaign.id) }
        .to have_enqueued_job(Campaigns::SendRecipientJob).with(r1.id)
        .and have_enqueued_job(Campaigns::SendRecipientJob).with(r2.id)

      expect(r1.reload.status).to eq('queued')
      expect(r2.reload.status).to eq('queued')
    end

    it 'no afecta a recipients que ya están en otro estado' do
      r_pending = campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
      r_sent    = campaign.campaign_recipients.create!(phone: '+51900000002', status: :sent)

      described_class.perform_now(campaign.id)
      expect(r_pending.reload.status).to eq('queued')
      expect(r_sent.reload.status).to eq('sent')
    end

    it 'anti-doble-disparo: segundo run con triggered_at no-nil no hace nada' do
      campaign.update!(triggered_at: 1.minute.ago)
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)

      expect { described_class.perform_now(campaign.id) }
        .not_to have_enqueued_job(Campaigns::SendRecipientJob)
    end

    it 'campaign inexistente: no raisea' do
      expect { described_class.perform_now(999_999) }.not_to raise_error
    end

    it 'crash interno: marca campaign :failed y re-raisea' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
      allow_any_instance_of(CampaignRecipient).to receive(:update!).and_raise(StandardError, 'boom')

      expect { described_class.perform_now(campaign.id) }.to raise_error(StandardError, 'boom')
      expect(campaign.reload.campaign_status).to eq('failed')
    end
  end
end
