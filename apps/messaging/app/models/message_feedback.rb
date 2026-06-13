# == Schema Information
#
# Table name: messaging.message_feedbacks
#
#  id              :bigint           not null, primary key
#  message_id      :bigint           not null
#  account_id      :bigint           not null
#  conversation_id :bigint           not null
#  user_id         :bigint           not null
#  rating          :integer          not null
#  comment         :text
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_message_feedbacks_on_message_id_and_user_id  (message_id,user_id) UNIQUE
#  index_message_feedbacks_on_account_id              (account_id)
#  index_message_feedbacks_on_conversation_id         (conversation_id)
#  index_message_feedbacks_on_user_id                 (user_id)
#  idx_message_feedbacks_account_rating_created       (account_id,rating,created_at)
#

class MessageFeedback < ApplicationRecord
  COMMENT_MAX_LENGTH = 2000

  belongs_to :message
  belongs_to :account
  belongs_to :conversation
  belongs_to :user

  # Agente evalúa la respuesta del bot/IA. Comentario solo aplica al voto negativo.
  enum rating: { dislike: 0, like: 1 }

  # El like nunca lleva comentario (se descarta); el dislike se normaliza (strip).
  before_validation :normalize_comment

  validates :rating, presence: true
  validates :comment, presence: true, if: :dislike?
  validates :comment, length: { maximum: COMMENT_MAX_LENGTH }
  validates :user_id, uniqueness: { scope: :message_id }

  # Mismo shape que el serializer del listado (messages_controller#feedback_json)
  # para un contrato único hacia el frontend.
  def as_json_payload
    {
      rating: rating,
      comment: comment,
      user_id: user_id,
      updated_at: updated_at
    }
  end

  private

  def normalize_comment
    self.comment = dislike? ? comment&.strip.presence : nil
  end
end
