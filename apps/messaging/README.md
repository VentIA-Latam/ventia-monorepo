# Messaging Service

Minimal Rails API backend for WhatsApp messaging, campaigns, automation rules, and agent bots. Adapted from Chatwoot's core messaging functionality for the Ventia monorepo.

## Overview

This is a stripped-down Rails 7.2 API-only application that handles:

- **WhatsApp Integration**: Official Meta Cloud API with embedded signup
- **Campaigns**: Schedule and send bulk messages
- **Labels**: Organize conversations
- **Automation Rules**: Trigger actions based on conditions
- **Agent Bots**: Automated responses and workflows

## Architecture

### Database Schema

Uses PostgreSQL with a dedicated `messaging` schema to isolate from the main Ventia application (`ventia` schema).

```
ventia_db
├── ventia (schema)         # Main Ventia application
│   ├── tenants
│   ├── users
│   └── orders
└── messaging (schema)      # Messaging service
    ├── accounts
    ├── inboxes
    ├── conversations
    ├── messages
    └── channel_whatsapp
```

### Multitenancy

- Each Ventia tenant gets one `Account` in the messaging service
- `Account.ventia_tenant_id` references `ventia.tenants.id`
- All messaging data is isolated by `account_id`

## Setup

### Prerequisites

- Ruby 3.4.4
- PostgreSQL 16
- Redis 7+

### Installation

```bash
cd apps/messaging

# Install dependencies
bundle install

# Create database and run migrations
bundle exec rails db:create
bundle exec rails db:migrate

# Start server
bundle exec rails server -p 3001
```

### Docker Setup

The messaging service is integrated into the monorepo's Docker Compose configuration.

```bash
# From monorepo root
docker-compose -f docker-compose.dev.yml up messaging
```

## Development

### Running Tests

```bash
bundle exec rspec
```

### Database Migrations

```bash
# Create new migration
bundle exec rails generate migration CreateContacts

# Run migrations
bundle exec rails db:migrate

# Rollback
bundle exec rails db:rollback
```

### Linting

```bash
# Check
bundle exec rubocop

# Auto-fix
bundle exec rubocop -a
```

## API Endpoints

Base URL: `http://localhost:3001/api/v1`

### WhatsApp

- `POST /whatsapp/embedded_signup` - Complete embedded signup flow
- `POST /whatsapp/webhooks/:inbox_id` - Receive WhatsApp webhooks

### Conversations

- `GET /conversations` - List conversations
- `GET /conversations/:id` - Get conversation details
- `POST /conversations/:id/messages` - Send message
- `POST /conversations/:id/toggle_status` - Open/resolve conversation

### Campaigns

- `GET /campaigns` - List campaigns
- `POST /campaigns` - Create campaign
- `POST /campaigns/:id/trigger` - Trigger campaign execution

### Automation Rules

- `GET /automation_rules` - List automation rules
- `POST /automation_rules` - Create automation rule
- `POST /automation_rules/:id/toggle` - Enable/disable rule

## Integration with Ventia

The messaging service integrates with the main Ventia application through:

1. **Shared Database**: Single PostgreSQL instance with separate schemas
2. **API Calls**: Ventia backend can call messaging API endpoints
3. **Tenant Mapping**: `Account.ventia_tenant_id` links to Ventia tenants

### Example Integration

From Ventia backend (FastAPI):

```python
# apps/backend/app/services/messaging_service.py
import httpx

async def send_whatsapp_message(tenant_id: UUID, phone: str, message: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://messaging:3001/api/v1/conversations",
            json={
                "ventia_tenant_id": str(tenant_id),
                "phone_number": phone,
                "message": message
            }
        )
        return response.json()
```

## Environment Variables

Key variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ventia_db

# Redis
REDIS_URL=redis://localhost:6379/1

# Rails
RAILS_ENV=development
SECRET_KEY_BASE=your_secret_key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8000

# WhatsApp (Meta Cloud API)
# Note: API keys are stored per-tenant in database, not here
```

## Key Differences from Chatwoot

This is a **minimal** version of Chatwoot with:

- ✅ WhatsApp Cloud API only (no other channels)
- ✅ Campaigns, Labels, Automation Rules, Agent Bots
- ✅ API-only (no admin UI)
- ❌ No web widget, email, or social channels
- ❌ No built-in user management (uses Ventia's Auth0)
- ❌ No help center/knowledge base
- ❌ No SLA policies, CSAT surveys
- ❌ ~85% less code

## Tech Stack

- **Framework**: Rails 7.2 (API-only)
- **Ruby**: 3.4.4
- **Database**: PostgreSQL 16
- **Cache/Jobs**: Redis + Sidekiq
- **Events**: Wisper (pub/sub)
- **State Machines**: AASM
- **HTTP Client**: HTTParty / Faraday

## File Structure

```
apps/messaging/
├── app/
│   ├── models/           # ActiveRecord models
│   ├── controllers/      # API controllers
│   ├── services/         # Business logic
│   ├── jobs/             # Sidekiq background jobs
│   └── listeners/        # Event listeners
├── config/
│   ├── application.rb    # Rails config
│   ├── database.yml      # DB config (messaging schema)
│   ├── routes.rb         # API routes
│   └── initializers/     # Redis, Sidekiq, Wisper
├── db/
│   └── migrate/          # Database migrations
├── Gemfile               # Dependencies
└── README.md             # This file
```

## Credits

Based on [Chatwoot](https://github.com/chatwoot/chatwoot) (MIT License)
Adapted for Ventia monorepo by the Ventia team.
