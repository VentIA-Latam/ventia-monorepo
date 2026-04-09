# == Schema Information
#
# Table name: messaging.contact_inboxes
#
#  id                    :bigint           not null, primary key
#  contact_id            :bigint           not null
#  inbox_id              :bigint           not null
#  source_id             :string           not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#
# Indexes
#
#  index_contact_inboxes_on_contact_id             (contact_id)
#  index_contact_inboxes_on_inbox_id               (inbox_id)
#  index_contact_inboxes_on_source_id_and_inbox_id (source_id, inbox_id) UNIQUE
#

class ContactInbox < ApplicationRecord
  validates :inbox_id, presence: true
  validates :contact_id, presence: true
  validates :source_id, presence: true
  validates :source_id, uniqueness: { scope: [:inbox_id] }

  belongs_to :contact
  belongs_to :inbox

  has_many :conversations, dependent: :destroy
end
