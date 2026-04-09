class Api::V1::LabelsController < Api::V1::BaseController
  before_action :set_label, only: [:show, :update, :destroy]

  def index
    labels = current_account.labels
    render_success(labels.map { |l| label_json(l) })
  end

  def show
    render_success(label_json(@label))
  end

  def create
    label = current_account.labels.new(label_params)

    if label.save
      render_success(label_json(label), message: 'Label created', status: :created)
    else
      render_error('Failed to create label', errors: label.errors.full_messages)
    end
  end

  def update
    if @label.update(label_params)
      render_success(label_json(@label), message: 'Label updated')
    else
      render_error('Failed to update label', errors: @label.errors.full_messages)
    end
  end

  def destroy
    @label.destroy!
    render_success(nil, message: 'Label deleted')
  end

  private

  def set_label
    @label = current_account.labels.find(params[:id])
  end

  def label_params
    params.require(:label).permit(:title, :description, :color, :show_on_sidebar)
  end

  def label_json(label)
    { id: label.id, title: label.title, color: label.color, system: label.system }
  end
end
