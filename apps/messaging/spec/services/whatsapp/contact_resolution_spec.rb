require 'rails_helper'

RSpec.describe Whatsapp::ContactResolution do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_whatsapp, account: account) }
  let(:inbox)   { create(:inbox, account: account, channel: channel) }

  # The module is mixed into services that expose `@inbox`. Build a minimal host.
  let(:host_class) do
    Class.new do
      include Whatsapp::ContactResolution
      attr_accessor :inbox

      def initialize(inbox)
        @inbox = inbox
      end
    end
  end
  let(:host) { host_class.new(inbox) }

  describe '#find_or_create_contact' do
    context 'when phone and bsuid are both blank' do
      it 'raises ArgumentError (Bug A)' do
        expect { host.find_or_create_contact(nil, nil, {}) }
          .to raise_error(ArgumentError, /phone and bsuid both blank/)
      end

      it 'treats empty strings as blank' do
        expect { host.find_or_create_contact('', '', {}) }
          .to raise_error(ArgumentError)
      end
    end

    context 'with only bsuid (no phone)' do
      let(:bsuid) { 'PE.1A2B3C4D5E6F7G8H' }

      it 'creates a contact with nil phone_number and bsuid as name fallback' do
        contact = host.find_or_create_contact(nil, bsuid, {})
        expect(contact.phone_number).to be_nil
        expect(contact.name).to eq(bsuid)
      end

      it 'prefers profile.name over bsuid when present' do
        contact = host.find_or_create_contact(nil, bsuid, { 'profile' => { 'name' => 'Sheena' } })
        expect(contact.name).to eq('Sheena')
      end
    end

    context 'with only phone' do
      it 'creates contact with phone_number "+phone"' do
        contact = host.find_or_create_contact('51999111222', nil, {})
        expect(contact.phone_number).to eq('+51999111222')
      end

      it 'returns existing contact matched by phone' do
        existing = create(:contact, account: account, phone_number: '+51999111222')
        contact = host.find_or_create_contact('51999111222', nil, {})
        expect(contact.id).to eq(existing.id)
      end
    end

    context 'when bsuid matches an existing contact_inbox' do
      let(:bsuid) { 'PE.STABLEBSUID' }
      let!(:existing_contact) { create(:contact, account: account, phone_number: nil) }
      let!(:existing_ci) do
        create(:contact_inbox, contact: existing_contact, inbox: inbox,
                               source_id: bsuid, whatsapp_bsuid: bsuid)
      end

      it 'returns the existing contact (bsuid wins over phone)' do
        contact = host.find_or_create_contact(nil, bsuid, {})
        expect(contact.id).to eq(existing_contact.id)
      end

      it 'enriches phone_number when later webhook brings it' do
        contact = host.find_or_create_contact('51999111222', bsuid, {})
        expect(contact.id).to eq(existing_contact.id)
        expect(contact.reload.phone_number).to eq('+51999111222')
      end

      it 'does not overwrite existing phone_number' do
        existing_contact.update!(phone_number: '+51999000000')
        contact = host.find_or_create_contact('51999111222', bsuid, {})
        expect(contact.reload.phone_number).to eq('+51999000000')
      end
    end

    it 'never creates a contact with phone_number "+" (Bug A regression)' do
      expect { host.find_or_create_contact(nil, nil, {}) }.to raise_error(ArgumentError)
      expect(Contact.where(account: account, phone_number: '+').count).to eq(0)
    end
  end

  describe '#find_or_create_contact_inbox' do
    let(:contact) { create(:contact, account: account) }

    context 'when phone and bsuid are both blank' do
      it 'returns nil (Bug A guard)' do
        expect(host.find_or_create_contact_inbox(contact, nil, nil)).to be_nil
      end
    end

    context 'when a contact_inbox already exists for the bsuid' do
      let(:bsuid) { 'PE.EXISTING' }
      let!(:other_contact) { create(:contact, account: account) }
      let!(:existing_ci) do
        create(:contact_inbox, contact: other_contact, inbox: inbox,
                               source_id: bsuid, whatsapp_bsuid: bsuid)
      end

      it 'returns the existing CI by bsuid' do
        ci = host.find_or_create_contact_inbox(contact, '51999', bsuid)
        expect(ci.id).to eq(existing_ci.id)
      end
    end

    context 'Bug C — reconciling a legacy CI when bsuid arrives later' do
      let(:bsuid) { 'PE.NEWLYRECEIVED' }
      let!(:legacy_ci) do
        create(:contact_inbox, contact: contact, inbox: inbox,
                               source_id: '51999111222', whatsapp_bsuid: nil)
      end

      it 'enriches the legacy CI with bsuid instead of creating a duplicate' do
        expect do
          host.find_or_create_contact_inbox(contact, '51999111222', bsuid)
        end.not_to change { ContactInbox.where(contact: contact, inbox: inbox).count }

        expect(legacy_ci.reload.whatsapp_bsuid).to eq(bsuid)
      end

      it 'returns the legacy CI after enriching it' do
        ci = host.find_or_create_contact_inbox(contact, '51999111222', bsuid)
        expect(ci.id).to eq(legacy_ci.id)
      end

      it 'does not overwrite an already-set bsuid' do
        legacy_ci.update!(whatsapp_bsuid: 'PE.ORIGINAL')
        host.find_or_create_contact_inbox(contact, '51999111222', bsuid)
        expect(legacy_ci.reload.whatsapp_bsuid).to eq('PE.ORIGINAL')
      end
    end

    context 'when neither bsuid match nor legacy CI exist' do
      it 'creates a new CI with bsuid' do
        bsuid = 'PE.FRESH'
        ci = host.find_or_create_contact_inbox(contact, '51999000000', bsuid)
        expect(ci.source_id).to eq(bsuid)
        expect(ci.whatsapp_bsuid).to eq(bsuid)
      end

      it 'creates a new CI with phone-only source_id when bsuid is absent' do
        ci = host.find_or_create_contact_inbox(contact, '51999000000', nil)
        expect(ci.source_id).to eq('51999000000')
        expect(ci.whatsapp_bsuid).to be_nil
      end
    end

    context 'when a race condition causes RecordNotUnique on create' do
      let(:bsuid) { 'PE.RACED' }
      let!(:winner_contact) { create(:contact, account: account) }
      let!(:winner_ci) do
        create(:contact_inbox, contact: winner_contact, inbox: inbox,
                               source_id: bsuid, whatsapp_bsuid: bsuid)
      end

      it 'falls back to find_by(bsuid) and returns the winning row' do
        # Simulate two workers: this one tries to create, the other already did.
        # Force create! to raise so the rescue path runs.
        allow(ContactInbox).to receive(:create!).and_raise(ActiveRecord::RecordNotUnique.new('dup'))

        ci = host.find_or_create_contact_inbox(create(:contact, account: account), nil, bsuid)
        expect(ci.id).to eq(winner_ci.id)
      end

      it 'falls back to find_by(source_id) when bsuid lookup also misses' do
        # Mismatch: race was on source_id (legacy phone), not bsuid.
        legacy = create(:contact_inbox, contact: winner_contact, inbox: inbox,
                                        source_id: '51999777888', whatsapp_bsuid: nil)
        allow(ContactInbox).to receive(:create!).and_raise(ActiveRecord::RecordNotUnique.new('dup'))

        # No existing CI for the (contact, inbox) being processed → forces create! path
        new_contact = create(:contact, account: account)
        ci = host.find_or_create_contact_inbox(new_contact, '51999777888', nil)
        expect(ci&.id).to eq(legacy.id)
      end
    end
  end
end
