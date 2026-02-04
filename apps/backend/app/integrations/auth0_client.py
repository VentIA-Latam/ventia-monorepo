"""
Auth0 Management API Client.

Handles communication with Auth0 Management API for user management operations.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)


class Auth0Token(BaseModel):
    """Auth0 Management API token with expiration."""

    access_token: str
    expires_at: datetime


class Auth0ManagementClient:
    """Client for Auth0 Management API operations."""

    def __init__(self):
        self.domain = settings.AUTH0_DOMAIN
        self.client_id = settings.AUTH0_MANAGEMENT_CLIENT_ID
        self.client_secret = settings.AUTH0_MANAGEMENT_CLIENT_SECRET
        self.audience = settings.AUTH0_MANAGEMENT_AUDIENCE
        self.connection = settings.AUTH0_CONNECTION

        # Validate connection is not empty to prevent production errors
        if not self.connection or not self.connection.strip():
            raise ValueError(
                "AUTH0_CONNECTION must be set in environment variables. "
                "This specifies which Auth0 database connection to use for user operations."
            )

        self._token: Auth0Token | None = None
        self._client = httpx.AsyncClient(timeout=30.0)

    async def _get_management_token(self) -> str:
        """
        Get valid Management API token.

        Implements token caching with automatic renewal.
        Token TTL is 24 hours but we validate expires_in from response.
        """
        # Return cached token if still valid (with 5 min buffer)
        if self._token and self._token.expires_at > datetime.utcnow() + timedelta(minutes=5):
            return self._token.access_token

        # Request new token via Client Credentials Flow
        try:
            response = await self._client.post(
                f"https://{self.domain}/oauth/token",
                json={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "audience": self.audience,
                },
            )
            response.raise_for_status()

            data = response.json()
            access_token = data["access_token"]
            expires_in = data["expires_in"]  # TTL en segundos

            # Cache token with expiration
            self._token = Auth0Token(
                access_token=access_token,
                expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            )

            logger.info(f"Obtained new Auth0 Management token (expires in {expires_in}s)")
            return access_token

        except httpx.HTTPError as e:
            logger.error(f"Failed to get Auth0 Management token: {str(e)}")
            raise RuntimeError(f"Auth0 authentication failed: {str(e)}")

    async def create_user(
        self,
        email: str,
        name: str,
        email_verified: bool = False,
        needs_invitation: bool = True,
    ) -> dict[str, Any]:
        """
        Create user in Auth0.

        Args:
            email: User email
            name: User full name
            email_verified: Whether email is verified (default: False)
            needs_invitation: Set to True for invitation email (default: True)

        Returns:
            Auth0 user object with user_id

        Raises:
            RuntimeError: If Auth0 API call fails
        """
        token = await self._get_management_token()

        payload = {
            "email": email,
            "name": name,
            "connection": self.connection,
            "email_verified": email_verified,
            "app_metadata": {
                "needsInvitation": needs_invitation,
            },
            "password": "@gdsgs4t34G",
        }

        try:
            response = await self._client.post(
                f"https://{self.domain}/api/v2/users",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()

            user_data = response.json()
            logger.info(f"Created Auth0 user: {user_data['user_id']} ({email})")
            return user_data

        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response else {}
            logger.error(f"Failed to create Auth0 user: {error_detail}")
            raise RuntimeError(f"Auth0 user creation failed: {error_detail.get('message', str(e))}")

        except httpx.HTTPError as e:
            logger.error(f"HTTP error creating Auth0 user: {str(e)}")
            raise RuntimeError(f"Auth0 API error: {str(e)}")

    async def send_invitation_email(self, email: str) -> None:
        """
        Send invitation/password reset email via Auth0.

        Behavior depends on user's app_metadata.needsInvitation:
        - True: Sends "Activate your account" email
        - False: Sends "Reset password" email

        Args:
            email: User email

        Raises:
            RuntimeError: If Auth0 API call fails
        """
        payload = {
            "client_id": self.client_id,
            "email": email,
            "connection": self.connection,
        }

        try:
            response = await self._client.post(
                f"https://{self.domain}/dbconnections/change_password",
                json=payload,
            )
            response.raise_for_status()

            logger.info(f"Sent invitation email to {email}")

        except httpx.HTTPStatusError as e:
            error_detail = e.response.text if e.response else str(e)
            logger.error(f"Failed to send invitation email: {error_detail}")
            raise RuntimeError(f"Failed to send invitation email: {error_detail}")

        except httpx.HTTPError as e:
            logger.error(f"HTTP error sending invitation: {str(e)}")
            raise RuntimeError(f"Auth0 API error: {str(e)}")

    async def block_user(self, auth0_user_id: str) -> None:
        """
        Block user in Auth0.

        Args:
            auth0_user_id: Auth0 user ID (e.g., "auth0|507f1f77bcf86cd799439011")

        Raises:
            RuntimeError: If Auth0 API call fails
        """
        token = await self._get_management_token()

        try:
            response = await self._client.patch(
                f"https://{self.domain}/api/v2/users/{auth0_user_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "blocked": True,
                    "connection": self.connection,  # Required to specify which database
                },
            )
            response.raise_for_status()

            logger.info(f"Blocked Auth0 user: {auth0_user_id}")

        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response else {}
            logger.error(f"Failed to block Auth0 user: {error_detail}")
            raise RuntimeError(f"Auth0 block failed: {error_detail.get('message', str(e))}")

        except httpx.HTTPError as e:
            logger.error(f"HTTP error blocking Auth0 user: {str(e)}")
            raise RuntimeError(f"Auth0 API error: {str(e)}")

    async def unblock_user(self, auth0_user_id: str) -> None:
        """
        Unblock user in Auth0.

        Args:
            auth0_user_id: Auth0 user ID (e.g., "auth0|507f1f77bcf86cd799439011")

        Raises:
            RuntimeError: If Auth0 API call fails
        """
        token = await self._get_management_token()

        try:
            response = await self._client.patch(
                f"https://{self.domain}/api/v2/users/{auth0_user_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "blocked": False,
                    "connection": self.connection,  # Required to specify which database
                },
            )
            response.raise_for_status()

            logger.info(f"Unblocked Auth0 user: {auth0_user_id}")

        except httpx.HTTPStatusError as e:
            error_detail = e.response.json() if e.response else {}
            logger.error(f"Failed to unblock Auth0 user: {error_detail}")
            raise RuntimeError(f"Auth0 unblock failed: {error_detail.get('message', str(e))}")

        except httpx.HTTPError as e:
            logger.error(f"HTTP error unblocking Auth0 user: {str(e)}")
            raise RuntimeError(f"Auth0 API error: {str(e)}")

    async def close(self):
        """Close HTTP client."""
        await self._client.aclose()


# Singleton instance
auth0_client = Auth0ManagementClient()
