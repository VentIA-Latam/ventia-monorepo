module Api
  module V1
    class NotificationsController < BaseController
      before_action :set_current_user

      # GET /api/v1/notifications
      def index
        @notifications = @current_user.notifications
                                       .where(account: @current_account)
                                       .unsnoozed
                                       .recent
                                       .limit(params[:limit] || 50)

        render json: {
          notifications: @notifications.map(&:push_event_data),
          unread_count: @current_user.notifications.where(account: @current_account).unread.count
        }
      end

      # PATCH /api/v1/notifications/:id/read
      def read
        notification = @current_user.notifications.find(params[:id])
        notification.update!(read_at: Time.zone.now)
        render json: notification.push_event_data
      end

      # POST /api/v1/notifications/read_all
      def read_all
        @current_user.notifications
                     .where(account: @current_account)
                     .unread
                     .update_all(read_at: Time.zone.now)
        head :no_content
      end

      # PATCH /api/v1/notifications/:id/snooze
      def snooze
        notification = @current_user.notifications.find(params[:id])
        snoozed_until = params[:snoozed_until] || 1.hour.from_now
        notification.update!(snoozed_until: snoozed_until)
        render json: notification.push_event_data
      end

      private

      def set_current_user
        user_id = request.headers['X-User-Id'] || params[:user_id]
        @current_user = @current_account.users.find_by(ventia_user_id: user_id) ||
                        @current_account.users.find_by(id: user_id)

        render_error('User not found', :unauthorized) unless @current_user
      end
    end
  end
end
