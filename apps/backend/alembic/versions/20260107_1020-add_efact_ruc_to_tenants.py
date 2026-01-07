"""add efact_ruc to tenants

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-01-07 10:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add efact_ruc column to tenants table
    op.add_column('tenants', sa.Column(
        'efact_ruc',
        sa.String(11),
        nullable=True,
        comment='RUC del tenant para facturación electrónica'
    ))


def downgrade() -> None:
    # Remove efact_ruc column from tenants table
    op.drop_column('tenants', 'efact_ruc')
