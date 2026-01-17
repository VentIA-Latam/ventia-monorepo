"""add cliente_email to invoices

Revision ID: f7g8h9i0j1k2
Revises: a1b2c3d4e5f6
Create Date: 2026-01-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f7g8h9i0j1k2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add cliente_email column to invoices table."""
    op.add_column(
        'invoices',
        sa.Column(
            'cliente_email',
            sa.String(255),
            nullable=True,
            comment='Email del cliente para envío de comprobantes'
        )
    )


def downgrade() -> None:
    """Remove cliente_email column from invoices table."""
    op.drop_column('invoices', 'cliente_email')
