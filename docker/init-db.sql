-- Init script for PostgreSQL container.
-- Creates the messaging_db database used by the Rails messaging service.
-- The default ventia_db is used by the Ventia backend (Alembic/SQLAlchemy).

CREATE DATABASE messaging_db;
