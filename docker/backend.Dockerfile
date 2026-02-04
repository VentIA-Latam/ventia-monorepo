# Backend Dockerfile - Python 3.11 with UV (Multi-stage optimized)

# ============================================================================
# Stage 1: Builder - Instalar dependencias con compilación
# ============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Instalar dependencias de build (gcc para compilar paquetes como psycopg2)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar UV
RUN pip install --no-cache-dir uv

# Copiar archivos de dependencias
COPY apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version apps/backend/README.md ./

# Instalar dependencias (esto crea el venv en .venv)
# --frozen: usar exactamente lo que está en uv.lock
RUN uv sync --frozen

# ============================================================================
# Stage 2: Runtime - Imagen final mínima
# ============================================================================
FROM python:3.11-slim

WORKDIR /app

# Instalar solo runtime dependencies (libpq5 para PostgreSQL, curl para healthcheck)
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app

# Copiar UV desde builder
COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copiar venv con dependencias instaladas desde builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv

# Copiar archivos de configuración
COPY --chown=appuser:appuser apps/backend/pyproject.toml apps/backend/uv.lock apps/backend/.python-version apps/backend/README.md ./

# Copiar código de aplicación
COPY --chown=appuser:appuser apps/backend/app ./app
COPY --chown=appuser:appuser apps/backend/alembic ./alembic
COPY --chown=appuser:appuser apps/backend/alembic.ini ./
COPY --chown=appuser:appuser apps/backend/scripts ./scripts

# Variables de entorno para optimización
ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
