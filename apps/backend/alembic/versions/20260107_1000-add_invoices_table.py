"""add invoices table

Revision ID: a1b2c3d4e5f6
Revises: e4a8b2c9f1d3
Create Date: 2026-01-07 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'e4a8b2c9f1d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),

        # Multitenant
        sa.Column('tenant_id', sa.Integer(), nullable=False, comment='Tenant (company) this invoice belongs to'),
        sa.Column('order_id', sa.Integer(), nullable=False, comment='Order this invoice is for'),

        # Invoice identification
        sa.Column('invoice_type', sa.String(2), nullable=False, comment='01=Factura, 03=Boleta, 07=NC, 08=ND'),
        sa.Column('serie', sa.String(4), nullable=False, comment='Serie del comprobante (ej: F001, B001)'),
        sa.Column('correlativo', sa.Integer(), nullable=False, comment='Número correlativo del comprobante'),

        # Issuer (emisor)
        sa.Column('emisor_ruc', sa.String(11), nullable=False, comment='RUC del tenant emisor'),
        sa.Column('emisor_razon_social', sa.String(200), nullable=False, comment='Razón social del tenant'),

        # Customer (cliente)
        sa.Column('cliente_tipo_documento', sa.String(1), nullable=False, comment='1=DNI, 6=RUC'),
        sa.Column('cliente_numero_documento', sa.String(11), nullable=False, comment='DNI o RUC del cliente'),
        sa.Column('cliente_razon_social', sa.String(200), nullable=False, comment='Nombre o razón social del cliente'),

        # Amounts
        sa.Column('currency', sa.String(3), nullable=False, comment='PEN, USD'),
        sa.Column('subtotal', sa.Float(), nullable=False, comment='Subtotal sin IGV'),
        sa.Column('igv', sa.Float(), nullable=False, comment='IGV (18%)'),
        sa.Column('total', sa.Float(), nullable=False, comment='Total a pagar'),

        # Line items
        sa.Column('items', sa.JSON(), nullable=False, comment='Line items desde order.line_items'),

        # Reference for NC/ND (auto-reference)
        sa.Column('reference_invoice_id', sa.Integer(), nullable=True, comment='Invoice referenciado para NC/ND'),
        sa.Column('reference_type', sa.String(2), nullable=True, comment='Tipo de documento referenciado'),
        sa.Column('reference_serie', sa.String(4), nullable=True, comment='Serie del documento referenciado'),
        sa.Column('reference_correlativo', sa.Integer(), nullable=True, comment='Correlativo del documento referenciado'),
        sa.Column('reference_reason', sa.String(200), nullable=True, comment='Motivo de la NC/ND'),

        # eFact integration
        sa.Column('efact_ticket', sa.String(100), nullable=True, comment='UUID de eFact'),
        sa.Column('efact_status', sa.String(20), nullable=False, comment='pending, processing, success, error'),
        sa.Column('efact_response', sa.JSON(), nullable=True, comment='CDR de SUNAT'),
        sa.Column('efact_error', sa.String(500), nullable=True, comment='Mensaje de error si falla'),
        sa.Column('efact_sent_at', sa.DateTime(), nullable=True, comment='Timestamp cuando se envió a eFact'),
        sa.Column('efact_processed_at', sa.DateTime(), nullable=True, comment='Timestamp cuando eFact procesó el comprobante'),

        # Primary key
        sa.PrimaryKeyConstraint('id'),

        # Foreign keys
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reference_invoice_id'], ['invoices.id'], ondelete='SET NULL'),

        # Unique constraint
        sa.UniqueConstraint('tenant_id', 'serie', 'correlativo', name='uq_tenant_serie_correlativo'),
    )

    # Create indexes
    op.create_index('ix_invoices_id', 'invoices', ['id'])
    op.create_index('ix_invoices_tenant_id', 'invoices', ['tenant_id'])
    op.create_index('ix_invoices_order_id', 'invoices', ['order_id'])
    op.create_index('ix_invoices_efact_ticket', 'invoices', ['efact_ticket'], unique=True)
    op.create_index('ix_invoices_efact_status', 'invoices', ['efact_status'])
    op.create_index('ix_invoices_order_invoice_type', 'invoices', ['order_id', 'invoice_type'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_invoices_order_invoice_type', table_name='invoices')
    op.drop_index('ix_invoices_efact_status', table_name='invoices')
    op.drop_index('ix_invoices_efact_ticket', table_name='invoices')
    op.drop_index('ix_invoices_order_id', table_name='invoices')
    op.drop_index('ix_invoices_tenant_id', table_name='invoices')
    op.drop_index('ix_invoices_id', table_name='invoices')

    # Drop table
    op.drop_table('invoices')
