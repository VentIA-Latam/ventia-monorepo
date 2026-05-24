class Analytics::AdsSummaryService
  def initialize(account:, start_date:, end_date:, converted_conversation_ids:)
    @account = account
    @start_date = start_date
    @end_date = end_date
    @converted_ids = Array(converted_conversation_ids).map(&:to_i)
  end

  def perform
    return [] if @start_date.blank? || @end_date.blank?

    rows = ActiveRecord::Base.connection.exec_query(sanitized_sql, 'ads_summary')
    rows.map { |r| format_row(r) }
  end

  private

  def sanitized_sql
    ActiveRecord::Base.sanitize_sql_array([
      query_template,
      {
        account_id: @account.id,
        start_date: @start_date,
        end_date: @end_date,
        converted_ids: postgres_int_array(@converted_ids)
      }
    ])
  end

  def query_template
    <<~SQL.squish
      WITH latest_referral AS (
        SELECT DISTINCT ON (content_attributes->'referral'->>'source_id')
          content_attributes->'referral'->>'source_id'  AS ad_id,
          content_attributes->'referral'->>'headline'   AS headline,
          content_attributes->'referral'->>'image_url'  AS image_url,
          content_attributes->'referral'->>'source_url' AS source_url
        FROM messages
        WHERE account_id = :account_id
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN :start_date AND :end_date
        ORDER BY content_attributes->'referral'->>'source_id', created_at DESC
      ),
      ad_conversations AS (
        SELECT
          content_attributes->'referral'->>'source_id' AS ad_id,
          conversation_id
        FROM messages
        WHERE account_id = :account_id
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN :start_date AND :end_date
      )
      SELECT
        lr.ad_id, lr.headline, lr.image_url, lr.source_url,
        COUNT(DISTINCT ac.conversation_id) AS started,
        COUNT(DISTINCT ac.conversation_id)
          FILTER (WHERE ac.conversation_id = ANY(:converted_ids::int[])) AS converted
      FROM latest_referral lr
      JOIN ad_conversations ac USING (ad_id)
      GROUP BY lr.ad_id, lr.headline, lr.image_url, lr.source_url
      ORDER BY started DESC
    SQL
  end

  def postgres_int_array(ids)
    raise ArgumentError, 'converted_conversation_ids must contain only integers' \
      unless ids.all?(Integer)

    "{#{ids.join(',')}}"
  end

  def format_row(row)
    {
      ad_id: row['ad_id'],
      headline: row['headline'],
      image_url: row['image_url'],
      source_url: row['source_url'],
      started: row['started'].to_i,
      converted: row['converted'].to_i
    }
  end
end
