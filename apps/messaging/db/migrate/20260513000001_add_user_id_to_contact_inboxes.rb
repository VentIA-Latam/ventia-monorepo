class AddUserIdToContactInboxes < ActiveRecord::Migration[7.1]
  def change
    add_column :contact_inboxes, :user_id, :string

    add_index :contact_inboxes, [:user_id, :inbox_id],
              unique: true,
              where: "user_id IS NOT NULL",
              name: "index_contact_inboxes_on_user_id_and_inbox_id"
  end
end
