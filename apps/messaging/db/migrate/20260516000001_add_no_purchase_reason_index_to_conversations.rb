class AddNoPurchaseReasonIndexToConversations < ActiveRecord::Migration[7.2]
  def change
    add_index :conversations,
      "(custom_attributes->>'no_purchase_reason')",
      using: :btree,
      name: "idx_conversations_no_purchase_reason"
  end
end
