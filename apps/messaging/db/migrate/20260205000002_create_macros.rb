class CreateMacros < ActiveRecord::Migration[7.2]
  def change
    create_table :macros do |t|
      t.bigint :account_id, null: false
      t.string :name, null: false
      t.integer :visibility, default: 0, null: false
      t.bigint :created_by_id
      t.bigint :updated_by_id
      t.jsonb :actions, default: [], null: false

      t.timestamps
    end

    add_index :macros, :account_id
    add_index :macros, :created_by_id
    add_index :macros, :visibility
    add_foreign_key :macros, :accounts, column: :account_id
  end
end
