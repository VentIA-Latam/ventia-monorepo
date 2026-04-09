class ConvertTemperatureToCustomConfig < ActiveRecord::Migration[7.2]
  def up
    # 1. Add temperature_config JSONB to accounts
    add_column :accounts, :temperature_config, :jsonb, default: []

    # 2. Convert temperature integer → string on conversations
    add_column :conversations, :temperature_str, :string

    execute <<-SQL
      UPDATE conversations SET temperature_str =
        CASE temperature
          WHEN 0 THEN 'cold'
          WHEN 1 THEN 'warm'
          WHEN 2 THEN 'hot'
        END
      WHERE temperature IS NOT NULL;
    SQL

    remove_index :conversations, :temperature, if_exists: true
    remove_column :conversations, :temperature
    rename_column :conversations, :temperature_str, :temperature
    add_index :conversations, :temperature

    # 3. Seed default temperature_config for existing accounts
    Account.find_each do |account|
      account.update_column(:temperature_config, [
        { "key" => "cold", "name" => "Frío", "color" => "#1f93ff", "icon" => "snowflake", "position" => 0 },
        { "key" => "warm", "name" => "Tibio", "color" => "#FF9800", "icon" => "thermometer", "position" => 1 },
        { "key" => "hot", "name" => "Caliente", "color" => "#E91E63", "icon" => "flame", "position" => 2 }
      ])
    end
  end

  def down
    # Revert temperature_config
    remove_column :accounts, :temperature_config

    # Revert temperature string → integer
    add_column :conversations, :temperature_int, :integer

    execute <<-SQL
      UPDATE conversations SET temperature_int =
        CASE temperature
          WHEN 'cold' THEN 0
          WHEN 'warm' THEN 1
          WHEN 'hot' THEN 2
        END
      WHERE temperature IS NOT NULL;
    SQL

    remove_index :conversations, :temperature, if_exists: true
    remove_column :conversations, :temperature
    rename_column :conversations, :temperature_int, :temperature
    add_index :conversations, :temperature
  end
end
