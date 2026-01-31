# Guía de Despliegue - Ventia Backend

## Requisitos Previos

- Docker instalado en tu máquina local
- Cuenta en Docker Hub
- Acceso SSH a la VM de GCP
- El monorepo de Ventia clonado localmente

---

## Parte 1: Construir y Subir Imagen a Docker Hub

### 1.1 Login en Docker Hub (Local)

```bash
docker login
```

Te pedirá:
- Username: tu usuario de Docker Hub
- Password: tu contraseña o access token

### 1.2 Construir la imagen del backend

Desde la raíz del monorepo (`ventia-monorepo`):

```bash
cd C:\Users\Renzo\Desktop\Proyectos\Ventia\ventia-monorepo

docker build -t ventialatam/ventia-backend:latest -f docker/backend.Dockerfile .
```

> **Nota:** Reemplaza `ventialatam` con tu usuario de Docker Hub si es diferente.

### 1.3 Verificar que la imagen se creó

```bash
docker images | grep ventia-backend
```

### 1.4 Subir la imagen a Docker Hub

```bash
docker push ventialatam/ventia-backend:latest
```

### 1.5 (Opcional) Taggear con versión específica

```bash
docker tag ventialatam/ventia-backend:latest ventialatam/ventia-backend:v1.0.0
docker push ventialatam/ventia-backend:v1.0.0
```

---

## Parte 2: Modificar Docker Compose

### 2.1 Agregar servicio en `docker-compose.yml`

Agregar antes de la sección `networks:`:

```yaml
  # Ventia Backend - API FastAPI
  ventia-backend:
    image: ${VENTIA_DOCKER_IMAGE:-ventialatam/ventia-backend:latest}
    container_name: ${COMPOSE_PROJECT_NAME:-chatbot}-ventia-backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/ventia_db
      - ENVIRONMENT=${VENTIA_ENVIRONMENT:-production}
      - LOG_LEVEL=${VENTIA_LOG_LEVEL:-info}
      - CORS_ORIGINS=${VENTIA_CORS_ORIGINS:-["https://ventia.com"]}
      - SECRET_KEY=${VENTIA_SECRET_KEY}
      - AUTH0_DOMAIN=${VENTIA_AUTH0_DOMAIN}
      - AUTH0_AUDIENCE=${VENTIA_AUTH0_AUDIENCE}
      - AUTH0_ISSUER=${VENTIA_AUTH0_ISSUER}
      - AUTH0_ALGORITHM=${VENTIA_AUTH0_ALGORITHM:-RS256}
      # eFact (Facturación Electrónica)
      - EFACT_BASE_URL=${VENTIA_EFACT_BASE_URL:-https://ose-gw1.efact.pe:443/api-efact-ose}
      - EFACT_RUC_VENTIA=${VENTIA_EFACT_RUC}
      - EFACT_PASSWORD_REST=${VENTIA_EFACT_PASSWORD}
      - EFACT_TOKEN_CACHE_HOURS=${VENTIA_EFACT_TOKEN_CACHE_HOURS:-11}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - chatbot-network
```

### 2.2 Agregar override en `docker-compose.prod.yml`

Agregar al final del archivo:

```yaml
  # Ventia Backend - Configuración producción
  ventia-backend:
    ports:
      - "8001:8000"
    environment:
      - ENVIRONMENT=production
      - LOG_LEVEL=info
```

### 2.3 Agregar override en `docker-compose.dev.yml`

Agregar al final del archivo:

```yaml
  # Ventia Backend - Configuración desarrollo
  ventia-backend:
    ports:
      - "8001:8000"
    environment:
      - ENVIRONMENT=development
      - LOG_LEVEL=debug
      - CORS_ORIGINS=["http://localhost:3000", "http://localhost:8001"]
```

---

## Parte 3: Configurar Variables de Entorno

### 3.1 Agregar variables en `.env.prod`

Agregar las siguientes variables al archivo `.env.prod`:

```env
# ============================================
# VENTIA BACKEND
# ============================================

# Docker Image
VENTIA_DOCKER_IMAGE=ventialatam/ventia-backend:latest

# Entorno
VENTIA_ENVIRONMENT=production
VENTIA_LOG_LEVEL=info

# CORS - Dominios permitidos (formato JSON array)
VENTIA_CORS_ORIGINS=["https://app.ventia.com", "https://ventia.com"]

# Seguridad - Generar con: openssl rand -hex 32
VENTIA_SECRET_KEY=tu_secret_key_generada_aqui

# Auth0
VENTIA_AUTH0_DOMAIN=tu-tenant.auth0.com
VENTIA_AUTH0_AUDIENCE=https://tu-api-identifier
VENTIA_AUTH0_ISSUER=https://tu-tenant.auth0.com/
VENTIA_AUTH0_ALGORITHM=RS256

# eFact - Facturación Electrónica (opcional)
VENTIA_EFACT_BASE_URL=https://ose-gw1.efact.pe:443/api-efact-ose
VENTIA_EFACT_RUC=tu_ruc_aqui
VENTIA_EFACT_PASSWORD=tu_password_efact
VENTIA_EFACT_TOKEN_CACHE_HOURS=11
```

### 3.2 Generar SECRET_KEY

En Linux/Mac:
```bash
openssl rand -hex 32
```

En Windows (PowerShell):
```powershell
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Max 256) })
```

---

## Parte 4: Despliegue en la VM (GCP)

### 4.1 Conectar a la VM

```bash
ssh root@instance-20251112-223435
# o usando gcloud:
gcloud compute ssh instance-20251112-223435
```

### 4.2 Crear la base de datos

```bash
docker exec -it chatbot-prod-postgres psql -U postgres -c "CREATE DATABASE ventia_db;"
```

Verificar que se creó:
```bash
docker exec -it chatbot-prod-postgres psql -U postgres -c "\l" | grep ventia
```

### 4.3 Login en Docker Hub

```bash
docker login
```

### 4.4 Pull de la imagen

```bash
docker pull ventialatam/ventia-backend:latest
```

### 4.5 Subir archivos actualizados

Opción A - Usando SCP desde tu máquina local:
```bash
scp docker-compose.yml root@TU_IP_VM:/opt/ventia-docker/
scp docker-compose.prod.yml root@TU_IP_VM:/opt/ventia-docker/
scp .env.prod root@TU_IP_VM:/opt/ventia-docker/
```

Opción B - Editar directamente en la VM:
```bash
cd /opt/ventia-docker
nano docker-compose.yml
nano docker-compose.prod.yml
nano .env.prod
```

### 4.6 Levantar el servicio

```bash
cd /opt/ventia-docker

# Levantar solo ventia-backend
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d ventia-backend

# O levantar todos los servicios
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 4.7 Verificar que está corriendo

```bash
docker ps | grep ventia

# Ver logs
docker logs -f chatbot-prod-ventia-backend

# Verificar health
curl http://localhost:8001/api/v1/health
```

### 4.8 Ejecutar migraciones (si es necesario)

```bash
docker exec -it chatbot-prod-ventia-backend uv run alembic upgrade head
```

---

## Parte 5: Actualizaciones Futuras

Cuando hagas cambios en el código y necesites actualizar:

### En tu máquina local:

```bash
# 1. Construir nueva imagen
cd C:\Users\Renzo\Desktop\Proyectos\Ventia\ventia-monorepo
docker build -t ventialatam/ventia-backend:latest -f docker/backend.Dockerfile .

# 2. Subir a Docker Hub
docker push ventialatam/ventia-backend:latest
```

### En la VM:

```bash
cd /opt/ventia-docker

# 1. Pull de la nueva imagen
docker pull ventialatam/ventia-backend:latest

# 2. Recrear el contenedor
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d ventia-backend

# 3. Verificar
docker logs -f chatbot-prod-ventia-backend
```

---

## Troubleshooting

### El contenedor no inicia

```bash
# Ver logs detallados
docker logs chatbot-prod-ventia-backend

# Verificar variables de entorno
docker exec chatbot-prod-ventia-backend env | grep -E "(DATABASE|AUTH0|SECRET)"
```

### No puede conectar a PostgreSQL

```bash
# Verificar que están en la misma network
docker network inspect chatbot-prod_chatbot-network | grep -A5 ventia

# Probar conexión manual
docker exec -it chatbot-prod-ventia-backend python -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql://postgres:TU_PASSWORD@chatbot-prod-postgres:5432/ventia_db')
print(engine.connect())
"
```

### Migraciones fallan

```bash
# Ver estado de migraciones
docker exec -it chatbot-prod-ventia-backend uv run alembic current

# Ver historial
docker exec -it chatbot-prod-ventia-backend uv run alembic history
```

---

## Resumen de Comandos Rápidos

| Acción | Comando |
|--------|---------|
| Build imagen | `docker build -t ventialatam/ventia-backend:latest -f docker/backend.Dockerfile .` |
| Push imagen | `docker push ventialatam/ventia-backend:latest` |
| Pull imagen (VM) | `docker pull ventialatam/ventia-backend:latest` |
| Levantar servicio | `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d ventia-backend` |
| Ver logs | `docker logs -f chatbot-prod-ventia-backend` |
| Reiniciar | `docker restart chatbot-prod-ventia-backend` |
| Detener | `docker stop chatbot-prod-ventia-backend` |
| Migraciones | `docker exec -it chatbot-prod-ventia-backend uv run alembic upgrade head` |
