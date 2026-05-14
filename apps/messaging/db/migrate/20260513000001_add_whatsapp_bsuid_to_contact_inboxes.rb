class AddWhatsappBsuidToContactInboxes < ActiveRecord::Migration[7.1]
  def change
    add_column :contact_inboxes, :whatsapp_bsuid, :string

    add_index :contact_inboxes, [:whatsapp_bsuid, :inbox_id],
              unique: true,
              where: "whatsapp_bsuid IS NOT NULL",
              name: "index_contact_inboxes_on_whatsapp_bsuid_and_inbox_id"
  end
end
