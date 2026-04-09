class Api::V1::AccountsController < Api::V1::BaseController
  skip_before_action :set_current_account, only: [:create]

  def index
    accounts = Account.all
    render_success(accounts)
  end

  def show
    render_success(current_account)
  end

  def create
    account = Account.new(account_params)

    if account.save
      render_success(account, message: 'Account created successfully', status: :created)
    else
      render_error('Failed to create account', errors: account.errors.full_messages)
    end
  end

  def update
    if current_account.update(account_params)
      render_success(current_account, message: 'Account updated successfully')
    else
      render_error('Failed to update account', errors: current_account.errors.full_messages)
    end
  end

  # GET /api/v1/accounts/temperature_config
  def temperature_config
    render_success(current_account.temperature_config || [])
  end

  # PUT /api/v1/accounts/temperature_config
  def update_temperature_config
    config = params[:temperature_config]

    unless config.is_a?(Array)
      return render_error('temperature_config must be an array', status: :bad_request)
    end

    old_keys = (current_account.temperature_config || []).map { |t| t["key"] }
    new_keys = config.map { |t| t["key"] }
    removed_keys = old_keys - new_keys

    config_hashes = config.map { |item| item.respond_to?(:to_unsafe_h) ? item.to_unsafe_h : item }

    if current_account.update(temperature_config: config_hashes)
      # Nullify temperature on conversations with removed keys
      if removed_keys.any?
        current_account.conversations
          .where(temperature: removed_keys)
          .update_all(temperature: nil)
      end
      render_success(current_account.temperature_config)
    else
      render_error('Invalid temperature config', errors: current_account.errors.full_messages)
    end
  end

  private

  def account_params
    params.require(:account).permit(:name, :locale, :status, :ventia_tenant_id, settings: {})
  end
end
