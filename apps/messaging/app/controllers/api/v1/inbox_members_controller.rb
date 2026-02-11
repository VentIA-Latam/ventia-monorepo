module Api
  module V1
    class InboxMembersController < BaseController
      before_action :set_inbox

      # GET /api/v1/inboxes/:inbox_id/members
      def index
        @members = @inbox.inbox_members.includes(:user)
        render json: @members.map { |m| m.user.push_event_data }
      end

      # POST /api/v1/inboxes/:inbox_id/members
      def create
        user = @current_account.users.find(params[:user_id])
        @inbox_member = @inbox.inbox_members.new(user: user)

        if @inbox_member.save
          render json: user.push_event_data, status: :created
        else
          render_error(@inbox_member.errors.full_messages, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/inboxes/:inbox_id/members/:id
      def destroy
        @inbox_member = @inbox.inbox_members.find(params[:id])
        @inbox_member.destroy
        head :no_content
      end

      private

      def set_inbox
        @inbox = @current_account.inboxes.find(params[:inbox_id])
      end
    end
  end
end
