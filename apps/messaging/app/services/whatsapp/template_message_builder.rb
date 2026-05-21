class Whatsapp::TemplateMessageBuilder
  TemplateNotFound     = Class.new(StandardError)
  MissingBodyVariables = Class.new(StandardError)

  BODY_VAR_REGEX = /\{\{(\w+)\}\}/

  def initialize(conversation:, name:, language:, processed_params: {})
    @conversation     = conversation
    @name             = name
    @language         = language
    @processed_params = processed_params || {}
  end

  def build
    template = find_approved_template!
    body_text = find_component(template, 'BODY')&.dig('text')
    validate_body_params!(body_text, @processed_params['body'])

    {
      content: interpolate_body(body_text, @processed_params['body']),
      message_type: :template,
      additional_attributes: {
        'template_params' => {
          'name'              => @name,
          'language'          => @language,
          'namespace'         => template['namespace'],
          'processed_params'  => @processed_params,
          'template_snapshot' => { 'components' => template['components'] }
        }
      }
    }
  end

  private

  def find_approved_template!
    channel = @conversation.inbox.channel
    raise TemplateNotFound, 'Inbox is not a WhatsApp channel' unless channel.respond_to?(:message_templates)

    template = (channel.message_templates || []).find do |t|
      t['name'] == @name &&
        t['language']&.downcase == @language&.downcase &&
        t['status']&.downcase == 'approved'
    end
    raise TemplateNotFound, "Template '#{@name}' (#{@language}) not found or not approved" unless template

    template
  end

  def find_component(template, type)
    template['components']&.find { |c| c['type'] == type }
  end

  def validate_body_params!(body_text, body_params)
    return if body_text.blank?

    required_keys = body_text.scan(BODY_VAR_REGEX).flatten.uniq
    return if required_keys.empty?

    provided_keys = (body_params || {}).keys.map(&:to_s)
    missing = required_keys - provided_keys
    return if missing.empty?

    raise MissingBodyVariables, "Missing body variables: #{missing.map { |k| "{{#{k}}}" }.join(', ')}"
  end

  def interpolate_body(body_text, body_params)
    return '' if body_text.blank?
    return body_text if body_params.blank?

    body_text.gsub(BODY_VAR_REGEX) { |match| body_params[Regexp.last_match(1)] || match }
  end
end
