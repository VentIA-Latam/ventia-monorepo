class Macros::ExecutionJob < ApplicationJob
  queue_as :default

  def perform(macro_id, conversation_ids)
    macro = Macro.find(macro_id)
    conversations = macro.account.conversations.where(id: conversation_ids)

    conversations.each do |conversation|
      Macros::ExecutionService.new(macro: macro, conversation: conversation).perform
    end
  end
end
