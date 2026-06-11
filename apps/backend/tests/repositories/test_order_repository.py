"""
Tests for OrderRepository filtering, focused on the messaging_conversation_id
filter used to list orders linked to a conversation.

Uses an in-memory SQLite session so the filter logic runs against a real query.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Importing the models package registers every model on Base.metadata.
from app.models import Base, Order
from app.models.invoice import Invoice
from app.repositories.order import order_repository

# Tenant rows are not created: SQLite does not enforce foreign keys by default,
# and the conversation filter never joins the tenants table. Using bare tenant_id
# integers keeps the fixture free of Tenant's many NOT NULL emisor_* columns.
TENANT_A = 1
TENANT_B = 2


@pytest.fixture
def db():
    """In-memory SQLite session with all tables created."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Create only the tables this repository touches. Creating the full metadata
    # would pull in Postgres-only types (e.g. webhook_events.payload JSONB) that
    # SQLite cannot compile when the whole test suite is loaded.
    tables = [Order.__table__, Invoice.__table__]
    Base.metadata.create_all(engine, tables=tables)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine, tables=tables)


@pytest.fixture
def seeded(db):
    """Orders across two tenants linked to different conversations."""
    orders = [
        # tenant A, conversation 100 (two orders)
        Order(tenant_id=TENANT_A, customer_email="a1@x.com", total_price=10,
              currency="PEN", status="Pendiente", messaging_conversation_id=100),
        Order(tenant_id=TENANT_A, customer_email="a2@x.com", total_price=20,
              currency="PEN", status="Pagado", validado=True, messaging_conversation_id=100),
        # tenant A, conversation 200
        Order(tenant_id=TENANT_A, customer_email="a3@x.com", total_price=30,
              currency="PEN", status="Pendiente", messaging_conversation_id=200),
        # tenant A, no conversation link
        Order(tenant_id=TENANT_A, customer_email="a4@x.com", total_price=40,
              currency="PEN", status="Pendiente", messaging_conversation_id=None),
        # tenant B, SAME conversation id 100 (tenant isolation check)
        Order(tenant_id=TENANT_B, customer_email="b1@x.com", total_price=50,
              currency="PEN", status="Pendiente", messaging_conversation_id=100),
    ]
    db.add_all(orders)
    db.commit()
    return {"tenant_a": TENANT_A, "tenant_b": TENANT_B}


class TestOrderRepositoryConversationFilter:
    """get_all / count_all filter by messaging_conversation_id."""

    def test_get_all_filters_by_conversation(self, db, seeded):
        """Only orders linked to the given conversation are returned."""
        result = order_repository.get_all(db, messaging_conversation_id=100)
        # tenant A (2) + tenant B (1) all share conversation 100
        assert len(result) == 3
        assert all(o.messaging_conversation_id == 100 for o in result)

    def test_get_all_respects_tenant_isolation(self, db, seeded):
        """Combining tenant_id with the conversation filter isolates by tenant."""
        result = order_repository.get_all(
            db, tenant_id=seeded["tenant_a"], messaging_conversation_id=100
        )
        assert len(result) == 2
        assert {o.customer_email for o in result} == {"a1@x.com", "a2@x.com"}

    def test_get_all_unknown_conversation_returns_empty(self, db, seeded):
        """A conversation with no linked orders returns an empty list."""
        result = order_repository.get_all(db, messaging_conversation_id=999)
        assert result == []

    def test_get_all_without_filter_unchanged(self, db, seeded):
        """Omitting the filter returns every order (no regression)."""
        result = order_repository.get_all(db, tenant_id=seeded["tenant_a"])
        assert len(result) == 4

    def test_count_all_filters_by_conversation(self, db, seeded):
        """count_all applies the same conversation filter as get_all."""
        count = order_repository.count_all(
            db, tenant_id=seeded["tenant_a"], messaging_conversation_id=100
        )
        assert count == 2

    def test_count_all_cross_tenant_matches_get_all(self, db, seeded):
        """Without tenant_id, count_all sees the same cross-tenant set as get_all."""
        count = order_repository.count_all(db, messaging_conversation_id=100)
        result = order_repository.get_all(db, messaging_conversation_id=100)
        assert count == 3
        assert count == len(result)

    def test_count_and_get_all_parity_with_combined_filters(self, db, seeded):
        """count_all and len(get_all) stay in sync for an identical filter set.

        Guards against a future filter added to one method but not the other,
        which would silently desync pagination total vs items.
        """
        filters = {
            "tenant_id": seeded["tenant_a"],
            "messaging_conversation_id": 100,
            "status": "Pagado",
        }
        assert order_repository.count_all(db, **filters) == len(
            order_repository.get_all(db, **filters)
        )

    def test_conversation_filter_combined_with_status(self, db, seeded):
        """Conversation filter ANDs with status (does not replace it)."""
        result = order_repository.get_all(
            db, messaging_conversation_id=100, status="Pagado"
        )
        assert len(result) == 1
        assert result[0].customer_email == "a2@x.com"

    def test_conversation_filter_combined_with_validado(self, db, seeded):
        """Conversation filter ANDs with the validado flag."""
        result = order_repository.get_all(
            db, messaging_conversation_id=100, validado=True
        )
        assert len(result) == 1
        assert result[0].customer_email == "a2@x.com"
