# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VentIA is a multitenant SaaS platform for managing ecommerce orders (Shopify & WooCommerce) with electronic invoicing integration (Peru/SUNAT). The monorepo contains a Next.js frontend, FastAPI backend, and Rails messaging app.

## Workflow Preferences

- **Feature-first approach**: User describes features (not code changes). Launch sub-agents to analyze the codebase, then create a plan before implementing.
- **Always use plan mode** for non-trivial features via `EnterPlanMode`.
- **Language**: Respond in Spanish unless code/docs require English.

### Skills (apply automatically based on task)
| Skill | When to use |
|-------|-------------|
| `brainstorming` | **ALWAYS before any new feature or creative work**. Explore intent, requirements, and design before implementing. |
| `frontend-design` | Creating or modifying UI components, pages, layouts, or any visual element. |
| `interface-design` | Building dashboards, admin panels, forms, tables, or interactive tools (NOT marketing/landing pages). |
| `vercel-react-best-practices` | Writing, reviewing, or refactoring ANY React/Next.js code. Apply performance patterns automatically. |

**Important**: These skills must be invoked proactively — do NOT wait for the user to mention them. If the task matches the "When to use" column, apply the skill.

## Code Conventions

### General
- **pnpm** only (never npm/yarn) for frontend and root commands
- **uv** for backend Python package management
- Commit messages reference user stories when applicable (e.g., `US-001: ...`)

### Frontend (TypeScript / Next.js / React)
- **File naming**: kebab-case (`orders-table.tsx`, `use-auth.tsx`)
- **Components**: PascalCase exports, functional components only
- **Client components**: Split into `-client.tsx` suffix (e.g., `orders-client.tsx` for interactivity, server component for data fetching)
- **Imports**: Use `@/` alias. Order: React → Next.js → UI components → hooks → utils
- **Styling**: Tailwind CSS v4 with project tokens (volt, aqua, cielo, marino, noche). Use `cn()` utility for class merging
- **UI components**: shadcn/ui with `cva` for variants
- **Types**: Use `interface` (not `type`) for objects. Located in `lib/types/` grouped by domain
- **API calls**: Service functions in `lib/services/` that take `accessToken` as first param
- **Error handling**: try-catch with toast notifications via `useToast()`

### Backend (Python / FastAPI)
- **File naming**: snake_case (`order_service.py`)
- **Layered architecture**: endpoint (thin) → service (business logic) → repository (data access)
- **Services**: Class-based with module-level singleton instances (e.g., `order_service = OrderService()`)
- **Repositories**: Extend `CRUDBase[Model, CreateSchema, UpdateSchema]` generic base
- **Schemas**: Pydantic with `Field(description=...)`, `ConfigDict(from_attributes=True)` for responses
- **Models**: Inherit `Base, TimestampMixin`. All business tables have `tenant_id` FK indexed with `ondelete="CASCADE"`
- **Auth**: Dual auth via `get_current_user_or_api_key` (JWT + API Key)
- **Permissions**: `require_permission_dual(method, path_pattern)` dependency
- **SUPERADMIN pattern**: `if role == SUPERADMIN: get_all() else: get_by_tenant(tenant_id)`
- **Logging**: `logger = logging.getLogger(__name__)` with structured context (`order_id=, tenant_id=, platform=`)
- **Error mapping**: ValueError → 400, PermissionError → 403, not found → 404, catch-all → 500

### Messaging App (Ruby / Rails)
- **Controllers**: Inherit `Api::V1::BaseController`, use `before_action` for setup
- **Services**: Class-based with `perform` method, constructor injection
- **Queries**: Method chaining with `.includes()`, `.where()`, conditional filters
- **Response format**: `{ success: true, data: ..., meta: ... }`
- **Events**: Wisper for pub/sub event system

### Testing (Backend)
- **Framework**: pytest with `unittest.mock`
- **File naming**: `test_*.py`, classes `Test[Feature][Scenario]`, methods `test_[feature]_[scenario]_[expectation]`
- **Fixtures**: In `conftest.py` for shared setup (mock_db, mock_tenant, mock_order)
- **Mocking**: `patch()` for service dependencies, `MagicMock(spec=Model)` for type safety
- **Docstrings**: Reference user stories (`US-001: ...`)

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

# Reset database (removes volume)
docker-compose -f docker-compose.dev.yml down -v && docker-compose -f docker-compose.dev.yml up -d
```

### Docker Shell Access
```bash
docker exec -it ventia-backend sh     # Backend shell
docker exec -it ventia-postgres psql -U ventia_user -d ventia_db  # Database shell
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
└── integrations/       # External API clients (Shopify, WooCommerce, eFact)
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
- Ecommerce credentials (Shopify/WooCommerce) are stored **per tenant** in the database, NOT in .env
- Data isolation is automatic - all queries filter by tenant
- Users belong to exactly one tenant

### Authentication Flow
1. User logs in via Auth0 (frontend)
2. JWT token contains: `sub` (auth0_user_id), `email`, `company_id`, `role`
3. Frontend sends `Authorization: Bearer {token}` header
4. Backend validates JWT against Auth0 JWKS and extracts user

### Role-Based Access Control
Roles: `SUPERADMIN`, `ADMIN`, `LOGISTICA`, `VENTAS`, `VIEWER`
- Permissions defined in `apps/backend/app/core/permissions.py`
- SUPERADMIN: Platform-wide admin (manage all tenants)
- ADMIN: Full tenant access
- LOGISTICA: Order management + validation
- VENTAS: Order viewing
- VIEWER: Read-only

### Order Flow (Shopify)
1. n8n (external automation) creates draft orders in Shopify
2. n8n inserts orders into database with `shopify_draft_order_id`
3. User validates payment via frontend
4. Backend calls Shopify GraphQL `draftOrderComplete` mutation
5. Draft order becomes official Shopify order

### Order Flow (WooCommerce)
1. Orders are synced from WooCommerce via API
2. Orders stored in database with `woocommerce_order_id`
3. User validates payment via frontend
4. Backend updates order status in WooCommerce

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
- **Shopify GraphQL Admin API**: Draft order completion, store data
- **WooCommerce REST API**: Order sync and management
- **eFact-OSE**: Peru electronic invoicing/SUNAT (configured in `app/core/config.py`)
- **n8n**: External automation for order creation

## Environment Variables

Key variables needed (see `.env.example` files):
- Database: `DATABASE_URL`, `POSTGRES_*`
- Auth0: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`
- Frontend Auth0: `NEXT_PUBLIC_AUTH0_*`, `AUTH0_SECRET`, `AUTH0_CLIENT_SECRET`
- Backend: `SECRET_KEY`, `CORS_ORIGINS`
- eFact: `EFACT_BASE_URL`, `EFACT_RUC_VENTIA`, `EFACT_PASSWORD_REST`

## Key Files

### Backend Entry Points
- `app/main.py` - FastAPI application setup
- `app/core/config.py` - All settings and env vars
- `app/core/auth.py` - Auth0 JWT validation
- `app/core/permissions.py` - RBAC definitions
- `app/api/v1/api.py` - Main router aggregation

### Frontend Entry Points
- `app/layout.tsx` - Root layout with Auth0 provider
- `app/dashboard/layout.tsx` - Protected dashboard layout
- `lib/services/api.ts` - Backend API client
- `middleware.ts` - Auth middleware for protected routes
