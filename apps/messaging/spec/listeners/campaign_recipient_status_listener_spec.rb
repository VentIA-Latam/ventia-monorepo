require 'rails_helper'

RSpec.describe CampaignRecipientStatusListener do
  let(:listener) { described_class.instance }
  let(:account)  { create(:account) }
  let(:inbox)    { create(:inbox, account: account) }
  let(:contact)  { create(:contact, account: account, phone_number: '+51900000001') }
  let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: inbox, source_id: '51900000001') }
  let(:conversation)  { create(:conversation, account: account, inbox: inbox, contact: contact, contact_inbox: contact_inbox) }
  let(:campaign)      { Campaign.create!(account: account, inbox: inbox, title: 'T', campaign_status: :running) }
  let(:message) do
    Message.create!(
      account: account, inbox: inbox, conversation: conversation,
      message_type: :template, content_type: :text, content: 'Hola',
      status: :sent
    )
  end
  let!(:recipient) do
    campaign.campaign_recipients.create!(
      contact: contact, phone: contact.phone_number,
      conversation_id: conversation.id, message_id: message.id,
      status: :sent, sent_at: 1.minute.ago
    )
  end

  def event_for(status_changed_to:, prev: 'sent')
    message.update!(status: status_changed_to)
    {
      data: {
        message: message,
        changed_attributes: { 'status' => [prev, status_changed_to.to_s] }
      }
    }
  end

  describe '#message_updated' do
    it 'mapea :delivered → recipient.delivered + delivered_at' do
      listener.message_updated(event_for(status_changed_to: :delivered))
      recipient.reload
      expect(recipient.status).to eq('delivered')
      expect(recipient.delivered_at).not_to be_nil
    end

    it 'mapea :read → recipient.read + read_at' do
      listener.message_updated(event_for(status_changed_to: :read))
      recipient.reload
      expect(recipient.status).to eq('read')
      expect(recipient.read_at).not_to be_nil
    end

    it 'mapea :failed → recipient.failed + incrementa failed_count' do
      expect {
        listener.message_updated(event_for(status_changed_to: :failed))
      }.to change { campaign.reload.failed_count }.by(1)

      expect(recipient.reload.status).to eq('failed')
    end

    it 'no falla cuando el message no es de ninguna campaña' do
      other_msg = Message.create!(
        account: account, inbox: inbox, conversation: conversation,
        message_type: :outgoing, content_type: :text, content: 'Hi', status: :sent
      )
      other_msg.update!(status: :delivered)
      event = { data: { message: other_msg, changed_attributes: { 'status' => ['sent', 'delivered'] } } }
      expect { listener.message_updated(event) }.not_to raise_error
    end

    it 'ignora eventos sin cambio de status' do
      event = { data: { message: message, changed_attributes: { 'content' => ['a', 'b'] } } }
      expect { listener.message_updated(event) }.not_to change { recipient.reload.status }
    end

    it 'no double-counts: dos :failed seguidos solo incrementan una vez' do
      listener.message_updated(event_for(status_changed_to: :failed))
      expect {
        listener.message_updated(event_for(status_changed_to: :failed, prev: 'failed'))
      }.not_to change { campaign.reload.failed_count }
    end

    it 'marca campaign :completed cuando el recipient pasa a terminal y era el último' do
      listener.message_updated(event_for(status_changed_to: :delivered))
      expect(campaign.reload.campaign_status).to eq('completed')
    end
  end
end
