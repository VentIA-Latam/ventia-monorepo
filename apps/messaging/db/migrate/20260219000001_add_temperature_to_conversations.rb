class AddTemperatureToConversations < ActiveRecord::Migration[7.2]
  def change
    add_column :conversations, :temperature, :integer, default: nil
    add_index :conversations, :temperature
  end
end
