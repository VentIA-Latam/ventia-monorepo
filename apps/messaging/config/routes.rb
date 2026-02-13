Rails.application.routes.draw do
  # Ruta raiz: API info
  root 'system#index'

  # Health check: JSON response
  get '/health', to: 'system#health'

  # Mount Rswag engines (Swagger UI + OpenAPI spec)
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'

  # Mount ActionCable for WebSocket connections
  mount ActionCable.server => '/cable'

  # WhatsApp webhooks (public, no auth required)
  get 'webhooks/whatsapp/:phone_number', to: 'webhooks/whatsapp#verify'
  post 'webhooks/whatsapp/:phone_number', to: 'webhooks/whatsapp#process_payload'

  # API routes
  namespace :api do
    namespace :v1 do
      # Accounts
      resources :accounts, only: [:index, :show, :create, :update]

      # Users (synced from Ventia)
      resources :users, only: [:index, :show, :create, :update, :destroy]

      # Teams
      resources :teams do
        member do
          post :add_members
          post :remove_members
        end
      end

      # Inboxes
      resources :inboxes, only: [:index, :show, :create, :update, :destroy] do
        # Inbox members (agent access control)
        resources :members, controller: 'inbox_members', only: [:index, :create, :destroy]

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
      resources :conversations, only: [:index, :show, :update, :destroy] do
        member do
          post :toggle_status
          post :assign_agent
          post :assign_team
          patch :assign, controller: 'conversation_assignments'
          post :unassign, controller: 'conversation_assignments'
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

      # Notifications
      resources :notifications, only: [:index] do
        collection do
          post :read_all
        end
        member do
          patch :read
          patch :snooze
        end
      end

      # Webhooks
      resources :webhooks, only: [:index, :show, :create, :update, :destroy]

      # Canned Responses
      resources :canned_responses

      # WhatsApp
      namespace :whatsapp do
        post 'embedded_signup', to: 'embedded_signup#create'
        get 'embedded_signup/status', to: 'embedded_signup#status'
        get 'health/:inbox_id', to: 'embedded_signup#health'
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
