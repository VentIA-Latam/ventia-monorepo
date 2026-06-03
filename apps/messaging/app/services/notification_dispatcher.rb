class NotificationDispatcher
  PUSH_TITLES = {
    human_support:  'Conversación requiere soporte humano',
    payment_review: 'Pago pendiente de validar',
    message_ai_on:  'Nuevo mensaje',
    message_ai_off: 'Nuevo mensaje'
  }.freeze

  # Detalle textual fijo para los flags de etiqueta. Para los flags de mensaje
  # el detalle se toma dinámicamente del propio `message` (ver #push_body).
  PUSH_DETAILS = {
    human_support:  'necesita atención humana',
    payment_review: 'envió un comprobante de pago'
  }.freeze

  # Solo estos flags soportan canal email. Los flags de mensaje son push-only
  # por decisión de producto (evitar saturar inbox con cada mensaje entrante).
  EMAIL_FLAGS = %i[human_support payment_review].freeze

  def initialize(account, conversation, contact_name, flag_name, message: nil)
    unless PUSH_TITLES.key?(flag_name)
      raise ArgumentError, "[NotificationDispatcher] flag_name no soportado: #{flag_name.inspect}"
    end

    @account      = account
    @conversation = conversation
    @contact_name = contact_name
    @flag_name    = flag_name
    @message      = message
  end

  def perform
    offline_ids = fetch_offline_ids
    return if offline_ids.blank?

    settings = NotificationSetting
                 .where(account_id: @account.id, user_id: offline_ids)
                 .index_by { |s| s.user_id.to_s }

    # Cada canal se despacha de forma independiente: un fallo en push no debe
    # impedir el envío del email (y viceversa).
    safely('push')  { dispatch_push(offline_ids.select  { |uid| push_enabled?(settings[uid]) }) }
    safely('email') { dispatch_email(offline_ids.select { |uid| email_enabled?(settings[uid]) }) }
  end

  private

  def safely(channel)
    yield
  rescue StandardError => e
    Rails.logger.error "[NotificationDispatcher] Error en #{channel} " \
                       "(account_id=#{@account.id}, conversation_id=#{@conversation.id}, " \
                       "flag=#{@flag_name}): #{e.message}"

    return unless defined?(Sentry) && Sentry.initialized?

    Sentry.capture_exception(e, extra: {
      account_id:      @account.id,
      conversation_id: @conversation.id,
      flag:            @flag_name,
      channel:         channel
    })
  end

  def fetch_offline_ids
    # SUPERADMINs son operadores de la plataforma, no agentes del tenant.
    # Aunque estén enrolados en cada account_user (necesario para autorización
    # cross-tenant), no deben recibir notificaciones de soporte de cada cuenta.
    all_ids    = @account.account_users.where.not(role: :superadmin).pluck(:user_id).map(&:to_s)
    online_ids = OnlineStatusTracker.get_available_user_ids(@account.id).map(&:to_s)
    all_ids - online_ids
  end

  def push_enabled?(setting) = setting.nil? || setting.push_enabled?(@flag_name)

  def email_enabled?(setting)
    return false unless EMAIL_FLAGS.include?(@flag_name)
    setting.nil? || setting.email_enabled?(@flag_name)
  end

  def dispatch_push(eligible_ids)
    return if eligible_ids.blank?

    tokens = PushSubscriptionToken
               .where(account_id: @account.id, user_id: eligible_ids)
               .pluck(:token)
    return if tokens.blank?

    Notifications::SendFcmJob.perform_later(
      tokens: tokens,
      title:  PUSH_TITLES[@flag_name],
      body:   push_body,
      data: {
        conversation_id: @conversation.id.to_s,
        account_id:      @account.id.to_s,
        click_action:    conversation_url
      }
    )
  end

  def dispatch_email(eligible_ids)
    return if eligible_ids.blank?

    # Filtramos formato válido antes del envío para que una dirección malformada
    # en DB no haga rechazar todo el batch de BCC en Resend.
    emails = User.where(id: eligible_ids).pluck(:email).compact
    emails = emails.select { |e| e =~ URI::MailTo::EMAIL_REGEXP }
    return if emails.blank?

    channel_name = @conversation.inbox&.channel_type&.split('::')&.last

    NotificationMailer.public_send(
      @flag_name,
      emails:           emails,
      contact_name:     @contact_name,
      conversation_url: conversation_url,
      account_name:     @account.name,
      channel_name:     channel_name
    ).deliver_later
  end

  def push_body
    detail = PUSH_DETAILS[@flag_name] || @message&.content&.truncate(100).to_s
    "#{@contact_name}: #{detail}"
  end

  def conversation_url
    frontend = ENV.fetch('FRONTEND_URL', 'https://app.ventia-latam.com')
    "#{frontend}/dashboard/conversations?id=#{@conversation.id}"
  end
end
