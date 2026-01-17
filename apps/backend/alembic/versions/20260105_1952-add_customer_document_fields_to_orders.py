"""add customer document fields to orders

Revision ID: e4a8b2c9f1d3
Revises: 6b63927a59c5
Create Date: 2026-01-05 19:52:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4a8b2c9f1d3'
down_revision = 'add_superadmin_to_role'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add customer document type and number fields for invoicing
    op.add_column('orders', sa.Column(
        'customer_document_type',
        sa.String(1),
        nullable=True,
        comment="Tipo de documento: 1=DNI, 6=RUC"
    ))
    op.add_column('orders', sa.Column(
        'customer_document_number',
        sa.String(11),
        nullable=True,
        comment="Número de DNI o RUC del cliente"
    ))


def downgrade() -> None:
    op.drop_column('orders', 'customer_document_number')
    op.drop_column('orders', 'customer_document_type')
