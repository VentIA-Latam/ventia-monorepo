require 'rails_helper'

RSpec.describe Analytics::DistributionService do
  let(:account) { create(:account) }
  let(:inbox) { create(:inbox, account: account) }
  let(:contact) { create(:contact, account: account) }
  let(:user) { create(:user) }
  let(:start_date) { 30.days.ago }
  let(:end_date) { Time.current }
  let(:now) { Time.current }

  def conv(attrs = {})
    create(:conversation, { account: account, inbox: inbox, contact: contact }.merge(attrs))
  end

  def message(conversation, message_type:, sender: nil, content_attributes: {}, private: false, created_at: 1.hour.ago)
    Message.create!(
      account: account,
      inbox: inbox,
      conversation: conversation,
      content: 'Hola',
      message_type: message_type,
      content_type: :text,
      sender: sender,
      content_attributes: content_attributes,
      private: private,
      created_at: created_at
    )
  end

  # Mensaje de IA: outgoing sin sender, sin external_echo
  def ai_msg(conversation, at: 1.hour.ago)
    message(conversation, message_type: :outgoing, created_at: at)
  end

  # Mensaje de operador humano (app): sender = User
  def human_msg(conversation, at: 1.hour.ago)
    message(conversation, message_type: :outgoing, sender: user, created_at: at)
  end

  # Mensaje de humano vía WhatsApp móvil (coexistence): outgoing sin sender + external_echo
  def echo_msg(conversation, at: 1.hour.ago)
    message(conversation, message_type: :outgoing,
                          content_attributes: { 'external_echo' => true }, created_at: at)
  end

  # Mensaje entrante del cliente
  def customer_msg(conversation, at: 1.hour.ago)
    message(conversation, message_type: :incoming, sender: contact, created_at: at)
  end

  def run
    described_class.new(scope: account.conversations, start_date: start_date,
                        end_date: end_date, now: now).perform
  end

  def bucket(result, category)
    result[:distribution].find { |d| d[:category] == category }
  end

  describe '#perform — clasificación' do
    it 'clasifica conversación solo-IA como agent_ai' do
      c = conv
      customer_msg(c, at: 3.hours.ago)
      ai_msg(c, at: 2.hours.ago) # último saliente reciente (<24h) → no abandonada
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
    end

    it 'clasifica conversación con operador (sender User) como human_support' do
      c = conv
      ai_msg(c, at: 3.hours.ago)
      human_msg(c, at: 2.hours.ago)
      expect(bucket(run, :human_support)[:count]).to eq(1)
    end

    it 'clasifica echo de WhatsApp móvil (external_echo) como human_support' do
      c = conv
      echo_msg(c, at: 2.hours.ago)
      expect(bucket(run, :human_support)[:count]).to eq(1)
    end

    it 'humano precede a IA en escalación' do
      c = conv
      ai_msg(c, at: 3.hours.ago)
      human_msg(c, at: 2.hours.ago)
      customer_msg(c, at: 1.hour.ago) # último es incoming → no abandonada
      expect(bucket(run, :human_support)[:count]).to eq(1)
      expect(bucket(run, :agent_ai)[:count]).to eq(0)
    end

    it 'una nota interna (private) de un User NO cuenta como human_support' do
      c = conv
      ai_msg(c, at: 2.hours.ago) # solo la IA atendió de cara al cliente
      message(c, message_type: :outgoing, sender: user, private: true, created_at: 1.hour.ago)
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
      expect(bucket(run, :human_support)[:count]).to eq(0)
    end
  end

  describe '#perform — abandono' do
    it 'marca abandoned cuando el último saliente tiene +24h sin respuesta del cliente' do
      c = conv
      customer_msg(c, at: 3.days.ago)
      ai_msg(c, at: 2.days.ago) # último saliente, +24h
      expect(bucket(run, :abandoned)[:count]).to eq(1)
    end

    it 'abandono precede a humano' do
      c = conv
      human_msg(c, at: 2.days.ago) # humano participó pero último saliente +24h
      expect(bucket(run, :abandoned)[:count]).to eq(1)
      expect(bucket(run, :human_support)[:count]).to eq(0)
    end

    it 'NO marca abandoned si el último saliente es <24h' do
      c = conv
      ai_msg(c, at: 2.hours.ago)
      expect(bucket(run, :abandoned)[:count]).to eq(0)
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
    end

    it 'NO marca abandoned si el último mensaje es del cliente (entrante)' do
      c = conv
      ai_msg(c, at: 3.days.ago)
      customer_msg(c, at: 2.days.ago) # cliente respondió último → no abandonada
      expect(bucket(run, :abandoned)[:count]).to eq(0)
    end

    it 'ignora notas internas (private) al determinar el último mensaje' do
      c = conv
      customer_msg(c, at: 2.hours.ago)
      ai_msg(c, at: 1.hour.ago) # último mensaje real, reciente → NO abandonada
      # Nota interna posterior NO debe convertirse en el "último saliente"
      message(c, message_type: :outgoing, sender: user, private: true, created_at: 30.minutes.ago)
      expect(bucket(run, :abandoned)[:count]).to eq(0)
      expect(bucket(run, :agent_ai)[:count]).to eq(1)
    end

    it 'desempata por id cuando dos mensajes comparten created_at' do
      c = conv
      ts = 2.days.ago
      # incoming y outgoing con el mismo timestamp; el outgoing se crea después (id mayor)
      customer_msg(c, at: ts)
      ai_msg(c, at: ts)
      # El último (por id) es el saliente +24h → abandoned, de forma determinista
      expect(bucket(run, :abandoned)[:count]).to eq(1)
    end
  end

  describe '#perform — exclusiones y agregados' do
    it 'excluye conversaciones de campaña' do
      campaign = Campaign.create!(account: account, inbox: inbox, title: 'Promo', message: 'Hola')
      c = conv(campaign: campaign)
      ai_msg(c, at: 2.hours.ago)
      expect(run[:total_conversations]).to eq(0)
    end

    it 'calcula percentage y total_hours' do
      c1 = conv(created_at: 4.hours.ago, last_activity_at: 2.hours.ago) # 2h, agent_ai
      ai_msg(c1, at: 2.hours.ago)
      c2 = conv(created_at: 5.hours.ago, last_activity_at: 1.hour.ago) # 4h, human
      human_msg(c2, at: 1.hour.ago)

      result = run
      expect(result[:total_conversations]).to eq(2)
      expect(bucket(result, :agent_ai)[:percentage]).to eq(50.0)
      expect(bucket(result, :agent_ai)[:total_hours]).to eq(2.0)
      expect(bucket(result, :human_support)[:total_hours]).to eq(4.0)
    end

    it 'la duración usa el último mensaje real, no last_activity_at (ignora activity)' do
      c = conv(created_at: 4.hours.ago)
      ai_msg(c, at: 3.hours.ago) # último mensaje real → fin de la ventana
      # Un mensaje 'activity' posterior mueve last_activity_at pero NO la duración
      message(c, message_type: :activity, created_at: 1.hour.ago)
      # Duración esperada: 3h ago - 4h ago = 1h (no 3h que daría last_activity_at)
      expect(bucket(run, :agent_ai)[:total_hours]).to eq(1.0)
    end

    it 'devuelve resultado vacío sin conversaciones en el rango' do
      result = run
      expect(result[:total_conversations]).to eq(0)
      expect(result[:distribution].size).to eq(3)
      expect(result[:distribution].map { |d| d[:count] }).to all(eq(0))
    end
  end
end
