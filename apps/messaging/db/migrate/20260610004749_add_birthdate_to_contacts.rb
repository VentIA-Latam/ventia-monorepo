class AddBirthdateToContacts < ActiveRecord::Migration[7.2]
  def change
    add_column :contacts, :birthdate, :date
  end
end
