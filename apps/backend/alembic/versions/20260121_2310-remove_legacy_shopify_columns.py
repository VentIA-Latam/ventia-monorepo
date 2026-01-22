"""Remove legacy Shopify columns from tenants table.

These columns have been replaced by the unified settings JSON field
that supports multiple e-commerce platforms (Shopify + WooCommerce).

Revision ID: c0ef996c0615
Revises: 7f4a7df6fce6
Create Date: 2026-01-21 23:10:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c0ef996c0615"
down_revision: str | None = "7f4a7df6fce6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Remove legacy Shopify columns."""
    op.drop_column("tenants", "shopify_store_url")
    op.drop_column("tenants", "_shopify_access_token_encrypted")
    op.drop_column("tenants", "shopify_api_version")


def downgrade() -> None:
    """No downgrade - we are in development with no production data."""
    pass
