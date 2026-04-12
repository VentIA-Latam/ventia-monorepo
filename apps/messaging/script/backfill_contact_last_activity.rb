# Backfill script: populate Contact#last_activity_at from existing messages.
#
# Run with:
#   docker exec ventia-messaging rails runner script/backfill_contact_last_activity.rb
#
# Idempotent: safe to run multiple times.
total = Contact.count
done = 0
updated = 0

Contact.find_each(batch_size: 500) do |contact|
  last_at = Message.where(sender: contact, message_type: :incoming).maximum(:created_at)

  if last_at && contact.last_activity_at != last_at
    contact.update_columns(last_activity_at: last_at)
    updated += 1
  end

  done += 1
  puts "Processed #{done}/#{total} (updated: #{updated})" if (done % 500).zero?
end

puts "Backfill complete: #{done} contacts processed, #{updated} updated"
