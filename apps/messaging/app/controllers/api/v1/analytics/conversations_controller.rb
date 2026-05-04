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

          render_success(
            total: total,
            period: {
              start_date: start_date.iso8601,
              end_date: end_date.iso8601
            }
          )
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
