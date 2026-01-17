"""merge heads

Revision ID: merge_heads_2026
Revises: d4e5f6a7b8c9, f7g8h9i0j1k2
Create Date: 2026-01-17 01:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'merge_heads_2026'
down_revision = ('d4e5f6a7b8c9', 'f7g8h9i0j1k2')
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Merge two migration branches."""
    pass


def downgrade() -> None:
    """Reverse merge."""
    pass
