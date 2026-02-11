# == Schema Information
#
# Table name: messaging.canned_responses
#
#  id         :uuid             not null, primary key
#  account_id :uuid             not null
#  short_code :string           not null
#  content    :text             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class CannedResponse < ApplicationRecord
  belongs_to :account

  validates :short_code, presence: true, uniqueness: { scope: :account_id }
  validates :content, presence: true

  scope :search, lambda { |term|
    return all if term.blank?

    where('short_code ILIKE :term OR content ILIKE :term', term: "%#{term}%")
      .order(Arel.sql("CASE WHEN short_code ILIKE '#{sanitize_sql_like(term)}%' THEN 0 ELSE 1 END, short_code ASC"))
  }
end
