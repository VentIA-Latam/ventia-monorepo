"""merge chatwoot and webhooks

Revision ID: e1f71b23e005
Revises: add_chatwoot_fields, d9ed481f885b
Create Date: 2026-02-04 10:24:45.819346

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f71b23e005'
down_revision: Union[str, None] = ('add_chatwoot_fields', 'd9ed481f885b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
