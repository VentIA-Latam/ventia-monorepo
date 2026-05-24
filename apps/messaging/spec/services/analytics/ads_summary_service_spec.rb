require 'rails_helper'

RSpec.describe Analytics::AdsSummaryService do
  let(:account) { create(:account) }
  let(:inbox) { create(:inbox, account: account) }
  let(:start_date) { 7.days.ago }
  let(:end_date) { Time.current }

  def build_referral(source_id, headline: 'Test ad', image_url: 'https://img.test/x.png',
                    source_url: 'https://fb.me/x')
    {
      'referral' => {
        'source_id' => source_id,
        'headline' => headline,
        'image_url' => image_url,
        'source_url' => source_url,
        'source_type' => 'ad',
        'media_type' => 'image'
      }
    }
  end

  def create_message(conversation:, content_attributes: {}, created_at: 1.day.ago)
    Message.create!(
      account: account,
      inbox: inbox,
      conversation: conversation,
      content: 'Hola',
      message_type: :incoming,
      content_type: :text,
      content_attributes: content_attributes,
      created_at: created_at
    )
  end

  describe '#perform' do
    it 'aggregates conversations by ad_id with started and converted counts' do
      conv1 = create(:conversation, account: account, inbox: inbox)
      conv2 = create(:conversation, account: account, inbox: inbox)
      conv3 = create(:conversation, account: account, inbox: inbox)

      create_message(conversation: conv1, content_attributes: build_referral('ad_A'))
      create_message(conversation: conv2, content_attributes: build_referral('ad_A'))
      create_message(conversation: conv3, content_attributes: build_referral('ad_B'))

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [conv1.id, conv3.id]
      ).perform

      ad_a = result.find { |r| r[:ad_id] == 'ad_A' }
      ad_b = result.find { |r| r[:ad_id] == 'ad_B' }

      expect(ad_a[:started]).to eq(2)
      expect(ad_a[:converted]).to eq(1)
      expect(ad_b[:started]).to eq(1)
      expect(ad_b[:converted]).to eq(1)
    end

    it 'returns latest referral metadata when ad_id has multiple creatives' do
      conv = create(:conversation, account: account, inbox: inbox)

      create_message(
        conversation: conv,
        content_attributes: build_referral('ad_X', headline: 'Old headline'),
        created_at: 5.days.ago
      )
      create_message(
        conversation: conv,
        content_attributes: build_referral('ad_X', headline: 'New headline'),
        created_at: 1.day.ago
      )

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result.first[:headline]).to eq('New headline')
    end

    it 'returns converted=0 when converted_conversation_ids is empty' do
      conv = create(:conversation, account: account, inbox: inbox)
      create_message(conversation: conv, content_attributes: build_referral('ad_Z'))

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result.first[:started]).to eq(1)
      expect(result.first[:converted]).to eq(0)
    end

    it 'excludes messages outside the date range' do
      conv = create(:conversation, account: account, inbox: inbox)
      create_message(
        conversation: conv,
        content_attributes: build_referral('ad_old'),
        created_at: 30.days.ago
      )

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result).to be_empty
    end

    it 'excludes messages without referral' do
      conv = create(:conversation, account: account, inbox: inbox)
      create_message(conversation: conv, content_attributes: {})

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result).to be_empty
    end

    it 'returns empty array when start_date or end_date is blank' do
      result = described_class.new(
        account: account,
        start_date: nil,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result).to eq([])
    end

    it 'isolates results by account' do
      other_account = create(:account)
      other_inbox = create(:inbox, account: other_account)
      other_conv = create(:conversation, account: other_account, inbox: other_inbox)

      Message.create!(
        account: other_account,
        inbox: other_inbox,
        conversation: other_conv,
        content: 'Hola',
        message_type: :incoming,
        content_type: :text,
        content_attributes: build_referral('ad_other'),
        created_at: 1.day.ago
      )

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: []
      ).perform

      expect(result).to be_empty
    end
  end
end
