class ApplicationMailer < ActionMailer::Base
  default from: "VentIA <#{ENV.fetch('RESEND_FROM_EMAIL', 'noreply@ventia.pe')}>"
  layout false
end
