class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # Set schema search path for all models
  connects_to database: { writing: :primary, reading: :primary }
end
