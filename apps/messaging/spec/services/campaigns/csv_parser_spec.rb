require 'rails_helper'

RSpec.describe Campaigns::CsvParser do
  def parse(content)
    described_class.new(content).parse
  end

  describe 'happy path' do
    let(:content) do
      <<~CSV
        phone,cliente,pedido
        +51999888777,Juan,ORD-12345
        +51998877665,María,ORD-12346
      CSV
    end

    it 'devuelve 2 rows válidas con vars' do
      result = parse(content)
      expect(result.rows.size).to eq(2)
      expect(result.rows.first).to eq(phone: '+51999888777', vars: { 'cliente' => 'Juan', 'pedido' => 'ORD-12345' })
      expect(result.detected_columns).to eq(%w[cliente pedido])
      expect(result.phone_column).to eq('phone')
    end

    it 'no devuelve skipped' do
      expect(parse(content).skipped).to be_empty
    end

    it 'detecta delimitador ; cuando se usa' do
      content_semi = "phone;cliente\n+51999888777;Juan\n"
      result = parse(content_semi)
      expect(result.rows.size).to eq(1)
    end

    it 'acepta "telefono" como columna de phone' do
      result = parse("telefono,cliente\n+51999888777,Juan\n")
      expect(result.phone_column).to eq('telefono')
    end

    # Variantes comunes en CSVs LATAM/ES/EN — regresión del bug donde solo
    # se aceptaba phone/telefono/tel/celular.
    %w[number numero número nro celular movil móvil mobile whatsapp wa wsp phone_number].each do |header|
      it "acepta '#{header}' como columna de phone" do
        result = parse("#{header},cliente\n+51999888777,Juan\n")
        expect(result.phone_column).to eq(header)
        expect(result.rows.size).to eq(1)
      end
    end

    it 'maneja contenido en ASCII-8BIT (file uploads via multipart)' do
      # Regresión: el regex con chars UTF-8 (móvil, número) rompía con
      # "incompatible encoding regexp match" sobre strings en ASCII-8BIT.
      binary_content = "number,cliente\n+51999888777,Juan\n".dup.force_encoding('ASCII-8BIT')
      expect { parse(binary_content) }.not_to raise_error
      result = parse(binary_content)
      expect(result.rows.size).to eq(1)
      expect(result.phone_column).to eq('number')
    end

    it 'tolera headers con acentos (UTF-8 válido)' do
      result = parse("número,cliente\n+51999888777,Juan\n")
      expect(result.phone_column).to eq('número')
      expect(result.rows.size).to eq(1)
    end

    it 'remueve UTF-8 BOM al inicio del archivo (CSVs exportados de Excel)' do
      # Regresión: Excel/Google Sheets agregan BOM (EF BB BF) al exportar UTF-8.
      # `.strip` no lo saca → primer header quedaba "﻿number" y el regex
      # fallaba silenciosamente.
      bom_content = "﻿number,name\n+51999888777,Juan\n"
      result = parse(bom_content)
      expect(result.phone_column).to eq('number')
      expect(result.rows.size).to eq(1)
    end

    it 'remueve BOM aunque el contenido venga en ASCII-8BIT (multipart upload real)' do
      # Combinación del bug del usuario: file binario con BOM al inicio.
      raw_bytes = [0xEF, 0xBB, 0xBF].pack('C*') + "number,name\n+51999888777,Juan\n"
      binary = raw_bytes.dup.force_encoding('ASCII-8BIT')
      result = parse(binary)
      expect(result.phone_column).to eq('number')
      expect(result.rows.size).to eq(1)
    end

    it 'normaliza espacios y guiones en phone' do
      result = parse("phone,cliente\n +51-999 888 777 ,Juan\n")
      expect(result.rows.first[:phone]).to eq('+51999888777')
    end
  end

  describe 'validaciones de entrada' do
    it 'raisea EmptyCsvError cuando string vacío' do
      expect { parse('') }.to raise_error(described_class::EmptyCsvError)
    end

    it 'raisea EmptyCsvError cuando solo hay header' do
      expect { parse("phone,cliente\n") }.to raise_error(described_class::EmptyCsvError)
    end

    it 'raisea NoPhoneColumnError cuando no hay columna phone/telefono' do
      expect { parse("nombre,pedido\nJuan,ORD-1\n") }
        .to raise_error(described_class::NoPhoneColumnError)
    end

    it 'raisea TooManyColumnsError cuando hay >10 columnas no-phone' do
      headers = ['phone'] + (1..11).map { |i| "var#{i}" }
      content = headers.join(',') + "\n+51999888777,#{'x,' * 10}x\n"
      expect { parse(content) }.to raise_error(described_class::TooManyColumnsError)
    end
  end

  describe 'rows omitidas (skipped)' do
    it 'phone inválido → skipped con motivo' do
      content = "phone,cliente\n999888777,Juan\n+51999888777,María\n"
      result = parse(content)
      expect(result.rows.size).to eq(1)
      expect(result.skipped.size).to eq(1)
      expect(result.skipped.first).to include(row: 2, phone: '999888777', reason: /E\.164/)
    end

    it 'duplicado intra-CSV → primero queda, resto skipped' do
      content = "phone,cliente\n+51999888777,Juan\n+51999888777,Juan2\n+51999888777,Juan3\n"
      result = parse(content)
      expect(result.rows.size).to eq(1)
      expect(result.rows.first[:vars]['cliente']).to eq('Juan')
      expect(result.skipped.size).to eq(2)
      expect(result.skipped.map { |s| s[:reason] }).to all(match(/duplicado/))
    end

    it 'mezcla de válidos y omitidos' do
      content = "phone,cliente\n+51999888777,Juan\n999,María\n+51998877665,Carlos\n+51999888777,Dup\n"
      result = parse(content)
      expect(result.rows.size).to eq(2)
      expect(result.skipped.size).to eq(2)
    end
  end

  describe 'malformed CSV' do
    it 'raisea ParseError cuando el CSV no se puede parsear' do
      content = %(phone,cliente\n+51999888777,"Juan)
      expect { parse(content) }.to raise_error(described_class::ParseError)
    end
  end
end
