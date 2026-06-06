# == Schema Information
#
# Table name: messaging.notes
#
#  id         :bigint           not null, primary key
#  content    :text             not null
#  account_id :bigint           not null
#  contact_id :bigint           not null
#  user_id    :bigint
#  created_at :datetime         not null
#  updated_at :datetime         not null
#
# Indexes
#
#  index_notes_on_account_id                  (account_id)
#  index_notes_on_contact_id                  (contact_id)
#  index_notes_on_contact_id_and_created_at   (contact_id, created_at)
#  index_notes_on_user_id                     (user_id)
#

class Note < ApplicationRecord
  CONTENT_MAX_LENGTH = 2000

  belongs_to :account
  belongs_to :contact
  belongs_to :user, optional: true

  validates :content, presence: true, length: { maximum: CONTENT_MAX_LENGTH }

  scope :recent_first, -> { order(created_at: :desc) }
end
