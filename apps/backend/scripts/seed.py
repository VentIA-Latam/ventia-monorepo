"""
Database seed script to populate initial test data.
Run this script to populate the database with sample users, tenants, and orders.

Usage:
    python apps/backend/scripts/seed.py
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend app to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.invoice_serie import InvoiceSerie
from app.models.order import Order
from app.models.tenant import Tenant
from app.models.user import User
from app.core.permissions import Role
from app.schemas.tenant_settings import (
    EcommerceSettings,
    ShopifyCredentials,
    WooCommerceCredentials,
)


def seed_database():
    """Seed the database with initial data."""
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if data already exists
        if db.query(Tenant).count() > 0:
            print("⚠️  Database already contains data. Skipping seed...")
            return
        
        print("Starting database seed...")
        
        # ============ SEED TENANTS ============
        # NOTE: E-commerce configuration is done via set_ecommerce_settings() after tenant creation.
        # This uses the unified settings JSON field with encrypted credentials.
        print("\nCreating tenants...")
        tenants = [
            # Tenant 1: VentIA Platform (SuperAdmin tenant) - No e-commerce config
            Tenant(
                name="VentIA Platform",
                slug="ventia",
                company_id=None,
                is_platform=True,  # This is the platform tenant
                is_active=True,
                efact_ruc="20100000001",
                # Datos del emisor para facturacion electronica
                emisor_nombre_comercial="VentIA",
                emisor_ubigeo="150101",
                emisor_departamento="LIMA",
                emisor_provincia="LIMA",
                emisor_distrito="LIMA",
                emisor_direccion="AV. JAVIER PRADO ESTE 4600",
                settings=None,  # Platform tenant - no e-commerce needed
                created_at=datetime(2026, 1, 1, 12, 0, 0),
                updated_at=datetime(2026, 1, 1, 12, 0, 0),
            ),
            # Tenant 2: Nassau (Client) - Shopify configuration (set via set_ecommerce_settings)
            Tenant(
                name="Nassau",
                slug="nassau-outlet",
                company_id=None,
                is_active=True,
                efact_ruc="20614382741",
                # Datos del emisor para facturacion electronica
                emisor_nombre_comercial="Nassau Outlet",
                emisor_ubigeo="150131",
                emisor_departamento="LIMA",
                emisor_provincia="LIMA",
                emisor_distrito="SAN ISIDRO",
                emisor_direccion="AV. CONQUISTADORES 1234",
                settings=None,  # E-commerce set after commit
                created_at=datetime(2026, 1, 1, 12, 27, 59),
                updated_at=datetime(2026, 1, 1, 12, 27, 59),
            ),
            # Tenant 3: La dore (Client) - WooCommerce configuration (set via set_ecommerce_settings)
            Tenant(
                name="La dore",
                slug="la-dore-outlet",
                company_id=None,
                is_active=True,
                efact_ruc="20614382741",
                # Datos del emisor para facturacion electronica
                emisor_nombre_comercial="La Dore",
                emisor_ubigeo="150122",
                emisor_departamento="LIMA",
                emisor_provincia="LIMA",
                emisor_distrito="MIRAFLORES",
                emisor_direccion="AV. LARCO 567",
                settings=None,  # E-commerce set after commit
                created_at=datetime(2026, 1, 1, 12, 27, 59),
                updated_at=datetime(2026, 1, 1, 12, 27, 59),
            ),
            # Tenant 4: Not peppers (Client) - Shopify configuration (set via set_ecommerce_settings)
            Tenant(
                name="Not peppers",
                slug="not-peppers-outlet",
                company_id=None,
                is_active=True,
                efact_ruc="20555666777",
                # Datos del emisor para facturacion electronica
                emisor_nombre_comercial="Not Peppers Restaurant",
                emisor_ubigeo="150141",
                emisor_departamento="LIMA",
                emisor_provincia="LIMA",
                emisor_distrito="SURCO",
                emisor_direccion="AV. PRIMAVERA 890",
                settings=None,  # E-commerce set after commit
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            # Tenant 5: Lucano (Inactive Client) - WooCommerce configuration (set via set_ecommerce_settings)
            Tenant(
                name="Lucano",
                slug="lucano-outlet",
                company_id=None,
                is_active=False,
                efact_ruc="20444333222",
                # Datos del emisor para facturacion electronica
                emisor_nombre_comercial="Lucano Store",
                emisor_ubigeo="150115",
                emisor_departamento="LIMA",
                emisor_provincia="LIMA",
                emisor_distrito="LA MOLINA",
                emisor_direccion="AV. LA FONTANA 456",
                settings=None,  # E-commerce set after commit
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
        ]
        db.add_all(tenants)
        db.commit()
        print(f"✅ Created {len(tenants)} tenants")
        
        # ============ CONFIGURE E-COMMERCE SETTINGS ============
        print("\n🔧 Configuring e-commerce settings for tenants...")
        
        # Tenant 2: Nassau - Shopify with OAuth2 and sync enabled
        # Note: OAuth2 credentials should be set via admin panel in production
        tenants[1].set_ecommerce_settings(EcommerceSettings(
            sync_on_validation=True,
            shopify=ShopifyCredentials(
                store_url="https://nassau-outlet.myshopify.com",
                client_id=None,  # Set in production via admin panel
                client_secret=None,  # Set in production via admin panel
                api_version="2024-01",
            ),
        ))
        print(f"   - Nassau: Shopify OAuth2 (sync=True)")
        
        # Tenant 3: La dore - WooCommerce with sync enabled
        # Note: credentials should be set via admin panel or environment
        tenants[2].set_ecommerce_settings(EcommerceSettings(
            sync_on_validation=True,
            woocommerce=WooCommerceCredentials(
                store_url="https://ladore.com",
                consumer_key=None,  # Set in production via admin panel
                consumer_secret=None,  # Set in production via admin panel
            ),
        ))
        print(f"   - La Dore: WooCommerce (sync=True)")
        
        # Tenant 4: Not Peppers - Shopify with OAuth2 and sync disabled (for local orders)
        tenants[3].set_ecommerce_settings(EcommerceSettings(
            sync_on_validation=False,  # Local orders, no sync needed
            shopify=ShopifyCredentials(
                store_url="https://not-peppers.myshopify.com",
                client_id=None,  # Set in production via admin panel
                client_secret=None,  # Set in production via admin panel
                api_version="2024-01",
            ),
        ))
        print(f"   - Not Peppers: Shopify OAuth2 (sync=False)")
        
        # Tenant 5: Lucano - WooCommerce with sync disabled (inactive tenant)
        tenants[4].set_ecommerce_settings(EcommerceSettings(
            sync_on_validation=False,
            woocommerce=WooCommerceCredentials(
                store_url="https://lucano-store.com",
                consumer_key=None,
                consumer_secret=None,
            ),
        ))
        print(f"   - Lucano: WooCommerce (sync=False, inactive)")
        
        db.commit()
        print("✅ E-commerce settings configured")
        
        # ============ SEED USERS ============
        print("\nCreating users...")
        users = [
            User(
                auth0_user_id="auth0|694b71d6c90e2884d082a568",
                email="renzolenes0@gmail.com",
                name="Renzo Lenes",
                tenant_id=2,
                role=Role.ADMIN,
                is_active=True,
                last_login=datetime.now(),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            User(
                auth0_user_id="auth0|694c6cd2c1284cca639e207d",
                email="johnsovero@gmail.com",
                name="John Sovero",
                tenant_id=2,
                role=Role.LOGISTICA,
                is_active=True,
                last_login=datetime.now(),
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            User(
                auth0_user_id="auth0|694c6dc0fc900ddc4668f10c",
                email="pedrito@gmail.com",
                name="Pedrito Uno",
                tenant_id=3,
                role=Role.LOGISTICA,
                is_active=True,
                last_login=datetime(2025, 12, 24, 23, 0, 33, 682000),
                created_at=datetime(2025, 12, 24, 22, 48, 32, 97000),
                updated_at=datetime(2025, 12, 24, 22, 48, 32, 97000),
            ),
            User(
                auth0_user_id="auth0|694c6dd2873030064bddc0c8",
                email="pedrito2@gmail.com",
                name="Pedrito Dos",
                tenant_id=3,
                role=Role.ADMIN,
                is_active=True,
                last_login=datetime(2025, 12, 24, 23, 2, 4, 241000),
                created_at=datetime(2025, 12, 24, 22, 48, 50, 361000),
                updated_at=datetime(2025, 12, 24, 22, 48, 50, 361000),
            ),
            User(
                auth0_user_id="auth0|6952d4a85588312a179c0d08",
                email="equipoventia@gmail.com",
                name="Equipo Ventia",
                tenant_id=1,  # Super admin for first tenant
                role=Role.SUPERADMIN,
                is_active=True,
                last_login=datetime.now(),
                chatwoot_user_id=1,
                chatwoot_account_id=1,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
        ]
        db.add_all(users)
        db.commit()
        print(f"Created {len(users)} users")
        
        # ============ SEED ORDERS ============
        print("\n📦 Creating orders (30 for Nassau, 1 for La dore)...")
        orders = [
            Order(
                tenant_id=2,
                shopify_draft_order_id="123123",
                shopify_order_id="123456789",
                customer_email="francisco@gmail.com",
                customer_name="Francisco Perez",
                customer_document_type="6",
                customer_document_number="20123456789",
                total_price=1200,
                currency="PEN",
                line_items=[
                    {"sku": "LAPTOP-DXP13", "product": "Laptop Dell XPS 13", "unitPrice": 900.00, "quantity": 1, "subtotal": 900.00},
                    {"sku": "MOUSE-LMX3", "product": "Mouse Logitech MX Master", "unitPrice": 100.00, "quantity": 2, "subtotal": 200.00},
                    {"sku": "CABLE-HDMI-2M", "product": "HDMI Cable 2m", "unitPrice": 25.00, "quantity": 4, "subtotal": 100.00}
                ],
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                expected_delivery_date=datetime(2026, 1, 15, 14, 0, 0),
                dispatch_time_window="09:00-12:00",
                shipping_address="Av. Javier Prado Este 1234",
                shipping_city="SAN BORJA",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime(2026, 1, 8, 10, 30, 0),
                updated_at=datetime(2026, 1, 8, 10, 30, 0),
            ),
            Order(
                tenant_id=2,
                shopify_draft_order_id="123122",
                shopify_order_id="123456788",
                customer_email="juan@gmail.com",
                customer_name="Juan Calvo",
                customer_document_type="1",
                customer_document_number="12345678",
                total_price=850.5,
                currency="PEN",
                line_items=[
                    {"sku": "MON-LG27-4K", "product": "Monitor LG 27\" 4K", "unitPrice": 450.00, "quantity": 1, "subtotal": 450.00},
                    {"sku": "KB-MECH-RGB", "product": "Mechanical Keyboard RGB", "unitPrice": 120.00, "quantity": 2, "subtotal": 240.00},
                    {"sku": "WEB-LC920", "product": "Webcam Logitech C920", "unitPrice": 80.25, "quantity": 2, "subtotal": 160.50}
                ],
                validado=False,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pendiente",
                expected_delivery_date=datetime(2026, 1, 20, 10, 30, 0),
                dispatch_time_window="14:00-17:00",
                shipping_address="Jr. Lampa 456",
                shipping_city="JESUS MARIA",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            Order(
                tenant_id=2,
                shopify_draft_order_id="123121",
                shopify_order_id="123456787",
                customer_email="maria@gmail.com",
                customer_name="Maria Lopez",
                customer_document_type="6",
                customer_document_number="20987654321",
                total_price=99.00,
                currency="PEN",
                line_items=[
                    {"sku": "HUB-USBC-7P", "product": "USB-C Hub Adapter", "unitPrice": 35.00, "quantity": 1, "subtotal": 35.00},
                    {"sku": "STAND-PH-AL", "product": "Phone Stand Aluminum", "unitPrice": 32.00, "quantity": 2, "subtotal": 64.00}
                ],
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                expected_delivery_date=datetime(2026, 1, 18, 16, 0, 0),
                dispatch_time_window="08:00-10:00",
                shipping_address="Calle Las Begonias 789",
                shipping_city="SANTIAGO DE SURCO",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime(2026, 1, 10, 9, 15, 10),
                updated_at=datetime(2026, 1, 10, 9, 15, 10),
            ),
            Order(
                tenant_id=2,
                shopify_draft_order_id="123120",
                shopify_order_id="123456786",
                customer_email="pedro@gmail.com",
                customer_name="Pedro Ramirez",
                customer_document_type="1",
                customer_document_number="87654321",
                total_price=149.99,
                currency="PEN",
                line_items=[
                    {"sku": "HP-SONY-WH", "product": "Wireless Headphones Sony", "unitPrice": 149.99, "quantity": 1, "subtotal": 149.99}
                ],
                validado=False,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pendiente",
                expected_delivery_date=datetime(2026, 1, 25, 12, 0, 0),
                dispatch_time_window="10:00-13:00",
                shipping_address="Av. La Molina 1560",
                shipping_city="LA MOLINA",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            Order(
                tenant_id=2,
                shopify_draft_order_id="123119",
                shopify_order_id="123456785",
                customer_email="sofia@gmail.com",
                customer_name="Sofia Torres",
                customer_document_type="6",
                customer_document_number="20555888333",
                total_price=299.00,
                currency="PEN",
                line_items=[
                    {"sku": "CHAIR-ERG-MSH", "product": "Ergonomic Chair Mesh", "unitPrice": 199.00, "quantity": 1, "subtotal": 199.00},
                    {"sku": "LAMP-LED-ADJ", "product": "Desk Lamp LED Adjustable", "unitPrice": 50.00, "quantity": 2, "subtotal": 100.00}
                ],
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                expected_delivery_date=datetime(2026, 1, 22, 11, 30, 0),
                dispatch_time_window="15:00-18:00",
                shipping_address="Av. Primavera 2150",
                shipping_city="SAN BORJA",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            # === 25 órdenes adicionales para tenant 2 (Nassau) ===
            Order(tenant_id=2, shopify_draft_order_id="DFT-006", shopify_order_id="ORD-006",
                customer_email="carlos.mendez@email.com", customer_name="Carlos Mendez",
                customer_document_type="6", customer_document_number="20111222333",
                total_price=2150.00, currency="PEN",
                line_items=[
                    {"sku": "LAPTOP-MBP16", "product": "MacBook Pro 16\"", "unitPrice": 2000.00, "quantity": 1, "subtotal": 2000.00},
                    {"sku": "MOUSE-APL-MG", "product": "Magic Mouse", "unitPrice": 75.00, "quantity": 2, "subtotal": 150.00}
                ], validado=True, validated_at=datetime(2026, 1, 9, 9, 30, 0), payment_method="Wire Transfer",
                notes="Pedido corporativo", status="Pagado",
                shipping_address="Av. Conquistadores 1050", shipping_city="SAN ISIDRO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 9, 8, 15, 0), updated_at=datetime(2026, 1, 9, 9, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-007", shopify_order_id="ORD-007",
                customer_email="ana.garcia@company.com", customer_name="Ana Garcia", 
                customer_document_type="1", customer_document_number="11234567",
                total_price=575.25, currency="PEN",
                line_items=[
                    {"sku": "TABLET-IPA11", "product": "iPad Air 11\"", "unitPrice": 500.00, "quantity": 1, "subtotal": 500.00},
                    {"sku": "PEN-APL-2", "product": "Apple Pencil", "unitPrice": 75.25, "quantity": 1, "subtotal": 75.25}
                ], validado=True, validated_at=datetime(2026, 1, 11, 14, 0, 0), payment_method="Credit Card",
                notes=None, status="Pagado",
                shipping_address="Calle Schell 320", shipping_city="MIRAFLORES", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 11, 13, 45, 0), updated_at=datetime(2026, 1, 11, 14, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-008", shopify_order_id=None,
                customer_email="roberto.silva@mail.com", customer_name="Roberto Silva", 
                customer_document_type="6", customer_document_number="20444666777",
                total_price=320.00, currency="PEN",
                line_items=[
                    {"sku": "SSD-SAM-1TB", "product": "External SSD 1TB Samsung", "unitPrice": 180.00, "quantity": 1, "subtotal": 180.00},
                    {"sku": "BAG-LP-BK", "product": "Laptop Backpack", "unitPrice": 70.00, "quantity": 2, "subtotal": 140.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes="Cliente solicitó factura", status="Pendiente",
                shipping_address="Jr. Huallaga 198", shipping_city="LINCE", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 12, 10, 20, 0), updated_at=datetime(2026, 1, 12, 10, 20, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-009", shopify_order_id="ORD-009",
                customer_email="lucia.martinez@email.com", customer_name="Lucia Martinez", 
                customer_document_type="1", customer_document_number="22345678",
                total_price=1890.00, currency="PEN",
                line_items=[
                    {"sku": "DESK-STD-ELC", "product": "Standing Desk Electric", "unitPrice": 650.00, "quantity": 2, "subtotal": 1300.00},
                    {"sku": "ARM-MON-DL", "product": "Monitor Arm Dual", "unitPrice": 295.00, "quantity": 2, "subtotal": 590.00}
                ], validado=True, validated_at=datetime(2026, 1, 14, 16, 30, 0), payment_method="PayPal",
                notes="Envío express", status="Pagado",
                shipping_address="Av. Arequipa 4500", shipping_city="SANTIAGO DE SURCO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 14, 15, 10, 0), updated_at=datetime(2026, 1, 14, 16, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-010", shopify_order_id="ORD-010",
                customer_email="diego.fernandez@biz.com", customer_name="Diego Fernandez", 
                customer_document_type="6", customer_document_number="20888999111",
                total_price=445.50, currency="PEN",
                line_items=[
                    {"sku": "KB-KEY-K2", "product": "Mechanical Keyboard Keychron", "unitPrice": 145.50, "quantity": 1, "subtotal": 145.50},
                    {"sku": "MOUSE-RZR-V3", "product": "Gaming Mouse Razer", "unitPrice": 100.00, "quantity": 3, "subtotal": 300.00}
                ], validado=True, validated_at=datetime(2026, 1, 15, 11, 0, 0), payment_method="Credit Card",
                notes=None, status="Pagado",
                shipping_address="Calle Los Pinos 250", shipping_city="LOS OLIVOS", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 15, 10, 30, 0), updated_at=datetime(2026, 1, 15, 11, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-011", shopify_order_id="ORD-011",
                customer_email="valentina.cruz@email.com", customer_name="Valentina Cruz", 
                customer_document_type="1", customer_document_number="33456789",
                total_price=725.00, currency="PEN",
                line_items=[
                    {"sku": "MON-UW-34", "product": "Ultrawide Monitor 34\"", "unitPrice": 625.00, "quantity": 1, "subtotal": 625.00},
                    {"sku": "STAND-MON-WD", "product": "Monitor Stand Wood", "unitPrice": 100.00, "quantity": 1, "subtotal": 100.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Av. Salaverry 3200", shipping_city="SAN ISIDRO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 16, 12, 50, 0), updated_at=datetime(2026, 1, 16, 12, 50, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-012", shopify_order_id=None,
                customer_email="miguel.ruiz@company.com", customer_name="Miguel Ruiz", 
                customer_document_type="6", customer_document_number="20777555333",
                total_price=199.99, currency="PEN",
                line_items=[
                    {"sku": "CHR-WRL-3IN1", "product": "Wireless Charger 3-in-1", "unitPrice": 79.99, "quantity": 1, "subtotal": 79.99},
                    {"sku": "CABLE-LTN-6", "product": "USB Cable Lightning 6ft", "unitPrice": 20.00, "quantity": 6, "subtotal": 120.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Av. Brasil 1580", shipping_city="PUEBLO LIBRE", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 18, 9, 0, 0), updated_at=datetime(2026, 1, 18, 9, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-013", shopify_order_id="ORD-013",
                customer_email="carolina.vargas@mail.com", customer_name="Carolina Vargas", 
                customer_document_type="1", customer_document_number="44567890",
                total_price=1250.00, currency="PEN",
                line_items=[
                    {"sku": "PRINT-HP-LJ", "product": "HP LaserJet Pro Printer", "unitPrice": 850.00, "quantity": 1, "subtotal": 850.00},
                    {"sku": "PAPER-A4-500", "product": "Printer Paper Ream 500 Sheets", "unitPrice": 10.00, "quantity": 40, "subtotal": 400.00}
                ], validado=True, validated_at=datetime(2026, 1, 19, 15, 45, 0), payment_method="Credit Card",
                notes="Cliente VIP", status="Pagado",
                shipping_address="Calle Porta 130", shipping_city="MIRAFLORES", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 19, 14, 30, 0), updated_at=datetime(2026, 1, 19, 15, 45, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-014", shopify_order_id="ORD-014",
                customer_email="andres.lopez@email.com", customer_name="Andres Lopez", 
                customer_document_type="6", customer_document_number="20666333444",
                total_price=890.00, currency="PEN",
                line_items=[
                    {"sku": "TABLET-WCM-INT", "product": "Graphics Tablet Wacom", "unitPrice": 450.00, "quantity": 1, "subtotal": 450.00},
                    {"sku": "PEN-STY-PRO", "product": "Stylus Pen Pro", "unitPrice": 110.00, "quantity": 4, "subtotal": 440.00}
                ], validado=True, validated_at=datetime(2026, 1, 20, 10, 20, 0), payment_method="PayPal",
                notes=None, status="Pagado",
                shipping_address="Jr. Cusco 450", shipping_city="ATE", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 20, 9, 45, 0), updated_at=datetime(2026, 1, 20, 10, 20, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-015", shopify_order_id="ORD-015",
                customer_email="isabella.rojas@biz.com", customer_name="Isabella Rojas", 
                customer_document_type="1", customer_document_number="55678901",
                total_price=325.75, currency="PEN",
                line_items=[
                    {"sku": "SPK-JBL-BT", "product": "Bluetooth Speaker JBL", "unitPrice": 125.00, "quantity": 2, "subtotal": 250.00},
                    {"sku": "CASE-PH-LTH", "product": "Phone Case Leather", "unitPrice": 25.25, "quantity": 3, "subtotal": 75.75}
                ], validado=True, validated_at=datetime(2026, 1, 21, 16, 0, 0), payment_method="Debit Card",
                notes=None, status="Pagado",
                shipping_address="Av. Sáenz Peña 1200", shipping_city="CALLAO", shipping_province="CALLAO", shipping_country="Peru",
                created_at=datetime(2026, 1, 21, 15, 30, 0), updated_at=datetime(2026, 1, 21, 16, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-016", shopify_order_id=None,
                customer_email="gabriel.santos@email.com", customer_name="Gabriel Santos", 
                customer_document_type="6", customer_document_number="20444999555",
                total_price=450.00, currency="PEN",
                line_items=[
                    {"sku": "HP-BSE-NC700", "product": "Noise Cancelling Headphones Bose", "unitPrice": 350.00, "quantity": 1, "subtotal": 350.00},
                    {"sku": "CASE-HP-PRM", "product": "Carrying Case Premium", "unitPrice": 100.00, "quantity": 1, "subtotal": 100.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes="Esperando confirmación", status="Pendiente",
                shipping_address="Calle Chinchón 890", shipping_city="SAN ISIDRO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 22, 11, 30, 0), updated_at=datetime(2026, 1, 22, 11, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-017", shopify_order_id="ORD-017",
                customer_email="camila.herrera@company.com", customer_name="Camila Herrera", 
                customer_document_type="1", customer_document_number="66789012",
                total_price=1575.00, currency="PEN",
                line_items=[
                    {"sku": "PC-DELL-WKS", "product": "Dell Workstation Desktop", "unitPrice": 1200.00, "quantity": 1, "subtotal": 1200.00},
                    {"sku": "KB-MECH-FS", "product": "Mechanical Keyboard Full Size", "unitPrice": 125.00, "quantity": 3, "subtotal": 375.00}
                ], validado=True, validated_at=datetime(2026, 1, 23, 14, 30, 0), payment_method="Wire Transfer",
                notes="Pedido empresarial", status="Pagado",
                shipping_address="Av. Tupac Amaru 3400", shipping_city="COMAS", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 23, 13, 0, 0), updated_at=datetime(2026, 1, 23, 14, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-018", shopify_order_id="ORD-018",
                customer_email="fernando.castro@mail.com", customer_name="Fernando Castro", 
                customer_document_type="6", customer_document_number="20333777666",
                total_price=670.50, currency="PEN",
                line_items=[
                    {"sku": "LIGHT-RNG-18", "product": "Ring Light 18\"", "unitPrice": 89.50, "quantity": 3, "subtotal": 268.50},
                    {"sku": "TRIPOD-CF-PRO", "product": "Tripod Carbon Fiber", "unitPrice": 134.00, "quantity": 3, "subtotal": 402.00}
                ], validado=True, validated_at=datetime(2026, 1, 24, 10, 0, 0), payment_method="Credit Card",
                notes=None, status="Pagado",
                shipping_address="Av. El Sol 580", shipping_city="SAN JUAN DE LURIGANCHO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 24, 9, 20, 0), updated_at=datetime(2026, 1, 24, 10, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-019", shopify_order_id="ORD-019",
                customer_email="daniela.morales@email.com", customer_name="Daniela Morales", 
                customer_document_type="1", customer_document_number="77890123",
                total_price=210.00, currency="PEN",
                line_items=[
                    {"sku": "COOL-LP-RGB", "product": "Laptop Cooling Pad RGB", "unitPrice": 55.00, "quantity": 2, "subtotal": 110.00},
                    {"sku": "ORG-CABLE-SET", "product": "Cable Organizer Set", "unitPrice": 25.00, "quantity": 4, "subtotal": 100.00}
                ], validado=True, validated_at=datetime(2026, 1, 25, 15, 15, 0), payment_method="PayPal",
                notes=None, status="Pagado",
                shipping_address="Calle Los Jazmines 145", shipping_city="LA MOLINA", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 25, 14, 45, 0), updated_at=datetime(2026, 1, 25, 15, 15, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-020", shopify_order_id="ORD-020",
                customer_email="ricardo.flores@biz.com", customer_name="Ricardo Flores", 
                customer_document_type="6", customer_document_number="20222888999",
                total_price=980.50, currency="PEN",
                line_items=[
                    {"sku": "MON-GM-27-144", "product": "27\" Gaming Monitor 144Hz", "unitPrice": 380.00, "quantity": 2, "subtotal": 760.00},
                    {"sku": "CABLE-DP-6FT", "product": "DisplayPort Cable 6ft", "unitPrice": 22.05, "quantity": 10, "subtotal": 220.50}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Av. Grau 900", shipping_city="BARRANCO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 26, 11, 0, 0), updated_at=datetime(2026, 1, 26, 11, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-021", shopify_order_id=None,
                customer_email="paula.jimenez@company.com", customer_name="Paula Jimenez", 
                customer_document_type="1", customer_document_number="88901234",
                total_price=135.00, currency="PEN",
                line_items=[
                    {"sku": "MOUSE-WRL-SLM", "product": "Wireless Mouse Slim", "unitPrice": 45.00, "quantity": 3, "subtotal": 135.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Jr. Camaná 615", shipping_city="LIMA", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 27, 10, 15, 0), updated_at=datetime(2026, 1, 27, 10, 15, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-022", shopify_order_id="ORD-022",
                customer_email="sergio.navarro@email.com", customer_name="Sergio Navarro", 
                customer_document_type="6", customer_document_number="20111444555",
                total_price=1425.00, currency="PEN",
                line_items=[
                    {"sku": "IPHONE-15P-256", "product": "iPhone 15 Pro 256GB", "unitPrice": 1100.00, "quantity": 1, "subtotal": 1100.00},
                    {"sku": "AIRPODS-PRO-2", "product": "AirPods Pro", "unitPrice": 249.00, "quantity": 1, "subtotal": 249.00},
                    {"sku": "CASE-IP-MAG", "product": "Phone Case MagSafe", "unitPrice": 38.00, "quantity": 2, "subtotal": 76.00}
                ], validado=True, validated_at=datetime(2026, 1, 28, 16, 30, 0), payment_method="Credit Card",
                notes="Entrega urgente", status="Pagado",
                shipping_address="Av. Angamos 1800", shipping_city="SANTIAGO DE SURCO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 28, 15, 50, 0), updated_at=datetime(2026, 1, 28, 16, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-023", shopify_order_id="ORD-023",
                customer_email="adriana.vega@mail.com", customer_name="Adriana Vega", 
                customer_document_type="1", customer_document_number="99012345",
                total_price=555.00, currency="PEN",
                line_items=[
                    {"sku": "WEB-LG-4K", "product": "Webcam 4K Logitech", "unitPrice": 185.00, "quantity": 3, "subtotal": 555.00}
                ], validado=True, validated_at=datetime(2026, 1, 29, 13, 0, 0), payment_method="PayPal",
                notes=None, status="Pagado",
                shipping_address="Av. Universitaria 2500", shipping_city="SAN MARTIN DE PORRES", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 29, 12, 20, 0), updated_at=datetime(2026, 1, 29, 13, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-024", shopify_order_id="ORD-024",
                customer_email="jorge.ramos@biz.com", customer_name="Jorge Ramos", 
                customer_document_type="6", customer_document_number="20999666777",
                total_price=790.00, currency="PEN",
                line_items=[
                    {"sku": "DOCK-USBC-11", "product": "Docking Station USB-C", "unitPrice": 320.00, "quantity": 2, "subtotal": 640.00},
                    {"sku": "CABLE-ETH-50", "product": "Ethernet Cable Cat8 50ft", "unitPrice": 30.00, "quantity": 5, "subtotal": 150.00}
                ], validado=True, validated_at=datetime(2026, 1, 30, 10, 45, 0), payment_method="Debit Card",
                notes=None, status="Pagado",
                shipping_address="Calle Libertad 340", shipping_city="SAN BORJA", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 30, 10, 0, 0), updated_at=datetime(2026, 1, 30, 10, 45, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-025", shopify_order_id=None,
                customer_email="natalia.ortiz@email.com", customer_name="Natalia Ortiz", 
                customer_document_type="1", customer_document_number="11223344",
                total_price=265.50, currency="PEN",
                line_items=[
                    {"sku": "SSD-PORT-500", "product": "Portable SSD 500GB", "unitPrice": 85.50, "quantity": 3, "subtotal": 256.50},
                    {"sku": "CABLE-USBC-3", "product": "USB-C Cable Braided 3ft", "unitPrice": 9.00, "quantity": 1, "subtotal": 9.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes="Revisar disponibilidad", status="Pendiente",
                shipping_address="Av. Venezuela 1100", shipping_city="BREÑA", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 1, 31, 14, 30, 0), updated_at=datetime(2026, 1, 31, 14, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-026", shopify_order_id="ORD-026",
                customer_email="alberto.duran@company.com", customer_name="Alberto Duran", total_price=1180.00, currency="PEN",
                line_items=[
                    {"sku": "MON-LG-UW-38", "product": "LG UltraWide 38\" Monitor", "unitPrice": 980.00, "quantity": 1, "subtotal": 980.00},
                    {"sku": "LIGHT-MON-BAR", "product": "Monitor Light Bar", "unitPrice": 100.00, "quantity": 2, "subtotal": 200.00}
                ], validado=True, validated_at=datetime(2026, 2, 1, 11, 30, 0), payment_method="Wire Transfer",
                notes="Cliente corporativo", status="Pagado",
                shipping_address="Av. Del Ejército 600", shipping_city="MIRAFLORES", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 2, 1, 10, 15, 0), updated_at=datetime(2026, 2, 1, 11, 30, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-027", shopify_order_id="ORD-027",
                customer_email="patricia.gomez@mail.com", customer_name="Patricia Gomez", 
                customer_document_type="6", customer_document_number="20888555666",
                total_price=435.79, currency="PEN",
                line_items=[
                    {"sku": "MIC-BLUE-YETI", "product": "Microphone Blue Yeti", "unitPrice": 129.99, "quantity": 1, "subtotal": 129.99},
                    {"sku": "ARM-MIC-BOOM", "product": "Boom Arm Stand", "unitPrice": 48.95, "quantity": 2, "subtotal": 97.90},
                    {"sku": "FILTER-POP-XLR", "product": "Pop Filter XLR", "unitPrice": 20.79, "quantity": 10, "subtotal": 207.90}
                ], validado=True, validated_at=datetime(2026, 2, 2, 15, 0, 0), payment_method="Credit Card",
                notes=None, status="Pagado",
                shipping_address="Jr. Risso 240", shipping_city="LINCE", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 2, 2, 14, 30, 0), updated_at=datetime(2026, 2, 2, 15, 0, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-028", shopify_order_id="ORD-028",
                customer_email="manuel.reyes@email.com", customer_name="Manuel Reyes", 
                customer_document_type="1", customer_document_number="22334455",
                total_price=625.00, currency="PEN",
                line_items=[
                    {"sku": "WATCH-APL-S9", "product": "Smart Watch Apple Watch", "unitPrice": 399.00, "quantity": 1, "subtotal": 399.00},
                    {"sku": "BAND-WATCH-SP", "product": "Watch Band Sport", "unitPrice": 49.00, "quantity": 2, "subtotal": 98.00},
                    {"sku": "PROT-SCR-GLS", "product": "Screen Protector Glass", "unitPrice": 16.00, "quantity": 8, "subtotal": 128.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Calle Monte Rosa 250", shipping_city="SANTIAGO DE SURCO", shipping_province="LIMA", shipping_country="Peru",
                created_at=datetime(2026, 2, 3, 11, 15, 0), updated_at=datetime(2026, 2, 3, 11, 15, 0)),
            Order(tenant_id=2, shopify_draft_order_id="DFT-029", shopify_order_id=None,
                customer_email="veronica.medina@biz.com", customer_name="Veronica Medina", 
                customer_document_type="6", customer_document_number="20777666555",
                total_price=189.98, currency="PEN",
                line_items=[
                    {"sku": "PWR-BANK-20K", "product": "Power Bank 20000mAh", "unitPrice": 45.99, "quantity": 2, "subtotal": 91.98},
                    {"sku": "CHR-FAST-65W", "product": "Fast Charger 65W GaN", "unitPrice": 49.00, "quantity": 2, "subtotal": 98.00}
                ], validado=False, validated_at=None, payment_method=None,
                notes=None, status="Pendiente",
                shipping_address="Av. Colonial 2300", shipping_city="CALLAO", shipping_province="CALLAO", shipping_country="Peru",
                created_at=datetime(2026, 2, 4, 9, 45, 0), updated_at=datetime(2026, 2, 4, 9, 45, 0)),
            # === Tenant 3 (La dore) ===
            Order(
                tenant_id=3,
                shopify_draft_order_id="123111",
                shopify_order_id="123456784",
                customer_email="juancho@gmail.com",
                customer_name="Juancho Bustamante",
                customer_document_type="1",
                customer_document_number="76310388",
                total_price=100,
                currency="PEN",
                line_items=[
                    {"sku": "ORG-DESK-BAMB", "product": "Desk Organizer Bamboo", "unitPrice": 35.00, "quantity": 2, "subtotal": 70.00},
                    {"sku": "CHR-WRL-PAD", "product": "Wireless Charger Pad", "unitPrice": 30.00, "quantity": 1, "subtotal": 30.00}
                ],
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                expected_delivery_date=datetime(2026, 2, 10, 14, 0, 0),
                dispatch_time_window="09:00-14:00",
                shipping_address="Av. Larco 345",
                shipping_city="MIRAFLORES",
                shipping_province="LIMA",
                shipping_country="Peru",
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
        ]
        db.add_all(orders)
        db.commit()
        print(f"Created {len(orders)} orders")
        
        # ============ SEED INVOICE SERIES ============
        print("\nCreating invoice series...")
        invoice_series = [
            InvoiceSerie(
                tenant_id=3,  # La dore
                invoice_type="03",  # Boleta
                serie="B001",
                description="Serie de boletas para La dore",
                last_correlativo=0,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            InvoiceSerie(
                tenant_id=2,  # Nassau
                invoice_type="03",  # Boleta
                serie="B001",
                description="Serie de boletas para Nassau",
                last_correlativo=11,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
        ]
        db.add_all(invoice_series)
        db.commit()
        print(f"Created {len(invoice_series)} invoice series")
        
        print("\nDatabase seed completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\nError seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
