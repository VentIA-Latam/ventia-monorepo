require 'rails_helper'

RSpec.describe Campaign, type: :model do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }
  let(:instagram_inbox) do
    create(:inbox, account: account, channel: create(:channel_instagram, account: account))
  end

  describe 'enum extensions' do
    it 'campaign_status incluye los 6 estados nuevos' do
      expect(Campaign.campaign_statuses).to eq(
        'active' => 0, 'completed' => 1, 'paused' => 2,
        'running' => 3, 'draft' => 4, 'failed' => 5
      )
    end

    it 'audience_type tiene labels y csv' do
      expect(Campaign.audience_types).to eq('labels' => 0, 'csv' => 1)
    end

    it 'default a :draft para nuevas campañas (post-migración)' do
      campaign = Campaign.create!(account: account, inbox: inbox, title: 'New')
      expect(campaign.campaign_status).to eq('draft')
    end
  end

  describe 'validations' do
    it 'rechaza inbox que no es WhatsApp' do
      campaign = Campaign.new(account: account, inbox: instagram_inbox, title: 'Test')
      expect(campaign).not_to be_valid
      expect(campaign.errors[:inbox]).to include('must be a WhatsApp inbox')
    end
  end

  describe 'scope triggerable' do
    let!(:due_active)     { Campaign.create!(account: account, inbox: inbox, title: 'due', campaign_status: :active, scheduled_at: 1.minute.ago, enabled: true) }
    let!(:future_active)  { Campaign.create!(account: account, inbox: inbox, title: 'future', campaign_status: :active, scheduled_at: 1.hour.from_now, enabled: true) }
    let!(:due_but_triggered) { Campaign.create!(account: account, inbox: inbox, title: 'done', campaign_status: :active, scheduled_at: 1.minute.ago, enabled: true, triggered_at: Time.current) }
    let!(:disabled)       { Campaign.create!(account: account, inbox: inbox, title: 'disabled', campaign_status: :active, scheduled_at: 1.minute.ago, enabled: false) }
    let!(:draft)          { Campaign.create!(account: account, inbox: inbox, title: 'draft', campaign_status: :draft, scheduled_at: 1.minute.ago, enabled: true) }

    it 'incluye solo campañas active+enabled+no_triggered+scheduled_at_passed' do
      expect(Campaign.triggerable).to contain_exactly(due_active)
    end
  end

  describe '#trigger!' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'Test', campaign_status: :active, enabled: true) }

    before { ActiveJob::Base.queue_adapter = :test }

    it 'encola Campaigns::TriggerJob cuando can_trigger?' do
      expect { campaign.trigger! }.to have_enqueued_job(Campaigns::TriggerJob).with(campaign.id)
    end

    it 'devuelve false y no encola si no can_trigger?' do
      campaign.update!(triggered_at: Time.current)
      expect { expect(campaign.trigger!).to eq(false) }.not_to have_enqueued_job(Campaigns::TriggerJob)
    end

    it 'broadcasts :campaign_triggered' do
      listener = double('listener')
      campaign.subscribe(listener)
      expect(listener).to receive(:campaign_triggered)
      campaign.trigger!
    end
  end

  describe '#can_trigger?' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'Test', campaign_status: :active, enabled: true) }

    it 'true cuando active+enabled+sin triggered_at' do
      expect(campaign.can_trigger?).to be true
    end

    it 'false cuando ya triggered' do
      campaign.update!(triggered_at: Time.current)
      expect(campaign.can_trigger?).to be false
    end

    it 'false cuando draft' do
      campaign.update!(campaign_status: :draft)
      expect(campaign.can_trigger?).to be false
    end

    it 'false cuando disabled' do
      campaign.update!(enabled: false)
      expect(campaign.can_trigger?).to be false
    end
  end

  describe '#all_recipients_terminal?' do
    let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'Test', campaign_status: :running) }

    it 'true cuando no quedan pending ni queued' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :sent)
      expect(campaign.all_recipients_terminal?).to be true
    end

    it 'false cuando alguno está pending o queued' do
      campaign.campaign_recipients.create!(phone: '+51900000001', status: :pending)
      campaign.campaign_recipients.create!(phone: '+51900000002', status: :sent)
      expect(campaign.all_recipients_terminal?).to be false
    end

    it 'true cuando no hay recipients' do
      expect(campaign.all_recipients_terminal?).to be true
    end
  end
end
