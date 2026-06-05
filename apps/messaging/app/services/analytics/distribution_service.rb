module Analytics
  # Clasifica las conversaciones de un rango en tres buckets mutuamente
  # excluyentes (precedencia: abandoned > human_support > agent_ai) y agrega
  # count, percentage y horas totales por bucket.
  #
  # Cálculo set-based (número constante de queries) para no agotar el pool
  # de conexiones. Excluye conversaciones de campaña (marketing outbound).
  class DistributionService
    HUMAN_SQL = "sender_type = 'User' OR content_attributes->>'external_echo' IS NOT NULL".freeze
    ABANDON_THRESHOLD = 24.hours
    CATEGORIES = %i[agent_ai human_support abandoned].freeze

    def initialize(scope:, start_date:, end_date:, now: Time.current)
      @scope = scope            # current_account.conversations o Conversation (cross_tenant)
      @start_date = start_date
      @end_date = end_date
      @now = now
    end

    def perform
      # Query 1 — base: ids + created_at de la conversación. Excluye campañas.
      convs = @scope.created_in_range(@start_date, @end_date)
                    .where(campaign_id: nil)
                    .pluck(:id, :created_at)
      conv_ids = convs.map(&:first)
      return empty_result if conv_ids.empty?

      # Query 2 — conversaciones con CUALQUIER mensaje humano.
      # Excluye notas internas (private): no son atención al cliente.
      human_ids = Message.where(conversation_id: conv_ids)
                         .where(message_type: %i[outgoing template])
                         .where(private: false)
                         .where(HUMAN_SQL)
                         .distinct.pluck(:conversation_id).to_set

      # Query 3 — último mensaje real por conversación.
      # Ignora 'activity' y notas internas (private). Desempata por id para
      # que el orden sea determinista cuando dos mensajes comparten created_at.
      last_by_conv = Message.where(conversation_id: conv_ids)
                            .where.not(message_type: :activity)
                            .where(private: false)
                            .select('DISTINCT ON (conversation_id) conversation_id, message_type, created_at')
                            .order('conversation_id, created_at DESC, id DESC')
                            .index_by(&:conversation_id)

      buckets = { agent_ai: [], human_support: [], abandoned: [] }
      convs.each do |id, created_at|
        last = last_by_conv[id]
        category = classify(id, last, human_ids)
        # Duración = desde la creación hasta el último mensaje real (no
        # last_activity_at, que se mueve con mensajes activity/private).
        duration = last ? [(last.created_at - created_at), 0].max : 0
        buckets[category] << duration
      end

      build_result(buckets, conv_ids.size)
    end

    private

    def classify(id, last, human_ids)
      if abandoned?(last)
        :abandoned
      elsif human_ids.include?(id)
        :human_support
      else
        :agent_ai
      end
    end

    def abandoned?(last)
      return false if last.nil?

      outgoing = %w[outgoing template].include?(last.message_type)
      outgoing && last.created_at < (@now - ABANDON_THRESHOLD)
    end

    def build_result(buckets, total)
      distribution = CATEGORIES.map do |cat|
        durations = buckets[cat]
        count = durations.size
        {
          category: cat,
          count: count,
          percentage: total.positive? ? (count.to_f / total * 100).round(1) : 0.0,
          total_hours: (durations.sum / 3600.0).round(1)
        }
      end
      { distribution: distribution, total_conversations: total }
    end

    def empty_result
      distribution = CATEGORIES.map do |cat|
        { category: cat, count: 0, percentage: 0.0, total_hours: 0.0 }
      end
      { distribution: distribution, total_conversations: 0 }
    end
  end
end
