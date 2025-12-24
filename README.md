# VentIA Monorepo

Monorepo para VentIA: Next.js Frontend + FastAPI Backend con arquitectura multitenant.

## Estructura del Proyecto

```
ventia-monorepo/
├── apps/
│   ├── frontend/           # Next.js 16 App
│   └── backend/            # FastAPI Backend (próximo)
├── packages/               # Shared packages (futuro)
├── docker/                 # Dockerfiles
├── docker-compose.yml      # Orquestación de servicios
├── pnpm-workspace.yaml     # Configuración pnpm workspaces
└── package.json            # Scripts root
```

## Stack Tecnológico

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TailwindCSS v4, Shadcn/ui
- **Auth**: Auth0
- **TypeScript**: Strict mode

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Package Manager**: UV
- **Database**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0
- **Migrations**: Alembic
- **Auth**: Auth0 JWT validation
- **API Client**: httpx (Shopify GraphQL)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Monorepo**: pnpm workspaces

## Arquitectura

### Backend - Arquitectura en Capas

```
API Layer          → FastAPI routers, endpoints
    ↓
Service Layer      → Lógica de negocio
    ↓
Repository Layer   → Acceso a datos (SQLAlchemy)
    ↓
Models Layer       → SQLAlchemy models + Pydantic schemas
    ↓
Core Layer         → Config, database, auth, permissions
    ↓
Integrations       → Shopify GraphQL client
```

### Multitenant

- Cada **Tenant** (company) tiene sus propias credenciales de Shopify en la DB
- Los usuarios pertenecen a un tenant específico
- Role-based access control: ADMIN, LOGISTICA, VENTAS, VIEWER
- Aislamiento automático de datos por `tenant_id`

## Setup Inicial

### Prerrequisitos

- Node.js 20+
- pnpm 9+
- Python 3.11+
- UV (Python package manager)
- Docker + Docker Compose
- Git

### Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ventia-monorepo
   ```

2. **Configurar variables de ambiente**
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales
   ```

3. **Instalar dependencias del frontend**
   ```bash
   cd apps/frontend
   pnpm install
   ```

4. **Instalar dependencias del backend** (cuando esté listo)
   ```bash
   cd apps/backend
   uv sync
   ```

5. **Levantar servicios con Docker**
   ```bash
   # Desde la raíz del monorepo
   pnpm docker:up
   ```

6. **Correr migraciones**
   ```bash
   pnpm db:migrate
   ```

7. **Iniciar desarrollo**
   ```bash
   pnpm dev
   ```

## Scripts Disponibles

### Desarrollo
- `pnpm dev` - Levantar frontend + backend en paralelo
- `pnpm dev:frontend` - Solo frontend
- `pnpm dev:backend` - Solo backend

### Docker
- `pnpm docker:up` - Levantar servicios
- `pnpm docker:down` - Bajar servicios
- `pnpm docker:logs` - Ver logs
- `pnpm docker:restart` - Reiniciar servicios

### Base de Datos
- `pnpm db:migrate` - Aplicar migraciones
- `pnpm db:migrate:create "nombre"` - Crear nueva migración
- `pnpm db:reset` - Reset completo de DB

### Build
- `pnpm build` - Build frontend + backend
- `pnpm build:frontend` - Solo frontend
- `pnpm build:backend` - Solo backend

## Flujo de Trabajo

### Flujo de Orders

1. **n8n (IA Agent)** crea draft orders en Shopify y los inserta en la DB
2. **Frontend** muestra orders en tabla (filtrado por tenant)
3. **Usuario** valida el pago desde la UI
4. **Backend** marca el order como validado y llama a Shopify GraphQL
5. **Shopify** completa el draft order → order oficial

### Autenticación y Autorización

1. Usuario hace login con **Auth0**
2. Auth0 retorna JWT con claims: `sub`, `email`, `company_id`, `role`
3. Frontend envía JWT en headers: `Authorization: Bearer {token}`
4. Backend valida JWT y verifica permisos basado en rol
5. Todos los datos se filtran automáticamente por `tenant_id`

## Endpoints del Backend

### Health
- `GET /api/v1/health` - Health check (sin auth)

### Orders (requiere auth)
- `GET /api/v1/orders` - Listar orders (filtrado por tenant)
- `GET /api/v1/orders/{id}` - Obtener order específico
- `PUT /api/v1/orders/{id}` - Actualizar order
- `POST /api/v1/orders/{id}/validate` - Validar y completar en Shopify

### Users (solo ADMIN)
- `GET /api/v1/users` - Listar usuarios del tenant
- `POST /api/v1/users` - Crear usuario
- `PUT /api/v1/users/{id}` - Actualizar usuario
- `DELETE /api/v1/users/{id}` - Eliminar usuario

## Modelo de Datos

### Tenant (Company)
- `name`, `slug`, `company_id` (para Auth0)
- `shopify_store_url`, `shopify_access_token`, `shopify_api_version`
- Credenciales de Shopify **por tenant** (no en .env)

### User
- `auth0_user_id`, `email`, `name`
- `tenant_id` (FK a Tenant)
- `role` (ADMIN, LOGISTICA, VENTAS, VIEWER)

### Order
- `tenant_id` (FK a Tenant)
- `shopify_draft_order_id`, `shopify_order_id`
- `customer_email`, `total_price`, `line_items` (JSON)
- `validado`, `validated_at`, `status`

## Desarrollo

### Agregar nuevo endpoint

1. Crear schema en `apps/backend/app/schemas/`
2. Agregar método en Repository: `apps/backend/app/repositories/`
3. Implementar lógica en Service: `apps/backend/app/services/`
4. Crear endpoint en API: `apps/backend/app/api/v1/endpoints/`
5. Agregar permisos en `apps/backend/app/core/permissions.py`

### Testing

```bash
# Backend
cd apps/backend
uv run pytest

# Frontend
cd apps/frontend
pnpm test
```

## Configuración de Auth0

1. Crear aplicación en Auth0 Dashboard
2. Configurar Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
3. Configurar Allowed Logout URLs: `http://localhost:3000`
4. Crear API en Auth0 con identifier (audience)
5. Configurar variables de ambiente con credenciales

## Notas Importantes

- **NO** poner credenciales de Shopify en `.env` - van en tabla `tenants`
- Cada tenant tiene sus propias credenciales de Shopify
- Usar `openssl rand -hex 32` para generar `AUTH0_SECRET`
- Cambiar todos los passwords y secrets en producción
- El backend filtra automáticamente datos por `tenant_id`

## Roadmap

- [x] Setup monorepo structure
- [x] Migrar frontend a apps/frontend
- [ ] Implementar backend con FastAPI
- [ ] Configurar Alembic migrations
- [ ] Setup Docker Compose
- [ ] Integrar Auth0
- [ ] Conectar frontend con backend
- [ ] Testing e2e

## Licencia

Privado - VentIA Team
