"""merge messaging and reminders migrations

Revision ID: f46cfe87e0ef
Revises: a3b7c9d2e4f1, da6b1eaa3f3e
Create Date: 2026-04-09 03:17:53.062743

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f46cfe87e0ef'
down_revision: Union[str, None] = ('a3b7c9d2e4f1', 'da6b1eaa3f3e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
