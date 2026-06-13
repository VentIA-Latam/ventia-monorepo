class Api::V1::MessageFeedbacksController < Api::V1::BaseController
  CONTEXT_DEFAULT = 6
  CONTEXT_MAX = 20

  before_action :require_current_user, only: [:upsert, :destroy]
  before_action :set_conversation, only: [:upsert, :destroy]
  before_action :set_message, only: [:upsert, :destroy]
  before_action :require_admin, only: [:export]

  # PUT /api/v1/conversations/:conversation_id/messages/:id/feedback
  # Crea o actualiza el voto del agente actual sobre un mensaje de IA.
  def upsert
    unless @message.ai_generated?
      return render_error('Solo se pueden evaluar respuestas de la IA',
                          status: :unprocessable_entity)
    end

    attempts = 0
    begin
      feedback = MessageFeedback.find_or_initialize_by(message: @message, user_id: current_user.id)
      feedback.assign_attributes(
        account: current_account,
        conversation: @conversation,
        rating: feedback_params[:rating],
        comment: feedback_params[:comment]
      )

      if feedback.save
        render_success(feedback.as_json_payload)
      else
        render_error('No se pudo guardar el feedback', errors: feedback.errors.full_messages)
      end
    rescue ActiveRecord::RecordNotUnique
      # find_or_initialize + save no es atómico: dos requests concurrentes del
      # mismo agente sobre el mismo mensaje pueden chocar contra el índice único.
      # Reintentamos una vez para que el segundo encuentre y actualice la fila.
      attempts += 1
      retry if attempts < 2
      render_error('No se pudo guardar el feedback', status: :conflict)
    end
  rescue ArgumentError => e
    # rating fuera del enum → 422 en lugar de 500
    render_error(e.message, status: :unprocessable_entity)
  end

  # DELETE /api/v1/conversations/:conversation_id/messages/:id/feedback
  # Quita el voto del agente actual (toggle a neutral).
  def destroy
    MessageFeedback.where(message: @message, user_id: current_user.id).destroy_all
    render_success({})
  end

  # GET /api/v1/message_feedbacks/export
  # Dataset NDJSON (una línea por voto) con la respuesta del bot + contexto previo.
  # Filtros: rating, inbox_id, from, to. Param context = nº de mensajes previos.
  def export
    context_size = (params[:context].presence || CONTEXT_DEFAULT).to_i.clamp(0, CONTEXT_MAX)

    from = params[:from].present? ? parse_time(params[:from]) : nil
    to   = params[:to].present? ? parse_time(params[:to]) : nil
    if (params[:from].present? && from.nil?) || (params[:to].present? && to.nil?)
      return render_error('Parámetro de fecha inválido (use ISO8601)', status: :unprocessable_entity)
    end

    feedbacks = export_scope(from, to).to_a
    context_index = build_context_index(feedbacks, context_size)

    lines = feedbacks.map do |fb|
      {
        message_id: fb.message_id,
        conversation_id: fb.conversation_id,
        user_id: fb.user_id,
        rating: fb.rating,
        comment: fb.comment,
        bot_response: fb.message.content,
        context: context_index[fb.message_id] || [],
        inbox_id: fb.conversation.inbox_id,
        created_at: fb.created_at.iso8601
      }.to_json
    end

    render plain: lines.join("\n"), content_type: 'application/x-ndjson'
  end

  private

  def require_current_user
    render_error('Usuario requerido', status: :unauthorized) unless current_user
  end

  # Defensa en profundidad: aunque el proxy FastAPI ya restringe el export a
  # ADMIN/SUPERADMIN, validamos el rol del AccountUser también aquí (el dataset
  # es sensible). agent (VENTAS) queda fuera.
  def require_admin
    return render_error('Usuario requerido', status: :unauthorized) unless current_user

    account_user = current_account.account_users.find_by(user_id: current_user.id)
    return if account_user&.administrator? || account_user&.superadmin?

    render_error('No autorizado para exportar feedback', status: :forbidden)
  end

  def set_conversation
    @conversation = current_account.conversations.find(params[:conversation_id])
  end

  def set_message
    @message = @conversation.messages.find(params[:id])
  end

  def feedback_params
    params.permit(:rating, :comment)
  end

  def export_scope(from = nil, to = nil)
    # inbox_id es columna de conversations, así que basta precargar :conversation
    # (no :inbox). :message se usa para bot_response.
    scope = current_account.message_feedbacks
                           .includes(:message, :conversation)
                           .order(created_at: :asc)

    if params[:rating].present? && MessageFeedback.ratings.key?(params[:rating])
      scope = scope.where(rating: MessageFeedback.ratings[params[:rating]])
    end

    if params[:inbox_id].present?
      scope = scope.joins(:conversation).where(conversations: { inbox_id: params[:inbox_id] })
    end

    scope = scope.where('message_feedbacks.created_at >= ?', from) if from
    scope = scope.where('message_feedbacks.created_at <= ?', to) if to

    scope
  end

  # Construye el contexto (N mensajes previos) de TODOS los feedbacks con UNA
  # sola query (evita el N+1 que agotaba el pool de conexiones). Scopeado por
  # cuenta como defensa en profundidad.
  def build_context_index(feedbacks, size)
    return {} if size.zero? || feedbacks.empty?

    conversation_ids = feedbacks.map(&:conversation_id).uniq
    messages_by_conv = Message
                       .where(account_id: current_account.id, conversation_id: conversation_ids)
                       .where.not(message_type: :activity)
                       .order(:conversation_id, :created_at)
                       .group_by(&:conversation_id)

    feedbacks.each_with_object({}) do |fb, index|
      bot = fb.message
      prior = (messages_by_conv[fb.conversation_id] || [])
              .select { |m| m.created_at < bot.created_at }
              .last(size)
      index[fb.message_id] = prior.map { |m| { role: role_for(m), content: m.content } }
    end
  end

  def role_for(message)
    return 'customer' if message.incoming?
    return 'ai' if message.ai_generated?

    'agent'
  end

  def parse_time(value)
    return nil if value.blank?

    Time.zone.parse(value.to_s)
  rescue ArgumentError
    nil
  end
end
