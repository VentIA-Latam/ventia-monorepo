# == Schema Information
#
# Table name: messaging.team_members
#
#  id         :uuid             not null, primary key
#  team_id    :uuid             not null
#  user_id    :uuid             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class TeamMember < ApplicationRecord
  belongs_to :team
  belongs_to :user

  validates :user_id, uniqueness: { scope: :team_id }
end
