"""
Chatwoot service - handles SSO login via Chatwoot Platform API.
"""

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class ChatwootService:
    """Service for Chatwoot Platform API integration."""

    def __init__(self):
        self.base_url = settings.CHATWOOT_BASE_URL.rstrip("/")
        self.api_token = settings.CHATWOOT_PLATFORM_API_TOKEN

    async def get_sso_login_url(
        self,
        chatwoot_user_id: int,
    ) -> Optional[str]:
        """
        Get SSO login URL for a Chatwoot user.

        Uses the Chatwoot Platform API to get a single-sign-on link.
        API: GET /platform/api/v1/users/{id}/login

        Args:
            chatwoot_user_id: The Chatwoot user ID

        Returns:
            The SSO login URL or None if failed
        """
        if not self.api_token:
            logger.error("CHATWOOT_PLATFORM_API_TOKEN not configured")
            return None

        url = f"{self.base_url}/platform/api/v1/users/{chatwoot_user_id}/login"
        logger.info(f"Requesting Chatwoot SSO URL: {url}")
        logger.info(f"Using base_url: {self.base_url}, token: {self.api_token[:8]}...")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    url,
                    headers={
                        "api_access_token": self.api_token,
                        "Content-Type": "application/json",
                    },
                )
                
                logger.info(f"Chatwoot response status: {response.status_code}")
                logger.info(f"Chatwoot response body: {response.text[:500]}")

                if response.status_code == 200:
                    data = response.json()
                    # The API returns {"url": "https://..."}
                    sso_url = data.get("url")
                    if sso_url:
                        logger.info(f"SSO URL generated for Chatwoot user {chatwoot_user_id}")
                        return sso_url
                    else:
                        logger.error(f"No URL in Chatwoot SSO response: {data}")
                        return None
                else:
                    logger.error(
                        f"Chatwoot SSO API error: {response.status_code} - {response.text}"
                    )
                    return None

        except httpx.RequestError as e:
            logger.error(f"Chatwoot SSO request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting Chatwoot SSO URL: {e}")
            return None


# Global service instance
chatwoot_service = ChatwootService()
