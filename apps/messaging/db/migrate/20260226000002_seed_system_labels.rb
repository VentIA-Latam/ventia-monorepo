class SeedSystemLabels < ActiveRecord::Migration[7.2]
  def up
    Account.find_each do |account|
      label = Label.find_or_initialize_by(account_id: account.id, title: 'soporte-humano')
      label.assign_attributes(color: '#EF4444', system: true, show_on_sidebar: true)
      label.save!(validate: false)

      label = Label.find_or_initialize_by(account_id: account.id, title: 'en-revisión')
      label.assign_attributes(color: '#F59E0B', system: true, show_on_sidebar: true)
      label.save!(validate: false)
    end
  end

  def down
    Label.where(system: true, title: ['soporte-humano', 'en-revisión']).delete_all
  end
end
