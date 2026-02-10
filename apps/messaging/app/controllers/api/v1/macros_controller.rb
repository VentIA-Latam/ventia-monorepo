class Api::V1::MacrosController < Api::V1::BaseController
  before_action :set_macro, only: [:show, :update, :destroy, :execute]

  # GET /api/v1/macros
  def index
    @macros = if params[:user_id].present?
                # Global macros + personal macros of user
                @current_account.macros.global_macros
                  .or(@current_account.macros.personal_for(params[:user_id]))
              else
                # All macros (admin view)
                @current_account.macros
              end

    render json: @macros.order(created_at: :desc)
  end

  # GET /api/v1/macros/:id
  def show
    render json: @macro
  end

  # POST /api/v1/macros
  def create
    @macro = @current_account.macros.build(macro_params)
    @macro.created_by_id = params[:created_by_id]  # UUID from Ventia

    if @macro.save
      render json: @macro, status: :created
    else
      render json: { errors: @macro.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PUT /api/v1/macros/:id
  def update
    @macro.updated_by_id = params[:updated_by_id]  # UUID from Ventia

    if @macro.update(macro_params)
      render json: @macro
    else
      render json: { errors: @macro.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/macros/:id
  def destroy
    @macro.destroy
    head :no_content
  end

  # POST /api/v1/macros/:id/execute
  def execute
    conversation_ids = params[:conversation_ids] || []

    if conversation_ids.empty?
      render json: { error: 'No conversations provided' }, status: :bad_request
      return
    end

    # Execute async via Sidekiq
    Macros::ExecutionJob.perform_later(@macro.id, conversation_ids)

    render json: { message: 'Macro execution queued' }, status: :accepted
  end

  private

  def set_macro
    @macro = @current_account.macros.find(params[:id])
  end

  def macro_params
    params.require(:macro).permit(
      :name,
      :visibility,
      actions: [
        :action_name,
        action_params: {}
      ]
    )
  end
end
