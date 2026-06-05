require 'rails_helper'

RSpec.describe NotificationMailer, type: :mailer do
  describe '#human_support' do
    let(:mail) do
      NotificationMailer.human_support(
        emails: ['agent@test.com'],
        contact_name: 'Juan Pérez',
        conversation_url: 'https://app.ventia-latam.com/dashboard/conversations?id=123',
        account_name: 'Tienda Demo',
        channel_name: 'Whatsapp'
      )
    end

    it 'sends to the noreply address (recipients go in bcc)' do
      expect(mail.to).to eq([ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')])
    end

    it 'puts the actual recipients in bcc to keep them hidden from each other' do
      expect(mail.bcc).to eq(['agent@test.com'])
    end

    it 'sets the correct subject' do
      expect(mail.subject).to eq('[VentIA] Juan Pérez necesita atención humana')
    end

    it 'sets the correct from address' do
      expected_from = ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')
      expect(mail.from).to include(expected_from)
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

    it 'includes the CTA button text' do
      expect(mail.body.encoded).to include('Abrir conversación')
    end

    it 'includes the channel name formatted' do
      expect(mail.body.encoded).to include('WhatsApp')
    end

    it 'omits canal section when channel_name is nil' do
      mail_without_channel = NotificationMailer.human_support(
        emails: ['agent@test.com'],
        contact_name: 'Test',
        conversation_url: 'https://app.ventia-latam.com',
        account_name: 'Test'
      )
      expect(mail_without_channel.body.encoded).not_to include('Canal')
    end

    it 'includes the logo URL' do
      expect(mail.body.encoded).to include('ventia-logo-primary.png')
    end

    it 'sends to multiple recipients via bcc' do
      multi_mail = NotificationMailer.human_support(
        emails: ['agent1@test.com', 'agent2@test.com'],
        contact_name: 'Test',
        conversation_url: 'https://example.com',
        account_name: 'Test'
      )
      expect(multi_mail.to).to eq([ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')])
      expect(multi_mail.bcc).to eq(['agent1@test.com', 'agent2@test.com'])
    end

    it 'sanitizes CRLF in contact_name to prevent header injection' do
      injected_mail = NotificationMailer.human_support(
        emails: ['agent@test.com'],
        contact_name: "Nombre\r\nBcc: attacker@evil.com",
        conversation_url: 'https://app.ventia-latam.com',
        account_name: 'Test'
      )
      expect(injected_mail.subject).not_to include("\r\n")
    end

    it 'rejects javascript: URIs in conversation_url' do
      injected_mail = NotificationMailer.human_support(
        emails: ['agent@test.com'],
        contact_name: 'Test',
        conversation_url: 'javascript:alert(1)',
        account_name: 'Test'
      )
      expect(injected_mail.body.encoded).to include('href="#"')
      expect(injected_mail.body.encoded).not_to include('javascript:')
    end
  end

  describe '#payment_review' do
    let(:mail) do
      NotificationMailer.payment_review(
        emails: ['agent@test.com'],
        contact_name: 'María García',
        conversation_url: 'https://app.ventia-latam.com/dashboard/conversations?id=456',
        account_name: 'Tienda Demo',
        channel_name: 'Whatsapp'
      )
    end

    it 'sends to the noreply address (recipients go in bcc)' do
      expect(mail.to).to eq([ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')])
    end

    it 'puts the actual recipients in bcc to keep them hidden from each other' do
      expect(mail.bcc).to eq(['agent@test.com'])
    end

    it 'sets the correct subject' do
      expect(mail.subject).to eq('[VentIA] María García envió un comprobante de pago')
    end

    it 'sets the correct from address' do
      expected_from = ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')
      expect(mail.from).to include(expected_from)
    end

    it 'includes the contact name in the body' do
      expect(mail.body.encoded).to include('María García')
    end

    it 'includes the conversation URL' do
      expect(mail.body.encoded).to include('https://app.ventia-latam.com/dashboard/conversations?id=456')
    end

    it 'includes the account name' do
      expect(mail.body.encoded).to include('Tienda Demo')
    end

    it 'includes the CTA button text' do
      expect(mail.body.encoded).to include('Revisar comprobante')
    end

    it 'includes the channel name formatted' do
      expect(mail.body.encoded).to include('WhatsApp')
    end

    it 'includes the logo URL' do
      expect(mail.body.encoded).to include('ventia-logo-primary.png')
    end

    it 'rejects javascript: URIs in conversation_url' do
      injected_mail = NotificationMailer.payment_review(
        emails: ['agent@test.com'],
        contact_name: 'Test',
        conversation_url: 'javascript:alert(1)',
        account_name: 'Test'
      )
      expect(injected_mail.body.encoded).to include('href="#"')
      expect(injected_mail.body.encoded).not_to include('javascript:')
    end

    it 'sanitizes CRLF in contact_name to prevent header injection' do
      injected_mail = NotificationMailer.payment_review(
        emails: ['agent@test.com'],
        contact_name: "Nombre\r\nBcc: attacker@evil.com",
        conversation_url: 'https://app.ventia-latam.com',
        account_name: 'Test'
      )
      expect(injected_mail.subject).not_to include("\r\n")
    end
  end
end
