class ChangeUserVentiaUserIdToString < ActiveRecord::Migration[7.2]
  def up
    # Already handled in initial migration (ventia_user_id is now integer)
  end

  def down
    # No-op
  end
end
