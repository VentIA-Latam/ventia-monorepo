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



from fastapi import Query

@router.get(
    "/sso",
    response_model=ChatwootSSOResponse,
    responses={
        400: {"model": ChatwootSSOError},
        503: {"model": ChatwootSSOError},
    },
    summary="Get Chatwoot SSO login URL",
    description="Get a single-sign-on URL for a user to access Chatwoot. user_id es obligatorio.",
)
async def get_chatwoot_sso_url(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    user_id: int = Query(..., description="ID del usuario para SSO (obligatorio)"),
):
    """
    Get Chatwoot SSO login URL for the user_id provided as query param. user_id es obligatorio.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "user_not_found",
                "detail": f"No existe un usuario con id {user_id}."
            }
        )

    # Validar campos de Chatwoot
    if not getattr(user, "chatwoot_user_id", None):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "chatwoot_not_configured",
                "detail": "Este usuario no tiene configurado un ID de usuario de Chatwoot. "
                         "Contacta al administrador para configurar la integración."
            }
        )

    if not getattr(user, "chatwoot_account_id", None):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "chatwoot_account_not_configured",
                "detail": "Este usuario no tiene configurado un ID de cuenta de Chatwoot. "
                         "Contacta al administrador para configurar la integración."
            }
        )

    # Get SSO URL from Chatwoot
    sso_url = await chatwoot_service.get_sso_login_url(
        chatwoot_user_id=int(user.chatwoot_user_id),
    )

    if not sso_url:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "chatwoot_unavailable",
                "detail": "No se pudo obtener el enlace de acceso a Chatwoot. "
                         "El servicio puede estar temporalmente no disponible."
            }
        )

    return ChatwootSSOResponse(url=sso_url)


@router.get(
    "/config",
    summary="Get Chatwoot configuration status",
    description="Check if the current user has Chatwoot SSO configured.",
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
