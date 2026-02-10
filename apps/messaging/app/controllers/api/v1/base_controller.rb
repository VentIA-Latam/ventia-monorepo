class Api::V1::BaseController < ApplicationController
  before_action :set_current_account

  private

  def set_current_account
    # For now, we'll use tenant_id from params/headers
    # In production, this should come from JWT token validation
    tenant_id = request.headers['X-Tenant-Id'] || params[:tenant_id]

    if tenant_id.present?
      @current_account = Account.find_by(ventia_tenant_id: tenant_id)

      unless @current_account
        render json: { error: 'Account not found for tenant' }, status: :not_found
      end
    else
      render json: { error: 'Tenant ID required' }, status: :unauthorized
    end
  end

  def current_account
    @current_account
  end

  def render_success(data, message: nil, status: :ok)
    response = { success: true }
    response[:message] = message if message
    response[:data] = data if data

    render json: response, status: status
  end

  def render_error(message, errors: nil, status: :unprocessable_entity)
    response = { success: false, error: message }
    response[:errors] = errors if errors

    render json: response, status: status
  end

  def pagination_meta(collection)
    {
      current_page: collection.current_page,
      next_page: collection.next_page,
      prev_page: collection.prev_page,
      total_pages: collection.total_pages,
      total_count: collection.total_count
    }
  end
end
