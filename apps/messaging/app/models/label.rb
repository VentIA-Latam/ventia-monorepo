# == Schema Information
#
# Table name: messaging.labels
#
#  id              :uuid             not null, primary key
#  title           :string           not null
#  description     :text
#  color           :string           default("#1f93ff"), not null
#  show_on_sidebar :boolean          default(TRUE)
#  account_id      :uuid             not null
#  created_at      :datetime         not null
#  updated_at      :datetime         not null
#
# Indexes
#
#  index_labels_on_account_id            (account_id)
#  index_labels_on_title_and_account_id  (title, account_id) UNIQUE
#

class Label < ApplicationRecord
  # Validations
  validates :title, presence: true, uniqueness: { scope: :account_id }
  validates :color, presence: true
  validates :account_id, presence: true

  # Associations
  belongs_to :account
  has_many :conversation_labels, dependent: :destroy
  has_many :conversations, through: :conversation_labels

  # Callbacks
  before_validation :normalize_title

  # Scopes
  default_scope -> { order(:title) }
  scope :visible_on_sidebar, -> { where(show_on_sidebar: true) }

  def webhook_data
    {
      id: id,
      title: title,
      description: description,
      color: color
    }
  end

  private

  def normalize_title
    self.title = title.downcase.strip if title.present?
  end
end
