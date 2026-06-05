class AddCreatedAtIndexToConversations < ActiveRecord::Migration[7.2]
  # El KPI "chats iniciados por día" (US-AUDIT-003) filtra y agrupa por
  # conversations.created_at (acotado por account en single-tenant). Sin índice,
  # el rango fuerza un sequential scan en accounts de alto volumen. Índice
  # compuesto (account_id, created_at) para cubrir el caso por tenant.
  def change
    add_index :conversations, %i[account_id created_at],
      name: "index_conversations_on_account_id_and_created_at"
  end
end
