class NotificationDispatcher
  PUSH_TITLES = {
    human_support:  'Conversación requiere soporte humano',
    payment_review: 'Pago pendiente de validar'
  }.freeze

  def initialize(account, conversation, contact_name, flag_name)
    @account      = account
    @conversation = conversation
    @contact_name = contact_name
    @flag_name    = flag_name
  end

  def perform
    unless PUSH_TITLES.key?(@flag_name)
      Rails.logger.error "[NotificationDispatcher] flag_name no soportado: #{@flag_name.inspect}"
      return
    end

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
  end

  def fetch_offline_ids
    all_ids    = @account.account_users.pluck(:user_id).map(&:to_s)
    online_ids = OnlineStatusTracker.get_available_user_ids(@account.id).map(&:to_s)
    all_ids - online_ids
  end

  def push_enabled?(setting) = setting.nil? || setting.push_enabled?(@flag_name)
  def email_enabled?(setting) = setting.nil? || setting.email_enabled?(@flag_name)

  def dispatch_push(eligible_ids)
    return if eligible_ids.blank?

    tokens = PushSubscriptionToken
               .where(account_id: @account.id, user_id: eligible_ids)
               .pluck(:token)
    return if tokens.blank?

    Notifications::SendFcmJob.perform_later(
      tokens: tokens,
      title:  PUSH_TITLES[@flag_name],
      body:   "#{@contact_name}: #{push_body}",
      data: {
        conversation_id: @conversation.id.to_s,
        account_id:      @account.id.to_s,
        click_action:    conversation_url
      }
    )
  end

  def dispatch_email(eligible_ids)
    return if eligible_ids.blank?

    emails = User.where(id: eligible_ids).pluck(:email).compact
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
    @flag_name == :human_support ? 'necesita atención humana' : 'envió un comprobante de pago'
  end

  def conversation_url
    frontend = ENV.fetch('FRONTEND_URL', 'https://app.ventia-latam.com')
    "#{frontend}/dashboard/conversations?id=#{@conversation.id}"
  end
end
