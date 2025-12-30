"""add SUPER_ADMIN to role enum

Revision ID: add_superadmin_to_role
Revises: 5bc42defbfa9
Create Date: 2025-12-30 04:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_superadmin_to_role'
down_revision: Union[str, None] = '5bc42defbfa9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add SUPER_ADMIN to the role enum
    op.execute("ALTER TYPE role ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN'")


def downgrade() -> None:
    # Cannot easily remove enum values, so we skip downgrade
    pass
