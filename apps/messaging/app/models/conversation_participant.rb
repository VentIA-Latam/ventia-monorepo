# == Schema Information
#
# Table name: messaging.conversation_participants
#
#  id              :bigint           not null, primary key
#  account_id      :bigint           not null
#  conversation_id :bigint           not null
#  user_id         :bigint           not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#

class ConversationParticipant < ApplicationRecord
  belongs_to :account
  belongs_to :conversation
  belongs_to :user

  validates :user_id, presence: true, uniqueness: { scope: :conversation_id }

  before_validation :ensure_account_id

  private

  def ensure_account_id
    self.account_id = conversation&.account_id
  end
end
