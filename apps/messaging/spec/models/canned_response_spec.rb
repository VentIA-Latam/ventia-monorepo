require 'rails_helper'

RSpec.describe CannedResponse, type: :model do
  let(:account) { create(:account) }

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
      other = create(:account)
      cr = other.canned_responses.build(short_code: 'saludo', content: 'hola')
      expect(cr).to be_valid
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
