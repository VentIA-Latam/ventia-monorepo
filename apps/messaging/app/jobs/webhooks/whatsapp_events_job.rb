class Webhooks::WhatsappEventsJob < ApplicationJob
  queue_as :low

  def perform(params = {})
    channel = find_channel_from_payload(params)

    if channel.blank?
      Rails.logger.warn("WhatsApp webhook: no channel found for payload")
      return
    end

    outgoing_echo = message_echo_event?(params)
    Whatsapp::IncomingMessageService.new(inbox: channel.inbox, params: params, outgoing_echo: outgoing_echo).perform
  end

  private

  def find_channel_from_payload(params)
    return find_channel_from_wba_payload(params) if params[:object] == 'whatsapp_business_account'

    find_channel_by_url_param(params)
  end

  def find_channel_by_url_param(params)
    return unless params[:phone_number]

    Channel::Whatsapp.find_by(phone_number: params[:phone_number])
  end

  def find_channel_from_wba_payload(wba_params)
    phone_number = "+#{wba_params.dig(:entry, 0, :changes, 0, :value, :metadata, :display_phone_number)}"
    phone_number_id = wba_params.dig(:entry, 0, :changes, 0, :value, :metadata, :phone_number_id)

    channel = Channel::Whatsapp.find_by(phone_number: phone_number)
    return channel if channel && channel.provider_config['phone_number_id'] == phone_number_id
  end

  def message_echo_event?(params)
    field = params.dig(:entry, 0, :changes, 0, :field) ||
            params.dig('entry', 0, 'changes', 0, 'field')
    field == 'smb_message_echoes'
  end
end
