module Api
  module V1
    class ConversationAssignmentsController < BaseController
      before_action :set_conversation

      # PATCH /api/v1/conversations/:conversation_id/assign
      def assign
        assignee = params[:assignee_id].present? ? @current_account.users.find(params[:assignee_id]) : nil
        team = params[:team_id].present? ? @current_account.teams.find(params[:team_id]) : nil

        @conversation.update!(assignee: assignee, team: team)

        render json: @conversation.webhook_data
      end

      # POST /api/v1/conversations/:conversation_id/unassign
      def unassign
        @conversation.update!(assignee: nil)
        render json: @conversation.webhook_data
      end

      private

      def set_conversation
        @conversation = @current_account.conversations.find(params[:conversation_id])
      end
    end
  end
end
