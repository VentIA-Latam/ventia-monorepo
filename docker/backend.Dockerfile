# Backend Dockerfile - Python 3.11 with UV

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install UV
RUN pip install uv

# Copy dependency files
COPY apps/backend/pyproject.toml apps/backend/.python-version apps/backend/README.md ./

# Install dependencies
RUN uv sync

# Copy application code
COPY apps/backend/app ./app
COPY apps/backend/alembic ./alembic
COPY apps/backend/alembic.ini ./
COPY apps/backend/scripts ./scripts

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000"]
