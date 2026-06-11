class ExtendCampaignsForEngine < ActiveRecord::Migration[7.2]
  def change
    add_column :campaigns, :template_params,  :jsonb,   default: {}
    add_column :campaigns, :audience_type,    :integer, default: 0
    add_column :campaigns, :header_media_url, :string
    add_column :campaigns, :recipients_count, :integer, default: 0
    add_column :campaigns, :sent_count,       :integer, default: 0
    add_column :campaigns, :failed_count,     :integer, default: 0

    # campaign_status enum extends: active=0, completed=1, paused=2, running=3, draft=4, failed=5
    # New campaigns default to :draft (4) so the wizard can build them before triggering.
    change_column_default :campaigns, :campaign_status, from: 0, to: 4
  end
end
