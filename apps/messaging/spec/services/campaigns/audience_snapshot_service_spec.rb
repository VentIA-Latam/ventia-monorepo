require 'rails_helper'

RSpec.describe Campaigns::AudienceSnapshotService do
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) { Campaign.create!(account: account, inbox: inbox, title: 'T', campaign_status: :draft) }

  let(:label_a) { create(:label, account: account, title: 'pendiente') }
  let(:label_b) { create(:label, account: account, title: 'urgente') }

  # Contacts y conversations linkeadas
  let!(:contact_a) { create(:contact, account: account, phone_number: '+51900000001') }
  let!(:contact_b) { create(:contact, account: account, phone_number: '+51900000002') }
  let!(:contact_no_phone) { create(:contact, account: account, phone_number: nil) }

  before do
    # contact_a tiene conversation con label_a
    conv_a = create(:conversation, account: account, inbox: inbox, contact: contact_a)
    conv_a.conversation_labels.create!(label: label_a)

    # contact_b tiene conversation con label_b
    conv_b = create(:conversation, account: account, inbox: inbox, contact: contact_b)
    conv_b.conversation_labels.create!(label: label_b)

    # contact_no_phone tiene conversation con label_a pero sin phone
    conv_np = create(:conversation, account: account, inbox: inbox, contact: contact_no_phone)
    conv_np.conversation_labels.create!(label: label_a)
  end

  describe '#perform' do
    it 'crea recipients para contactos con label A (excluye sin phone)' do
      count = described_class.new(campaign: campaign, label_ids: [label_a.id]).perform
      expect(count).to eq(1)
      expect(campaign.campaign_recipients.first.contact_id).to eq(contact_a.id)
    end

    it 'incluye múltiples labels (union)' do
      count = described_class.new(campaign: campaign, label_ids: [label_a.id, label_b.id]).perform
      expect(count).to eq(2)
    end

    it 'es idempotente: re-llamar borra y rehace' do
      described_class.new(campaign: campaign, label_ids: [label_a.id]).perform
      old_ids = campaign.campaign_recipients.pluck(:id)

      described_class.new(campaign: campaign, label_ids: [label_a.id, label_b.id]).perform
      new_ids = campaign.campaign_recipients.pluck(:id)

      expect(new_ids & old_ids).to be_empty
      expect(new_ids.size).to eq(2)
    end

    it 'setea audience_type :labels y recipients_count' do
      described_class.new(campaign: campaign, label_ids: [label_a.id]).perform
      campaign.reload
      expect(campaign.audience_type).to eq('labels')
      expect(campaign.recipients_count).to eq(1)
    end

    it 'persiste audience como [{id, type:Label}, ...] (formato Chatwoot)' do
      described_class.new(campaign: campaign, label_ids: [label_a.id, label_b.id]).perform
      campaign.reload
      expect(campaign.audience).to contain_exactly(
        { 'id' => label_a.id, 'type' => 'Label' },
        { 'id' => label_b.id, 'type' => 'Label' }
      )
    end

    it 'raisea cuando campaign no está en :draft' do
      campaign.update!(campaign_status: :active)
      expect { described_class.new(campaign: campaign, label_ids: [label_a.id]).perform }
        .to raise_error(described_class::CampaignNotDraftError)
    end

    it 'no duplica contactos que tienen múltiples conversations con el mismo label' do
      another_conv = create(:conversation, account: account, inbox: inbox, contact: contact_a)
      another_conv.conversation_labels.create!(label: label_a)

      count = described_class.new(campaign: campaign, label_ids: [label_a.id]).perform
      expect(count).to eq(1)
    end
  end
end
