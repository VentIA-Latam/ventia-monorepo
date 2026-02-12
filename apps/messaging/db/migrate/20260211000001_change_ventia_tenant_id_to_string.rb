class ChangeVentiaTenantIdToString < ActiveRecord::Migration[7.2]
  def up
    # Change ventia_tenant_id from uuid to string to accept integer tenant IDs from Ventia
    change_column :accounts, :ventia_tenant_id, :string, null: false
  end

  def down
    change_column :accounts, :ventia_tenant_id, :uuid, null: false, using: 'ventia_tenant_id::uuid'
  end
end
