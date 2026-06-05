module Analytics
  # Cuenta los chats (conversaciones) iniciados por día en un rango, agrupando
  # por el día local de la timezone indicada. Devuelve la serie completa con los
  # días sin actividad rellenados en 0, el total, y los inboxes WhatsApp
  # disponibles para poblar el filtro del widget.
  #
  # Cálculo set-based (número constante de queries) para no agotar el pool de
  # conexiones. Excluye conversaciones de campaña (marketing outbound, no
  # demanda entrante). Permite filtrar por inbox_id (número de WhatsApp).
  class ChatsStartedService
    def initialize(scope:, account:, start_date:, end_date:, timezone:, inbox_id: nil)
      @scope = scope        # current_account.conversations o Conversation (cross_tenant)
      @account = account    # nil en cross_tenant
      @start_date = start_date
      @end_date = end_date
      @timezone = timezone  # ej. "America/Lima"; "UTC" en cross_tenant
      @inbox_id = inbox_id
    end

    def perform
      relation = @scope.created_in_range(@start_date, @end_date)
                       .where(campaign_id: nil)
      relation = relation.where(inbox_id: @inbox_id) if @inbox_id.present?

      # Query 1 — conteo agrupado por día local.
      # created_at es `timestamp without time zone` almacenado en UTC, por eso la
      # conversión es doble: interpretar el valor como UTC y llevarlo a la tz
      # local antes de truncar a fecha. (activity_by_hour usa un solo AT TIME
      # ZONE; aquí se hace la conversión correcta para que el día cuadre con el
      # día local del negocio.)
      tz_quoted = ActiveRecord::Base.connection.quote(@timezone)
      counts = relation
               .group(Arel.sql("DATE(conversations.created_at AT TIME ZONE 'UTC' AT TIME ZONE #{tz_quoted})"))
               .count

      results = fill_zero_days(counts)
      total = results.sum { |r| r[:count] }

      { results: results, total: total, available_inboxes: available_inboxes }
    end

    private

    # Genera TODOS los días del rango (en la tz) con su count, rellenando 0 los
    # ausentes para que la serie sea continua.
    def fill_zero_days(counts)
      by_day = counts.transform_keys { |k| k.to_s[0, 10] } # "YYYY-MM-DD"
      from = @start_date.in_time_zone(@timezone).to_date
      to   = @end_date.in_time_zone(@timezone).to_date

      (from..to).map do |day|
        { date: day.iso8601, count: by_day[day.iso8601].to_i }
      end
    end

    # Inboxes de todos los canales (WhatsApp, Instagram, etc.) del account para
    # el dropdown del widget. Incluye channel_type e identifier (número/usuario)
    # para que el frontend muestre "Canal · identificador".
    # Vacío en cross_tenant (filtrar por un inbox concreto cruzando tenants no aplica).
    def available_inboxes
      return [] if @account.nil?

      @account.inboxes
              .where(channel_type: %w[Channel::Whatsapp Channel::Instagram])
              .includes(:channel)
              .order_by_name
              .map do |inbox|
                {
                  id: inbox.id,
                  name: inbox.name,
                  channel_type: inbox.channel_type,
                  identifier: inbox_identifier(inbox)
                }
              end
    end

    def inbox_identifier(inbox)
      case inbox.channel_type
      when 'Channel::Whatsapp' then inbox.channel&.phone_number
      when 'Channel::Instagram' then inbox.channel&.username
      end
    end
  end
end
