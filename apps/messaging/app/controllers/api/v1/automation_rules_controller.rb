class Api::V1::AutomationRulesController < Api::V1::BaseController
  before_action :set_rule, only: [:show, :update, :destroy, :toggle, :clone]

  def index
    rules = current_account.automation_rules.order(created_at: :desc)
    render_success(rules.map { |r| rule_json(r) })
  end

  def show
    render_success(rule_json(@rule))
  end

  def create
    rule = current_account.automation_rules.new(rule_params)

    if rule.save
      render_success(rule_json(rule), message: 'Automation rule created', status: :created)
    else
      render_error('Failed to create rule', errors: rule.errors.full_messages)
    end
  end

  def update
    if @rule.update(rule_params)
      render_success(rule_json(@rule), message: 'Automation rule updated')
    else
      render_error('Failed to update rule', errors: @rule.errors.full_messages)
    end
  end

  def destroy
    @rule.destroy
    render_success(nil, message: 'Automation rule deleted')
  end

  def toggle
    @rule.toggle!
    render_success(rule_json(@rule), message: "Rule #{@rule.active? ? 'activated' : 'deactivated'}")
  end

  def clone
    new_rule = @rule.dup
    new_rule.name = "#{@rule.name} (Copy)"

    if new_rule.save
      render_success(rule_json(new_rule), message: 'Rule cloned', status: :created)
    else
      render_error('Failed to clone rule', errors: new_rule.errors.full_messages)
    end
  end

  private

  def set_rule
    @rule = current_account.automation_rules.find(params[:id])
  end

  def rule_params
    params.require(:automation_rule).permit(
      :name,
      :description,
      :event_name,
      :active,
      conditions: [],
      actions: []
    )
  end

  def rule_json(rule)
    {
      id: rule.id,
      name: rule.name,
      description: rule.description,
      event_name: rule.event_name,
      active: rule.active,
      conditions: rule.conditions,
      actions: rule.actions,
      created_at: rule.created_at
    }
  end
end
