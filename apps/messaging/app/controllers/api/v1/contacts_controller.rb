class Api::V1::ContactsController < Api::V1::BaseController
  before_action :set_contact, only: [:show, :update, :destroy]

  def index
    contacts = current_account.contacts
                              .order_on_last_activity_at(:desc)
                              .page(params[:page] || 1)
                              .per(params[:per_page] || 25)

    render json: {
      success: true,
      data: contacts.map { |c| contact_json(c) },
      meta: pagination_meta(contacts)
    }
  end

  def show
    render_success(contact_json(@contact))
  end

  def create
    contact = current_account.contacts.new(contact_params)

    if contact.save
      render_success(contact_json(contact), message: 'Contact created', status: :created)
    else
      render_error('Failed to create contact', errors: contact.errors.full_messages)
    end
  end

  def update
    if @contact.update(contact_params)
      render_success(contact_json(@contact), message: 'Contact updated')
    else
      render_error('Failed to update contact', errors: @contact.errors.full_messages)
    end
  end

  def destroy
    @contact.destroy
    render_success(nil, message: 'Contact deleted')
  end

  def search
    query = params[:query]
    contacts = current_account.contacts
                              .where('name ILIKE ? OR email ILIKE ? OR phone_number ILIKE ?',
                                     "%#{query}%", "%#{query}%", "%#{query}%")
                              .limit(20)

    render_success(contacts.map { |c| contact_json(c) })
  end

  private

  def set_contact
    @contact = current_account.contacts.find(params[:id])
  end

  def contact_params
    params.require(:contact).permit(
      :name,
      :email,
      :phone_number,
      :identifier,
      :contact_type,
      additional_attributes: {},
      custom_attributes: {}
    )
  end

  def contact_json(contact)
    {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone_number: contact.phone_number,
      contact_type: contact.contact_type,
      last_activity_at: contact.last_activity_at,
      created_at: contact.created_at
    }
  end
end
