require 'csv'

# Parsea un CSV de audiencia para una campaña.
#
# Input: contenido del CSV (String, ya leído del file). Output: struct Result con
# rows válidas + filas omitidas + columnas detectadas.
#
# Reglas:
# - Header en primera fila, auto-detect delimitador `,` vs `;`.
# - Una columna debe matchear /^(phone|telefono|tel|celular)$/i (es la phone).
# - Máx 10 columnas no-phone (sino raise TooManyColumnsError).
# - Phone E.164 valid (reusa EnsureFromPhoneService::E164_REGEX).
# - Duplicados intra-CSV: mantiene primero, descarta el resto.
class Campaigns::CsvParser
  MAX_VARIABLE_COLUMNS = 10
  PHONE_COLUMN_REGEX = /\A(phone|telefono|tel|celular)\z/i

  Result = Struct.new(:rows, :skipped, :detected_columns, :phone_column, keyword_init: true)

  class TooManyColumnsError < StandardError; end
  class NoPhoneColumnError  < StandardError; end
  class EmptyCsvError       < StandardError; end
  class ParseError          < StandardError; end

  def initialize(content)
    @content = content.to_s
  end

  def parse
    raise EmptyCsvError, 'CSV vacío' if @content.strip.empty?

    delimiter = detect_delimiter
    table = CSV.parse(@content, headers: true, col_sep: delimiter, skip_blanks: true)
    raise EmptyCsvError, 'CSV sin filas de datos' if table.empty?

    normalized_headers = table.headers.map { |h| h.to_s.strip }
    phone_column = detect_phone_column(normalized_headers)
    raise NoPhoneColumnError, "El CSV debe tener una columna 'phone' o 'telefono'" unless phone_column

    variable_columns = normalized_headers.reject { |h| h == phone_column }
    if variable_columns.size > MAX_VARIABLE_COLUMNS
      raise TooManyColumnsError, "Máx #{MAX_VARIABLE_COLUMNS} columnas de datos (encontradas: #{variable_columns.size})"
    end

    rows = []
    skipped = []
    seen_phones = Set.new

    table.each_with_index do |row, idx|
      row_number = idx + 2 # +1 for header, +1 for 1-based numbering
      raw_phone = row[phone_column].to_s
      normalized = normalize_phone(raw_phone)

      if normalized.nil?
        skipped << { row: row_number, phone: raw_phone, reason: 'phone inválido (debe ser E.164)' }
        next
      end

      if seen_phones.include?(normalized)
        skipped << { row: row_number, phone: normalized, reason: 'duplicado intra-CSV' }
        next
      end
      seen_phones << normalized

      vars = variable_columns.each_with_object({}) { |col, acc| acc[col] = row[col]&.to_s&.strip }
      rows << { phone: normalized, vars: vars }
    end

    Result.new(
      rows: rows,
      skipped: skipped,
      detected_columns: variable_columns,
      phone_column: phone_column
    )
  rescue CSV::MalformedCSVError => e
    raise ParseError, "CSV mal formado: #{e.message}"
  end

  private

  def detect_delimiter
    first_line = @content.lines.first.to_s
    # Score = cantidad de ocurrencias. Asume el delimitador con más apariciones.
    @content.lines.first.to_s.count(';') > first_line.count(',') ? ';' : ','
  end

  def detect_phone_column(headers)
    headers.find { |h| h.match?(PHONE_COLUMN_REGEX) }
  end

  def normalize_phone(raw)
    cleaned = raw.gsub(/[\s\-]/, '')
    return nil unless cleaned.match?(Conversations::EnsureFromPhoneService::E164_REGEX)

    cleaned
  end
end
