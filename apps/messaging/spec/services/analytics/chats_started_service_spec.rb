require 'rails_helper'

RSpec.describe Analytics::ChatsStartedService do
  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }
  let(:contact) { create(:contact, account: account) }

  def conv(attrs = {})
    create(:conversation, { account: account, inbox: inbox, contact: contact }.merge(attrs))
  end

  def run(start_date:, end_date:, timezone: 'America/Lima', inbox_id: nil, scope: account.conversations, acct: account)
    described_class.new(
      scope: scope, account: acct, start_date: start_date,
      end_date: end_date, timezone: timezone, inbox_id: inbox_id
    ).perform
  end

  def count_on(result, date)
    result[:results].find { |r| r[:date] == date }&.fetch(:count)
  end

  describe '#perform — conteo por día' do
    it 'cuenta las conversaciones creadas por día' do
      conv(created_at: Time.utc(2026, 6, 1, 15, 0))
      conv(created_at: Time.utc(2026, 6, 1, 18, 0))
      conv(created_at: Time.utc(2026, 6, 3, 15, 0))

      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 3, 23, 0))

      expect(count_on(result, '2026-06-01')).to eq(2)
      expect(count_on(result, '2026-06-03')).to eq(1)
      expect(result[:total]).to eq(3)
    end

    it 'rellena con 0 los días sin conversaciones (serie continua)' do
      conv(created_at: Time.utc(2026, 6, 1, 15, 0))

      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 4, 23, 0))

      # Días locales (America/Lima) cubiertos por el rango, todos presentes
      expect(result[:results].map { |r| r[:date] }).to include('2026-06-01', '2026-06-02', '2026-06-03')
      expect(count_on(result, '2026-06-02')).to eq(0)
      expect(count_on(result, '2026-06-03')).to eq(0)
    end

    it 'agrupa en la timezone local, no en UTC' do
      # 03:00 UTC del 2 jun = 22:00 del 1 jun en Lima (UTC-5) → día local 2026-06-01
      conv(created_at: Time.utc(2026, 6, 2, 3, 0))

      result = run(start_date: Time.utc(2026, 5, 31), end_date: Time.utc(2026, 6, 3))

      expect(count_on(result, '2026-06-01')).to eq(1)
      expect(count_on(result, '2026-06-02')).to eq(0)
    end
  end

  describe '#perform — filtros' do
    it 'excluye conversaciones de campaña' do
      campaign = Campaign.create!(account: account, inbox: inbox, title: 'Promo', message: 'Hola')
      conv(created_at: Time.utc(2026, 6, 1, 15, 0), campaign: campaign)

      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 2))

      expect(result[:total]).to eq(0)
    end

    it 'filtra por inbox_id cuando se pasa' do
      other_inbox = create(:inbox, account: account)
      conv(created_at: Time.utc(2026, 6, 1, 15, 0)) # inbox principal
      conv(created_at: Time.utc(2026, 6, 1, 16, 0), inbox: other_inbox)

      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 2), inbox_id: inbox.id)

      expect(result[:total]).to eq(1)
    end
  end

  describe '#perform — available_inboxes' do
    it 'lista inboxes WhatsApp e Instagram del account con su identifier' do
      wa_channel = create(:channel_whatsapp, account: account, phone_number: '+51999111222')
      create(:inbox, account: account, name: 'WA Ventas', channel: wa_channel)
      ig_channel = create(:channel_instagram, account: account, username: 'ventia.shop')
      create(:inbox, account: account, name: 'IG Marketing', channel: ig_channel)
      # Canal no soportado por el filtro: no debe aparecer.
      api_inbox = create(:inbox, account: account, name: 'API Canal')
      api_inbox.update_column(:channel_type, 'Channel::Api')

      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 2))

      by_name = result[:available_inboxes].index_by { |i| i[:name] }
      expect(by_name.keys).to include('WA Ventas', 'IG Marketing')
      expect(by_name.keys).not_to include('API Canal')
      # inbox_identifier resuelve por canal: phone_number (WA) y username (IG)
      expect(by_name['WA Ventas'][:identifier]).to eq('+51999111222')
      expect(by_name['WA Ventas'][:channel_type]).to eq('Channel::Whatsapp')
      expect(by_name['IG Marketing'][:identifier]).to eq('ventia.shop')
      expect(by_name['IG Marketing'][:channel_type]).to eq('Channel::Instagram')
    end

    it 'devuelve [] en cross_tenant (account nil)' do
      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 2),
                   scope: Conversation, acct: nil, timezone: 'UTC')

      expect(result[:available_inboxes]).to eq([])
    end
  end

  describe '#perform — rango vacío' do
    it 'devuelve total 0 con la serie en cero cuando no hay conversaciones' do
      result = run(start_date: Time.utc(2026, 6, 1), end_date: Time.utc(2026, 6, 3))

      expect(result[:total]).to eq(0)
      expect(result[:results].map { |r| r[:count] }).to all(eq(0))
      expect(result[:results]).not_to be_empty
    end
  end
end
