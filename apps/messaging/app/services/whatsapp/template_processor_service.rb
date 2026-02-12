class Whatsapp::TemplateProcessorService
  def initialize(channel:, template_params:, message: nil)
    @channel = channel
    @template_params = template_params
    @message = message
  end

  def call
    return [nil, nil, nil, nil] if @template_params.blank?

    process_template_with_params
  end

  private

  def process_template_with_params
    [
      @template_params['name'],
      @template_params['namespace'],
      @template_params['language'],
      processed_templates_params
    ]
  end

  def find_template
    @channel.message_templates&.find do |t|
      t['name'] == @template_params['name'] &&
        t['language']&.downcase == @template_params['language']&.downcase &&
        t['status']&.downcase == 'approved'
    end
  end

  def processed_templates_params
    template = find_template
    return if template.blank?

    processed_params = @template_params['processed_params']
    return if processed_params.blank?

    process_enhanced_template_params(template, processed_params)
  end

  def process_enhanced_template_params(template, processed_params)
    components = []

    components.concat(process_header_components(processed_params))
    components.concat(process_body_components(processed_params, template))
    components.concat(process_button_components(processed_params))

    components
  end

  def process_header_components(processed_params)
    return [] if processed_params['header'].blank?

    header_params = []
    processed_params['header'].each do |key, value|
      next if value.blank?

      if key == 'media_url' && processed_params['header']['media_type'].present?
        media_param = parameter_builder.build_media_parameter(
          value,
          processed_params['header']['media_type'],
          processed_params['header']['media_name']
        )
        header_params << media_param if media_param
      elsif key != 'media_type' && key != 'media_name'
        header_params << parameter_builder.build_parameter(value)
      end
    end

    header_params.present? ? [{ type: 'header', parameters: header_params }] : []
  end

  def process_body_components(processed_params, template)
    return [] if processed_params['body'].blank?

    body_params = processed_params['body'].filter_map do |key, value|
      next if value.blank?

      parameter_format = template['parameter_format']
      if parameter_format == 'NAMED'
        parameter_builder.build_named_parameter(key, value)
      else
        parameter_builder.build_parameter(value)
      end
    end

    body_params.present? ? [{ type: 'body', parameters: body_params }] : []
  end

  def process_button_components(processed_params)
    return [] if processed_params['buttons'].blank?

    button_params = processed_params['buttons'].filter_map.with_index do |button, index|
      next if button.blank?

      if button['type'] == 'url' || button['parameter'].present?
        {
          type: 'button',
          sub_type: button['type'] || 'url',
          index: index,
          parameters: [parameter_builder.build_button_parameter(button)]
        }
      end
    end

    button_params.compact
  end

  def parameter_builder
    @parameter_builder ||= Whatsapp::PopulateTemplateParametersService.new
  end
end
