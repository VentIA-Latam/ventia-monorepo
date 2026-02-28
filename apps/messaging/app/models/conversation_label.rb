# == Schema Information
#
# Table name: messaging.conversation_labels
#
#  id              :bigint           not null, primary key
#  conversation_id :bigint           not null
#  label_id        :bigint           not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_conversation_labels_on_conversation_id              (conversation_id)
#  index_conversation_labels_on_label_id                     (label_id)
#  index_conversation_labels_on_conversation_id_and_label_id (conversation_id, label_id) UNIQUE
#

class ConversationLabel < ApplicationRecord
  include Wisper::Publisher

  validates :conversation_id, presence: true
  validates :label_id, presence: true
  validates :label_id, uniqueness: { scope: :conversation_id }

  belongs_to :conversation
  belongs_to :label

  after_create_commit :dispatch_create_event
  after_destroy_commit :dispatch_destroy_event

  private

  def dispatch_create_event
    Rails.logger.info "Label #{label_id} added to conversation #{conversation_id}"
    broadcast_label_update
  end

  def dispatch_destroy_event
    Rails.logger.info "Label #{label_id} removed from conversation #{conversation_id}"
    broadcast_label_update
  end

  def broadcast_label_update
    broadcast(:conversation_labels_updated, data: {
      conversation: conversation,
      labels: conversation.labels.map { |l| { id: l.id, title: l.title, color: l.color } }
    })
  end
end
