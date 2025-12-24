"""
Auth0 JWT validation and authentication utilities.
"""

import httpx
from jose import JWTError, jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError

from app.core.config import settings


class Auth0JWKSClient:
    """
    Client for fetching Auth0 public keys (JWKS).

    JWKS (JSON Web Key Set) is used to verify JWT signatures.
    """

    def __init__(self) -> None:
        """Initialize JWKS client with Auth0 domain."""
        self.jwks_url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
        self._jwks: dict | None = None

    async def get_jwks(self) -> dict:
        """
        Fetch JWKS from Auth0.

        Returns:
            dict: JWKS data containing public keys

        Raises:
            httpx.HTTPError: If request to Auth0 fails
        """
        if self._jwks is None:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_url)
                response.raise_for_status()
                self._jwks = response.json()
        return self._jwks

    async def get_signing_key(self, token: str) -> str:
        """
        Get the signing key for a JWT token.

        Args:
            token: JWT token string

        Returns:
            str: Signing key (PEM format)

        Raises:
            ValueError: If signing key not found
        """
        # Decode token header without verification to get kid (key ID)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        if not kid:
            raise ValueError("Token header missing 'kid' field")

        # Get JWKS and find matching key
        jwks = await self.get_jwks()
        keys = jwks.get("keys", [])

        for key in keys:
            if key.get("kid") == kid:
                # Convert JWK to PEM format
                from jose.backends.cryptography_backend import CryptographyECKey, CryptographyRSAKey

                if key.get("kty") == "RSA":
                    rsa_key = CryptographyRSAKey(key, algorithm="RS256")
                    return rsa_key.to_pem().decode("utf-8")
                elif key.get("kty") == "EC":
                    ec_key = CryptographyECKey(key, algorithm="ES256")
                    return ec_key.to_pem().decode("utf-8")

        raise ValueError(f"Signing key with kid '{kid}' not found in JWKS")


# Global JWKS client instance
jwks_client = Auth0JWKSClient()


async def verify_token(token: str) -> dict:
    """
    Verify and decode a JWT token from Auth0.

    Args:
        token: JWT token string (without "Bearer " prefix)

    Returns:
        dict: Decoded token payload containing claims (sub, email, etc.)

    Raises:
        ValueError: If token is invalid, expired, or verification fails
        JWTError: If token decoding fails

    Example:
        >>> payload = await verify_token(token)
        >>> user_id = payload.get("sub")  # Auth0 user ID
        >>> email = payload.get("email")
    """
    try:
        # Get signing key for this token
        signing_key = await jwks_client.get_signing_key(token)

        # Verify and decode token
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=[settings.AUTH0_ALGORITHM],
            audience=settings.AUTH0_AUDIENCE,
            issuer=settings.AUTH0_ISSUER,
        )

        return payload

    except ExpiredSignatureError:
        raise ValueError("Token has expired")
    except JWTClaimsError as e:
        raise ValueError(f"Invalid token claims: {str(e)}")
    except JWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")
    except Exception as e:
        raise ValueError(f"Token verification failed: {str(e)}")


def get_user_id_from_token(payload: dict) -> str:
    """
    Extract user ID (sub) from decoded token payload.

    Args:
        payload: Decoded JWT payload

    Returns:
        str: Auth0 user ID (sub claim)

    Raises:
        ValueError: If 'sub' claim is missing
    """
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Token missing 'sub' claim")
    return user_id


def get_email_from_token(payload: dict) -> str | None:
    """
    Extract email from decoded token payload.

    Args:
        payload: Decoded JWT payload

    Returns:
        str | None: User email if present, None otherwise
    """
    return payload.get("email")
