module Api
  module V1
    module Analytics
      class ConversationsController < Api::V1::BaseController
        # GET /api/v1/analytics/conversations_count
        # Params:
        #   - start_date (ISO 8601, opcional, default 30.days.ago)
        #   - end_date   (ISO 8601, opcional, default Time.current)
        # Respuesta:
        #   { success: true,
        #     data: { total:, period: { start_date:, end_date: } } }
        def count
          start_date, end_date = parse_date_range
          return if performed?

          total = current_account.conversations
                                 .created_in_range(start_date, end_date)
                                 .count

          render_success({
            total: total,
            period: {
              start_date: start_date.iso8601,
              end_date: end_date.iso8601
            }
          })
        end

        def no_purchase_reasons
          start_date, end_date = parse_date_range
          return if performed?

          counts = current_account.conversations
            .created_in_range(start_date, end_date)
            .where("custom_attributes->>'no_purchase_reason' IS NOT NULL")
            .group("custom_attributes->>'no_purchase_reason'")
            .count

          total = counts.values.sum
          results = counts
            .sort_by { |_, v| -v }
            .map do |reason, count|
              {
                reason: reason,
                count: count,
                percentage: total > 0 ? (count.to_f / total * 100).round(1) : 0.0
              }
            end

          render_success({ total: total, results: results })
        end

        # POST /api/v1/analytics/ads_summary
        # Body:
        #   - start_date (ISO 8601, required)
        #   - end_date   (ISO 8601, required)
        #   - converted_conversation_ids (array<integer>, optional, default [])
        # Respuesta:
        #   { success: true,
        #     data: { ads: [{ ad_id, headline, image_url, source_url, started, converted }] } }
        def ads_summary
          start_date, end_date = parse_date_range
          return if performed?

          ads = ::Analytics::AdsSummaryService.new(
            account: current_account,
            start_date: start_date,
            end_date: end_date,
            converted_conversation_ids: Array(params[:converted_conversation_ids])
          ).perform

          render_success({ ads: ads })
        end

        def activity_by_hour
          start_date, end_date = parse_date_range
          return if performed?

          tz = params[:timezone].presence || 'America/Lima'
          begin
            TZInfo::Timezone.get(tz)
          rescue TZInfo::InvalidTimezoneIdentifier
            return render_error('Invalid timezone identifier', status: :bad_request)
          end

          # cross_tenant solo es enviado por el backend Python tras verificar rol SUPERADMIN
          scope = if params[:cross_tenant] == 'true'
                    Message.where(created_at: start_date..end_date)
                  else
                    current_account.messages.where(created_at: start_date..end_date)
                  end

          tz_quoted = ActiveRecord::Base.connection.quote(tz)
          # `messages.created_at` es `timestamp without time zone` con valor en UTC
          # (convención Rails). Para extraer DOW/HOUR en la tz del tenant, primero
          # marcamos el timestamp como UTC y después convertimos a la tz local.
          # Sin el `AT TIME ZONE 'UTC'` previo, Postgres asume que el naive está
          # en la tz local y lo convierte a UTC, dando un desfase de 2× el offset.
          dow_expr  = "EXTRACT(DOW  FROM (messages.created_at AT TIME ZONE 'UTC') AT TIME ZONE #{tz_quoted})"
          hour_expr = "EXTRACT(HOUR FROM (messages.created_at AT TIME ZONE 'UTC') AT TIME ZONE #{tz_quoted})"
          counts = scope
                   .group(Arel.sql(dow_expr))
                   .group(Arel.sql(hour_expr))
                   .count

          matrix = Array.new(7) { Array.new(24, 0) }
          counts.each do |(dow, hour), count|
            matrix[dow.to_i][hour.to_i] = count
          end

          render_success({ matrix: matrix, max_count: matrix.flatten.max || 0 })
        end

        def conversation_distribution
          start_date, end_date = parse_date_range
          return if performed?

          # cross_tenant solo es enviado por el backend Python tras verificar rol SUPERADMIN
          scope = if params[:cross_tenant] == 'true'
                    Conversation
                  else
                    current_account.conversations
                  end

          result = ::Analytics::DistributionService.new(
            scope: scope, start_date: start_date, end_date: end_date
          ).perform

          render_success(result)
        end

        private

        def parse_date_range
          start_date = params[:start_date].present? ? Time.iso8601(params[:start_date]) : 30.days.ago
          end_date = params[:end_date].present? ? Time.iso8601(params[:end_date]) : Time.current
          [start_date, end_date]
        rescue ArgumentError, TypeError
          # ArgumentError: invalid ISO 8601; TypeError: param es array/numeric
          render_error('Invalid date format, use ISO 8601', status: :bad_request)
          [nil, nil]
        end
      end
    end
  end
end
