class Whatsapp::PopulateTemplateParametersService
  def build_parameter(value)
    case value
    when String
      { type: 'text', text: sanitize_parameter(value) }
    when Hash
      build_hash_parameter(value)
    else
      { type: 'text', text: value.to_s }
    end
  end

  def build_button_parameter(button)
    return { type: 'text', text: '' } if button.blank?

    case button['type']
    when 'copy_code'
      coupon_code = button['parameter'].to_s.strip
      { type: 'coupon_code', coupon_code: coupon_code }
    else
      { type: 'text', text: button['parameter'].to_s.strip }
    end
  end

  def build_media_parameter(url, media_type, media_name = nil)
    return nil if url.blank?

    sanitized_url = sanitize_parameter(url)

    case media_type.downcase
    when 'image'
      { type: 'image', image: { link: sanitized_url } }
    when 'video'
      { type: 'video', video: { link: sanitized_url } }
    when 'document'
      doc = { link: sanitized_url }
      doc[:filename] = media_name if media_name.present?
      { type: 'document', document: doc }
    end
  end

  def build_named_parameter(parameter_name, value)
    { type: 'text', parameter_name: parameter_name, text: sanitize_parameter(value.to_s) }
  end

  private

  def build_hash_parameter(value)
    case value['type']
    when 'currency'
      {
        type: 'currency',
        currency: {
          fallback_value: value['fallback_value'],
          code: value['code'],
          amount_1000: value['amount_1000']
        }
      }
    when 'date_time'
      {
        type: 'date_time',
        date_time: {
          fallback_value: value['fallback_value']
        }
      }
    else
      { type: 'text', text: value.to_s }
    end
  end

  def sanitize_parameter(value)
    value.to_s.strip[0...1000]
  end
end
