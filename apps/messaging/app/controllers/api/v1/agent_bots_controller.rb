class Api::V1::AgentBotsController < Api::V1::BaseController
  before_action :set_agent_bot, only: [:show, :update, :destroy]

  def index
    bots = current_account.agent_bots
    render_success(bots)
  end

  def show
    render_success(@agent_bot)
  end

  def create
    bot = current_account.agent_bots.new(agent_bot_params)

    if bot.save
      render_success(bot, message: 'Agent bot created', status: :created)
    else
      render_error('Failed to create agent bot', errors: bot.errors.full_messages)
    end
  end

  def update
    if @agent_bot.update(agent_bot_params)
      render_success(@agent_bot, message: 'Agent bot updated')
    else
      render_error('Failed to update agent bot', errors: @agent_bot.errors.full_messages)
    end
  end

  def destroy
    @agent_bot.destroy
    render_success(nil, message: 'Agent bot deleted')
  end

  private

  def set_agent_bot
    @agent_bot = current_account.agent_bots.find(params[:id])
  end

  def agent_bot_params
    params.require(:agent_bot).permit(:name, :description, :bot_type, bot_config: {})
  end
end
