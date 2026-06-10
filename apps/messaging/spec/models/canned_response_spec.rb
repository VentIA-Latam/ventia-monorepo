require 'rails_helper'

RSpec.describe CannedResponse, type: :model do
  # Random tenant id to avoid colliding with persisted/seeded accounts (sequence starts low).
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }

  describe 'validations' do
    it 'requires a short_code' do
      cr = account.canned_responses.build(short_code: nil, content: 'hola')
      expect(cr).not_to be_valid
      expect(cr.errors[:short_code]).to be_present
    end

    it 'requires content' do
      cr = account.canned_responses.build(short_code: 'saludo', content: nil)
      expect(cr).not_to be_valid
      expect(cr.errors[:content]).to be_present
    end

    it 'enforces unique short_code per account' do
      account.canned_responses.create!(short_code: 'saludo', content: 'hola')
      dup = account.canned_responses.build(short_code: 'saludo', content: 'otra')
      expect(dup).not_to be_valid
      expect(dup.errors[:short_code]).to be_present
    end

    it 'allows the same short_code in a different account' do
      account.canned_responses.create!(short_code: 'saludo', content: 'hola')
      other = create(:account, ventia_tenant_id: rand(100_000..999_999))
      cr = other.canned_responses.build(short_code: 'saludo', content: 'hola')
      expect(cr).to be_valid
    end
  end

  describe 'actions validation' do
    it 'defaults to an empty array' do
      cr = account.canned_responses.create!(short_code: 'saludo', content: 'hola')
      expect(cr.actions).to eq([])
    end

    it 'accepts whitelisted actions with params' do
      cr = account.canned_responses.build(
        short_code: 'esc', content: 'hola',
        actions: [{ 'action_name' => 'add_label', 'action_params' => { 'labels' => [1] } }]
      )
      expect(cr).to be_valid
    end

    it 'rejects an action name outside the whitelist' do
      cr = account.canned_responses.build(
        short_code: 'esc', content: 'hola',
        actions: [{ 'action_name' => 'drop_table' }]
      )
      expect(cr).not_to be_valid
      expect(cr.errors[:actions]).to be_present
    end

    it 'rejects actions that are not an array' do
      cr = account.canned_responses.build(short_code: 'esc', content: 'hola', actions: 'nope')
      expect(cr).not_to be_valid
      expect(cr.errors[:actions]).to be_present
    end

    it 'rejects malformed action entries (missing action_name)' do
      cr = account.canned_responses.build(short_code: 'esc', content: 'hola', actions: [{ 'foo' => 'bar' }])
      expect(cr).not_to be_valid
      expect(cr.errors[:actions]).to be_present
    end
  end

  describe '.search' do
    before do
      account.canned_responses.create!(short_code: 'saludo', content: 'Hola, ¿en qué te ayudo?')
      account.canned_responses.create!(short_code: 'despedida', content: 'Saludos, hasta luego')
    end

    it 'returns all records when the term is blank' do
      expect(account.canned_responses.search(nil).count).to eq(2)
    end

    it 'matches on short_code and content' do
      results = account.canned_responses.search('salu')
      expect(results.map(&:short_code)).to contain_exactly('saludo', 'despedida')
    end

    it 'prioritises short_code prefix matches first' do
      results = account.canned_responses.search('salu')
      expect(results.first.short_code).to eq('saludo')
    end

    it 'is safe against SQL injection in the search term' do
      malicious = "x'; DROP TABLE messaging.canned_responses; --"
      expect { account.canned_responses.search(malicious).to_a }.not_to raise_error
      expect(CannedResponse.table_exists?).to be true
    end
  end
end
