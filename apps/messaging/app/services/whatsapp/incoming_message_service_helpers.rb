module Whatsapp::IncomingMessageServiceHelpers
  def message_content(message)
    message.dig(:text, :body) ||
      message.dig(:button, :text) ||
      message.dig(:interactive, :button_reply, :title) ||
      message.dig(:interactive, :list_reply, :title) ||
      message.dig(:name, :formatted_name)
  end

  def file_content_type(file_type)
    return :image if %w[image sticker].include?(file_type)
    return :audio if %w[audio voice].include?(file_type)
    return :video if ['video'].include?(file_type)
    return :location if ['location'].include?(file_type)
    return :contact if ['contacts'].include?(file_type)

    :file
  end

  def unprocessable_message_type?(message_type)
    %w[reaction ephemeral unsupported request_welcome].include?(message_type)
  end

  def error_webhook_event?(message)
    message.key?('errors') || message.key?(:errors)
  end

  def log_error(message)
    errors = message['errors'] || message[:errors]
    Rails.logger.warn "Whatsapp Error: #{errors&.first&.dig('title') || errors&.first&.dig(:title)} - contact: #{message['from'] || message[:from]}"
  end
end
