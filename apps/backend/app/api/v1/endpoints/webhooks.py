"""
Webhook reception endpoints for Shopify and WooCommerce.

These endpoints receive webhook events from e-commerce platforms, validate HMAC signatures,
and log events for processing. They are public endpoints (no authentication) but protected
by HMAC signature validation.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_database
from app.core.webhook_signature import verify_shopify_webhook, verify_woocommerce_webhook
from app.repositories.tenant import tenant_repository
from app.repositories.webhook import webhook_repository
from app.schemas.tenant_settings import TenantSettings
from app.schemas.webhook import WebhookEventCreate
from app.services.webhook_service import (
    process_shopify_draft_order_create,
    process_shopify_draft_order_delete,
    process_shopify_draft_order_update,
    process_shopify_order_cancelled,
    process_shopify_order_updated,
    process_shopify_orders_create,
    process_shopify_orders_paid,
    process_woocommerce_order_created,
    process_woocommerce_order_deleted,
    process_woocommerce_order_updated,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Shopify webhook topics that are not yet implemented (stubs)
# These events will be logged but not processed
# TODO: Implement handlers for these event types as needed
SHOPIFY_STUB_TOPICS = [
    # "orders/create" - Now implemented (see process_shopify_orders_create)
]


@router.post("/shopify/{tenant_id}", status_code=status.HTTP_200_OK)
async def receive_shopify_webhook(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_database),
) -> dict[str, Any]:
    try:
        return await _receive_shopify_webhook_impl(tenant_id, request, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CRITICAL UNHANDLED ERROR in Shopify webhook: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )


async def _receive_shopify_webhook_impl(
    tenant_id: int,
    request: Request,
    db: Session,
) -> dict[str, Any]:
    """
    Receive webhook events from Shopify.

    This endpoint is called by Shopify when events occur (e.g., draft_orders/create, orders/paid).
    It validates the HMAC signature, logs the event, and returns 200 OK for processing.

    **Authentication:** Public endpoint, protected by HMAC signature validation.

    **Headers required:**
    - X-Shopify-Hmac-Sha256: HMAC signature for validation
    - X-Shopify-Topic: Event type (e.g., "draft_orders/create")

    Args:
        tenant_id: Tenant ID from URL path
        request: FastAPI request object (for reading raw body and headers)
        db: Database session

    Returns:
        Success message with webhook event ID

    Raises:
        HTTPException 404: If tenant not found or inactive
        HTTPException 400: If tenant has no Shopify credentials configured
        HTTPException 401: If HMAC signature is invalid
        HTTPException 500: If webhook logging fails
    """
    # Extract headers
    hmac_header = request.headers.get("X-Shopify-Hmac-Sha256")
    topic = request.headers.get("X-Shopify-Topic")

    logger.info(f"Shopify webhook received: tenant_id={tenant_id}, topic={topic}")

    if not hmac_header:
        logger.warning(f"Shopify webhook received without HMAC header for tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Shopify-Hmac-Sha256 header",
        )

    if not topic:
        logger.warning(f"Shopify webhook received without topic header for tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Shopify-Topic header",
        )

    # Read raw body (needed for signature validation)
    raw_body = await request.body()

    # Parse JSON payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Shopify webhook JSON: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from e

    # Check for idempotency - prevent duplicate processing
    # Use X-Shopify-Webhook-Id header as event_id (unique per webhook, not per resource)
    # This allows multiple updates to the same resource
    webhook_id = request.headers.get("X-Shopify-Webhook-Id")
    event_id = webhook_id if webhook_id else (str(payload.get("id")) if payload.get("id") else None)
    if event_id:
        existing_event = webhook_repository.get_by_event_id(db, "shopify", event_id, topic)
        if existing_event:
            logger.info(
                f"Shopify webhook already received (idempotent): "
                f"tenant={tenant_id}, topic={topic}, event_id={event_id}, "
                f"processed={existing_event.processed}"
            )
            return {
                "success": True,
                "message": "Event already processed (idempotent)",
                "webhook_event_id": existing_event.id,
                "idempotent": True,
            }

    # Validate tenant exists and is active
    tenant = tenant_repository.get(db, id=tenant_id)
    if not tenant:
        logger.warning(f"Shopify webhook received for non-existent tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    if not tenant.is_active:
        logger.warning(f"Shopify webhook received for inactive tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} is not active",
        )

    # Validate tenant has Shopify credentials configured
    if not tenant.settings:
        logger.warning(f"Shopify webhook received for tenant {tenant_id} with no settings")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant has no e-commerce settings configured",
        )

    # Get settings with decrypted credentials
    tenant_settings = tenant.get_settings()

    if not tenant_settings.ecommerce or not tenant_settings.ecommerce.shopify:
        logger.warning(
            f"Shopify webhook received for tenant {tenant_id} without Shopify credentials"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant has no Shopify credentials configured",
        )

    # Get client_secret from Shopify credentials (used for webhook HMAC validation)
    # Per Shopify docs: webhooks are signed using the app's client_secret
    # https://shopify.dev/docs/apps/build/webhooks/subscribe/https
    shopify_creds = tenant_settings.ecommerce.shopify

    logger.info(f"DEBUG: shopify_creds type: {type(shopify_creds)}")
    logger.info(f"DEBUG: shopify_creds.client_secret exists: {hasattr(shopify_creds, 'client_secret')}")

    client_secret = shopify_creds.client_secret

    logger.info(f"DEBUG: client_secret is None: {client_secret is None}")
    logger.info(f"DEBUG: client_secret length: {len(client_secret) if client_secret else 0}")

    if not client_secret:
        logger.error(f"Shopify client_secret not configured for tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Shopify client_secret not configured for this tenant",
        )

    # Validate HMAC signature using client_secret
    logger.info(f"Validating HMAC for {topic}...")
    signature_valid = verify_shopify_webhook(raw_body, hmac_header, client_secret)

    if not signature_valid:
        logger.warning(f"Invalid HMAC signature for {topic}")
        logger.warning(f"Invalid Shopify webhook signature for tenant {tenant_id}, topic {topic}")
        # Still log the event but mark signature as invalid
        webhook_event = webhook_repository.create(
            db,
            obj_in=WebhookEventCreate(
                platform="shopify",
                event_type=topic,
                event_id=event_id,  # Use the extracted event_id (webhook UUID)
                tenant_id=tenant_id,
                payload=payload,
                headers=dict(request.headers),
                signature_valid=False,
                signature_header=hmac_header,
            ),
        )
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    # Log webhook event
    logger.info(f"Saving webhook event to DB: {topic}, event_id={event_id}")
    try:
        webhook_event = webhook_repository.create(
            db,
            obj_in=WebhookEventCreate(
                platform="shopify",
                event_type=topic,
                event_id=event_id,  # Use the extracted event_id (webhook UUID)
                tenant_id=tenant_id,
                payload=payload,
                headers=dict(request.headers),
                signature_valid=True,
                signature_header=hmac_header,
            ),
        )
        db.commit()

        logger.info(
            f"Shopify webhook received: tenant={tenant_id}, topic={topic}, "
            f"event_id={webhook_event.id}"
        )

        # Process webhook event based on topic
        order = None
        if topic == "draft_orders/create":
            try:
                order = process_shopify_draft_order_create(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed draft_orders/create: created order_id={order.id}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process draft_orders/create webhook: {str(process_error)}",
                    exc_info=True,
                )
                # Event is already logged, just return error in response
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }
        elif topic == "orders/paid":
            try:
                order = process_shopify_orders_paid(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                if order:
                    logger.info(
                        f"Processed orders/paid: updated order_id={order.id} to Pagado"
                    )
                else:
                    logger.warning(
                        f"Processed orders/paid but order not found for tenant={tenant.id}"
                    )
            except Exception as process_error:
                logger.error(
                    f"Failed to process orders/paid webhook: {str(process_error)}",
                    exc_info=True,
                )
                # Event is already logged, just return error in response
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }
        elif topic == "orders/create":
            try:
                order = process_shopify_orders_create(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                if order:
                    logger.info(
                        f"Processed orders/create: created/updated order_id={order.id}, "
                        f"status={order.status}, validado={order.validado}"
                    )
                else:
                    logger.warning(
                        f"Processed orders/create but order not returned for tenant={tenant.id}"
                    )
            except Exception as process_error:
                logger.error(
                    f"Failed to process orders/create webhook: {str(process_error)}",
                    exc_info=True,
                )
                # Event is already logged, just return error in response
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }
        elif topic == "draft_orders/update":
            try:
                order = process_shopify_draft_order_update(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed draft_orders/update: updated order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process draft_orders/update webhook: {str(process_error)}",
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }
        elif topic == "draft_orders/delete":
            try:
                order = process_shopify_draft_order_delete(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed draft_orders/delete: cancelled order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process draft_orders/delete webhook: {str(process_error)}",
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }

        elif topic == "orders/updated":
            try:
                order = process_shopify_order_updated(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed orders/updated: updated order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process orders/updated webhook: {str(process_error)}",
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }

        elif topic == "orders/cancelled":
            try:
                order = process_shopify_order_cancelled(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed orders/cancelled: cancelled order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process orders/cancelled webhook: {str(process_error)}",
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }

        elif topic in SHOPIFY_STUB_TOPICS:
            # Stub handler for events not yet implemented
            # Event is already logged in webhook_events table
            # Just mark as processed and return success
            logger.info(
                f"Received Shopify {topic} event (not implemented yet): "
                f"tenant={tenant.id}, webhook_event_id={webhook_event.id}"
            )
            webhook_event.processed = True
            db.commit()

            return {
                "success": True,
                "message": f"Webhook received but event type '{topic}' not implemented yet",
                "webhook_event_id": webhook_event.id,
                "action": "ignored",
            }

        return {
            "success": True,
            "message": "Webhook received and processed" if order else "Webhook received and logged",
            "webhook_event_id": webhook_event.id,
            "order_id": order.id if order else None,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log Shopify webhook: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log webhook event: {str(e)}",
        ) from e


@router.post("/woocommerce/{tenant_id}", status_code=status.HTTP_200_OK)
async def receive_woocommerce_webhook(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_database),
) -> dict[str, Any]:
    """
    Receive webhook events from WooCommerce.

    This endpoint is called by WooCommerce when events occur (e.g., order.created, order.updated).
    It validates the HMAC signature, logs the event, and returns 200 OK for processing.

    **Authentication:** Public endpoint, protected by HMAC signature validation.

    **Headers required:**
    - X-WC-Webhook-Signature: HMAC signature for validation
    - X-WC-Webhook-Topic: Event type (e.g., "order.created")

    Args:
        tenant_id: Tenant ID from URL path
        request: FastAPI request object (for reading raw body and headers)
        db: Database session

    Returns:
        Success message with webhook event ID

    Raises:
        HTTPException 404: If tenant not found or inactive
        HTTPException 400: If tenant has no WooCommerce credentials configured
        HTTPException 401: If HMAC signature is invalid
        HTTPException 500: If webhook logging fails
    """
    # Extract headers
    signature_header = request.headers.get("X-WC-Webhook-Signature")
    topic = request.headers.get("X-WC-Webhook-Topic")

    if not signature_header:
        # WooCommerce sends a test delivery (sin firma) cada vez que crea un webhook via REST API.
        # Es un ping de conectividad — retornar 200 sin procesar.
        if topic:
            logger.debug(
                f"WooCommerce test delivery received for tenant {tenant_id}, topic={topic}"
            )
            return {"success": True, "message": "Test delivery acknowledged"}

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-WC-Webhook-Signature header",
        )

    if not topic:
        logger.warning(f"WooCommerce webhook received without topic header for tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-WC-Webhook-Topic header",
        )

    # Read raw body (needed for signature validation)
    raw_body = await request.body()

    # Parse JSON payload
    try:
        payload = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse WooCommerce webhook JSON: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from e

    # Check for idempotency - prevent duplicate processing
    # Use X-WC-Webhook-Delivery-ID if available (unique per webhook delivery)
    # Fallback to resource ID + timestamp for uniqueness
    webhook_delivery_id = request.headers.get("X-WC-Webhook-Delivery-ID")
    if webhook_delivery_id:
        event_id = webhook_delivery_id
    elif payload.get("id") and payload.get("date_modified"):
        # For updates, combine resource ID + modification timestamp
        event_id = f"{payload.get('id')}-{payload.get('date_modified')}"
    else:
        event_id = str(payload.get("id")) if payload.get("id") else None

    if event_id:
        existing_event = webhook_repository.get_by_event_id(db, "woocommerce", event_id, topic)
        if existing_event:
            logger.info(
                f"WooCommerce webhook already received (idempotent): "
                f"tenant={tenant_id}, topic={topic}, event_id={event_id}, "
                f"processed={existing_event.processed}"
            )
            return {
                "success": True,
                "message": "Event already processed (idempotent)",
                "webhook_event_id": existing_event.id,
                "idempotent": True,
            }

    # Validate tenant exists and is active
    tenant = tenant_repository.get(db, id=tenant_id)
    if not tenant:
        logger.warning(f"WooCommerce webhook received for non-existent tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} not found",
        )

    if not tenant.is_active:
        logger.warning(f"WooCommerce webhook received for inactive tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant {tenant_id} is not active",
        )

    # Validate tenant has WooCommerce credentials configured
    if not tenant.settings:
        logger.warning(f"WooCommerce webhook received for tenant {tenant_id} with no settings")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant has no e-commerce settings configured",
        )

    # Get settings with decrypted credentials
    tenant_settings = tenant.get_settings()

    if not tenant_settings.ecommerce or not tenant_settings.ecommerce.woocommerce:
        logger.warning(
            f"WooCommerce webhook received for tenant {tenant_id} without WooCommerce credentials"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant has no WooCommerce credentials configured",
        )

    # Get webhook secret from WooCommerce credentials
    woo_creds = tenant_settings.ecommerce.woocommerce
    webhook_secret = woo_creds.webhook_secret

    if not webhook_secret:
        logger.error(f"WooCommerce webhook_secret not configured for tenant {tenant_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured for this tenant",
        )

    # Validate HMAC signature
    signature_valid = verify_woocommerce_webhook(raw_body, signature_header, webhook_secret)

    if not signature_valid:
        logger.warning(
            f"Invalid WooCommerce webhook signature for tenant {tenant_id}, topic {topic}"
        )
        # Still log the event but mark signature as invalid
        webhook_event = webhook_repository.create(
            db,
            obj_in=WebhookEventCreate(
                platform="woocommerce",
                event_type=topic,
                event_id=event_id,  # Use the extracted event_id
                tenant_id=tenant_id,
                payload=payload,
                headers=dict(request.headers),
                signature_valid=False,
                signature_header=signature_header,
            ),
        )
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    # Log webhook event
    try:
        webhook_event = webhook_repository.create(
            db,
            obj_in=WebhookEventCreate(
                platform="woocommerce",
                event_type=topic,
                event_id=event_id,  # Use the extracted event_id
                tenant_id=tenant_id,
                payload=payload,
                headers=dict(request.headers),
                signature_valid=True,
                signature_header=signature_header,
            ),
        )
        db.commit()

        logger.info(
            f"WooCommerce webhook received: tenant={tenant_id}, topic={topic}, "
            f"event_id={webhook_event.id}"
        )

        # Process webhook event based on topic
        order = None
        if topic == "order.created":
            try:
                order = process_woocommerce_order_created(
                    db=db,
                    webhook_event=webhook_event,
                    payload=payload,
                    tenant=tenant,
                )
                logger.info(
                    f"Processed order.created: created order_id={order.id}"
                )
            except Exception as process_error:
                logger.error(
                    f"Failed to process order.created webhook: {str(process_error)}",
                    exc_info=True,
                )
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }
        elif topic == "order.updated":
            try:
                order = process_woocommerce_order_updated(
                    db=db, webhook_event=webhook_event, payload=payload, tenant=tenant
                )
                logger.info(
                    f"Processed order.updated: updated order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(f"Failed to process order.updated webhook: {str(process_error)}", exc_info=True)
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }

        elif topic == "order.deleted":
            try:
                order = process_woocommerce_order_deleted(
                    db=db, webhook_event=webhook_event, payload=payload, tenant=tenant
                )
                logger.info(
                    f"Processed order.deleted: cancelled order_id={order.id if order else 'not_found'}"
                )
            except Exception as process_error:
                logger.error(f"Failed to process order.deleted webhook: {str(process_error)}", exc_info=True)
                return {
                    "success": False,
                    "message": f"Webhook logged but processing failed: {str(process_error)}",
                    "webhook_event_id": webhook_event.id,
                }

        return {
            "success": True,
            "message": "Webhook received and processed" if order else "Webhook received and logged",
            "webhook_event_id": webhook_event.id,
            "order_id": order.id if order else None,
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log WooCommerce webhook: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to log webhook event: {str(e)}",
        ) from e
