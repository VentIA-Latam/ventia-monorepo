# Marca una campaña como :completed cuando todos sus recipients están en estado terminal.
# Idempotente: si ya está :completed o todavía hay pending/queued, no hace nada.
#
# Se invoca:
# - Al final de cada SendRecipientJob (por si fue el último).
# - Desde el listener CampaignRecipientStatusListener cuando un webhook actualiza status.
#
# `:sent` se considera terminal aquí (puede seguir transicionando a :delivered/:read vía
# webhook después, pero la campaña ya hizo su trabajo).
class Campaigns::CompletionChecker
  def initialize(campaign)
    @campaign = campaign
  end

  def maybe_complete!
    return if @campaign.completed?
    return if @campaign.campaign_recipients.pending_or_queued.exists?

    @campaign.complete!
  end
end
