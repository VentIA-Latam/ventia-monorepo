require 'rails_helper'

RSpec.describe Instagram::Providers::GraphApiService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_instagram, account: account, instagram_id: '17841400000000000') }
  let(:service) { described_class.new(instagram_channel: channel) }

  before { allow(channel).to receive(:valid_access_token).and_return('tok123') }

  def ok_response
    instance_double(HTTParty::Response, success?: true,
                                        parsed_response: { 'message_id' => 'mid.sent.1' })
  end

  # Captures the JSON body of the (single) HTTParty.post call.
  def capture_post
    captured = nil
    allow(HTTParty).to receive(:post) do |_url, opts|
      captured = JSON.parse(opts[:body])
      ok_response
    end
    yield
    captured
  end

  describe '#send_message with content_type "cards"' do
    let(:message) do
      instance_double(
        Message,
        content_type: 'cards',
        content_attributes: {
          'cards' => [{
            'title' => 'Zapatillas Runner',
            'subtitle' => 'S/ 199.90',
            'image_url' => 'https://img/shoe.jpg',
            'default_action_url' => 'https://t/p/runner',
            'buttons' => [
              { 'type' => 'web_url',  'title' => 'Ver producto', 'url' => 'https://t/p/runner' },
              { 'type' => 'postback', 'title' => 'Quiero este',  'payload' => 'BUY_1' }
            ]
          }]
        }
      )
    end

    it 'POSTs a generic-template (carousel) payload' do
      allow(message).to receive(:update!)

      body = capture_post { service.send_message('IGSID1', message) }

      attachment = body['message']['attachment']
      expect(attachment['type']).to eq('template')
      expect(attachment['payload']['template_type']).to eq('generic')

      el = attachment['payload']['elements'].first
      expect(el['title']).to eq('Zapatillas Runner')
      expect(el['subtitle']).to eq('S/ 199.90')
      expect(el['image_url']).to eq('https://img/shoe.jpg')
      expect(el['default_action']).to eq('type' => 'web_url', 'url' => 'https://t/p/runner')
      expect(el['buttons']).to eq([
        { 'type' => 'web_url',  'title' => 'Ver producto', 'url' => 'https://t/p/runner' },
        { 'type' => 'postback', 'title' => 'Quiero este',  'payload' => 'BUY_1' }
      ])
    end

    it 'caps elements to 10 and drops cards without a title' do
      cards = Array.new(12) { |i| { 'title' => "Card #{i}" } }
      cards << { 'subtitle' => 'no title' } # debe descartarse
      allow(message).to receive(:content_attributes).and_return('cards' => cards)
      allow(message).to receive(:update!)

      body = capture_post { service.send_message('IGSID1', message) }

      expect(body['message']['attachment']['payload']['elements'].size).to eq(10)
    end

    it 'caps buttons to 3 and drops invalid buttons (web_url sin url, postback sin payload)' do
      allow(message).to receive(:content_attributes).and_return(
        'cards' => [{
          'title' => 'Card',
          'buttons' => [
            { 'type' => 'web_url',  'title' => 'ok',   'url' => 'https://x' },
            { 'type' => 'web_url',  'title' => 'bad' }, # sin url -> descartado
            { 'type' => 'postback', 'title' => 'bad' }, # sin payload -> descartado
            { 'type' => 'postback', 'title' => 'ok2',  'payload' => 'P' },
            { 'type' => 'web_url',  'title' => 'ok3',  'url' => 'https://y' },
            { 'type' => 'web_url',  'title' => 'ok4',  'url' => 'https://z' }
          ]
        }]
      )
      allow(message).to receive(:update!)

      body = capture_post { service.send_message('IGSID1', message) }
      buttons = body['message']['attachment']['payload']['elements'].first['buttons']

      expect(buttons.size).to eq(3)
      expect(buttons.map { |b| b['title'] }).to eq(%w[ok ok2 ok3])
    end

    it 'truncates title/subtitle to 80 chars' do
      allow(message).to receive(:content_attributes).and_return(
        'cards' => [{ 'title' => 'a' * 100, 'subtitle' => 'b' * 100 }]
      )
      allow(message).to receive(:update!)

      body = capture_post { service.send_message('IGSID1', message) }
      el = body['message']['attachment']['payload']['elements'].first

      expect(el['title'].length).to eq(80)
      expect(el['subtitle'].length).to eq(80)
    end

    it 'marks the message failed when there are no valid cards' do
      allow(message).to receive(:content_attributes).and_return('cards' => [{ 'subtitle' => 'x' }])

      expect(message).to receive(:update!).with(hash_including(status: :failed))
      expect(HTTParty).not_to receive(:post)

      service.send_message('IGSID1', message)
    end
  end
end
