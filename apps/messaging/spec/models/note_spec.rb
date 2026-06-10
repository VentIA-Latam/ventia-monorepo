require 'rails_helper'

RSpec.describe Note, type: :model do
  let(:account) { create(:account) }
  let(:contact) { create(:contact, account: account) }
  let(:user)    { create(:user) }

  describe 'validations' do
    it 'is valid with content, account, contact, user' do
      note = described_class.new(account: account, contact: contact, user: user, content: 'Cliente VIP')
      expect(note).to be_valid
    end

    it 'is valid without user (user_id nullable)' do
      note = described_class.new(account: account, contact: contact, user: nil, content: 'Sistema')
      expect(note).to be_valid
    end

    it 'rejects blank content' do
      note = described_class.new(account: account, contact: contact, user: user, content: '')
      expect(note).not_to be_valid
      expect(note.errors[:content]).to include("can't be blank")
    end

    it 'rejects content longer than CONTENT_MAX_LENGTH' do
      note = described_class.new(account: account, contact: contact, user: user, content: 'x' * (Note::CONTENT_MAX_LENGTH + 1))
      expect(note).not_to be_valid
      expect(note.errors[:content]).to be_present
    end

    it 'requires account' do
      note = described_class.new(account: nil, contact: contact, user: user, content: 'x')
      expect(note).not_to be_valid
    end

    it 'requires contact' do
      note = described_class.new(account: account, contact: nil, user: user, content: 'x')
      expect(note).not_to be_valid
    end
  end

  describe 'scope :recent_first' do
    it 'orders notes by created_at desc' do
      old_note = described_class.create!(account: account, contact: contact, user: user, content: 'old', created_at: 2.days.ago)
      new_note = described_class.create!(account: account, contact: contact, user: user, content: 'new', created_at: 1.minute.ago)
      expect(described_class.recent_first.to_a).to eq([new_note, old_note])
    end
  end

  describe 'associations' do
    it 'destroys notes when contact is destroyed' do
      described_class.create!(account: account, contact: contact, user: user, content: 'note')
      expect { contact.destroy }.to change(described_class, :count).by(-1)
    end

    it 'nullifies user_id when user is destroyed (note persists)' do
      note = described_class.create!(account: account, contact: contact, user: user, content: 'note')
      user.destroy
      note.reload
      expect(note.user_id).to be_nil
      expect(note).to be_persisted
    end
  end
end
