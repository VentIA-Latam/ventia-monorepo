class CreateNotes < ActiveRecord::Migration[7.2]
  def change
    create_table :notes do |t|
      t.text :content, null: false
      t.references :account, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :user,    null: true,  foreign_key: true
      t.timestamps
    end

    add_index :notes, [:contact_id, :created_at]
  end
end
