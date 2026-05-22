require 'rails_helper'

# Lightweight specs covering the Bug C ordering logic in Campaigns::TriggerService.
# Full end-to-end perform specs would require campaign factory + outbound stubbing;
# here we exercise only the query that decides which CI wins.
RSpec.describe Campaigns::TriggerService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_whatsapp, account: account) }
  let(:inbox)   { create(:inbox, account: account, channel: channel) }
  let(:contact) { create(:contact, account: account) }

  describe 'preferred contact_inbox lookup (Bug C ordering)' do
    let!(:legacy_ci) do
      create(:contact_inbox, contact: contact, inbox: inbox,
                             source_id: '51999000000', whatsapp_bsuid: nil,
                             created_at: 2.days.ago)
    end
    let!(:bsuid_ci) do
      create(:contact_inbox, contact: contact, inbox: inbox,
                             source_id: 'PE.NEWBSUID', whatsapp_bsuid: 'PE.NEWBSUID',
                             created_at: 1.day.ago)
    end

    it 'returns the CI with bsuid first even if a legacy CI is older' do
      result = ContactInbox
                 .where(contact: contact, inbox: inbox)
                 .order(Arel.sql('whatsapp_bsuid IS NULL ASC'))
                 .first
      expect(result.id).to eq(bsuid_ci.id)
    end
  end

  describe '#reachable_contacts' do
    let(:campaign) { Campaign.new(account: account, inbox: inbox, message: 'hi') }
    let(:service)  { described_class.new(campaign: campaign) }

    context 'contact with phone only' do
      let!(:contact_phone) do
        create(:contact, account: account, phone_number: '+51999111111')
      end

      it 'is included via the phone branch' do
        expect(service.send(:reachable_contacts)).to include(contact_phone)
      end
    end

    context 'contact with bsuid-only CI (no phone)' do
      let!(:contact_bsuid) { create(:contact, account: account, phone_number: nil) }
      let!(:ci) do
        create(:contact_inbox, contact: contact_bsuid, inbox: inbox,
                               source_id: 'PE.X', whatsapp_bsuid: 'PE.X')
      end

      it 'is included via the bsuid branch' do
        expect(service.send(:reachable_contacts)).to include(contact_bsuid)
      end
    end

    context 'contact with neither phone nor bsuid CI' do
      let!(:contact_empty) { create(:contact, account: account, phone_number: nil) }

      it 'is excluded' do
        expect(service.send(:reachable_contacts)).not_to include(contact_empty)
      end
    end
  end
end
