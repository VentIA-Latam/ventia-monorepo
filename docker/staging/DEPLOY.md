# Ventia Staging — Guia de Deploy en MV

## Prerequisitos

- VM en GCP con Ubuntu 22.04+
- Acceso SSH como root o con sudo
- Dominio ventia-latam.com con acceso a DNS

## Paso 1: Preparar la MV

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Instalar Docker Compose plugin
apt install docker-compose-plugin -y

# Verificar
docker --version
docker compose version

# Instalar Nginx
apt install nginx -y
systemctl enable nginx

# Instalar Certbot
apt install certbot python3-certbot-nginx -y
```

## Paso 2: Configurar DNS

En tu proveedor de DNS, crear 3 registros A apuntando a la IP de la MV:

| Registro | Tipo | Valor |
|----------|------|-------|
| staging.ventia-latam.com | A | IP_DE_LA_MV |
| staging-api.ventia-latam.com | A | IP_DE_LA_MV |
| staging-ws.ventia-latam.com | A | IP_DE_LA_MV |

Verificar propagacion:
```bash
dig staging.ventia-latam.com +short
dig staging-api.ventia-latam.com +short
dig staging-ws.ventia-latam.com +short
```

## Paso 3: Clonar repositorio

```bash
cd /opt
git clone https://github.com/VentIA-Latam/ventia-monorepo.git
cd ventia-monorepo
git checkout feat/chatwoot-integration
```

## Paso 4: Configurar variables de entorno

```bash
cd docker/staging
cp .env.example .env
nano .env  # Llenar todas las variables
```

Variables criticas a configurar:
- `POSTGRES_PASSWORD` — password seguro para PostgreSQL
- `SECRET_KEY` — string random para el backend
- `SECRET_KEY_BASE` — string random para messaging Rails
- `AUTH0_*` — todas las credenciales de Auth0
- `AUTH0_SECRET`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` — para el frontend
- `NEXT_PUBLIC_AUTH0_*` — credenciales publicas del frontend

## Paso 5: Configurar Nginx

```bash
# Copiar config
cp /opt/ventia-monorepo/docker/staging/nginx.conf /etc/nginx/sites-available/ventia-staging

# Crear symlink
ln -sf /etc/nginx/sites-available/ventia-staging /etc/nginx/sites-enabled/

# Quitar default
rm -f /etc/nginx/sites-enabled/default

# Verificar sintaxis (va a fallar por SSL — es normal, los certs no existen aun)
nginx -t
```

## Paso 6: Obtener certificados SSL

Primero, crear config temporal sin SSL para que Certbot pueda verificar:

```bash
# Crear directorio para ACME challenge
mkdir -p /var/www/certbot

# Config temporal (solo HTTP, sin SSL)
cat > /etc/nginx/sites-available/ventia-staging << 'EOF'
server {
    listen 80;
    server_name staging.ventia-latam.com staging-api.ventia-latam.com staging-ws.ventia-latam.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

# Reiniciar nginx con config temporal
nginx -t && systemctl reload nginx

# Obtener certificados
certbot certonly --webroot -w /var/www/certbot \
  -d staging.ventia-latam.com \
  -d staging-api.ventia-latam.com \
  -d staging-ws.ventia-latam.com \
  --email tu-email@ventia.com \
  --agree-tos \
  --no-eff-email

# Restaurar config completa con SSL
cp /opt/ventia-monorepo/docker/staging/nginx.conf /etc/nginx/sites-available/ventia-staging

# Verificar y aplicar
nginx -t && systemctl reload nginx
```

Verificar auto-renewal:
```bash
certbot renew --dry-run
```

## Paso 7: Levantar servicios Docker

```bash
cd /opt/ventia-monorepo/docker/staging

# Build y levantar todo
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f

# Ver estado de los servicios
docker compose ps
```

Esperar a que todos los healthchecks pasen:
```bash
# Verificar healthchecks
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Todos los servicios deben mostrar `(healthy)`.

## Paso 8: Verificar servicios

```bash
# Backend health
curl -s http://127.0.0.1:8000/api/v1/health

# Frontend
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000

# Messaging
curl -s http://127.0.0.1:3001/api/v1/health || echo "No health endpoint (normal)"

# Via Nginx (SSL)
curl -s https://staging-api.ventia-latam.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}" https://staging.ventia-latam.com
```

## Paso 9: Inicializar base de datos

Las migraciones corren automaticamente al iniciar los containers. Para seed:

```bash
# Seed de datos de prueba (ventia_db)
docker exec ventia-backend uv run python scripts/seed.py

# Verificar que messaging se provisionó
docker exec ventia-postgres psql -U postgres -d messaging_db -c "SELECT id, name, ventia_tenant_id FROM accounts;"
docker exec ventia-postgres psql -U postgres -d messaging_db -c "SELECT id, name, ventia_user_id FROM users;"
```

## Paso 10: Migrar datos de Chatwoot (opcional)

Si necesitas migrar historial de conversaciones:
```bash
# Ejecutar notebook de migracion (pendiente de crear)
docker exec ventia-backend uv run python scripts/migrate-chatwoot.py --config migration-config.json
```

## Comandos utiles

```bash
# Ver logs de un servicio especifico
docker compose logs -f backend
docker compose logs -f messaging
docker compose logs -f frontend

# Reiniciar un servicio
docker compose restart backend
docker compose restart messaging

# Rebuild y reiniciar
docker compose up -d --build backend

# Acceder al shell de un container
docker exec -it ventia-backend sh
docker exec -it ventia-messaging sh

# Ver base de datos
docker exec -it ventia-postgres psql -U postgres -d ventia_db
docker exec -it ventia-postgres psql -U postgres -d messaging_db

# Ejecutar migraciones manualmente
docker exec ventia-backend uv run alembic upgrade head
docker exec ventia-messaging bundle exec rails db:migrate

# Parar todo
docker compose down

# Parar y borrar volumes (CUIDADO: borra data)
docker compose down -v
```

## Troubleshooting

### Container en restart loop
```bash
docker logs ventia-messaging --tail 50
# Si dice "server.pid already running":
docker exec ventia-messaging rm -f /app/tmp/pids/server.pid
docker compose restart messaging
```

### Migraciones fallaron
```bash
# Backend
docker exec ventia-backend uv run alembic upgrade head

# Messaging
docker exec ventia-messaging bundle exec rails db:migrate
```

### SSL no funciona
```bash
# Verificar certificados existen
ls /etc/letsencrypt/live/staging.ventia-latam.com/

# Renovar manualmente
certbot renew

# Verificar nginx config
nginx -t
```

### Messaging no conecta con PostgreSQL
```bash
# Verificar que messaging_db existe
docker exec ventia-postgres psql -U postgres -c "\l" | grep messaging

# Si no existe, recrear init-db
docker exec ventia-postgres psql -U postgres -c "CREATE DATABASE messaging_db;"
docker compose restart messaging
```
