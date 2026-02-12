module Api
  module V1
    class UsersController < BaseController
      before_action :set_user, only: [:show, :update, :destroy]

      # GET /api/v1/users
      def index
        @users = @current_account.users.order_by_name
        @users = @users.where(ventia_user_id: params[:ventia_user_id]) if params[:ventia_user_id].present?
        render_success(@users.map(&:push_event_data))
      end

      # GET /api/v1/users/:id
      def show
        render_success(@user)
      end

      # POST /api/v1/users (sync from Ventia)
      def create
        @user = User.find_or_initialize_by(ventia_user_id: user_params[:ventia_user_id])
        @user.assign_attributes(user_params)

        if @user.save
          account_user = @current_account.account_users.find_or_initialize_by(user: @user)
          account_user.role = params[:role] if params[:role].present?
          account_user.save!

          render json: { user: @user.push_event_data, account_user: account_user.push_event_data },
                 status: @user.previously_new_record? ? :created : :ok
        else
          render_error('Failed to save user', errors: @user.errors.full_messages)
        end
      end

      # PATCH /api/v1/users/:id
      def update
        if @user.update(user_params)
          render_success(@user.push_event_data)
        else
          render_error('Failed to save user', errors: @user.errors.full_messages)
        end
      end

      # DELETE /api/v1/users/:id
      def destroy
        @current_account.account_users.find_by(user: @user)&.destroy
        head :no_content
      end

      private

      def set_user
        @user = @current_account.users.find(params[:id])
      end

      def user_params
        params.require(:user).permit(:ventia_user_id, :name, :email, :avatar_url, custom_attributes: {})
      end
    end
  end
end
