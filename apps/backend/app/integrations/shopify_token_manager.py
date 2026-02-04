"""
Shopify OAuth2 Token Manager.

Manages the lifecycle of Shopify access tokens, automatically refreshing
them when they expire using client_id and client_secret.
"""

import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.schemas.tenant_settings import ShopifyCredentials

logger = logging.getLogger(__name__)


class ShopifyTokenManager:
    """
    Manages Shopify OAuth2 access tokens.

    Automatically renews tokens when they expire using client credentials.
    Updates the database with new tokens and expiration times.
    """

    TOKEN_BUFFER_SECONDS = 300  # Renew 5 minutes before expiration

    async def get_valid_access_token(
        self,
        db: Session,
        tenant: Tenant,
    ) -> str:
        """
        Get a valid Shopify access token.

        If the current token is expired or about to expire, automatically
        generates a new one using OAuth2 client credentials flow.

        Args:
            db: Database session
            tenant: Tenant with Shopify credentials

        Returns:
            Valid access token ready to use

        Raises:
            ValueError: If OAuth credentials are missing or token refresh fails
        """
        settings = tenant.get_settings()
        if not settings.ecommerce or not settings.ecommerce.shopify:
            raise ValueError("Shopify settings not configured for this tenant")

        shopify = settings.ecommerce.shopify

        # Validate we have OAuth credentials
        if not shopify.client_id or not shopify.client_secret:
            raise ValueError(
                "Shopify OAuth credentials (client_id/client_secret) not configured"
            )

        # Check if current token is valid
        if self._is_token_valid(shopify):
            return shopify.access_token

        # Token expired or missing - refresh it
        logger.info(f"Refreshing expired Shopify token for tenant {tenant.id}")
        new_token, expires_in = await self._refresh_token(
            store_url=shopify.store_url,
            client_id=shopify.client_id,
            client_secret=shopify.client_secret,
        )

        # Update tenant settings with new token
        self._update_token_in_settings(
            tenant=tenant,
            new_token=new_token,
            expires_in=expires_in,
        )

        db.commit()
        db.refresh(tenant)

        logger.info(f"Successfully refreshed Shopify token for tenant {tenant.id}")
        return new_token

    def _is_token_valid(self, shopify: ShopifyCredentials) -> bool:
        """
        Check if the current access token is valid.

        A token is valid if:
        1. It exists
        2. It has an expiration time
        3. It expires more than TOKEN_BUFFER_SECONDS from now
        """
        if not shopify.access_token:
            return False

        if not shopify.access_token_expires_at:
            # No expiration info - assume invalid
            return False

        buffer = timedelta(seconds=self.TOKEN_BUFFER_SECONDS)
        expires_soon = datetime.utcnow() + buffer

        return shopify.access_token_expires_at > expires_soon

    async def _refresh_token(
        self,
        store_url: str,
        client_id: str,
        client_secret: str,
    ) -> tuple[str, int]:
        """
        Request a new access token from Shopify OAuth2 endpoint.

        Args:
            store_url: Shopify store URL
            client_id: OAuth2 client ID
            client_secret: OAuth2 client secret

        Returns:
            Tuple of (access_token, expires_in_seconds)

        Raises:
            ValueError: If the OAuth request fails
        """
        oauth_url = f"{store_url}/admin/oauth/access_token"

        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(oauth_url, json=payload)
                response.raise_for_status()

                data = response.json()

                access_token = data.get("access_token")
                expires_in = data.get("expires_in", 86400)  # Default 24h

                if not access_token:
                    raise ValueError("No access_token in Shopify OAuth response")

                return access_token, expires_in

        except httpx.HTTPStatusError as e:
            raise ValueError(
                f"Shopify OAuth failed with status {e.response.status_code}: "
                f"{e.response.text}"
            ) from e
        except httpx.RequestError as e:
            raise ValueError(f"Shopify OAuth request failed: {str(e)}") from e

    def _update_token_in_settings(
        self,
        tenant: Tenant,
        new_token: str,
        expires_in: int,
    ) -> None:
        """
        Update tenant settings with new access token and expiration.

        Encrypts the token before storage.
        """
        settings = tenant.get_settings()

        # Update the token and expiration
        settings.ecommerce.shopify.access_token = new_token
        settings.ecommerce.shopify.access_token_expires_at = (
            datetime.utcnow() + timedelta(seconds=expires_in)
        )

        # Save encrypted settings back to tenant
        tenant.set_ecommerce_settings(settings.ecommerce)


# Global singleton instance
shopify_token_manager = ShopifyTokenManager()
