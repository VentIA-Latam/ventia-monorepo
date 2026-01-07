"""add invoice_series table

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-07 10:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create invoice_series table
    op.create_table(
        'invoice_series',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),

        # Multitenant
        sa.Column('tenant_id', sa.Integer(), nullable=False, comment='Tenant (company) this series belongs to'),

        # Series configuration
        sa.Column('invoice_type', sa.String(2), nullable=False, comment='01=Factura, 03=Boleta, 07=NC, 08=ND'),
        sa.Column('serie', sa.String(4), nullable=False, comment='Código de serie (ej: F001, B001)'),
        sa.Column('last_correlativo', sa.Integer(), nullable=False, comment='Último número correlativo usado'),
        sa.Column('is_active', sa.Boolean(), nullable=False, comment='Serie activa o inactiva'),
        sa.Column('description', sa.String(100), nullable=True, comment='Descripción opcional de la serie'),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign key
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),

        # Unique constraint
        sa.UniqueConstraint('tenant_id', 'serie', name='uq_tenant_serie'),
    )

    # Create indexes
    op.create_index('ix_invoice_series_id', 'invoice_series', ['id'])
    op.create_index('ix_invoice_series_tenant_id', 'invoice_series', ['tenant_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_invoice_series_tenant_id', table_name='invoice_series')
    op.drop_index('ix_invoice_series_id', table_name='invoice_series')

    # Drop table
    op.drop_table('invoice_series')
