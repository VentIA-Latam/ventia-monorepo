class AddAiAgentEnabledToConversations < ActiveRecord::Migration[7.2]
  def change
    add_column :conversations, :ai_agent_enabled, :boolean, default: true, null: false
  end
end
