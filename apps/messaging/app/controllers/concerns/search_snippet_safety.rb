require 'cgi'

# Construye snippets de búsqueda inyectables como HTML sin riesgo de XSS.
#
# ts_headline de Postgres NO escapa el contenido original, solo envuelve los
# matches en StartSel/StopSel. Si el contenido del mensaje incluye HTML/JS
# (ej: un cliente envía <script>...</script> por WhatsApp), el snippet llega
# al frontend con HTML inyectable.
#
# Patrón: usar sentinels ASCII control characters (no aparecen en texto
# válido), escapar TODO el snippet con CGI.escapeHTML, y luego reemplazar
# los sentinels por <mark>...</mark>.
module SearchSnippetSafety
  extend ActiveSupport::Concern

  # ASCII 0x01 (SOH) y 0x02 (STX). Caracteres de control que no aparecen en
  # mensajes legítimos y sobreviven a CGI.escapeHTML (no son <, >, &, ", ').
  SNIPPET_MARK_OPEN  = "\x01HL\x02".freeze
  SNIPPET_MARK_CLOSE = "\x01/HL\x02".freeze

  SNIPPET_HEADLINE_OPTIONS = "MaxWords=15, MinWords=8, " \
    "StartSel=#{SNIPPET_MARK_OPEN}, StopSel=#{SNIPPET_MARK_CLOSE}".freeze

  private

  # Escapa HTML del contenido original y luego inyecta los marks reales.
  def sanitize_snippet(raw)
    return nil if raw.blank?

    CGI.escapeHTML(raw)
       .gsub(SNIPPET_MARK_OPEN, '<mark>')
       .gsub(SNIPPET_MARK_CLOSE, '</mark>')
  end
end
