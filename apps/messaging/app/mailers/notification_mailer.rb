class NotificationMailer < ApplicationMailer
  default from: "VentIA - Notificaciones <#{ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')}>"

  def human_support(emails:, contact_name:, conversation_url:, account_name:, channel_name: nil)
    @contact_name = sanitize_name(contact_name)
    @conversation_url = safe_url(conversation_url)
    @account_name = account_name
    @channel_name = format_channel(channel_name)

    mail(
      to: emails,
      subject: "[VentIA] #{@contact_name} necesita atención humana"
    )
  end

  def payment_review(emails:, contact_name:, conversation_url:, account_name:, channel_name: nil)
    @contact_name = sanitize_name(contact_name)
    @conversation_url = safe_url(conversation_url)
    @account_name = account_name
    @channel_name = format_channel(channel_name)

    mail(
      to: emails,
      subject: "[VentIA] #{@contact_name} envió un comprobante de pago"
    )
  end

  private

  def sanitize_name(name)
    name.to_s.gsub(/[\r\n]/, ' ').strip
  end

  def safe_url(url)
    uri = URI.parse(url.to_s)
    return '#' unless %w[http https].include?(uri.scheme)
    uri.to_s
  rescue URI::InvalidURIError
    '#'
  end

  def format_channel(channel_name)
    return nil if channel_name.nil?
    {
      'Whatsapp'  => 'WhatsApp',
      'Api'       => 'API',
      'WebWidget' => 'Web Widget',
      'Email'     => 'Email',
      'Sms'       => 'SMS',
      'Telegram'  => 'Telegram',
      'Facebook'  => 'Facebook',
      'Fbpage'    => 'Facebook'
    }.fetch(channel_name, channel_name)
  end
end
