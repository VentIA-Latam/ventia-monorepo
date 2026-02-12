class ChangeUserVentiaUserIdToString < ActiveRecord::Migration[7.2]
  def up
    change_column :users, :ventia_user_id, :string, null: false
  end

  def down
    change_column :users, :ventia_user_id, :uuid, null: false, using: 'ventia_user_id::uuid'
  end
end
