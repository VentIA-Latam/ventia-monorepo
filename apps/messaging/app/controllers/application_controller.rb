class ApplicationController < ActionController::API
  include ActionController::RequestForgeryProtection

  protect_from_forgery with: :null_session

  rescue_from ActiveRecord::RecordNotFound, with: :record_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :record_invalid
  rescue_from ArgumentError, with: :bad_request

  private

  def record_not_found(exception)
    render json: {
      error: 'Record not found',
      message: exception.message
    }, status: :not_found
  end

  def record_invalid(exception)
    render json: {
      error: 'Validation failed',
      message: exception.message,
      details: exception.record.errors.full_messages
    }, status: :unprocessable_entity
  end

  def bad_request(exception)
    render json: {
      error: 'Bad request',
      message: exception.message
    }, status: :bad_request
  end
end
