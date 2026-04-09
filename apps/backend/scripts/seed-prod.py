"""
Production database seed script - creates only essential platform data.
Run this script to initialize a production database with the platform tenant and superadmin user.

Usage:
    docker exec ventia-backend uv run python scripts/seed-prod.py
    # Or locally:
    python apps/backend/scripts/seed-prod.py
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
from app.models.tenant import Tenant
from app.models.user import User
from app.core.permissions import Role


def seed_production():
    """Seed the database with production data (platform tenant + superadmin)."""

    # Create all tables
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        # Check if platform tenant already exists
        platform_tenant = db.query(Tenant).filter(Tenant.is_platform == True).first()
        if platform_tenant:
            print("⚠️  Platform tenant already exists. Skipping seed...")
            return

        print("🚀 Starting production database seed...")

        # ============ CREATE PLATFORM TENANT ============
        print("\n📦 Creating platform tenant...")
        ventia_tenant = Tenant(
            name="VentIA Platform",
            slug="Ventia",
            company_id=None,
            is_platform=True,  # This is the platform tenant
            is_active=True,
            efact_ruc="20614382741",
            emisor_nombre_comercial="Ventia",
            emisor_ubigeo="150101",
            emisor_departamento="LIMA",
            emisor_provincia="LIMA",
            emisor_distrito="LIMA",
            emisor_direccion="AV. JAVIER PRADO ESTE 4600",
            settings=None,  # Platform tenant - no e-commerce needed
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(ventia_tenant)
        db.commit()
        db.refresh(ventia_tenant)
        print(f"✅ Created platform tenant: {ventia_tenant.name} (ID: {ventia_tenant.id})")

        # ============ CREATE SUPERADMIN USER ============
        print("\n👤 Creating superadmin user...")

        # Note: auth0_user_id should be updated after first login
        # This is a placeholder that will be updated when the user logs in via Auth0
        superadmin = User(
            auth0_user_id="auth0|69803b9d25e3e7f463e4a0b6",  # Will be updated on first login
            email="equipoventia@gmail.com",
            name="Equipo Ventia",
            tenant_id=ventia_tenant.id,
            role=Role.SUPERADMIN,
            is_active=True,
            last_login=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(superadmin)
        db.commit()
        db.refresh(superadmin)
        print(f"✅ Created superadmin user: {superadmin.email} (ID: {superadmin.id})")

        print("\n✨ Production database seed completed successfully!")
        print("\n📝 Next steps:")
        print("   1. User 'equipoventia@gmail.com' should log in via Auth0")
        print("   2. The auth0_user_id will be automatically updated on first login")
        print("   3. Create client tenants via the superadmin panel")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_production()
