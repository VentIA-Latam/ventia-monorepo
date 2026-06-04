require 'rails_helper'

RSpec.describe Campaigns::VariableResolver do
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:campaign) do
    Campaign.create!(
      account: account, inbox: inbox, title: 'T', campaign_status: :running,
      template_params: { 'name' => 't', 'language' => 'es', 'variables' => variables }
    )
  end
  let(:variables) { {} }

  describe 'CSV path' do
    let(:variables) do
      {
        '1' => { 'source' => 'csv_column', 'key' => 'cliente' },
        '2' => { 'source' => 'csv_column', 'key' => 'pedido' }
      }
    end
    let(:recipient) do
      campaign.campaign_recipients.create!(
        phone: '+51900000001', vars: { 'cliente' => 'Juan', 'pedido' => 'ORD-12345' }
      )
    end

    it 'resuelve cada {{N}} desde vars del recipient' do
      expect(described_class.new(recipient).resolve).to eq(
        'body' => { '1' => 'Juan', '2' => 'ORD-12345' }
      )
    end

    it 'devuelve :missing_attr cuando una vars value es blank' do
      recipient.update!(vars: { 'cliente' => 'Juan', 'pedido' => '' })
      expect(described_class.new(recipient).resolve).to eq(:missing_attr)
    end

    it 'devuelve :missing_attr cuando una key falta' do
      recipient.update!(vars: { 'cliente' => 'Juan' })
      expect(described_class.new(recipient).resolve).to eq(:missing_attr)
    end
  end

  describe 'Contact attribute path' do
    let(:contact) { create(:contact, account: account, name: 'María', custom_attributes: { 'order_id' => 'ORD-99' }) }
    let(:variables) do
      {
        '1' => { 'source' => 'contact_attribute', 'path' => 'name' },
        '2' => { 'source' => 'contact_attribute', 'path' => 'custom_attributes.order_id' }
      }
    end
    let(:recipient) { campaign.campaign_recipients.create!(contact: contact, phone: contact.phone_number) }

    it 'lee name del contact directamente' do
      expect(described_class.new(recipient).resolve).to eq(
        'body' => { '1' => 'María', '2' => 'ORD-99' }
      )
    end

    it 'devuelve :missing_attr cuando custom_attribute no existe en el contact' do
      contact.update!(custom_attributes: {})
      expect(described_class.new(recipient).resolve).to eq(:missing_attr)
    end

    it 'devuelve :missing_attr cuando recipient no tiene contact asociado' do
      r = campaign.campaign_recipients.create!(phone: '+51900000002', vars: {})
      expect(described_class.new(r).resolve).to eq(:missing_attr)
    end

    it 'devuelve :missing_attr cuando path es vacío en config' do
      variables['1']['path'] = ''
      campaign.update!(template_params: campaign.template_params.merge('variables' => variables))
      expect(described_class.new(recipient).resolve).to eq(:missing_attr)
    end
  end

  describe 'header media' do
    let(:variables) { {} }
    let(:recipient) { campaign.campaign_recipients.create!(phone: '+51900000001') }

    it 'incluye header cuando campaign.header_media_url está seteado' do
      campaign.update!(header_media_url: 'https://example.com/img.jpg')
      expect(described_class.new(recipient).resolve['header']).to eq(
        'media_url' => 'https://example.com/img.jpg', 'media_type' => 'image'
      )
    end

    it 'omite header cuando campaign.header_media_url está vacío' do
      expect(described_class.new(recipient).resolve).not_to have_key('header')
    end
  end

  describe 'edge cases' do
    let(:variables) { {} }
    let(:recipient) { campaign.campaign_recipients.create!(phone: '+51900000001') }

    it 'devuelve body vacío cuando no hay variables definidas' do
      expect(described_class.new(recipient).resolve).to eq('body' => {})
    end
  end
end
