# Resuelve los valores de las variables del template para un recipient específico.
#
# Lee campaign.template_params['variables'] (hash con shape estructurado tipo dropdown,
# no Liquid) y para cada {{N}} produce el valor concreto leyendo del recipient.
#
# - source: csv_column     → recipient.vars[key]
# - source: contact_attribute → recipient.contact.<path> (dig recursivo sobre attrs/custom_attributes)
#
# Si cualquier valor requerido sale blank/nil, devuelve el sym `:missing_attr` (señal de
# "omitir este recipient") en vez de un hash incompleto.
#
# Output (cuando OK): hash compatible con Whatsapp::TemplateMessageBuilder#processed_params:
#   { 'body' => { '1' => 'Juan', '2' => 'ORD-12345' }, 'header' => { media_url:, media_type: } }
class Campaigns::VariableResolver
  def initialize(recipient)
    @recipient = recipient
    @campaign  = recipient.campaign
  end

  def resolve
    variables = @campaign.template_params&.dig('variables') || {}

    body_params = {}
    variables.each do |idx, mapping|
      value = resolve_one(mapping)
      return :missing_attr if value.blank?

      body_params[idx.to_s] = value
    end

    result = { 'body' => body_params }
    result['header'] = header_params if @campaign.header_media_url.present?
    result
  end

  private

  def resolve_one(mapping)
    case mapping['source']
    when 'csv_column'
      @recipient.vars[mapping['key']]
    when 'contact_attribute'
      dig_contact_path(mapping['path'])
    end
  end

  # Sigue un path con dots para leer attributes o claves de custom_attributes del contact.
  # Ej:
  #   'name'                          → contact.name
  #   'custom_attributes.order_id'    → contact.custom_attributes&.dig('order_id')
  #   'additional_attributes.x.y'     → contact.additional_attributes&.dig('x', 'y')
  def dig_contact_path(path)
    return nil if path.blank?
    return nil unless @recipient.contact

    parts = path.split('.')
    parts.reduce(@recipient.contact) do |obj, key|
      break nil if obj.nil?
      if obj.is_a?(Hash)
        obj[key] || obj[key.to_sym]
      elsif obj.respond_to?(key)
        obj.public_send(key)
      end
    end
  end

  def header_params
    {
      'media_url'  => @campaign.header_media_url,
      'media_type' => 'image'
    }
  end
end
