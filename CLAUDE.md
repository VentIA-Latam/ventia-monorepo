# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VentIA is a multitenant SaaS platform for managing Shopify orders with electronic invoicing integration (Peru). The monorepo contains a Next.js frontend and FastAPI backend.

## Commands

### Development
```bash
pnpm dev              # Run frontend + backend in parallel
pnpm dev:frontend     # Frontend only (Next.js on port 3000)
pnpm dev:backend      # Backend only (FastAPI on port 8000)
```

### Docker (Recommended for development)
```bash
pnpm docker:up        # Start all services (postgres, backend, frontend)
pnpm docker:down      # Stop services
pnpm docker:logs      # View logs

# Dev environment specifically
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml logs -f backend
```

### Database
```bash
pnpm db:migrate                    # Apply migrations
pnpm db:migrate:create "message"   # Create new migration

# Or via Docker
docker exec ventia-backend uv run alembic upgrade head
docker exec ventia-backend uv run alembic revision --autogenerate -m "description"

# Seed test data
docker exec ventia-backend uv run python scripts/seed.py
```

### Backend Testing & Linting
```bash
cd apps/backend
uv run pytest                              # All tests
uv run pytest tests/test_file.py           # Single file
uv run pytest tests/test_file.py::test_fn  # Single test
uv run pytest --cov                        # With coverage
uv run ruff check .                        # Lint
uv run ruff format .                       # Format
```

### Frontend
```bash
cd apps/frontend
pnpm dev      # Dev server
pnpm build    # Production build
pnpm lint     # ESLint
```

## Architecture

### Backend Layered Architecture
```
apps/backend/app/
├── api/v1/endpoints/   # FastAPI routers (thin, just validation + response)
├── services/           # Business logic layer
├── repositories/       # Data access layer (SQLAlchemy queries)
├── models/             # SQLAlchemy ORM models
├── schemas/            # Pydantic request/response schemas
├── core/               # Config, database, auth, permissions
└── integrations/       # External API clients (Shopify GraphQL)
```

### Frontend Structure
```
apps/frontend/
├── app/                # Next.js App Router pages
│   ├── (landing)/      # Public landing page
│   ├── dashboard/      # Protected app routes
│   ├── superadmin/     # Super admin panel
│   └── api/            # API routes (Auth0 callbacks)
├── components/         # React components (shadcn/ui based)
└── lib/
    ├── services/       # API client functions
    └── types/          # TypeScript definitions
```

## Key Concepts

### Multitenancy
- Every business data table has a `tenant_id` foreign key
- Shopify credentials are stored **per tenant** in the database, NOT in .env
- Data isolation is automatic - all queries filter by tenant
- Users belong to exactly one tenant

### Authentication Flow
1. User logs in via Auth0 (frontend)
2. JWT token contains: `sub` (auth0_user_id), `email`, `company_id`, `role`
3. Frontend sends `Authorization: Bearer {token}` header
4. Backend validates JWT against Auth0 JWKS and extracts user

### Role-Based Access Control
Roles: `ADMIN`, `LOGISTICA`, `VENTAS`, `VIEWER`
- Permissions defined in `apps/backend/app/core/permissions.py`
- ADMIN: Full tenant access
- LOGISTICA: Order management + validation
- VENTAS: Order viewing
- VIEWER: Read-only

### Order Flow
1. n8n (external automation) creates draft orders in Shopify
2. n8n inserts orders into database with `shopify_draft_order_id`
3. User validates payment via frontend
4. Backend calls Shopify GraphQL `draftOrderComplete` mutation
5. Draft order becomes official Shopify order

## Adding New Features

### New Backend Endpoint
1. Create Pydantic schemas in `app/schemas/`
2. Add repository methods in `app/repositories/`
3. Implement business logic in `app/services/`
4. Create endpoint in `app/api/v1/endpoints/`
5. Add permissions in `app/core/permissions.py`
6. Include router in `app/api/v1/api.py`

### Database Changes
1. Modify SQLAlchemy model in `app/models/`
2. Create migration: `uv run alembic revision --autogenerate -m "description"`
3. Apply: `uv run alembic upgrade head`

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS v4, shadcn/ui, Auth0
- **Backend**: FastAPI, Python 3.11+, SQLAlchemy 2.0, Alembic, UV package manager
- **Database**: PostgreSQL 16
- **Infrastructure**: Docker Compose, pnpm workspaces

## External Integrations

- **Auth0**: Authentication and JWT validation
- **Shopify GraphQL Admin API**: Draft order completion
- **eFact-OSE**: Peru electronic invoicing (configured in `app/core/config.py`)
- **n8n**: External automation for order creation

## Environment Variables

Key variables needed (see `.env.example` files):
- Database: `DATABASE_URL`, `POSTGRES_*`
- Auth0: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`
- Frontend Auth0: `NEXT_PUBLIC_AUTH0_*`, `AUTH0_SECRET`, `AUTH0_CLIENT_SECRET`
- Backend: `SECRET_KEY`, `CORS_ORIGINS`
