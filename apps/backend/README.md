# VentIA Backend

FastAPI backend with multitenant architecture, Auth0 authentication, and Shopify GraphQL integration.

## Stack

- **Framework**: FastAPI
- **Python**: 3.11+
- **Package Manager**: UV
- **Database**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Alembic
- **Auth**: Auth0 JWT
- **API Client**: httpx (Shopify GraphQL)

## Architecture

```
API Layer          → FastAPI routers (/api/v1/endpoints/)
    ↓
Service Layer      → Business logic (/services/)
    ↓
Repository Layer   → Data access (/repositories/)
    ↓
Models Layer       → SQLAlchemy models + Pydantic schemas (/models/, /schemas/)
    ↓
Core Layer         → Config, database, auth (/core/)
    ↓
Integrations       → External APIs (/integrations/)
```

## Setup

### Prerequisites

- Python 3.11+
- UV package manager
- PostgreSQL 16

### Installation

1. **Install UV** (if not installed)
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. **Install dependencies**
   ```bash
   cd apps/backend
   uv sync
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. **Run migrations**
   ```bash
   uv run alembic upgrade head
   ```

5. **Start development server**
   ```bash
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

## Development

### Run server
```bash
uv run uvicorn app.main:app --reload
```

### Create migration
```bash
uv run alembic revision --autogenerate -m "migration message"
```

### Apply migrations
```bash
uv run alembic upgrade head
```

### Run tests
```bash
uv run pytest
```

### Linting
```bash
uv run ruff check .
uv run ruff format .
```

## API Endpoints

### Health
- `GET /api/v1/health` - Health check (no auth)

### Orders (requires auth)
- `GET /api/v1/orders` - List orders (filtered by tenant)
- `GET /api/v1/orders/{id}` - Get order
- `PUT /api/v1/orders/{id}` - Update order (ADMIN, LOGISTICA)
- `POST /api/v1/orders/{id}/validate` - Validate payment & complete draft order (ADMIN, LOGISTICA)

### Users (ADMIN only)
- `GET /api/v1/users` - List users
- `POST /api/v1/users` - Create user
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user

## Project Structure

```
backend/
├── app/
│   ├── api/                    # API layer
│   │   ├── deps.py            # Dependencies (auth, db)
│   │   └── v1/
│   │       ├── api.py         # Main router
│   │       └── endpoints/     # Endpoint modules
│   ├── core/                   # Core layer
│   │   ├── config.py          # Settings
│   │   ├── database.py        # DB connection
│   │   ├── permissions.py     # RBAC
│   │   └── auth.py            # Auth0 JWT validation
│   ├── integrations/           # External APIs
│   │   └── shopify_client.py  # Shopify GraphQL
│   ├── models/                 # SQLAlchemy models
│   ├── schemas/                # Pydantic schemas
│   ├── repositories/           # Repository layer
│   ├── services/               # Service layer
│   └── main.py                 # FastAPI app
├── alembic/                    # Database migrations
├── scripts/                    # Utility scripts
├── tests/                      # Tests
└── pyproject.toml             # Dependencies
```

## Multitenant Architecture

### Key Concepts

- Each **Tenant** (company) has their own Shopify credentials stored in DB
- Users belong to a tenant and have a role (ADMIN, LOGISTICA, VENTAS, VIEWER)
- All data is automatically filtered by `tenant_id`
- Shopify credentials are **NOT in .env** - they're in the `tenants` table

### Database Models

#### Tenant
- Stores company info + Shopify credentials per client
- Fields: `name`, `slug`, `company_id`, `shopify_store_url`, `shopify_access_token`

#### User
- Linked to Auth0 user via `auth0_user_id`
- Belongs to a tenant via `tenant_id`
- Has a role: ADMIN, LOGISTICA, VENTAS, VIEWER

#### Order
- Belongs to a tenant via `tenant_id`
- References Shopify draft order: `shopify_draft_order_id`
- Validated status: `validado`, `validated_at`

## Auth0 Integration

### Setup

1. Create Auth0 application (SPA for frontend)
2. Create Auth0 API with identifier (audience)
3. Configure environment variables
4. Get public keys from `https://{AUTH0_DOMAIN}/.well-known/jwks.json`

### JWT Flow

1. User logs in via frontend → Auth0 returns JWT
2. Frontend sends JWT in `Authorization: Bearer {token}` header
3. Backend validates JWT using Auth0 public keys
4. Backend extracts `sub` (auth0_user_id) and gets user from DB
5. Backend checks permissions based on user role

### Role-Based Access Control

Permissions defined in `app/core/permissions.py`:

```python
PERMISSIONS = {
    ("GET", "/orders"): [Role.ADMIN, Role.LOGISTICA, Role.VENTAS, Role.VIEWER],
    ("POST", "/orders/*/validate"): [Role.ADMIN, Role.LOGISTICA],
    ("GET", "/users"): [Role.ADMIN],
    # ...
}
```

## Shopify Integration

### GraphQL API

The backend uses Shopify's GraphQL Admin API (not REST, not webhooks).

### Flow

1. n8n creates draft order in Shopify
2. n8n inserts order in database with `shopify_draft_order_id`
3. User validates payment in frontend
4. Backend calls `draftOrderComplete` mutation via Shopify GraphQL
5. Shopify converts draft → official order

### Client

Located in `app/integrations/shopify_client.py`:

```python
class ShopifyClient:
    def __init__(self, store_url: str, access_token: str, api_version: str):
        # Credentials from tenant.shopify_* fields

    async def complete_draft_order(self, draft_order_id: str) -> dict:
        # GraphQL mutation: draftOrderComplete
```

## Testing

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov

# Run specific test file
uv run pytest tests/test_main.py

# Run specific test
uv run pytest tests/test_main.py::test_health_endpoint
```

## Deployment

### Using Docker

```bash
# From monorepo root
docker compose up -d backend
```

### Environment Variables (Production)

- Change `SECRET_KEY` to a strong random value
- Use `openssl rand -hex 32` to generate secrets
- Encrypt Shopify access tokens in database
- Enable SSL for database connections
- Configure proper CORS origins

## License

Proprietary - VentIA Team
