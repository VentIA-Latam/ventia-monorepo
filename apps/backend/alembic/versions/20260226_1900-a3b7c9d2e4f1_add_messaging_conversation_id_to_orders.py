"""Add messaging_conversation_id to orders

Links orders to messaging conversations so payment validation
can auto-transition the conversation stage to 'sale'.

Revision ID: a3b7c9d2e4f1
Revises: f1e2d3c4b5a6
Create Date: 2026-02-26 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b7c9d2e4f1'
down_revision: Union[str, None] = 'f1e2d3c4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add messaging_conversation_id column to orders."""
    op.add_column(
        'orders',
        sa.Column(
            'messaging_conversation_id',
            sa.Integer(),
            nullable=True,
            comment='Linked conversation ID in the messaging service',
        )
    )
    op.create_index(
        'ix_orders_messaging_conversation_id',
        'orders',
        ['messaging_conversation_id'],
    )


def downgrade() -> None:
    """Remove messaging_conversation_id column from orders."""
    op.drop_index('ix_orders_messaging_conversation_id', table_name='orders')
    op.drop_column('orders', 'messaging_conversation_id')
