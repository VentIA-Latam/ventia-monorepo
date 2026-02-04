"""
Webhook event processing service.

Handles processing of webhook events from e-commerce platforms (Shopify, WooCommerce).
Extracts data from webhook payloads and creates/updates orders in the database.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.tenant import Tenant
from app.models.webhook import WebhookEvent
from app.repositories.order import order_repository
from app.repositories.webhook import webhook_repository
from app.schemas.order import OrderCreate, OrderUpdate

logger = logging.getLogger(__name__)


def process_shopify_draft_order_create(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order:
    """
    Process Shopify draft_orders/create webhook event.

    Extracts data from Shopify draft order payload and creates an order in the database.
    Implements idempotency - if order already exists, returns existing order without creating duplicate.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance (already saved in DB)
        payload: Shopify draft order payload
        tenant: Tenant instance

    Returns:
        Created or existing Order instance

    Raises:
        ValueError: If required fields are missing from payload
        Exception: If order creation fails
    """
    # Extract draft order ID
    draft_order_id = payload.get("id")
    if not draft_order_id:
        error_msg = "Missing 'id' field in Shopify draft order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID format if it's a numeric ID
    if isinstance(draft_order_id, int):
        shopify_draft_order_id = f"gid://shopify/DraftOrder/{draft_order_id}"
    else:
        shopify_draft_order_id = draft_order_id

    # Check idempotency - if order already exists, return it
    existing_order = order_repository.get_by_shopify_draft_id(
        db, tenant_id=tenant.id, shopify_draft_order_id=shopify_draft_order_id
    )
    if existing_order:
        logger.info(
            f"Draft order already exists (idempotent): tenant={tenant.id}, "
            f"draft_order_id={shopify_draft_order_id}, order_id={existing_order.id}"
        )
        # Update webhook event with existing order
        webhook_event.processed = True
        webhook_event.order_id = existing_order.id
        db.commit()
        return existing_order

    # Extract customer information
    customer_email = payload.get("email")
    customer = payload.get("customer", {})

    # Try to get email from customer object if not in root
    if not customer_email and customer:
        customer_email = customer.get("email")

    if not customer_email:
        error_msg = "Missing customer email in Shopify draft order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Extract customer name (combine first_name and last_name if available)
    customer_name = None
    if customer:
        first_name = customer.get("first_name", "")
        last_name = customer.get("last_name", "")
        if first_name or last_name:
            customer_name = f"{first_name} {last_name}".strip()

    # Fallback to name field if available
    if not customer_name:
        customer_name = payload.get("name")

    # Extract total price
    total_price = payload.get("total_price")
    if total_price is not None:
        try:
            total_price = float(total_price)
        except (ValueError, TypeError):
            logger.warning(f"Invalid total_price value: {total_price}, setting to 0.0")
            total_price = 0.0
    else:
        total_price = 0.0

    # Extract currency
    currency = payload.get("currency", "USD")

    # Extract and transform line items from Shopify format to our schema format
    line_items_raw = payload.get("line_items", [])
    line_items = []
    if line_items_raw:
        for item in line_items_raw:
            try:
                # Transform Shopify line item to our LineItemBase format
                transformed_item = {
                    "sku": item.get("sku", item.get("variant_id", str(item.get("id", "")))),
                    "product": item.get("title", item.get("name", "Unknown Product")),
                    "unitPrice": float(item.get("price", 0.0)),
                    "quantity": int(item.get("quantity", 1)),
                }
                # Calculate subtotal if not provided
                transformed_item["subtotal"] = transformed_item["unitPrice"] * transformed_item["quantity"]
                line_items.append(transformed_item)
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to transform line item: {item}, error: {e}")
                continue

    # Extract shipping line and add as line item if it has a cost
    shipping_line = payload.get("shipping_line")
    if shipping_line:
        try:
            shipping_price = float(shipping_line.get("price", 0.0))
            if shipping_price > 0:
                shipping_item = {
                    "sku": "DELIVERY",
                    "product": shipping_line.get("title", "Shipping"),
                    "unitPrice": shipping_price,
                    "quantity": 1,
                    "subtotal": shipping_price,
                }
                line_items.append(shipping_item)
                logger.info(f"Added shipping line item: {shipping_item['product']} - ${shipping_price}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to add shipping line item: {shipping_line}, error: {e}")

    # Extract shipping address (shipping_address principal, billing_address fallback)
    shipping_address_raw = payload.get("shipping_address") or payload.get("billing_address")
    shipping_address = _format_shipping_address(shipping_address_raw, "shopify")

    # Create order using repository
    try:
        order_data = OrderCreate(
            tenant_id=tenant.id,  # Explicitly set for internal use
            shopify_draft_order_id=shopify_draft_order_id,
            customer_email=customer_email,
            customer_name=customer_name,
            total_price=total_price,
            currency=currency,
            line_items=line_items if line_items else None,
            shipping_address=shipping_address,
        )

        order = order_repository.create(db, obj_in=order_data)

        # Ensure defaults are set (model should handle this, but verify)
        if not order.validado:
            order.validado = False
        if not order.status:
            order.status = "Pendiente"

        db.flush()  # Flush to get order.id

        # Update webhook event
        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Created order from Shopify draft order: tenant={tenant.id}, "
            f"draft_order_id={shopify_draft_order_id}, order_id={order.id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to create order from Shopify draft order: {str(e)}"
        logger.error(error_msg, exc_info=True)

        # Mark webhook as processed with error
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_shopify_orders_paid(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process Shopify orders/paid webhook event.

    Updates existing order to mark it as paid. Implements two-step lookup:
    1. First tries to find order by shopify_order_id
    2. If not found, tries to find by shopify_draft_order_id (converted from order id)

    Args:
        db: Database session
        webhook_event: WebhookEvent instance (already saved in DB)
        payload: Shopify order payload
        tenant: Tenant instance

    Returns:
        Updated Order instance, or None if order not found

    Raises:
        ValueError: If required fields are missing from payload
    """
    # Extract order ID
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in Shopify order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID format if it's a numeric ID
    if isinstance(order_id, int):
        shopify_order_id = f"gid://shopify/Order/{order_id}"
    else:
        shopify_order_id = order_id

    # Try to find order by shopify_order_id first
    order = order_repository.get_by_shopify_order_id(
        db, tenant_id=tenant.id, shopify_order_id=shopify_order_id
    )

    # If not found by order_id, try to find by draft_order_id
    # (order may have been created from draft_orders/create webhook)
    if not order:
        # Try to derive draft order ID from order ID
        # Shopify doesn't provide direct mapping, so we search by other fields
        # Get recent unvalidated orders for this tenant and try to match
        logger.info(
            f"Order not found by shopify_order_id={shopify_order_id}, "
            f"searching by draft_order_id or other fields..."
        )

        # Strategy: find unvalidated orders from this tenant that don't have shopify_order_id yet
        # and match by customer email (if available in payload)
        customer_email = payload.get("email") or payload.get("customer", {}).get("email")

        if customer_email:
            # Search for recent unvalidated orders with matching email
            potential_orders = (
                db.query(Order)
                .filter(
                    Order.tenant_id == tenant.id,
                    Order.customer_email == customer_email,
                    Order.validado == False,
                    Order.shopify_order_id == None,
                    Order.shopify_draft_order_id != None,
                )
                .order_by(Order.created_at.desc())
                .limit(5)
                .all()
            )

            # Try to match by total_price for additional confidence
            total_price_str = payload.get("total_price")
            if total_price_str and potential_orders:
                try:
                    total_price = float(total_price_str)
                    for potential_order in potential_orders:
                        if abs(potential_order.total_price - total_price) < 0.01:  # Allow small float diff
                            order = potential_order
                            logger.info(
                                f"Found order by email and price match: order_id={order.id}, "
                                f"draft_order_id={order.shopify_draft_order_id}"
                            )
                            break
                except (ValueError, TypeError):
                    pass

            # If still not found but we have potential orders, take the most recent one
            if not order and potential_orders:
                order = potential_orders[0]
                logger.info(
                    f"Using most recent unvalidated order with matching email: order_id={order.id}"
                )

    # If order still not found, log warning and mark webhook as processed
    if not order:
        warning_msg = (
            f"Order not found for Shopify order ID {shopify_order_id}, "
            f"tenant {tenant.id}. This may be an order created directly in Shopify "
            f"without going through draft orders."
        )
        logger.warning(warning_msg)
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # Check idempotency - if order is already validated with same order_id, return it
    if order.validado and order.shopify_order_id == shopify_order_id:
        logger.info(
            f"Order already validated (idempotent): tenant={tenant.id}, "
            f"order_id={order.id}, shopify_order_id={shopify_order_id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # Update order to mark as paid
    try:
        # Extract payment method if available
        payment_method = None
        payment_gateway_names = payload.get("payment_gateway_names", [])
        if payment_gateway_names:
            payment_method = ", ".join(payment_gateway_names)

        # Update order
        order_update = OrderUpdate(
            validado=True,
            status="Pagado",
            payment_method=payment_method,
        )

        # Apply updates manually to set validated_at
        order.validado = True
        order.status = "Pagado"
        order.validated_at = datetime.utcnow()

        # Save the shopify_order_id if not already set
        if not order.shopify_order_id:
            order.shopify_order_id = shopify_order_id

        if payment_method:
            order.payment_method = payment_method

        db.flush()

        # Update webhook event
        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Updated order to Pagado: tenant={tenant.id}, order_id={order.id}, "
            f"shopify_order_id={shopify_order_id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to update order from Shopify orders/paid: {str(e)}"
        logger.error(error_msg, exc_info=True)

        # Mark webhook as processed with error
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def _map_woo_status(woo_status: str) -> tuple[str, bool]:
    """
    Map WooCommerce order status to Ventia (status, validado).

    WooCommerce tiene muchos estados internos, pero Ventia necesita:
    - "Pendiente" (validado=False) - Pago no confirmado
    - "Pagado" (validado=True) - Pago confirmado
    - "Cancelado" (validado=False) - Orden cancelada/reembolsada

    Args:
        woo_status: WooCommerce order status string

    Returns:
        tuple: (status_string, validado_boolean)

    Examples:
        >>> _map_woo_status("pending")
        ("Pendiente", False)
        >>> _map_woo_status("processing")
        ("Pagado", True)
        >>> _map_woo_status("completed")
        ("Pagado", True)
        >>> _map_woo_status("cancelled")
        ("Cancelado", False)
    """
    woo_status_lower = woo_status.lower()

    # Estados donde el pago YA está confirmado en WooCommerce
    if woo_status_lower in ["processing", "completed"]:
        return ("Pagado", True)

    # Estados cancelados/fallidos
    if woo_status_lower in ["cancelled", "refunded", "failed"]:
        return ("Cancelado", False)

    # Estados pendientes (pending, on-hold, unknown, etc.)
    return ("Pendiente", False)


def _format_shipping_address(
    address_data: dict[str, Any] | None,
    platform: str,
) -> str | None:
    """
    Format shipping address as "address1, city" string.

    Args:
        address_data: Raw address dict from webhook
        platform: "shopify" or "woocommerce"

    Returns:
        Formatted address string or None if no data
    """
    if not address_data:
        return None

    if platform == "shopify":
        address1 = address_data.get("address1")
        city = address_data.get("city")
    elif platform == "woocommerce":
        address1 = address_data.get("address_1")
        city = address_data.get("city")
    else:
        return None

    if address1 and city:
        return f"{address1}, {city}"
    elif address1:
        return address1
    elif city:
        return city
    else:
        return None


def process_shopify_draft_order_update(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process Shopify draft_orders/update webhook event.

    Actualiza orden existente cuando se modifica draft order en Shopify.
    Implementa idempotencia - si los datos ya coinciden, no hace nada.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance (already saved in DB)
        payload: Shopify draft order payload
        tenant: Tenant instance

    Returns:
        Updated Order instance or None if not found

    Raises:
        ValueError: If required fields are missing
    """
    # 1. Extract draft_order_id
    draft_order_id = payload.get("id")
    if not draft_order_id:
        error_msg = "Missing 'id' field in Shopify draft order update payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID format if needed
    if isinstance(draft_order_id, int):
        shopify_draft_order_id = f"gid://shopify/DraftOrder/{draft_order_id}"
    else:
        shopify_draft_order_id = str(draft_order_id)

    # 2. Find existing order
    order = order_repository.get_by_shopify_draft_id(
        db, tenant_id=tenant.id, shopify_draft_order_id=shopify_draft_order_id
    )

    if not order:
        # Order doesn't exist - log warning but don't fail
        warning_msg = f"Order not found for draft_order_id={shopify_draft_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 3. Extract updated data
    customer_email = payload.get("email")
    if not customer_email:
        customer = payload.get("customer", {})
        customer_email = customer.get("email")

    # Customer name
    customer = payload.get("customer", {})
    first_name = customer.get("first_name", "")
    last_name = customer.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else None

    # Total and currency
    total_price_str = payload.get("total_price", "0.0")
    try:
        total_price = float(total_price_str)
    except (ValueError, TypeError):
        logger.warning(f"Invalid total_price value: {total_price_str}, keeping current value")
        total_price = order.total_price  # Keep current value

    currency = payload.get("currency", order.currency)

    # Line items
    line_items_raw = payload.get("line_items", [])
    line_items = []
    if line_items_raw:
        for item in line_items_raw:
            try:
                transformed_item = {
                    "sku": item.get("sku", str(item.get("variant_id", item.get("id", "")))),
                    "product": item.get("title") or item.get("name", "Unknown Product"),
                    "unitPrice": float(item.get("price", 0.0)),
                    "quantity": int(item.get("quantity", 1)),
                }
                transformed_item["subtotal"] = transformed_item["unitPrice"] * transformed_item["quantity"]
                line_items.append(transformed_item)
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to transform line item during update: {item}, error: {e}")
                continue

    # Extract shipping line and add as line item if it has a cost
    shipping_line = payload.get("shipping_line")
    if shipping_line:
        try:
            shipping_price = float(shipping_line.get("price", 0.0))
            if shipping_price > 0:
                shipping_item = {
                    "sku": "DELIVERY",
                    "product": shipping_line.get("title", "Shipping"),
                    "unitPrice": shipping_price,
                    "quantity": 1,
                    "subtotal": shipping_price,
                }
                line_items.append(shipping_item)
                logger.info(f"Added shipping line item: {shipping_item['product']} - ${shipping_price}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to add shipping line item: {shipping_line}, error: {e}")

    # Extract shipping address (shipping_address principal, billing_address fallback)
    shipping_address_raw = payload.get("shipping_address") or payload.get("billing_address")
    shipping_address = _format_shipping_address(shipping_address_raw, "shopify")

    # 4. Check idempotency - compare critical fields
    needs_update = False

    if customer_email and order.customer_email != customer_email:
        needs_update = True
    if customer_name and order.customer_name != customer_name:
        needs_update = True
    if abs(order.total_price - total_price) > 0.01:  # Floating point comparison
        needs_update = True
    if order.currency != currency:
        needs_update = True
    # For line_items, compare JSON representation
    if line_items and order.line_items != line_items:
        needs_update = True
    if shipping_address and order.shipping_address != shipping_address:
        needs_update = True

    if not needs_update:
        logger.info(
            f"Draft order update skipped (no changes): tenant={tenant.id}, "
            f"shopify_draft_order_id={shopify_draft_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 5. Update order
    try:
        if customer_email:
            order.customer_email = customer_email
        if customer_name:
            order.customer_name = customer_name
        order.total_price = total_price
        order.currency = currency
        if line_items:
            order.line_items = line_items
        if shipping_address:
            order.shipping_address = shipping_address

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Updated order from draft_order/update: tenant={tenant.id}, "
            f"shopify_draft_order_id={shopify_draft_order_id}, order_id={order.id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to update order from Shopify draft_order/update: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_shopify_draft_order_delete(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process Shopify draft_orders/delete webhook event.

    Marca orden como cancelada cuando se elimina draft order en Shopify.
    Usa soft delete (status="Cancelado").

    Args:
        db: Database session
        webhook_event: WebhookEvent instance
        payload: Shopify draft order payload (solo ID)
        tenant: Tenant instance

    Returns:
        Cancelled Order instance or None if not found
    """
    # 1. Extract draft_order_id
    draft_order_id = payload.get("id")
    if not draft_order_id:
        error_msg = "Missing 'id' field in Shopify draft order delete payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID
    if isinstance(draft_order_id, int):
        shopify_draft_order_id = f"gid://shopify/DraftOrder/{draft_order_id}"
    else:
        shopify_draft_order_id = str(draft_order_id)

    # 2. Find existing order
    order = order_repository.get_by_shopify_draft_id(
        db, tenant_id=tenant.id, shopify_draft_order_id=shopify_draft_order_id
    )

    if not order:
        warning_msg = f"Order not found for deleted draft_order_id={shopify_draft_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 3. Check idempotency - already cancelled?
    if order.status == "Cancelado":
        logger.info(
            f"Draft order already cancelled (idempotent): tenant={tenant.id}, "
            f"shopify_draft_order_id={shopify_draft_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 4. Mark as cancelled (soft delete)
    try:
        order.status = "Cancelado"
        order.validado = False  # Revert validation if was paid

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Cancelled order from draft_order/delete: tenant={tenant.id}, "
            f"shopify_draft_order_id={shopify_draft_order_id}, order_id={order.id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to cancel order from Shopify draft_order/delete: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_shopify_order_updated(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process Shopify orders/updated webhook event.

    Actualiza orden completa cuando se modifica en Shopify.
    Similar a orders/paid pero puede actualizar más campos.
    Implementa fallback search por email + total si no encuentra por ID.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance
        payload: Shopify order payload
        tenant: Tenant instance

    Returns:
        Updated Order instance or None if not found

    Raises:
        ValueError: If required fields are missing
    """
    # 1. Extract order_id
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in Shopify order updated payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID
    if isinstance(order_id, int):
        shopify_order_id = f"gid://shopify/Order/{order_id}"
    else:
        shopify_order_id = str(order_id)

    # 2. Find order by shopify_order_id
    order = order_repository.get_by_shopify_order_id(
        db, tenant_id=tenant.id, shopify_order_id=shopify_order_id
    )

    # 3. Fallback search if not found (similar to orders/paid logic)
    if not order:
        customer_email = payload.get("email") or payload.get("customer", {}).get("email")
        total_price_str = payload.get("total_price", "0.0")

        try:
            total_price = float(total_price_str)
        except (ValueError, TypeError):
            total_price = 0.0

        if customer_email:
            logger.info(
                f"Order not found by shopify_order_id={shopify_order_id}, "
                f"searching by email={customer_email} and total_price={total_price}"
            )

            # Get recent orders (last 30 days)
            recent_date = datetime.utcnow() - timedelta(days=30)

            potential_orders = (
                db.query(Order)
                .filter(
                    Order.tenant_id == tenant.id,
                    Order.customer_email == customer_email,
                    Order.created_at >= recent_date,
                )
                .order_by(Order.created_at.desc())
                .limit(10)
                .all()
            )

            # Try to match by total price
            for potential_order in potential_orders:
                if abs(potential_order.total_price - total_price) < 0.01:
                    order = potential_order
                    logger.info(f"Found order by email and price match: order_id={order.id}")
                    break

    if not order:
        warning_msg = f"Order not found for shopify_order_id={shopify_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 4. Extract updated data
    customer_email = payload.get("email") or payload.get("customer", {}).get("email")

    total_price_str = payload.get("total_price", str(order.total_price))
    try:
        total_price = float(total_price_str)
    except (ValueError, TypeError):
        total_price = order.total_price

    currency = payload.get("currency", order.currency)

    # Payment method
    payment_gateway_names = payload.get("payment_gateway_names", [])
    payment_method = ", ".join(payment_gateway_names) if payment_gateway_names else None

    # Financial status (to determine if paid)
    financial_status = payload.get("financial_status", "").lower()
    is_paid = financial_status in ["paid", "partially_paid", "refunded"]

    # 5. Check idempotency
    needs_update = False

    if customer_email and order.customer_email != customer_email:
        needs_update = True
    if abs(order.total_price - total_price) > 0.01:
        needs_update = True
    if order.currency != currency:
        needs_update = True
    if payment_method and order.payment_method != payment_method:
        needs_update = True
    if is_paid and not order.validado:
        needs_update = True
    if not order.shopify_order_id:
        needs_update = True

    if not needs_update:
        logger.info(
            f"Order update skipped (no changes): tenant={tenant.id}, "
            f"shopify_order_id={shopify_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 6. Update order
    try:
        if customer_email:
            order.customer_email = customer_email
        order.total_price = total_price
        order.currency = currency

        # Update payment info if paid
        if is_paid and not order.validado:
            order.validado = True
            order.status = "Pagado"
            order.validated_at = datetime.utcnow()

        # Save shopify_order_id if not set (draft→order transition)
        if not order.shopify_order_id:
            order.shopify_order_id = shopify_order_id

        if payment_method:
            order.payment_method = payment_method

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Updated order from orders/updated: tenant={tenant.id}, "
            f"shopify_order_id={shopify_order_id}, order_id={order.id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to update order from Shopify orders/updated: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_shopify_order_cancelled(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process Shopify orders/cancelled webhook event.

    Marca orden como cancelada cuando se cancela en Shopify.
    Opcionalmente guarda cancel_reason en notes.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance
        payload: Shopify order payload
        tenant: Tenant instance

    Returns:
        Cancelled Order instance or None if not found

    Raises:
        ValueError: If required fields are missing
    """
    # 1. Extract order_id
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in Shopify order cancelled payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Convert to GraphQL ID
    if isinstance(order_id, int):
        shopify_order_id = f"gid://shopify/Order/{order_id}"
    else:
        shopify_order_id = str(order_id)

    # 2. Find order
    order = order_repository.get_by_shopify_order_id(
        db, tenant_id=tenant.id, shopify_order_id=shopify_order_id
    )

    if not order:
        warning_msg = f"Order not found for cancelled shopify_order_id={shopify_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 3. Check idempotency
    if order.status == "Cancelado":
        logger.info(
            f"Order already cancelled (idempotent): tenant={tenant.id}, "
            f"shopify_order_id={shopify_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 4. Mark as cancelled
    try:
        order.status = "Cancelado"
        order.validado = False

        # Optional: store cancel_reason in notes
        cancel_reason = payload.get("cancel_reason")
        if cancel_reason:
            current_notes = order.notes or ""
            if current_notes:
                order.notes = f"{current_notes}\nCancelado: {cancel_reason}".strip()
            else:
                order.notes = f"Cancelado: {cancel_reason}"

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Cancelled order from orders/cancelled: tenant={tenant.id}, "
            f"shopify_order_id={shopify_order_id}, order_id={order.id}, "
            f"cancel_reason={cancel_reason or 'not provided'}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to cancel order from Shopify orders/cancelled: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_woocommerce_order_created(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order:
    """
    Process WooCommerce order.created webhook event.

    Extrae datos del payload de WooCommerce y crea orden en la base de datos.
    Implementa idempotencia - si orden ya existe, retorna orden existente.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance (already saved in DB)
        payload: WooCommerce order payload
        tenant: Tenant instance

    Returns:
        Created or existing Order instance

    Raises:
        ValueError: If required fields are missing
        Exception: If order creation fails
    """
    # 1. Extraer order ID (integer)
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in WooCommerce order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # WooCommerce usa IDs numéricos directamente (no GraphQL)
    woocommerce_order_id = int(order_id)

    # 2. Check idempotencia
    existing_order = order_repository.get_by_woocommerce_order_id(
        db, tenant_id=tenant.id, woocommerce_order_id=woocommerce_order_id
    )
    if existing_order:
        logger.info(
            f"WooCommerce order already exists (idempotent): tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={existing_order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = existing_order.id
        db.commit()
        return existing_order

    # 3. Extraer customer info de billing
    billing = payload.get("billing", {})
    customer_email = billing.get("email")

    if not customer_email:
        error_msg = "Missing customer email in WooCommerce order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    # Construir nombre del cliente
    first_name = billing.get("first_name", "")
    last_name = billing.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else None

    # 4. Extraer total y currency
    total_price_str = payload.get("total", "0.0")
    try:
        total_price = float(total_price_str)
    except (ValueError, TypeError):
        logger.warning(f"Invalid total value: {total_price_str}, setting to 0.0")
        total_price = 0.0

    currency = payload.get("currency", "USD")

    # 5. Mapear status de WooCommerce a status interno
    woo_status = payload.get("status", "pending")
    status, validado = _map_woo_status(woo_status)

    # 6. Transformar line items
    line_items_raw = payload.get("line_items", [])
    line_items = []
    if line_items_raw:
        for item in line_items_raw:
            try:
                transformed_item = {
                    "sku": item.get("sku", str(item.get("id", ""))),
                    "product": item.get("name", "Unknown Product"),
                    "unitPrice": float(item.get("price", 0.0)),
                    "quantity": int(item.get("quantity", 1)),
                }
                transformed_item["subtotal"] = transformed_item["unitPrice"] * transformed_item["quantity"]
                line_items.append(transformed_item)
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to transform line item: {item}, error: {e}")
                continue

    # 7. Extraer shipping_lines y agregar como line item
    shipping_lines_raw = payload.get("shipping_lines", [])
    for shipping_line in shipping_lines_raw:
        try:
            shipping_price = float(shipping_line.get("total", 0.0))
            if shipping_price > 0:
                shipping_item = {
                    "sku": "DELIVERY",
                    "product": shipping_line.get("method_title", "Envío"),
                    "unitPrice": shipping_price,
                    "quantity": 1,
                    "subtotal": shipping_price,
                }
                line_items.append(shipping_item)
                logger.info(f"Added shipping line item: {shipping_item['product']} - {shipping_price}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to add shipping line item: {shipping_line}, error: {e}")

    # 8. Extraer método de pago
    payment_method = payload.get("payment_method_title") or payload.get("payment_method")

    # 9. Extraer dirección de envío (shipping principal, billing fallback)
    shipping_address_raw = payload.get("shipping") or payload.get("billing")
    shipping_address = _format_shipping_address(shipping_address_raw, "woocommerce")

    # 10. Crear orden
    try:
        order_data = OrderCreate(
            tenant_id=tenant.id,
            woocommerce_order_id=woocommerce_order_id,
            customer_email=customer_email,
            customer_name=customer_name,
            total_price=total_price,
            currency=currency,
            line_items=line_items if line_items else None,
            payment_method=payment_method,
            shipping_address=shipping_address,
        )

        order = order_repository.create(db, obj_in=order_data)

        # Aplicar status y validado mapeados
        order.status = status
        order.validado = validado
        if validado:
            order.validated_at = datetime.utcnow()

        db.flush()

        # Actualizar webhook event
        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Created order from WooCommerce: tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={order.id}, "
            f"status={status}, validado={validado}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to create order from WooCommerce: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_woocommerce_order_updated(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process WooCommerce order.updated webhook event.

    Actualiza orden existente cuando se modifica en WooCommerce.
    Soporta transiciones de status incluyendo pending→processing→completed→cancelled.
    Implementa idempotencia exhaustiva comparando todos los campos críticos.

    Args:
        db: Database session
        webhook_event: WebhookEvent instance
        payload: WooCommerce order payload
        tenant: Tenant instance

    Returns:
        Updated Order instance or None if not found

    Raises:
        ValueError: If required fields are missing
    """
    # 1. Extract order_id
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in WooCommerce order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    woocommerce_order_id = int(order_id)

    # 2. Find order by woocommerce_order_id
    order = order_repository.get_by_woocommerce_order_id(
        db, tenant_id=tenant.id, woocommerce_order_id=woocommerce_order_id
    )

    if not order:
        warning_msg = f"Order not found for woocommerce_order_id={woocommerce_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 3. Extract customer info
    billing = payload.get("billing", {})
    customer_email = billing.get("email")

    first_name = billing.get("first_name", "")
    last_name = billing.get("last_name", "")
    customer_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else None

    # 4. Extract pricing
    total_price_str = payload.get("total", str(order.total_price))
    try:
        total_price = float(total_price_str)
    except (ValueError, TypeError):
        total_price = order.total_price

    currency = payload.get("currency", order.currency)

    # 5. Map status
    woo_status = payload.get("status", "pending")
    new_status, new_validado = _map_woo_status(woo_status)

    # Track previous state for logging
    prev_status = order.status
    prev_validado = order.validado

    # 6. Transform line items
    line_items_raw = payload.get("line_items", [])
    line_items = []
    if line_items_raw:
        for item in line_items_raw:
            try:
                transformed_item = {
                    "sku": item.get("sku", str(item.get("id", ""))),
                    "product": item.get("name", "Unknown Product"),
                    "unitPrice": float(item.get("price", 0.0)),
                    "quantity": int(item.get("quantity", 1)),
                }
                transformed_item["subtotal"] = transformed_item["unitPrice"] * transformed_item["quantity"]
                line_items.append(transformed_item)
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to transform line item: {item}, error: {e}")
                continue

    # 7. Extraer shipping_lines y agregar como line item
    shipping_lines_raw = payload.get("shipping_lines", [])
    for shipping_line in shipping_lines_raw:
        try:
            shipping_price = float(shipping_line.get("total", 0.0))
            if shipping_price > 0:
                shipping_item = {
                    "sku": "DELIVERY",
                    "product": shipping_line.get("method_title", "Envío"),
                    "unitPrice": shipping_price,
                    "quantity": 1,
                    "subtotal": shipping_price,
                }
                line_items.append(shipping_item)
                logger.info(f"Added shipping line item: {shipping_item['product']} - {shipping_price}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to add shipping line item: {shipping_line}, error: {e}")

    # 8. Extract payment method
    payment_method = payload.get("payment_method_title") or payload.get("payment_method")

    # 9. Extraer dirección de envío (shipping principal, billing fallback)
    shipping_address_raw = payload.get("shipping") or payload.get("billing")
    shipping_address = _format_shipping_address(shipping_address_raw, "woocommerce")

    # 10. Check idempotency - compare all critical fields
    needs_update = False

    if customer_email and order.customer_email != customer_email:
        needs_update = True
    if customer_name and order.customer_name != customer_name:
        needs_update = True
    if abs(order.total_price - total_price) > 0.01:
        needs_update = True
    if order.currency != currency:
        needs_update = True
    if order.status != new_status:
        needs_update = True
    if order.validado != new_validado:
        needs_update = True
    if payment_method and order.payment_method != payment_method:
        needs_update = True
    # Compare line_items (basic comparison)
    if line_items and order.line_items != line_items:
        needs_update = True
    if shipping_address and order.shipping_address != shipping_address:
        needs_update = True

    if not needs_update:
        logger.info(
            f"Order update skipped (no changes): tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 11. Update order
    try:
        if customer_email:
            order.customer_email = customer_email
        if customer_name:
            order.customer_name = customer_name

        order.total_price = total_price
        order.currency = currency
        order.status = new_status
        order.validado = new_validado

        # Set validated_at when transitioning to validated
        if new_validado and not prev_validado:
            order.validated_at = datetime.utcnow()

        if payment_method:
            order.payment_method = payment_method

        if line_items:
            order.line_items = line_items

        if shipping_address:
            order.shipping_address = shipping_address

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Updated order from order.updated: tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={order.id}, "
            f"status: {prev_status}→{new_status}, validado: {prev_validado}→{new_validado}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to update order from WooCommerce: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise


def process_woocommerce_order_deleted(
    db: Session,
    webhook_event: WebhookEvent,
    payload: dict[str, Any],
    tenant: Tenant,
) -> Order | None:
    """
    Process WooCommerce order.deleted webhook event.

    Marca orden como cancelada cuando se elimina en WooCommerce.
    Usa soft delete (no elimina de BD, solo marca status="Cancelado").

    Args:
        db: Database session
        webhook_event: WebhookEvent instance
        payload: WooCommerce order payload
        tenant: Tenant instance

    Returns:
        Updated Order instance or None if not found
    """
    # 1. Extract order_id
    order_id = payload.get("id")
    if not order_id:
        error_msg = "Missing 'id' field in WooCommerce order payload"
        logger.error(f"{error_msg}: {payload}")
        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()
        raise ValueError(error_msg)

    woocommerce_order_id = int(order_id)

    # 2. Find order
    order = order_repository.get_by_woocommerce_order_id(
        db, tenant_id=tenant.id, woocommerce_order_id=woocommerce_order_id
    )

    if not order:
        warning_msg = f"Order not found for woocommerce_order_id={woocommerce_order_id}"
        logger.warning(f"{warning_msg}, tenant={tenant.id}")
        webhook_event.processed = True
        webhook_event.error = warning_msg
        db.commit()
        return None

    # 3. Check idempotency
    if order.status == "Cancelado":
        logger.info(
            f"Order already cancelled (idempotent): tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={order.id}"
        )
        webhook_event.processed = True
        webhook_event.order_id = order.id
        db.commit()
        return order

    # 4. Mark as cancelled (soft delete)
    try:
        order.status = "Cancelado"
        order.validado = False

        db.flush()

        webhook_event.processed = True
        webhook_event.order_id = order.id

        db.commit()
        db.refresh(order)

        logger.info(
            f"Cancelled order from order.deleted: tenant={tenant.id}, "
            f"woo_order_id={woocommerce_order_id}, order_id={order.id}"
        )

        return order

    except Exception as e:
        db.rollback()
        error_msg = f"Failed to delete order from WooCommerce: {str(e)}"
        logger.error(error_msg, exc_info=True)

        webhook_event.processed = True
        webhook_event.error = error_msg
        db.commit()

        raise
