"""
Chatwoot API endpoints - SSO login.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.chatwoot import chatwoot_service

router = APIRouter()


class ChatwootSSOResponse(BaseModel):
    """Response schema for Chatwoot SSO."""
    url: str


class ChatwootSSOError(BaseModel):
    """Error schema for Chatwoot SSO."""
    error: str
    detail: str | None = None



@router.get(
    "/sso/{user_id}",
    response_model=ChatwootSSOResponse,
    responses={
        400: {"model": ChatwootSSOError},
        503: {"model": ChatwootSSOError},
    },
    summary="Get Chatwoot SSO login URL",
    description="Get a single-sign-on URL for a user to access Chatwoot.",
    tags=["chatwoot"],
)
async def get_chatwoot_sso_url(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get Chatwoot SSO login URL for a specific user.
    
    Args:
        user_id: User ID to get SSO login URL for
        current_user: Current authenticated user
        db: Database session
        
    Returns:
        ChatwootSSOResponse with the SSO login URL
        
    Raises:
        HTTPException 400: If user not found or Chatwoot not configured
        HTTPException 503: If Chatwoot service is unavailable
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with ID {user_id} not found"
        )

    # Validate Chatwoot configuration
    if not getattr(user, "chatwoot_user_id", None):
        raise HTTPException(
            status_code=400,
            detail="User does not have a Chatwoot user ID configured. Contact administrator."
        )

    if not getattr(user, "chatwoot_account_id", None):
        raise HTTPException(
            status_code=400,
            detail="User does not have a Chatwoot account ID configured. Contact administrator."
        )

    # Get SSO URL from Chatwoot
    sso_url = await chatwoot_service.get_sso_login_url(
        chatwoot_user_id=int(user.chatwoot_user_id),
    )

    if not sso_url:
        raise HTTPException(
            status_code=503,
            detail="Chatwoot service is temporarily unavailable"
        )

    return ChatwootSSOResponse(url=sso_url)


@router.get(
    "/config",
    summary="Get Chatwoot configuration status",
    description="Check if the current user has Chatwoot SSO configured.",
    tags=["chatwoot"],
)
async def get_chatwoot_config(
    current_user: User = Depends(get_current_user),
):
    """
    Get Chatwoot configuration status for the current user.
    """
    return {
        "configured": bool(current_user.chatwoot_user_id and current_user.chatwoot_account_id),
        "chatwoot_user_id": current_user.chatwoot_user_id,
        "chatwoot_account_id": current_user.chatwoot_account_id,
    }
