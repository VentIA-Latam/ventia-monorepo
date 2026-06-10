require 'rails_helper'

RSpec.describe Contact, type: :model do
  let(:account) { create(:account) }

  describe 'birthdate validation' do
    it 'is valid with a past birthdate' do
      contact = build(:contact, account: account, birthdate: Date.new(1995, 3, 12))
      expect(contact).to be_valid
    end

    it 'is valid when birthdate is today' do
      contact = build(:contact, account: account, birthdate: Date.current)
      expect(contact).to be_valid
    end

    it 'is valid when birthdate is nil' do
      contact = build(:contact, account: account, birthdate: nil)
      expect(contact).to be_valid
    end

    it 'rejects a future birthdate' do
      contact = build(:contact, account: account, birthdate: Date.current + 1)
      expect(contact).not_to be_valid
      expect(contact.errors[:birthdate]).to include('cannot be in the future')
    end

    it 'stores birthdate as Date (no time component)' do
      contact = create(:contact, account: account, birthdate: Date.new(1995, 3, 12))
      expect(contact.reload.birthdate).to be_a(Date)
      expect(contact.birthdate).to eq(Date.new(1995, 3, 12))
    end
  end
end
