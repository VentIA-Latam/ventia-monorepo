class AddStageAndSystemLabels < ActiveRecord::Migration[7.2]
  def change
    # Add stage to conversations (pre_sale: 0, sale: 1)
    add_column :conversations, :stage, :integer, default: 0, null: false
    add_index :conversations, :stage

    # Add indexes for unattended query performance
    add_index :conversations, :waiting_since
    add_index :conversations, :first_reply_created_at

    # Add system flag to labels
    add_column :labels, :system, :boolean, default: false, null: false
  end
end
