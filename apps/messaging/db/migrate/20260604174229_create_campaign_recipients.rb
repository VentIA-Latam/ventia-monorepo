class CreateCampaignRecipients < ActiveRecord::Migration[7.2]
  def change
    create_table :campaign_recipients do |t|
      t.references :campaign, null: false, foreign_key: true, index: true
      t.references :contact, foreign_key: true, index: true # nullable hasta que SendRecipientJob find_or_create el contact
      t.string  :phone, null: false
      t.jsonb   :vars, default: {}
      # conversation_id / message_id no son FK formales: el webhook puede correr antes que el job termine.
      # Si después el contact/conversation/message se borra, queremos que el recipient quede como huérfano-no-roto.
      t.bigint  :conversation_id
      t.bigint  :message_id
      t.integer :status, default: 0, null: false
      # Status enum: pending=0, queued=1, sent=2, delivered=3, read=4, failed=5, omitted=6
      t.text    :external_error
      t.datetime :sent_at
      t.datetime :delivered_at
      t.datetime :read_at
      t.timestamps
    end

    add_index :campaign_recipients, [:campaign_id, :status]
    add_index :campaign_recipients, [:campaign_id, :phone], unique: true
    add_index :campaign_recipients, :message_id, where: 'message_id IS NOT NULL'
  end
end
