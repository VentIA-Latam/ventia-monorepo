"""
Tests for metrics repository.
"""

from unittest.mock import MagicMock

import pytest

from app.repositories.metrics import metrics_repository


class TestGetTopProducts:
    """Tests for metrics_repository.get_top_products."""

    @pytest.fixture
    def mock_db(self) -> MagicMock:
        """Mock DB session with empty execute result by default."""
        db = MagicMock()
        db.execute.return_value = iter([])
        return db

    def test_query_excludes_products_with_zero_revenue(self, mock_db: MagicMock):
        """
        Excluye productos cuyo SUM(subtotal) agrupado sea 0
        mediante HAVING en la query SQL.
        """
        metrics_repository.get_top_products(
            db=mock_db,
            tenant_id=1,
            period="last_30_days",
        )

        executed_sql = str(mock_db.execute.call_args.args[0])

        assert "HAVING" in executed_sql
        assert "SUM((item->>'subtotal')::float)" in executed_sql
        assert "> 0" in executed_sql

    def test_returns_only_products_returned_by_db(self, mock_db: MagicMock):
        """
        El repositorio confía en el filtro SQL: si la DB ya excluye
        revenue=0 vía HAVING, el resultado no debe contener esos productos.
        """
        mock_db.execute.return_value = iter([
            ("Producto A", 5, 500.0),
            ("Producto B", 3, 300.0),
        ])

        result = metrics_repository.get_top_products(
            db=mock_db,
            tenant_id=1,
            period="last_30_days",
        )

        assert len(result) == 2
        assert all(p["total_revenue"] > 0 for p in result)
        assert result[0] == {"product": "Producto A", "total_sold": 5, "total_revenue": 500.0}
