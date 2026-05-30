require 'rails_helper'

RSpec.describe Instagram::IncomingMessageService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_instagram, account: account) }
  let(:inbox) { create(:inbox, account: account, channel: channel) }

  before do
    # No real Redis in tests; stub the dedup cache.
    allow($redis).to receive(:exists?).and_return(false)
    allow($redis).to receive(:setex)
    # Avoid the Graph API call for the sender profile.
    allow_any_instance_of(described_class).to receive(:maybe_fetch_profile).and_return({})
  end

  # Wrap a single message event in the Instagram webhook envelope.
  def webhook(message:, sender_id: 'IGSID_SENDER')
    {
      'object' => 'instagram',
      'entry'  => [{
        'id'        => channel.instagram_id,
        'time'      => 1_780_154_288_908,
        'messaging' => [{
          'sender'    => { 'id' => sender_id },
          'recipient' => { 'id' => channel.instagram_id },
          'timestamp' => 1_780_154_288_537,
          'message'   => message
        }]
      }]
    }
  end

  # Minimal Down.download stand-in: an IO that also answers content_type/original_filename.
  def fake_download(content_type: 'image/jpeg', filename: 'story.jpg')
    io = StringIO.new('fake-binary-data')
    io.define_singleton_method(:content_type) { content_type }
    io.define_singleton_method(:original_filename) { filename }
    io
  end

  describe '#perform — reply to a story' do
    let(:payload) do
      webhook(message: {
        'mid'      => 'ig.mid.story1',
        'text'     => 'Buena noticia!!!',
        'reply_to' => {
          'story' => {
            'id'  => '18468529870103136',
            'url' => 'https://lookaside.fbsbx.com/ig_messaging_cdn/story.jpg'
          }
        }
      })
    end

    before { allow(Down).to receive(:download).and_return(fake_download) }

    it 'stores the story id in content_attributes.reply_to_story' do
      described_class.new(inbox: inbox, params: payload).perform

      message = Message.find_by(source_id: 'ig.mid.story1')
      expect(message).not_to be_nil
      expect(message.content).to eq('Buena noticia!!!')
      expect(message.content_attributes.dig('reply_to_story', 'id')).to eq('18468529870103136')
    end

    it 'mirrors the story media as an attachment flagged with meta.story_reply' do
      described_class.new(inbox: inbox, params: payload).perform

      attachment = Message.find_by(source_id: 'ig.mid.story1').attachments.first
      expect(attachment).not_to be_nil
      expect(attachment.meta['story_reply']).to be true
      expect(attachment.meta['story_id']).to eq('18468529870103136')
      expect(attachment.file_type).to eq('image')
    end

    it 'still creates the message (with the story id) when the download fails' do
      allow(Down).to receive(:download).and_raise(Down::Error.new('boom'))

      described_class.new(inbox: inbox, params: payload).perform

      message = Message.find_by(source_id: 'ig.mid.story1')
      expect(message).not_to be_nil
      expect(message.attachments).to be_empty
      expect(message.content_attributes.dig('reply_to_story', 'id')).to eq('18468529870103136')
    end
  end

  describe '#perform — message originated from an ad (Click-to-Instagram-Direct)' do
    let(:payload) do
      webhook(message: {
        'mid'      => 'ig.mid.ad1',
        'text'     => 'Hola, vi su anuncio',
        'referral' => {
          'ref'              => 'promo-mayo',
          'ad_id'            => '120210000000000000',
          'source'           => 'ADS',
          'type'             => 'OPEN_THREAD',
          'ads_context_data' => {
            'ad_title'  => 'Zapatillas 2x1',
            'photo_url' => 'https://lookaside.fbsbx.com/ad.jpg'
          }
        }
      })
    end

    it 'maps the ad referral onto the shared referral shape (dashboard-compatible)' do
      described_class.new(inbox: inbox, params: payload).perform

      referral = Message.find_by(source_id: 'ig.mid.ad1').content_attributes['referral']
      expect(referral['source_type']).to eq('ADS')
      expect(referral['source_id']).to eq('120210000000000000')
      expect(referral['headline']).to eq('Zapatillas 2x1')
      expect(referral['image_url']).to eq('https://lookaside.fbsbx.com/ad.jpg')
      expect(referral['media_type']).to eq('image')
    end
  end

  describe '#perform — postback (carousel button tap)' do
    let(:payload) do
      {
        'object' => 'instagram',
        'entry'  => [{
          'id'        => channel.instagram_id,
          'time'      => 1,
          'messaging' => [{
            'sender'    => { 'id' => 'IGSID_PB' },
            'recipient' => { 'id' => channel.instagram_id },
            'timestamp' => 1_780_000_000,
            'postback'  => { 'mid' => 'ig.pb.1', 'title' => 'Quiero este', 'payload' => 'BUY_RUNNER_123' }
          }]
        }]
      }
    end

    it 'creates an incoming message carrying the postback payload' do
      described_class.new(inbox: inbox, params: payload).perform

      msg = Message.find_by(source_id: 'ig.pb.1')
      expect(msg).not_to be_nil
      expect(msg.message_type).to eq('incoming')
      expect(msg.content).to eq('Quiero este')
      expect(msg.content_attributes['postback_payload']).to eq('BUY_RUNNER_123')
    end

    it 'falls back to a synthetic source_id when mid is absent (and dedups)' do
      payload['entry'][0]['messaging'][0]['postback'].delete('mid')

      described_class.new(inbox: inbox, params: payload).perform
      described_class.new(inbox: inbox, params: payload).perform # replay -> dedup

      msgs = Message.where("content_attributes->>'postback_payload' = ?", 'BUY_RUNNER_123')
      expect(msgs.count).to eq(1)
    end
  end

  describe '#perform — plain text message (no origin context)' do
    let(:payload) do
      webhook(message: { 'mid' => 'ig.mid.plain1', 'text' => 'Hola' })
    end

    it 'does not add referral or reply_to_story attributes' do
      described_class.new(inbox: inbox, params: payload).perform

      attrs = Message.find_by(source_id: 'ig.mid.plain1').content_attributes
      expect(attrs['referral']).to be_nil
      expect(attrs['reply_to_story']).to be_nil
    end
  end
end
