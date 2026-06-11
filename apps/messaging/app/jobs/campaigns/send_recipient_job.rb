# Procesa un recipient individual:
# 1. Resuelve variables (vars del recipient o attrs del contact)
# 2. Si falta un atributo requerido → :omitted (no llega a Meta, no factura)
# 3. Sino, llama a EnsureFromPhoneService que crea contact/conversation/message
#    y el callback after_create_commit del Message dispara SendReplyJob que
#    envía a Meta. El listener de status sync actualiza después delivered/read/failed.
#
# Concurrency: Sidekiq corre N de estos en paralelo (uno por recipient encolado por TriggerJob).
# Cada uno escribe su propia fila — sin races. Counters de campaign se incrementan con
# update_all atómico.
class Campaigns::SendRecipientJob < ApplicationJob
  queue_as :campaigns

  def perform(recipient_id)
    recipient = CampaignRecipient.find(recipient_id)
    campaign  = recipient.campaign
    resolved  = Campaigns::VariableResolver.new(recipient).resolve

    if resolved == :missing_attr
      recipient.update!(status: :omitted, external_error: 'missing required attribute for template variable')
      Campaigns::CompletionChecker.new(campaign).maybe_complete!
      return
    end

    template_params = campaign.template_params.merge('processed_params' => resolved)
    result = Conversations::EnsureFromPhoneService.new(
      account:         campaign.account,
      inbox:           campaign.inbox,
      phone:           recipient.phone,
      template_params: template_params,
      campaign:        campaign
    ).perform

    recipient.update!(
      contact_id:      result.contact.id,
      conversation_id: result.conversation.id,
      message_id:      result.message.id,
      status:          :sent,
      sent_at:         Time.current
    )
    Campaign.where(id: campaign.id).update_all('sent_count = sent_count + 1, updated_at = NOW()')
    Campaigns::CompletionChecker.new(campaign).maybe_complete!
  rescue Conversations::EnsureFromPhoneService::InvalidPhoneError,
         Conversations::EnsureFromPhoneService::InvalidInboxChannelError,
         Whatsapp::TemplateMessageBuilder::TemplateNotFound,
         Whatsapp::TemplateMessageBuilder::MissingBodyVariables => e
    recipient.update!(status: :failed, external_error: e.message)
    Campaign.where(id: campaign.id).update_all('failed_count = failed_count + 1')
    Campaigns::CompletionChecker.new(campaign).maybe_complete!
  end
end
