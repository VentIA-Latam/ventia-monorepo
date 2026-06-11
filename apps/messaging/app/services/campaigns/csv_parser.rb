require 'csv'

# Parsea un CSV de audiencia para una campaña.
#
# Input: contenido del CSV (String, ya leído del file). Output: struct Result con
# rows válidas + filas omitidas + columnas detectadas.
#
# Reglas:
# - Header en primera fila, auto-detect delimitador `,` vs `;`.
# - Una columna debe matchear PHONE_COLUMN_REGEX (es la phone).
# - Máx 10 columnas no-phone (sino raise TooManyColumnsError).
# - Phone E.164 valid (reusa EnsureFromPhoneService::E164_REGEX).
# - Duplicados intra-CSV: mantiene primero, descarta el resto.
class Campaigns::CsvParser
  MAX_VARIABLE_COLUMNS = 10
  # Variantes comunes en CSVs LATAM/ES/EN. Underscores/espacios opcionales:
  # "phone_number", "phone number", "numero de telefono", etc.
  PHONE_COLUMN_REGEX = /\A(
    phone(?:[_\s-]?number)? | number |
    telefono | tel(?:efono)? |
    celular | celphone |
    movil | móvil | mobile |
    numero | número | nro |
    whatsapp | wa | wsp
  )\z/ix

  Result = Struct.new(:rows, :skipped, :detected_columns, :phone_column, keyword_init: true)

  class TooManyColumnsError < StandardError; end
  class NoPhoneColumnError  < StandardError; end
  class EmptyCsvError       < StandardError; end
  class ParseError          < StandardError; end

  def initialize(content)
    # Files uploadeados via multipart llegan como ASCII-8BIT (binary). El regex
    # de PHONE_COLUMN_REGEX usa chars UTF-8 (`móvil`, `número`) → Ruby rechaza
    # match cross-encoding. Forzamos UTF-8 + `scrub` para reemplazar bytes
    # inválidos (CSVs exportados de Excel a veces son Latin-1, mejor ser
    # tolerantes que romper).
    #
    # `delete_prefix("﻿")` saca el BOM (EF BB BF) que Excel/Google Sheets
    # agregan al inicio de CSVs UTF-8. `.strip` no lo remueve (BOM no es
    # whitespace) → el primer header quedaba "﻿number" y el regex fallaba.
    @content = content
      .to_s
      .dup
      .force_encoding('UTF-8')
      .scrub
      .delete_prefix("﻿")
  end

  def parse
    raise EmptyCsvError, 'CSV vacío' if @content.strip.empty?

    delimiter = detect_delimiter
    table = CSV.parse(@content, headers: true, col_sep: delimiter, skip_blanks: true)
    raise EmptyCsvError, 'CSV sin filas de datos' if table.empty?

    normalized_headers = table.headers.map { |h| h.to_s.strip }
    phone_column = detect_phone_column(normalized_headers)
    unless phone_column
      raise NoPhoneColumnError,
            "El CSV debe tener una columna de teléfono. Acepta: phone, phone_number, " \
            "number, telefono, celular, movil, numero, whatsapp (y variantes). " \
            "Encontradas: #{normalized_headers.inspect}"
    end

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
