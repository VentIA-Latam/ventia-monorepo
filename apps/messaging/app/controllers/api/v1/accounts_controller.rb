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

  private

  def account_params
    params.require(:account).permit(:name, :locale, :status, :ventia_tenant_id, settings: {})
  end
end
