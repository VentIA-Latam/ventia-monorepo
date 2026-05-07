# Plan: CI/CD y Manejo de Entornos

## Contexto

- Startup con un solo dev web
- Monorepo con 3 apps: frontend (Next.js), backend (FastAPI), messaging (Rails)
- Infra actual: servidor en GCP con Docker Compose + nginx
- CI/CD actual: un workflow en GitHub Actions que deploya backend al pushear a `main`
- Ramas actuales: `main` (producción), `development` (staging)

## Estrategia de Ramas

```
feature/x  ──squash merge──▶  development  ──merge──▶  main
                                  │                      │
                              staging                production
```

| Acción | Tipo de merge | Por qué |
|--------|--------------|---------|
| `feature/*` → `development` | Squash merge | Historial limpio, un commit por feature |
| `development` → `main` | Merge normal | Preserva historial entre ambientes |
| `main` → `development` | Merge normal | Sincronizar hotfixes de prod a staging |

### Convenciones de ramas feature

```
feat/nombre-corto      → nueva funcionalidad
fix/nombre-corto       → corrección de bug
refactor/nombre-corto  → refactorización
```

## Entornos

| Entorno | Rama | Dominio | Propósito |
|---------|------|---------|-----------|
| Desarrollo | local | localhost | Desarrollo diario con Docker Compose dev |
| Staging | `development` | staging.ventia-latam.com (o subdominio) | Pruebas pre-producción |
| Producción | `main` | ventia-latam.com / api.ventia-latam.com | Usuarios reales |

> Nota: Si staging comparte servidor con producción, usar puertos distintos o subdominios con nginx.

## GitHub Actions - Workflows

### 1. Deploy Backend a Producción (ya existe)

**Trigger**: push a `main`
**Acción**: deploy del backend FastAPI

### 2. Deploy Backend a Staging (nuevo)

**Trigger**: push a `development`

```yaml
# .github/workflows/deploy-staging-backend.yml
name: Deploy Backend (Staging)

on:
  push:
    branches: [development]
    paths:
      - 'apps/backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ventia-docker
            git pull origin development
            docker compose -f docker-compose.staging.yml up -d --build backend
```

### 3. Deploy Frontend a Producción (nuevo)

**Trigger**: push a `main`

```yaml
# .github/workflows/deploy-prod-frontend.yml
name: Deploy Frontend (Production)

on:
  push:
    branches: [main]
    paths:
      - 'apps/frontend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ventia-docker
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build frontend
```

### 4. Deploy Messaging a Producción (nuevo)

**Trigger**: push a `main`

```yaml
# .github/workflows/deploy-prod-messaging.yml
name: Deploy Messaging (Production)

on:
  push:
    branches: [main]
    paths:
      - 'apps/messaging/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ventia-docker
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build messaging
```

### 5. Tests en PRs (nuevo, recomendado)

**Trigger**: PR hacia `development` o `main`

```yaml
# .github/workflows/test-backend.yml
name: Backend Tests

on:
  pull_request:
    branches: [development, main]
    paths:
      - 'apps/backend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Install dependencies
        working-directory: apps/backend
        run: uv sync

      - name: Lint
        working-directory: apps/backend
        run: uv run ruff check .

      - name: Run tests
        working-directory: apps/backend
        run: uv run pytest --tb=short
```

## Flujo de Trabajo Diario

```
1. Crear rama feature:
   git checkout development
   git pull origin development
   git checkout -b feat/nueva-funcionalidad

2. Desarrollar y commitear:
   git add <archivos>
   git commit -m "feat: descripción"

3. Subir y crear PR:
   git push -u origin feat/nueva-funcionalidad
   gh pr create --base development

4. Mergear a staging (squash merge en GitHub):
   → Tests pasan automáticamente
   → Squash and merge en la UI de GitHub
   → Auto-deploy a staging

5. Probar en staging:
   → Verificar que todo funciona en el entorno de staging

6. Promover a producción:
   gh pr create --base main --head development
   → Merge normal (no squash)
   → Auto-deploy a producción
```

## Qué NO hacer (siendo solo dev)

- **No** crear ramas `release/*` ni `hotfix/*` (Gitflow completo es overkill)
- **No** poner aprobaciones obligatorias en PRs (no hay quién apruebe)
- **No** crear entornos separados de QA/UAT (staging es suficiente)
- **No** agregar herramientas de CI/CD complejas (GitHub Actions + SSH es suficiente)
- **No** usar Kubernetes o infraestructura compleja (Docker Compose escala bien para un equipo chico)

## Mejoras Futuras (cuando crezca el equipo)

- [ ] Agregar health checks post-deploy (curl al /health después del deploy)
- [ ] Notificaciones de deploy a Slack/Discord
- [ ] Rollback automático si el health check falla
- [ ] Branch protection rules cuando haya más devs
- [ ] Separar staging en su propio servidor
- [ ] Migrar a un registry privado de Docker (GitHub Container Registry)

## Secrets necesarios en GitHub

| Secret | Descripción |
|--------|-------------|
| `SERVER_HOST` | IP del servidor de producción |
| `SERVER_USER` | Usuario SSH (root o deploy user) |
| `SSH_PRIVATE_KEY` | Llave privada SSH para conectar al servidor |

Configurar en: GitHub → Repo → Settings → Secrets and variables → Actions
