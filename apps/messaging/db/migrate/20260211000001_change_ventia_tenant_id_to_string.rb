class ChangeVentiaTenantIdToString < ActiveRecord::Migration[7.2]
  def up
    # Already handled in initial migration (ventia_tenant_id is now integer)
  end

  def down
    # No-op
  end
end
