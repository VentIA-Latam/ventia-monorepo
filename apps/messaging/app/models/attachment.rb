# == Schema Information
#
# Table name: messaging.attachments
#
#  id               :bigint           not null, primary key
#  account_id       :bigint           not null
#  message_id       :bigint           not null
#  file_type        :integer          default("image")
#  external_url     :string
#  extension        :string
#  coordinates_lat  :float            default(0.0)
#  coordinates_long :float            default(0.0)
#  meta             :jsonb            default({})
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#

class Attachment < ApplicationRecord
  belongs_to :account
  belongs_to :message

  has_one_attached :file

  enum :file_type, { image: 0, audio: 1, video: 2, file: 3, location: 4, contact: 5 }

  validates :external_url, length: { maximum: 2048 }, allow_blank: true

  MAXIMUM_FILE_UPLOAD_SIZE = ENV.fetch('MAXIMUM_FILE_UPLOAD_SIZE', 40).to_i.megabytes

  validate :check_file_size

  def push_event_data
    base = {
      id: id,
      message_id: message_id,
      file_type: file_type,
      account_id: account_id
    }

    if location?
      base.merge(coordinates_lat: coordinates_lat, coordinates_long: coordinates_long, data_url: external_url)
    elsif file.attached?
      base.merge(extension: extension, data_url: file_url, file_size: file.byte_size)
    else
      base.merge(data_url: external_url)
    end
  end

  def file_url
    return '' unless file.attached?
    return '' if new_record? || !file.blob&.persisted?

    Rails.application.routes.url_helpers.rails_blob_url(file, only_path: true)
  end

  # Direct URL for external services (WhatsApp, etc.) that can't follow redirects.
  # Uses FRONTEND_URL so the URL is publicly accessible.
  def download_url
    return external_url if external_url.present?
    return '' unless file.attached?

    ActiveStorage::Current.url_options = Rails.application.routes.default_url_options if ActiveStorage::Current.url_options.blank?
    file.blob.url
  end

  private

  def check_file_size
    return unless file.attached?

    errors.add(:file, "is too large (max #{MAXIMUM_FILE_UPLOAD_SIZE / 1.megabyte}MB)") if file.byte_size > MAXIMUM_FILE_UPLOAD_SIZE
  end
end
