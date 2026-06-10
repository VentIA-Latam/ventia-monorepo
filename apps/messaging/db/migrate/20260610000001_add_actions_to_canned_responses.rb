class AddActionsToCannedResponses < ActiveRecord::Migration[7.2]
  # Acciones asociadas a una respuesta rápida (canned response) que se ejecutan al
  # enviar un mensaje originado en ella. Mismo esquema jsonb que Macro/AutomationRule
  # ([{ action_name, action_params }]) para reusar Automation::ActionService.
  def change
    add_column :canned_responses, :actions, :jsonb, default: [], null: false
  end
end
