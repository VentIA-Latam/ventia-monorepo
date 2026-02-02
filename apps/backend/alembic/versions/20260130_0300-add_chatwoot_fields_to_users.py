"""Add chatwoot_user_id and chatwoot_account_id to users table

Revision ID: add_chatwoot_fields
Revises: c0ef996c0615
Create Date: 2026-01-30 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_chatwoot_fields'
down_revision: Union[str, None] = 'c0ef996c0615'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add chatwoot_user_id and chatwoot_account_id columns to users table."""
    op.add_column(
        'users',
        sa.Column(
            'chatwoot_user_id',
            sa.Integer(),
            nullable=True,
            comment='Chatwoot user ID for SSO login'
        )
    )
    op.add_column(
        'users',
        sa.Column(
            'chatwoot_account_id',
            sa.Integer(),
            nullable=True,
            comment='Chatwoot account ID for SSO login'
        )
    )
    # Create indexes for faster lookups
    op.create_index(
        'ix_users_chatwoot_user_id',
        'users',
        ['chatwoot_user_id'],
        unique=False
    )
    op.create_index(
        'ix_users_chatwoot_account_id',
        'users',
        ['chatwoot_account_id'],
        unique=False
    )


def downgrade() -> None:
    """Remove chatwoot_user_id and chatwoot_account_id columns from users table."""
    op.drop_index('ix_users_chatwoot_account_id', table_name='users')
    op.drop_index('ix_users_chatwoot_user_id', table_name='users')
    op.drop_column('users', 'chatwoot_account_id')
    op.drop_column('users', 'chatwoot_user_id')
