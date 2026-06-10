require 'rails_helper'

RSpec.describe Campaigns::TriggerScheduledJob do
  include ActiveJob::TestHelper

  let(:account) { create(:account) }
  let(:inbox)   { create(:inbox, account: account) }

  def make_campaign(overrides = {})
    Campaign.create!({
      account: account, inbox: inbox, title: "C-#{SecureRandom.hex(2)}",
      campaign_status: :active, enabled: true, scheduled_at: 1.minute.ago
    }.merge(overrides))
  end

  before { ActiveJob::Base.queue_adapter = :test }

  it 'encola TriggerJob por cada campaña triggerable' do
    c1 = make_campaign
    c2 = make_campaign(scheduled_at: 5.minutes.ago)

    expect { described_class.perform_now }
      .to have_enqueued_job(Campaigns::TriggerJob).with(c1.id)
      .and have_enqueued_job(Campaigns::TriggerJob).with(c2.id)
  end

  it 'omite campañas con scheduled_at futuro' do
    make_campaign(scheduled_at: 1.hour.from_now)
    expect { described_class.perform_now }.not_to have_enqueued_job(Campaigns::TriggerJob)
  end

  it 'omite campañas ya triggered' do
    make_campaign(triggered_at: 1.minute.ago)
    expect { described_class.perform_now }.not_to have_enqueued_job(Campaigns::TriggerJob)
  end

  it 'omite campañas disabled' do
    make_campaign(enabled: false)
    expect { described_class.perform_now }.not_to have_enqueued_job(Campaigns::TriggerJob)
  end

  it 'omite campañas en estado :draft' do
    make_campaign(campaign_status: :draft)
    expect { described_class.perform_now }.not_to have_enqueued_job(Campaigns::TriggerJob)
  end
end
