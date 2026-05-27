class NotificationMailer < ApplicationMailer
  default from: "VentIA - Notificaciones <#{ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')}>"

  def human_support(emails:, contact_name:, conversation_url:, account_name:)
    @contact_name = contact_name
    @conversation_url = conversation_url
    @account_name = account_name

    mail(
      to: emails,
      subject: "[VentIA] #{contact_name} necesita atención humana"
    )
  end

  def payment_review(emails:, contact_name:, conversation_url:, account_name:)
    @contact_name = contact_name
    @conversation_url = conversation_url
    @account_name = account_name

    mail(
      to: emails,
      subject: "[VentIA] #{contact_name} envió un comprobante de pago"
    )
  end
end
