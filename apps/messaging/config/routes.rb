Rails.application.routes.draw do
  # Ruta raíz: API info
  root 'system#index'

  # Health check: JSON response
  get '/health', to: 'system#health'

  # Mount Rswag engines (Swagger UI + OpenAPI spec)
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'

  # Mount ActionCable for WebSocket connections
  mount ActionCable.server => '/cable'

  # API routes
  namespace :api do
    namespace :v1 do
      # Accounts
      resources :accounts, only: [:index, :show, :create, :update]

      # Inboxes
      resources :inboxes, only: [:index, :show, :create, :update, :destroy] do
        # Conversations within inbox
        resources :conversations, only: [:index, :show] do
          member do
            post :toggle_status
            post :assign_agent
          end
          # Messages within conversation
          resources :messages, only: [:index, :create]
        end
      end

      # Conversations (global)
      resources :conversations, only: [:index, :show, :update] do
        member do
          post :toggle_status
          post :assign_agent
          post :assign_team
        end
        resources :messages, only: [:index, :create]
        resources :labels, only: [:index, :create, :destroy], controller: 'conversations/labels'
      end

      # Contacts
      resources :contacts, only: [:index, :show, :create, :update, :destroy] do
        collection do
          post :search
          post :import
        end
      end

      # Labels
      resources :labels, only: [:index, :show, :create, :update, :destroy]

      # Campaigns
      resources :campaigns, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :trigger
          post :pause
          post :resume
        end
      end

      # Automation Rules
      resources :automation_rules, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :toggle
          post :clone
        end
      end

      # Agent Bots
      resources :agent_bots, only: [:index, :show, :create, :update, :destroy]

      # Macros
      resources :macros, only: [:index, :show, :create, :update, :destroy] do
        member do
          post :execute
        end
      end

      # WhatsApp
      namespace :whatsapp do
        post 'embedded_signup', to: 'embedded_signup#create'
        get 'embedded_signup/status', to: 'embedded_signup#status'
        get 'webhooks/:inbox_id', to: 'webhooks#verify'
        post 'webhooks/:inbox_id', to: 'webhooks#process_payload'
      end

      # Reports
      namespace :reports do
        get 'conversations', to: 'conversations#index'
        get 'conversations/summary', to: 'conversations#summary'
        get 'agents', to: 'agents#index'
      end
    end
  end
end
