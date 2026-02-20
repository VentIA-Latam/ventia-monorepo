"""Remove chatwoot_user_id and chatwoot_account_id from users table

These fields are no longer needed because user provisioning to the
messaging service is now automatic (sync_user called on user creation).

Revision ID: a1b2c3d4e5f6
Revises: 7fbd9b64d81b
Create Date: 2026-02-19 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '7fbd9b64d81b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove chatwoot fields from users table."""
    op.drop_index('ix_users_chatwoot_account_id', table_name='users')
    op.drop_index('ix_users_chatwoot_user_id', table_name='users')
    op.drop_column('users', 'chatwoot_account_id')
    op.drop_column('users', 'chatwoot_user_id')


def downgrade() -> None:
    """Re-add chatwoot fields to users table."""
    op.add_column(
        'users',
        sa.Column('chatwoot_user_id', sa.Integer(), nullable=True,
                  comment='Chatwoot user ID for SSO login')
    )
    op.add_column(
        'users',
        sa.Column('chatwoot_account_id', sa.Integer(), nullable=True,
                  comment='Chatwoot account ID for SSO login')
    )
    op.create_index('ix_users_chatwoot_user_id', 'users', ['chatwoot_user_id'])
    op.create_index('ix_users_chatwoot_account_id', 'users', ['chatwoot_account_id'])
