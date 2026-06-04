class Api::V1::CampaignsController < Api::V1::BaseController
  before_action :set_campaign, only: %i[
    show update destroy trigger pause resume
    upload_csv set_labels_audience preview retry_failed
    recipients destroy_recipient
  ]
  before_action :ensure_draft!, only: %i[update upload_csv set_labels_audience destroy_recipient]

  MAX_CSV_BYTES = 5.megabytes

  def index
    campaigns = current_account.campaigns
                               .includes(:inbox)
                               .order(created_at: :desc)
    render_success(campaigns.map { |c| campaign_json(c) })
  end

  def show
    render_success(campaign_json(@campaign, with_stats: true))
  end

  def create
    campaign = current_account.campaigns.new(campaign_create_params)
    campaign.campaign_status ||= :draft

    if campaign.save
      render_success(campaign_json(campaign), message: 'Campaign created', status: :created)
    else
      render_error('Failed to create campaign', errors: campaign.errors.full_messages)
    end
  end

  def update
    if @campaign.update(campaign_update_params)
      render_success(campaign_json(@campaign, with_stats: true), message: 'Campaign updated')
    else
      render_error('Failed to update campaign', errors: @campaign.errors.full_messages)
    end
  end

  def destroy
    @campaign.destroy
    render_success(nil, message: 'Campaign deleted')
  end

  # POST /campaigns/:id/trigger
  # Si scheduled_at en futuro → status :active, cron lo recoge. Si nil/pasado → :active + enqueue ahora.
  def trigger
    return render_error('Campaign must be in :draft to trigger', status: :unprocessable_entity) unless @campaign.draft?
    return render_error('Campaign has no recipients', status: :unprocessable_entity) if @campaign.campaign_recipients.empty?

    scheduled = params[:scheduled_at].present? ? Time.zone.parse(params[:scheduled_at].to_s) : nil

    if scheduled && scheduled > Time.current
      @campaign.update!(campaign_status: :active, scheduled_at: scheduled)
      render_success(campaign_json(@campaign), message: 'Campaign scheduled')
    else
      @campaign.update!(campaign_status: :active, scheduled_at: Time.current)
      @campaign.trigger! # enqueues TriggerJob
      render_success(campaign_json(@campaign), message: 'Campaign triggered')
    end
  rescue ArgumentError => e
    render_error(e.message, status: :unprocessable_entity)
  end

  def pause
    @campaign.pause!
    render_success(campaign_json(@campaign))
  end

  def resume
    @campaign.resume!
    render_success(campaign_json(@campaign))
  end

  # POST /campaigns/:id/audience/csv  (multipart, field "file")
  def upload_csv
    file = params[:file]
    return render_error('file requerido', status: :unprocessable_entity) if file.blank?
    return render_error("Archivo > #{MAX_CSV_BYTES / 1.megabyte}MB", status: :unprocessable_entity) if file.size > MAX_CSV_BYTES

    content = file.respond_to?(:read) ? file.read : file.to_s
    result  = Campaigns::CsvParser.new(content).parse

    Campaign.transaction do
      @campaign.campaign_recipients.delete_all
      result.rows.each do |row|
        @campaign.campaign_recipients.create!(phone: row[:phone], vars: row[:vars], status: :pending)
      end
      @campaign.update!(audience_type: :csv, recipients_count: result.rows.size)
    end

    render_success(
      {
        recipients_count: result.rows.size,
        columns:          result.detected_columns,
        phone_column:     result.phone_column,
        skipped_rows:     result.skipped
      },
      message: 'CSV processed',
      status:  :created
    )
  rescue Campaigns::CsvParser::EmptyCsvError,
         Campaigns::CsvParser::NoPhoneColumnError,
         Campaigns::CsvParser::TooManyColumnsError,
         Campaigns::CsvParser::ParseError => e
    render_error(e.message, status: :unprocessable_entity)
  end

  # POST /campaigns/:id/audience/labels  body: { label_ids: [] }
  def set_labels_audience
    ids = Array(params[:label_ids]).map(&:to_i).reject(&:zero?)
    return render_error('label_ids requerido', status: :unprocessable_entity) if ids.empty?

    count = Campaigns::AudienceSnapshotService.new(campaign: @campaign, label_ids: ids).perform
    render_success({ recipients_count: count }, message: 'Audience snapshot created', status: :created)
  rescue Campaigns::AudienceSnapshotService::CampaignNotDraftError => e
    render_error(e.message, status: :unprocessable_entity)
  end

  # GET /campaigns/:id/preview
  def preview
    recipients = @campaign.campaign_recipients.order(:id)
    return render_success(empty_preview) if recipients.empty?

    sample_ids = pick_sample_ids(recipients)
    samples = recipients.where(id: sample_ids).map { |r| render_preview(r) }

    render_success(
      template_name:    @campaign.template_params&.dig('name'),
      recipients_count: recipients.count,
      omitted_samples:  preview_omitted_samples(recipients),
      samples:          samples
    )
  end

  # POST /campaigns/:id/retry-failed
  def retry_failed
    return render_error('only :completed campaigns can retry', status: :unprocessable_entity) unless @campaign.completed?

    failed = @campaign.campaign_recipients.where(status: :failed)
    count = failed.count
    return render_success({ retrying: 0 }, message: 'No failed recipients') if count.zero?

    Campaign.transaction do
      failed.update_all(status: 0, external_error: nil, sent_at: nil, delivered_at: nil, read_at: nil)
      @campaign.update!(campaign_status: :active, triggered_at: nil, failed_count: [@campaign.failed_count - count, 0].max)
      Campaigns::TriggerJob.perform_later(@campaign.id)
    end
    render_success({ retrying: count }, message: 'Retry enqueued')
  end

  # GET /campaigns/:id/recipients
  def recipients
    base = @campaign.campaign_recipients.includes(:contact)
    base = filter_recipients(base)
    paginated = base.order(:id).page(params[:page] || 1).per(params[:per_page] || 25)
    render json: {
      success: true,
      data:    paginated.map { |r| recipient_json(r) },
      meta:    pagination_meta(paginated)
    }
  end

  # DELETE /campaigns/:id/recipients/:recipient_id
  def destroy_recipient
    recipient = @campaign.campaign_recipients.find(params[:recipient_id])
    recipient.destroy!
    @campaign.update!(recipients_count: @campaign.campaign_recipients.count)
    head :no_content
  end

  private

  def set_campaign
    @campaign = current_account.campaigns.find(params[:id])
  end

  def ensure_draft!
    return if @campaign.draft?

    render_error('Campaign must be in :draft for this action', status: :unprocessable_entity)
  end

  def campaign_create_params
    params.require(:campaign).permit(
      :title, :inbox_id, :header_media_url, :campaign_status, :enabled,
      template_params: {}
    )
  end

  def campaign_update_params
    params.require(:campaign).permit(
      :title, :header_media_url, :enabled,
      template_params: {}
    )
  end

  def filter_recipients(base)
    if params[:status].present?
      statuses = params[:status].to_s.split(',').map(&:strip)
      base = base.where(status: statuses)
    end

    if params[:search].present?
      term = "%#{ActiveRecord::Base.sanitize_sql_like(params[:search])}%"
      base = base.references(:contact)
                 .where('contact_recipients.phone ILIKE ? OR contacts.name ILIKE ?', term, term)
                 .or(base.where('campaign_recipients.phone ILIKE ?', term))
    end
    base
  end

  def pick_sample_ids(recipients)
    ids = recipients.pluck(:id)
    case ids.size
    when 1 then ids
    when 2 then ids
    else [ids.first, ids[ids.size / 2], ids.last]
    end
  end

  def render_preview(recipient)
    resolved = Campaigns::VariableResolver.new(recipient).resolve
    if resolved == :missing_attr
      return {
        recipient_id: recipient.id,
        phone:        recipient.phone,
        omitted:      true,
        reason:       'missing required attribute'
      }
    end

    built = Whatsapp::TemplateMessageBuilder.new(
      conversation:     fake_conversation_for_render(recipient),
      name:             @campaign.template_params['name'],
      language:         @campaign.template_params['language'],
      processed_params: resolved
    ).build

    {
      recipient_id:   recipient.id,
      phone:          recipient.phone,
      contact_name:   recipient.contact&.name,
      rendered_body:  built[:content],
      header_media:   @campaign.header_media_url
    }
  rescue Whatsapp::TemplateMessageBuilder::TemplateNotFound,
         Whatsapp::TemplateMessageBuilder::MissingBodyVariables => e
    { recipient_id: recipient.id, phone: recipient.phone, error: e.message }
  end

  def fake_conversation_for_render(recipient)
    # Render previewing doesn't actually create state — Whatsapp::TemplateMessageBuilder
    # needs `conversation.inbox.channel.message_templates` to look up the template.
    # Pass the campaign's inbox via a struct that quacks like Conversation.
    Struct.new(:inbox).new(@campaign.inbox)
  end

  def empty_preview
    { template_name: @campaign.template_params&.dig('name'), recipients_count: 0, omitted_samples: [], samples: [] }
  end

  def preview_omitted_samples(recipients)
    samples = []
    recipients.find_each do |r|
      resolved = Campaigns::VariableResolver.new(r).resolve
      if resolved == :missing_attr
        samples << { phone: r.phone, reason: 'missing required attribute' }
      end
      break if samples.size >= 3
    end
    samples
  end

  def campaign_json(campaign, with_stats: false)
    base = {
      id:               campaign.id,
      title:            campaign.title,
      message:          campaign.message,
      campaign_type:    campaign.campaign_type,
      campaign_status:  campaign.campaign_status,
      audience_type:    campaign.audience_type,
      header_media_url: campaign.header_media_url,
      template_params:  campaign.template_params,
      enabled:          campaign.enabled,
      scheduled_at:     campaign.scheduled_at,
      triggered_at:     campaign.triggered_at,
      recipients_count: campaign.recipients_count,
      sent_count:       campaign.sent_count,
      failed_count:     campaign.failed_count,
      inbox: { id: campaign.inbox.id, name: campaign.inbox.name }
    }
    base[:stats] = compute_stats(campaign) if with_stats
    base
  end

  def compute_stats(campaign)
    counts = campaign.campaign_recipients.group(:status).count
    %i[pending queued sent delivered read failed omitted].each_with_object({}) do |key, acc|
      acc[key] = counts[CampaignRecipient.statuses[key.to_s]].to_i
    end
  end

  def recipient_json(recipient)
    {
      id:              recipient.id,
      phone:           recipient.phone,
      contact_id:      recipient.contact_id,
      contact_name:    recipient.contact&.name,
      conversation_id: recipient.conversation_id,
      message_id:      recipient.message_id,
      status:          recipient.status,
      external_error:  recipient.external_error,
      sent_at:         recipient.sent_at,
      delivered_at:    recipient.delivered_at,
      read_at:         recipient.read_at
    }
  end
end
