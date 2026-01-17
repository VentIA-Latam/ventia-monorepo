"""merge heads

Revision ID: c21ddad9b0cb
Revises: d4e5f6a7b8c9, f7g8h9i0j1k2
Create Date: 2026-01-17 08:32:10.221478

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c21ddad9b0cb'
down_revision: Union[str, None] = ('d4e5f6a7b8c9', 'f7g8h9i0j1k2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
