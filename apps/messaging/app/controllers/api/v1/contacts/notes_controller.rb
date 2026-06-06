class Api::V1::Contacts::NotesController < Api::V1::BaseController
  before_action :set_contact
  before_action :set_note, only: [:update, :destroy]

  def index
    notes = @contact.notes.recent_first.includes(:user)
    render_success(notes.map { |n| note_json(n) })
  end

  def create
    note = @contact.notes.new(
      content: note_params[:content],
      account: current_account,
      user: current_user
    )

    if note.save
      render_success(note_json(note), message: 'Note created', status: :created)
    else
      render_error('Failed to create note', errors: note.errors.full_messages)
    end
  end

  def update
    if @note.update(note_params)
      render_success(note_json(@note), message: 'Note updated')
    else
      render_error('Failed to update note', errors: @note.errors.full_messages)
    end
  end

  def destroy
    @note.destroy
    render_success(nil, message: 'Note deleted')
  end

  private

  def set_contact
    @contact = current_account.contacts.find(params[:contact_id])
  end

  def set_note
    @note = @contact.notes.find(params[:id])
  end

  def note_params
    params.require(:note).permit(:content)
  end

  def note_json(note)
    {
      id: note.id,
      content: note.content,
      created_at: note.created_at,
      updated_at: note.updated_at,
      user: note.user ? {
        id: note.user.id,
        name: note.user.name,
        email: note.user.email
      } : nil
    }
  end
end
