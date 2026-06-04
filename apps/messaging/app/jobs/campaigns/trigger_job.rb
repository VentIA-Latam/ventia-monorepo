# Orquesta el envío de una campaña: marca :running con lock, pasa todos los recipients
# :pending → :queued y encola un SendRecipientJob por cada uno.
#
# Anti-doble-disparo: usa SELECT FOR UPDATE + check de triggered_at. Si la campaña ya
# fue triggered (por cron + click manual simultáneo, por ejemplo), el segundo TriggerJob
# se sale sin tocar nada.
#
# Si el TriggerJob mismo crashea (no algún hijo), marca la campaña como :failed para
# diagnóstico y re-raisea para que Sidekiq la registre.
class Campaigns::TriggerJob < ApplicationJob
  queue_as :campaigns

  # Sidekiq por defecto reintenta StandardError. NO marcamos campaign :failed en el
  # rescue — eso bloquearía retries útiles (ej. ActiveRecord::Deadlocked transient).
  # Si Sidekiq agota retries, el job va al dead set y un admin investiga.
  # Para errores fatales explícitos (ej. campaña en estado inválido), preferí raisar
  # ArgumentError o validar antes de encolar.
  def perform(campaign_id)
    Campaign.transaction do
      campaign = Campaign.lock('FOR UPDATE').find_by(id: campaign_id)
      return unless campaign
      return if campaign.triggered_at.present?

      campaign.update!(campaign_status: :running, triggered_at: Time.current)
      campaign.campaign_recipients.where(status: :pending).find_each do |r|
        r.update!(status: :queued)
        Campaigns::SendRecipientJob.perform_later(r.id)
      end
    end
  rescue StandardError => e
    Rails.logger.error "[Campaigns] TriggerJob failed for campaign #{campaign_id}: #{e.class.name}: #{e.message}"
    raise # deja que Sidekiq haga retry
  end
end
