class AddFtsToMessages < ActiveRecord::Migration[7.2]
  # REQUERIDO para CREATE INDEX CONCURRENTLY y para batchar el backfill sin
  # mantener una transacción gigante (que inflaría el WAL y bloat).
  disable_ddl_transaction!

  BACKFILL_BATCH_SIZE = 1_000

  def up
    # 1. Backfill PRIMERO. Llenamos processed_message_content donde está NULL
    #    antes de añadir la columna GENERATED, así el tsvector inicial se
    #    calcula una sola vez con datos completos (vs. ser recalculado tras
    #    el backfill por cambiar la columna fuente).
    backfill_processed_message_content

    # 2. ALTER TABLE ADD GENERATED STORED — operación más costosa.
    #    Toma AccessExclusiveLock y reescribe todas las filas calculando
    #    el tsvector. Estimado: 5-10s con decenas de miles de mensajes.
    #    En prod: correr en ventana de baja actividad.
    execute <<~SQL
      ALTER TABLE messages
        ADD COLUMN message_search_ts tsvector
        GENERATED ALWAYS AS (
          to_tsvector('simple', coalesce(processed_message_content, ''))
        ) STORED;
    SQL

    # 3. CONCURRENTLY = sin bloquear writes durante la creación del índice.
    add_index :messages, :message_search_ts,
              using: :gin,
              algorithm: :concurrently,
              name: 'index_messages_on_message_search_ts'
  end

  def down
    remove_index :messages,
                 name: 'index_messages_on_message_search_ts',
                 algorithm: :concurrently
    execute 'ALTER TABLE messages DROP COLUMN message_search_ts;'
    # El backfill de processed_message_content es irreversible (no perdemos
    # datos, solo lo dejamos lleno). Safe para mantener.
  end

  private

  # Actualiza filas en lotes pequeños para evitar locks largos y bloat masivo.
  # Cada batch commitea independientemente (disable_ddl_transaction!).
  def backfill_processed_message_content
    loop do
      affected = execute(<<~SQL).cmd_tuples
        UPDATE messages
        SET processed_message_content = content
        WHERE id IN (
          SELECT id FROM messages
          WHERE processed_message_content IS NULL
            AND content IS NOT NULL
          LIMIT #{BACKFILL_BATCH_SIZE}
        )
      SQL
      break if affected.zero?
    end
  end
end
