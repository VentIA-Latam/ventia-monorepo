# == Schema Information
#
# Table name: messaging.teams
#
#  id                :bigint           not null, primary key
#  account_id        :bigint           not null
#  name              :string           not null
#  description       :text
#  allow_auto_assign :boolean          default(TRUE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#

class Team < ApplicationRecord
  belongs_to :account

  has_many :team_members, dependent: :destroy
  has_many :members, through: :team_members, source: :user
  has_many :conversations, dependent: :nullify

  validates :name, presence: true, uniqueness: { scope: :account_id }

  before_validation :normalize_name

  def add_members(user_ids)
    records = user_ids.map { |uid| team_members.find_or_create_by(user_id: uid) }
    records.filter_map(&:user)
  end

  def remove_members(user_ids)
    team_members.where(user_id: user_ids).destroy_all
  end

  def push_event_data
    {
      id: id,
      name: name,
      description: description,
      allow_auto_assign: allow_auto_assign
    }
  end

  private

  def normalize_name
    self.name = name.downcase if name.present?
  end
end
