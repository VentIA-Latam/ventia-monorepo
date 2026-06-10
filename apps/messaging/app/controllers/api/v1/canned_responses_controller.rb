module Api
  module V1
    class CannedResponsesController < BaseController
      before_action :authorize_management!, only: [:create, :update, :destroy]
      before_action :set_canned_response, only: [:show, :update, :destroy]

      # GET /api/v1/canned_responses
      def index
        @canned_responses = @current_account.canned_responses.search(params[:search])
        render_success(@canned_responses)
      end

      # GET /api/v1/canned_responses/:id
      def show
        render_success(@canned_response)
      end

      # POST /api/v1/canned_responses
      def create
        @canned_response = @current_account.canned_responses.new(canned_response_params)

        if @canned_response.save
          render_success(@canned_response, status: :created)
        else
          render_error(@canned_response.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/canned_responses/:id
      def update
        if @canned_response.update(canned_response_params)
          render_success(@canned_response)
        else
          render_error(@canned_response.errors.full_messages, status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/canned_responses/:id
      def destroy
        @canned_response.destroy
        head :no_content
      end

      private

      # Only administrators and superadmins of the account may create/update/destroy
      # canned responses; agents can only list and view them. Centralised here so the
      # future "brand admin" role can be plugged into a single place.
      def authorize_management!
        membership = @current_account.account_users.find_by(user: @current_user)
        return if membership && %w[administrator superadmin].include?(membership.role)

        render_error("No autorizado", status: :forbidden)
      end

      def set_canned_response
        @canned_response = @current_account.canned_responses.find(params[:id])
      end

      def canned_response_params
        params.require(:canned_response).permit(:short_code, :content)
      end
    end
  end
end
