"""add unique partial index on (tenant_id, shopify_order_id)

Prevents duplicate Shopify orders per tenant. Partial (WHERE shopify_order_id
IS NOT NULL) so multiple draft-only orders (NULL shopify_order_id) are allowed.

NOTE: If duplicate (tenant_id, shopify_order_id) rows already exist, this
migration will fail. Clean them up first:
    SELECT tenant_id, shopify_order_id, count(*)
    FROM orders
    WHERE shopify_order_id IS NOT NULL
    GROUP BY 1, 2 HAVING count(*) > 1;

Revision ID: 9d4e7f2a1c8b
Revises: f46cfe87e0ef
Create Date: 2026-05-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d4e7f2a1c8b'
down_revision: Union[str, None] = 'f46cfe87e0ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'uq_tenant_shopify_order',
        'orders',
        ['tenant_id', 'shopify_order_id'],
        unique=True,
        postgresql_where=sa.text('shopify_order_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_tenant_shopify_order', table_name='orders')
