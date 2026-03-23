class FcmListener < BaseListener
  def message_created(event)
    message, account = extract_message_and_account(event)
    return unless message.incoming?

    conversation = message.conversation

    if conversation.ai_agent_enabled?
      return unless account.notify_ai_messages?
    end

    contact_name = conversation.contact&.name || 'Cliente'
    body = "#{contact_name}: #{message.content&.truncate(100)}"

    send_push_to_offline_agents(account, conversation, 'Nuevo mensaje', body)
  rescue StandardError => e
    Rails.logger.error "[FcmListener] Error in message_created: #{e.message}"
  end

  def conversation_labels_updated(event)
    conversation = event[:data][:conversation]
    labels = event[:data][:labels]
    account = conversation.account

    label_titles = labels.map { |l| l[:title] }

    if label_titles.include?('soporte-humano')
      contact_name = conversation.contact&.name || 'Cliente'
      send_push_to_offline_agents(
        account, conversation,
        'Conversación requiere soporte humano',
        "#{contact_name} necesita atención humana"
      )
    end

    if label_titles.include?('en-revisión')
      contact_name = conversation.contact&.name || 'Cliente'
      send_push_to_offline_agents(
        account, conversation,
        'Pago pendiente de validar',
        "#{contact_name} envió un comprobante de pago"
      )
    end
  rescue StandardError => e
    Rails.logger.error "[FcmListener] Error in conversation_labels_updated: #{e.message}"
  end

  private

  def send_push_to_offline_agents(account, conversation, title, body)
    # Both arrays must be strings for correct set subtraction
    all_agent_ids = account.account_users.pluck(:user_id).map(&:to_s)
    online_ids = OnlineStatusTracker.get_available_user_ids(account.id).map(&:to_s)
    offline_ids = all_agent_ids - online_ids

    return if offline_ids.blank?

    tokens = PushSubscriptionToken
               .where(account_id: account.id, user_id: offline_ids)
               .pluck(:token)

    return if tokens.blank?

    Notifications::SendFcmJob.perform_later(
      tokens: tokens,
      title: title,
      body: body,
      data: {
        conversation_id: conversation.id.to_s,
        account_id: account.id.to_s,
        click_action: "/dashboard/conversations?id=#{conversation.id}"
      }
    )
  rescue StandardError => e
    Rails.logger.error "[FcmListener] Error sending push: #{e.message}"
  end
end
