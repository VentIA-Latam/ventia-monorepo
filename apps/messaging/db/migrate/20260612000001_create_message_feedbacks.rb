class CreateMessageFeedbacks < ActiveRecord::Migration[7.2]
  def change
    create_table :message_feedbacks do |t|
      t.references :message, null: false, foreign_key: true, index: false
      t.bigint  :account_id,      null: false
      t.bigint  :conversation_id, null: false
      t.bigint  :user_id,         null: false
      t.integer :rating,          null: false # 0 dislike, 1 like
      t.text    :comment
      t.timestamps
    end

    # One feedback per (message, agent): nadie sobrescribe el voto de otro.
    add_index :message_feedbacks, [:message_id, :user_id], unique: true
    add_index :message_feedbacks, :account_id
    add_index :message_feedbacks, :conversation_id
    add_index :message_feedbacks, :user_id
    # Export/analítica por cuenta + rating + fecha.
    add_index :message_feedbacks, [:account_id, :rating, :created_at]
  end
end
