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
        SELECT DISTINCT ON (m.content_attributes->'referral'->>'source_id')
          m.content_attributes->'referral'->>'source_id'  AS ad_id,
          m.content_attributes->'referral'->>'headline'   AS headline,
          m.content_attributes->'referral'->>'image_url'  AS image_url,
          m.content_attributes->'referral'->>'source_url' AS source_url,
          i.channel_type                                  AS channel_type
        FROM messages m
        LEFT JOIN inboxes i ON i.id = m.inbox_id
        WHERE m.account_id = :account_id
          AND m.content_attributes->'referral'->>'source_id' IS NOT NULL
          AND m.created_at BETWEEN :start_date AND :end_date
        ORDER BY m.content_attributes->'referral'->>'source_id', m.created_at DESC
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
        lr.ad_id, lr.headline, lr.image_url, lr.source_url, lr.channel_type,
        COUNT(DISTINCT ac.conversation_id) AS started,
        COUNT(DISTINCT ac.conversation_id)
          FILTER (WHERE ac.conversation_id = ANY(:converted_ids::int[])) AS converted
      FROM latest_referral lr
      JOIN ad_conversations ac USING (ad_id)
      GROUP BY lr.ad_id, lr.headline, lr.image_url, lr.source_url, lr.channel_type
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
      channel: normalize_channel(row['channel_type']),
      started: row['started'].to_i,
      converted: row['converted'].to_i
    }
  end

  # Maps the polymorphic channel_type to a short token the frontend uses to pick the icon.
  def normalize_channel(channel_type)
    case channel_type
    when 'Channel::Instagram' then 'instagram'
    when 'Channel::Whatsapp'  then 'whatsapp'
    end
  end
end
