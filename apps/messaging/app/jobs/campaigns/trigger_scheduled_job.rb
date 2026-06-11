# Cron job que recoge campañas programadas y las encola para envío.
#
# Corre cada 5 minutos (ver config/sidekiq-cron.yml). Filtra usando el scope
# Campaign.triggerable: active + enabled + sin triggered_at + scheduled_at en el pasado.
#
# Si una misma campaña se cuela dos veces (cron + click manual), TriggerJob hace lock
# y se sale en el segundo run.
class Campaigns::TriggerScheduledJob < ApplicationJob
  queue_as :scheduled

  def perform
    Campaign.triggerable.find_each do |campaign|
      Campaigns::TriggerJob.perform_later(campaign.id)
    end
  end
end
