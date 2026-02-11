module Api
  module V1
    class TeamsController < BaseController
      before_action :set_team, only: [:show, :update, :destroy, :add_members, :remove_members]

      # GET /api/v1/teams
      def index
        @teams = @current_account.teams.includes(:members)
        render_success(@teams.map(&:push_event_data))
      end

      # GET /api/v1/teams/:id
      def show
        render json: {
          team: @team.push_event_data,
          members: @team.members.map(&:push_event_data)
        }
      end

      # POST /api/v1/teams
      def create
        @team = @current_account.teams.new(team_params)

        if @team.save
          render json: @team.push_event_data, status: :created
        else
          render_error(@team.errors.full_messages, :unprocessable_entity)
        end
      end

      # PATCH /api/v1/teams/:id
      def update
        if @team.update(team_params)
          render_success(@team.push_event_data)
        else
          render_error(@team.errors.full_messages, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/teams/:id
      def destroy
        @team.destroy
        head :no_content
      end

      # POST /api/v1/teams/:id/add_members
      def add_members
        added = @team.add_members(params[:user_ids])
        render json: { members: added.map(&:push_event_data) }
      end

      # POST /api/v1/teams/:id/remove_members
      def remove_members
        @team.remove_members(params[:user_ids])
        head :no_content
      end

      private

      def set_team
        @team = @current_account.teams.find(params[:id])
      end

      def team_params
        params.require(:team).permit(:name, :description, :allow_auto_assign)
      end
    end
  end
end
