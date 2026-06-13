require 'rails_helper'

RSpec.describe MessageFeedback, type: :model do
  let(:account) { create(:account, ventia_tenant_id: rand(100_000..999_999)) }
  let(:user)    { create(:user, ventia_user_id: rand(100_000..999_999)) }
  let(:conversation) { create(:conversation, account: account) }
  let(:message) do
    m = conversation.messages.new(
      account: account, inbox: conversation.inbox,
      message_type: :outgoing, content: 'Respuesta IA', content_type: :text
    )
    m.skip_send_reply = true
    m.save!
    m
  end

  def build_fb(attrs = {})
    MessageFeedback.new(
      { message: message, account: account, conversation: conversation, user: user, rating: :like }.merge(attrs)
    )
  end

  describe 'validations' do
    it 'is valid as a like without comment' do
      expect(build_fb(rating: :like)).to be_valid
    end

    it 'clears the comment on a like' do
      fb = build_fb(rating: :like, comment: 'algo')
      fb.valid?
      expect(fb.comment).to be_nil
    end

    it 'requires a comment on a dislike' do
      fb = build_fb(rating: :dislike, comment: nil)
      expect(fb).not_to be_valid
      expect(fb.errors[:comment]).to be_present
    end

    it 'is valid as a dislike with a comment' do
      expect(build_fb(rating: :dislike, comment: 'Dio un precio inexistente')).to be_valid
    end

    it 'enforces one feedback per (message, user)' do
      build_fb(rating: :like).save!
      dup = build_fb(rating: :dislike, comment: 'x')
      expect(dup).not_to be_valid
      expect(dup.errors[:user_id]).to be_present
    end

    it 'allows different users to rate the same message' do
      other = create(:user, ventia_user_id: rand(100_000..999_999))
      build_fb(rating: :like).save!
      expect(build_fb(user: other, rating: :like)).to be_valid
    end
  end
end
