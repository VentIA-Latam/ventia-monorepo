# == Schema Information
#
# Table name: messaging.attachments
#
#  id               :uuid             not null, primary key
#  account_id       :uuid             not null
#  message_id       :uuid             not null
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

    Rails.application.routes.url_helpers.rails_blob_url(file, only_path: true)
  end

  private

  def check_file_size
    return unless file.attached?

    errors.add(:file, "is too large (max #{MAXIMUM_FILE_UPLOAD_SIZE / 1.megabyte}MB)") if file.byte_size > MAXIMUM_FILE_UPLOAD_SIZE
  end
end
