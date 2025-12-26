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
from app.models.order import Order
from app.models.tenant import Tenant
from app.models.user import User
from app.core.permissions import Role


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
        
        print("🌱 Starting database seed...")
        
        # ============ SEED TENANTS ============
        print("\n📍 Creating tenants...")
        tenants = [
            Tenant(
                id=5,
                name="Nassau",
                slug="nassau-outlet",
                company_id=None,
                shopify_store_url=None,
                shopify_access_token=None,
                shopify_api_version=None,
                is_active=True,
                settings=None,
                created_at=datetime(2025, 12, 24, 12, 27, 59),
                updated_at=datetime(2025, 12, 24, 12, 27, 59),
            ),
            Tenant(
                id=6,
                name="La dore",
                slug="la-dore-outlet",
                company_id=None,
                shopify_store_url=None,
                shopify_access_token=None,
                shopify_api_version=None,
                is_active=True,
                settings=None,
                created_at=datetime(2025, 12, 24, 12, 27, 59),
                updated_at=datetime(2025, 12, 24, 12, 27, 59),
            ),
            Tenant(
                id=7,
                name="Not peppers",
                slug="not-peppers-outlet",
                company_id=None,
                shopify_store_url=None,
                shopify_access_token=None,
                shopify_api_version=None,
                is_active=True,
                settings=None,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
            Tenant(
                id=8,
                name="Lucano",
                slug="lucano-outlet",
                company_id=None,
                shopify_store_url=None,
                shopify_access_token=None,
                shopify_api_version=None,
                is_active=False,
                settings=None,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ),
        ]
        db.add_all(tenants)
        db.commit()
        print(f"✅ Created {len(tenants)} tenants")
        
        # ============ SEED USERS ============
        print("\n👥 Creating users...")
        users = [
            User(
                id=1,
                auth0_user_id="auth0|694b71d6c90e2884d082a568",
                email="renzolenes0@gmail.com",
                name="Renzo Lenes",
                tenant_id=5,
                role=Role.ADMIN,
                is_active=True,
                last_login=datetime(2025, 12, 24, 22, 45, 24, 384000),
                created_at=datetime(2025, 12, 24, 4, 53, 42, 719000),
                updated_at=datetime(2025, 12, 25, 17, 48, 18, 229000),
            ),
            User(
                id=2,
                auth0_user_id="auth0|694c6cd2c1284cca639e207d",
                email="johnsovero@gmail.com",
                name="John Sovero",
                tenant_id=5,
                role=Role.ADMIN,
                is_active=True,
                last_login=datetime(2025, 12, 24, 22, 45, 24, 384000),
                created_at=datetime(2025, 12, 24, 22, 44, 34, 612000),
                updated_at=datetime(2025, 12, 24, 22, 45, 24, 385000),
            ),
            User(
                id=3,
                auth0_user_id="auth0|694c6dc0fc900ddc4668f10c",
                email="pedrito@gmail.com",
                name="Pedrito Uno",
                tenant_id=7,
                role=Role.LOGISTICA,
                is_active=True,
                last_login=datetime(2025, 12, 24, 23, 0, 33, 682000),
                created_at=datetime(2025, 12, 24, 22, 48, 32, 97000),
                updated_at=datetime(2025, 12, 24, 22, 48, 32, 97000),
            ),
            User(
                id=4,
                auth0_user_id="auth0|694c6dd2873030064bddc0c8",
                email="pedrito2@gmail.com",
                name="Pedrito Dos",
                tenant_id=8,
                role=Role.ADMIN,
                is_active=True,
                last_login=datetime(2025, 12, 24, 23, 2, 4, 241000),
                created_at=datetime(2025, 12, 24, 22, 48, 50, 361000),
                updated_at=datetime(2025, 12, 24, 22, 48, 50, 361000),
            ),
        ]
        db.add_all(users)
        db.commit()
        print(f"✅ Created {len(users)} users")
        
        # ============ SEED ORDERS ============
        print("\n📦 Creating orders...")
        orders = [
            Order(
                id=3,
                tenant_id=5,
                shopify_draft_order_id="123123",
                shopify_order_id="123456789",
                customer_email="francisco@gmail.com",
                customer_name="Francisco Perez",
                total_price=1200,
                currency="USD",
                line_items=None,
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                created_at=datetime(2025, 10, 24, 22, 44, 34, 612000),
                updated_at=datetime(2025, 10, 24, 22, 44, 34, 612000),
            ),
            Order(
                id=4,
                tenant_id=5,
                shopify_draft_order_id="123122",
                shopify_order_id="123456788",
                customer_email="juan@gmail.com",
                customer_name="Juan Calvo",
                total_price=850.5,
                currency="USD",
                line_items=None,
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pendiente",
                created_at=datetime(2025, 10, 24, 22, 44, 34, 612000),
                updated_at=datetime(2025, 10, 24, 22, 44, 34, 612000),
            ),
            Order(
                id=5,
                tenant_id=5,
                shopify_draft_order_id="123121",
                shopify_order_id="123456787",
                customer_email="maria@gmail.com",
                customer_name="Maria Lopez",
                total_price=99.00,
                currency="USD",
                line_items=None,
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                created_at=datetime(2025, 10, 25, 9, 15, 10),
                updated_at=datetime(2025, 10, 25, 9, 15, 10),
            ),
            Order(
                id=6,
                tenant_id=5,
                shopify_draft_order_id="123120",
                shopify_order_id="123456786",
                customer_email="pedro@gmail.com",
                customer_name="Pedro Ramirez",
                total_price=149.99,
                currency="USD",
                line_items=None,
                validado=False,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pendiente",
                created_at=datetime(2025, 10, 25, 11, 40, 0),
                updated_at=datetime(2025, 10, 25, 11, 40, 0),
            ),
            Order(
                id=7,
                tenant_id=5,
                shopify_draft_order_id="123119",
                shopify_order_id="123456785",
                customer_email="sofia@gmail.com",
                customer_name="Sofia Torres",
                total_price=299.00,
                currency="USD",
                line_items=None,
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                created_at=datetime(2025, 10, 26, 16, 20, 45, 500000),
                updated_at=datetime(2025, 10, 26, 16, 20, 45, 500000),
            ),
            Order(
                id=8,
                tenant_id=6,
                shopify_draft_order_id="123111",
                shopify_order_id="123456784",
                customer_email="juancho@gmail.com",
                customer_name="Juancho Bustamante",
                total_price=100,
                currency="USD",
                line_items=None,
                validado=True,
                validated_at=None,
                payment_method=None,
                notes=None,
                status="Pagado",
                created_at=datetime(2025, 10, 26, 16, 20, 45, 500000),
                updated_at=datetime(2025, 10, 26, 16, 20, 45, 500000),
            ),
        ]
        db.add_all(orders)
        db.commit()
        print(f"✅ Created {len(orders)} orders")
        
        print("\n✨ Database seed completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
