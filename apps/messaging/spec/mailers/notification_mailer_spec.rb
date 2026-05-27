require 'rails_helper'

RSpec.describe NotificationMailer, type: :mailer do
  describe '#human_support' do
    let(:mail) do
      NotificationMailer.human_support(
        emails: ['agent@test.com'],
        contact_name: 'Juan Pérez',
        conversation_url: 'https://app.ventia-latam.com/dashboard/conversations?id=123',
        account_name: 'Tienda Demo'
      )
    end

    it 'sends to the correct recipients' do
      expect(mail.to).to eq(['agent@test.com'])
    end

    it 'sets the correct subject' do
      expect(mail.subject).to eq('[VentIA] Juan Pérez necesita atención humana')
    end

    it 'includes the contact name in the body' do
      expect(mail.body.encoded).to include('Juan Pérez')
    end

    it 'includes the conversation URL' do
      expect(mail.body.encoded).to include('https://app.ventia-latam.com/dashboard/conversations?id=123')
    end

    it 'includes the account name' do
      expect(mail.body.encoded).to include('Tienda Demo')
    end

    it 'sends to multiple recipients' do
      multi_mail = NotificationMailer.human_support(
        emails: ['agent1@test.com', 'agent2@test.com'],
        contact_name: 'Test',
        conversation_url: 'https://example.com',
        account_name: 'Test'
      )
      expect(multi_mail.to).to eq(['agent1@test.com', 'agent2@test.com'])
    end
  end

  describe '#payment_review' do
    let(:mail) do
      NotificationMailer.payment_review(
        emails: ['agent@test.com'],
        contact_name: 'María García',
        conversation_url: 'https://app.ventia-latam.com/dashboard/conversations?id=456',
        account_name: 'Tienda Demo'
      )
    end

    it 'sends to the correct recipients' do
      expect(mail.to).to eq(['agent@test.com'])
    end

    it 'sets the correct subject' do
      expect(mail.subject).to eq('[VentIA] María García envió un comprobante de pago')
    end

    it 'includes the contact name in the body' do
      expect(mail.body.encoded).to include('María García')
    end

    it 'includes the CTA button text' do
      expect(mail.body.encoded).to include('Revisar pago')
    end
  end
end
