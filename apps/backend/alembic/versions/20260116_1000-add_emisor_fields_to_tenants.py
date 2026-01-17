"""add emisor fields to tenants

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-01-16 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add emisor fields to tenants table for electronic invoicing
    op.add_column('tenants', sa.Column(
        'emisor_nombre_comercial',
        sa.String(200),
        nullable=True,
        comment='Nombre comercial del emisor para comprobantes electronicos'
    ))
    op.add_column('tenants', sa.Column(
        'emisor_ubigeo',
        sa.String(6),
        nullable=False,
        server_default='150101',
        comment='Codigo UBIGEO INEI del domicilio fiscal'
    ))
    op.add_column('tenants', sa.Column(
        'emisor_departamento',
        sa.String(100),
        nullable=False,
        server_default='LIMA',
        comment='Departamento del domicilio fiscal'
    ))
    op.add_column('tenants', sa.Column(
        'emisor_provincia',
        sa.String(100),
        nullable=False,
        server_default='LIMA',
        comment='Provincia del domicilio fiscal'
    ))
    op.add_column('tenants', sa.Column(
        'emisor_distrito',
        sa.String(100),
        nullable=False,
        server_default='LIMA',
        comment='Distrito del domicilio fiscal'
    ))
    op.add_column('tenants', sa.Column(
        'emisor_direccion',
        sa.String(500),
        nullable=True,
        comment='Direccion completa del domicilio fiscal'
    ))


def downgrade() -> None:
    # Remove emisor fields from tenants table
    op.drop_column('tenants', 'emisor_direccion')
    op.drop_column('tenants', 'emisor_distrito')
    op.drop_column('tenants', 'emisor_provincia')
    op.drop_column('tenants', 'emisor_departamento')
    op.drop_column('tenants', 'emisor_ubigeo')
    op.drop_column('tenants', 'emisor_nombre_comercial')
