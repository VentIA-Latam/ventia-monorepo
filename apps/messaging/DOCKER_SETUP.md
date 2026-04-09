# 🐳 Messaging Service - Docker Setup

Setup rápido para ejecutar el servicio de mensajería con Docker Compose.

## Quick Start

### 1. Configurar variables de entorno

```bash
cd apps/messaging
cp .env.example .env
# Edita .env con tus valores (opcional, los defaults funcionan)
```

### 2. Levantar servicios

```bash
# Construir y levantar TODO (postgres, redis, messaging, sidekiq)
docker-compose up --build -d

# Ver logs
docker-compose logs -f messaging
```

### 3. Crear base de datos

```bash
# Primera vez: crear DB y migrar
docker-compose exec messaging bundle exec rails db:create db:migrate

# Health check
curl http://localhost:3001/health
```

## Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| postgres | 5433 | PostgreSQL 16 |
| redis | 6380 | Redis 7 |
| messaging | 3001 | Rails API |
| sidekiq | - | Background jobs |

## Comandos útiles

```bash
# Ver servicios
docker-compose ps

# Logs
docker-compose logs -f [servicio]

# Consola Rails
docker-compose exec messaging bundle exec rails console

# Detener
docker-compose down

# Detener y borrar datos
docker-compose down -v
```

## Usar PostgreSQL local

Edita `.env`:
```bash
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
POSTGRES_DATABASE=ventia_db  # tu BD local
```

Comenta el servicio postgres en `docker-compose.yml` y elimina las dependencias.

## Troubleshooting

**"could not connect to server"**
```bash
docker-compose ps postgres  # Debe estar "healthy"
```

**Sidekiq no procesa jobs**
```bash
docker-compose logs sidekiq
docker-compose restart sidekiq
```

**Hot reload no funciona**
Los cambios en `app/` se reflejan automáticamente. Para `config/` reinicia:
```bash
docker-compose restart messaging
```
