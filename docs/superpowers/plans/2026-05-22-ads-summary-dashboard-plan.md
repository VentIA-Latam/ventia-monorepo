# Plan: Resumen de Conversaciones por Anuncio en Dashboard

**Fecha:** 2026-05-22
**Branch sugerido:** `feat/ads-summary-dashboard`
**Spec:** `docs/superpowers/specs/2026-05-22-ads-summary-dashboard-design.md`
**Status:** Listo para ejecutar

## Resumen

Implementación por capas en este orden:

1. **Rails**: ruta + controller + service + spec.
2. **Backend FastAPI**: schemas → repo → cliente HTTP → service → endpoint → permisos → tests.
3. **Frontend**: tipos + fetcher → widget → integración al dashboard.
4. **Smoke test e2e** con datos reales.

Cada paso es funcional por sí solo (compila/lint/test). El paso 2 depende del 1; el paso 3 depende del 2. Los sub-pasos dentro de cada capa son secuenciales internamente pero independientes entre capas (i.e. se puede mergear el PR de Rails y luego trabajar en backend).

---

## Capa 1 — Rails (apps/messaging/)

### Paso 1.1 — Service `Analytics::AdsSummaryService`

**Archivo nuevo:** `apps/messaging/app/services/analytics/ads_summary_service.rb`

```ruby
class Analytics::AdsSummaryService
  def initialize(account:, start_date:, end_date:, converted_conversation_ids:)
    @account = account
    @start_date = start_date
    @end_date = end_date
    @converted_ids = converted_conversation_ids
  end

  def perform
    rows = ActiveRecord::Base.connection.exec_query(
      query_sql,
      'ads_summary',
      binds,
    )
    rows.map { |r| format_row(r) }
  end

  private

  def query_sql
    <<~SQL
      WITH latest_referral AS (
        SELECT DISTINCT ON (content_attributes->'referral'->>'source_id')
          content_attributes->'referral'->>'source_id'  AS ad_id,
          content_attributes->'referral'->>'headline'   AS headline,
          content_attributes->'referral'->>'image_url'  AS image_url,
          content_attributes->'referral'->>'source_url' AS source_url
        FROM messages
        WHERE account_id = $1
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN $2 AND $3
        ORDER BY content_attributes->'referral'->>'source_id', created_at DESC
      ),
      ad_conversations AS (
        SELECT
          content_attributes->'referral'->>'source_id' AS ad_id,
          conversation_id
        FROM messages
        WHERE account_id = $1
          AND content_attributes->'referral'->>'source_id' IS NOT NULL
          AND created_at BETWEEN $2 AND $3
      )
      SELECT
        lr.ad_id, lr.headline, lr.image_url, lr.source_url,
        COUNT(DISTINCT ac.conversation_id) AS started,
        COUNT(DISTINCT ac.conversation_id)
          FILTER (WHERE ac.conversation_id = ANY($4)) AS converted
      FROM latest_referral lr
      JOIN ad_conversations ac USING (ad_id)
      GROUP BY lr.ad_id, lr.headline, lr.image_url, lr.source_url
      ORDER BY started DESC;
    SQL
  end

  def binds
    [
      ActiveRecord::Relation::QueryAttribute.new('account_id', @account.id, ActiveRecord::Type::Integer.new),
      ActiveRecord::Relation::QueryAttribute.new('start_date', @start_date, ActiveRecord::Type::DateTime.new),
      ActiveRecord::Relation::QueryAttribute.new('end_date', @end_date, ActiveRecord::Type::DateTime.new),
      ActiveRecord::Relation::QueryAttribute.new('converted_ids', "{#{@converted_ids.join(',')}}", ActiveRecord::Type::String.new),
    ]
  end

  def format_row(r)
    {
      ad_id: r['ad_id'],
      headline: r['headline'],
      image_url: r['image_url'],
      source_url: r['source_url'],
      started: r['started'].to_i,
      converted: r['converted'].to_i,
    }
  end
end
```

**Criterio de éxito:** archivo cargado sin error en consola Rails (`rails c` → `Analytics::AdsSummaryService`).

---

### Paso 1.2 — Action en controller existente

**Archivo:** `apps/messaging/app/controllers/api/v1/analytics/conversations_controller.rb`

Agregar action al final de la clase (siguiendo el patrón de `no_purchase_reasons`):

```ruby
def ads_summary
  start_date = params[:start_date]
  end_date = params[:end_date]
  converted_ids = Array(params[:converted_conversation_ids]).map(&:to_i)

  if start_date.blank? || end_date.blank?
    render json: { success: false, error: 'start_date and end_date are required' }, status: :bad_request
    return
  end

  ads = Analytics::AdsSummaryService.new(
    account: current_account,
    start_date: start_date,
    end_date: end_date,
    converted_conversation_ids: converted_ids,
  ).perform

  render json: { success: true, data: { ads: ads } }
end
```

**Criterio de éxito:** linting Rubocop pasa.

---

### Paso 1.3 — Ruta nueva

**Archivo:** `apps/messaging/config/routes.rb`

Dentro del `namespace :analytics` existente, agregar:

```ruby
post 'ads_summary', to: 'conversations#ads_summary'
```

**Criterio de éxito:**
- `bundle exec rails routes | grep ads_summary` muestra `POST /api/v1/analytics/ads_summary`.

---

### Paso 1.4 — Spec del service

**Archivo nuevo:** `apps/messaging/spec/services/analytics/ads_summary_service_spec.rb`

```ruby
require 'rails_helper'

RSpec.describe Analytics::AdsSummaryService do
  let(:account) { create(:account) }
  let(:inbox) { create(:inbox, account: account) }
  let(:start_date) { 7.days.ago }
  let(:end_date) { Time.current }

  def referral_attrs(source_id, headline = 'Test ad', image_url = 'https://img.test/x.png')
    {
      'referral' => {
        'source_id' => source_id,
        'headline' => headline,
        'image_url' => image_url,
        'source_url' => 'https://fb.me/x',
        'source_type' => 'ad',
        'media_type' => 'image',
      },
    }
  end

  describe '#perform' do
    it 'aggregates conversations by ad_id with started and converted counts' do
      conv1 = create(:conversation, account: account, inbox: inbox)
      conv2 = create(:conversation, account: account, inbox: inbox)
      conv3 = create(:conversation, account: account, inbox: inbox)

      create(:message, account: account, conversation: conv1, content_attributes: referral_attrs('ad_A'))
      create(:message, account: account, conversation: conv2, content_attributes: referral_attrs('ad_A'))
      create(:message, account: account, conversation: conv3, content_attributes: referral_attrs('ad_B'))

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [conv1.id, conv3.id],
      ).perform

      ad_a = result.find { |r| r[:ad_id] == 'ad_A' }
      ad_b = result.find { |r| r[:ad_id] == 'ad_B' }

      expect(ad_a[:started]).to eq(2)
      expect(ad_a[:converted]).to eq(1)
      expect(ad_b[:started]).to eq(1)
      expect(ad_b[:converted]).to eq(1)
    end

    it 'returns latest referral metadata when ad_id has multiple creatives' do
      conv = create(:conversation, account: account, inbox: inbox)

      create(:message, account: account, conversation: conv,
             content_attributes: referral_attrs('ad_X', 'Old headline'),
             created_at: 5.days.ago)
      create(:message, account: account, conversation: conv,
             content_attributes: referral_attrs('ad_X', 'New headline'),
             created_at: 1.day.ago)

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [],
      ).perform

      expect(result.first[:headline]).to eq('New headline')
    end

    it 'handles empty converted_conversation_ids' do
      conv = create(:conversation, account: account, inbox: inbox)
      create(:message, account: account, conversation: conv, content_attributes: referral_attrs('ad_Z'))

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [],
      ).perform

      expect(result.first[:converted]).to eq(0)
    end

    it 'excludes messages outside the date range' do
      conv = create(:conversation, account: account, inbox: inbox)
      create(:message, account: account, conversation: conv,
             content_attributes: referral_attrs('ad_old'),
             created_at: 30.days.ago)

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [],
      ).perform

      expect(result).to be_empty
    end

    it 'excludes messages without referral' do
      conv = create(:conversation, account: account, inbox: inbox)
      create(:message, account: account, conversation: conv, content_attributes: {})

      result = described_class.new(
        account: account,
        start_date: start_date,
        end_date: end_date,
        converted_conversation_ids: [],
      ).perform

      expect(result).to be_empty
    end
  end
end
```

**Criterio de éxito:**
- `cd apps/messaging && bundle exec rspec spec/services/analytics/ads_summary_service_spec.rb` pasa.

---

## Capa 2 — Backend FastAPI (apps/backend/)

### Paso 2.1 — Schemas Pydantic

**Archivo:** `apps/backend/app/schemas/metrics.py`

Agregar al final del archivo:

```python
class AdSummaryItem(BaseModel):
    ad_id: str = Field(description="Meta ad_id from referral.source_id")
    headline: str | None = Field(default=None, description="Most recent ad headline")
    image_url: str | None = Field(default=None, description="Most recent ad creative URL")
    source_url: str | None = Field(default=None, description="Short link to ad (fb.me/...)")
    conversations_started: int
    conversations_converted: int
    conversion_rate: float = Field(description="Percentage 0-100")


class AdsSummaryResponse(BaseModel):
    ads: list[AdSummaryItem]
    total_ads: int
    period: PeriodInfo
```

**Criterio de éxito:** `cd apps/backend && uv run ruff check app/schemas/metrics.py` pasa.

---

### Paso 2.2 — Método de repositorio

**Archivo:** `apps/backend/app/repositories/metrics.py`

Agregar al final de la clase del repository (después de `get_converted_conversations_count`):

```python
def get_validated_order_conversation_ids(
    self,
    db: Session,
    tenant_id: int,
    start: datetime,
    end: datetime,
) -> list[int]:
    rows = (
        db.query(distinct(Order.messaging_conversation_id))
        .filter(
            Order.tenant_id == tenant_id,
            Order.validado.is_(True),
            Order.validated_at >= start,
            Order.validated_at <= end,
            Order.messaging_conversation_id.isnot(None),
        )
        .all()
    )
    return [r[0] for r in rows]
```

**Criterio de éxito:** `uv run ruff check app/repositories/metrics.py` pasa.

---

### Paso 2.3 — Cliente HTTP en `messaging_service`

**Archivo:** `apps/backend/app/services/messaging_service.py`

Agregar método siguiendo el patrón de `get_no_purchase_reasons` (alrededor de las líneas 674-686):

```python
async def get_ads_summary(
    self,
    tenant_id: int,
    start_date: str,
    end_date: str,
    converted_conversation_ids: list[int],
) -> dict:
    return await self._request_with_status(
        "POST",
        "/api/v1/analytics/ads_summary",
        tenant_id,
        json={
            "start_date": start_date,
            "end_date": end_date,
            "converted_conversation_ids": converted_conversation_ids,
        },
        timeout=15.0,
    )
```

**Nota:** verificar que `_request_with_status` soporta `json=` body para POST. Si sólo soporta `params=`, agregar soporte mínimo (kwarg pasado a httpx). Inspeccionar implementación existente.

**Criterio de éxito:** `uv run ruff check app/services/messaging_service.py` pasa.

---

### Paso 2.4 — Método en `metrics_service`

**Archivo:** `apps/backend/app/services/metrics.py`

Agregar método siguiendo el patrón de `get_no_purchase_reasons` (alrededor de líneas 186-247):

```python
async def get_ads_summary(
    self,
    db: Session,
    tenant_id: int,
    query: MetricsQuery,
    tz_name: str,
) -> dict:
    start, end = resolve_period(query, tz_name)

    converted_ids = metrics_repo.get_validated_order_conversation_ids(
        db, tenant_id, start, end,
    )

    rails_response = await messaging_service.get_ads_summary(
        tenant_id=tenant_id,
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        converted_conversation_ids=converted_ids,
    )

    ads = []
    for row in rails_response.get("data", {}).get("ads", []):
        started = row["started"]
        converted = row["converted"]
        rate = (converted / started * 100) if started > 0 else 0.0
        ads.append(
            {
                "ad_id": row["ad_id"],
                "headline": row.get("headline"),
                "image_url": row.get("image_url"),
                "source_url": row.get("source_url"),
                "conversations_started": started,
                "conversations_converted": converted,
                "conversion_rate": round(rate, 2),
            }
        )

    return {
        "ads": ads,
        "total_ads": len(ads),
        "period": {
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
        },
    }
```

**Criterio de éxito:** `uv run ruff check app/services/metrics.py` pasa.

---

### Paso 2.5 — Endpoint

**Archivo:** `apps/backend/app/api/v1/endpoints/metrics.py`

Agregar al final del archivo (después de `no-purchase-reasons`):

```python
@router.get("/ads-summary", response_model=AdsSummaryResponse)
async def get_ads_summary(
    period: PeriodType = Query("last_30_days"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(require_permission_dual("GET", "/metrics/*")),
    db: Session = Depends(get_database),
) -> AdsSummaryResponse:
    query = MetricsQuery(
        period=period, start_date=start_date, end_date=end_date,
    )
    tz_name = _get_tenant_timezone(db, current_user.tenant_id)
    result = await metrics_service.get_ads_summary(
        db, current_user.tenant_id, query, tz_name=tz_name,
    )
    return AdsSummaryResponse(**result)
```

Asegurarse de importar `AdsSummaryResponse` desde `app.schemas.metrics`.

**Criterio de éxito:** `uv run uvicorn app.main:app --reload` arranca sin errores y `GET /docs` muestra el nuevo endpoint.

---

### Paso 2.6 — Permisos

**Archivo:** `apps/backend/app/core/permissions.py`

Buscar la sección que define permisos para `GET /metrics/*` o para `/metrics/conversion-rate`. Agregar `/metrics/ads-summary` a la lista de paths permitidos para los roles `SUPERADMIN`, `ADMIN`, `VENTAS`.

**Criterio de éxito:** la matriz de permisos incluye el nuevo endpoint. Test del paso 2.7 cubre el caso `VIEWER → 403`.

---

### Paso 2.7 — Tests backend

**Archivo nuevo:** `apps/backend/tests/test_metrics_ads_summary.py`

```python
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


class TestAdsSummary:
    """Tests for GET /metrics/ads-summary (US-ADS-001)."""

    @pytest.fixture
    def mock_rails_response(self):
        return {
            "success": True,
            "data": {
                "ads": [
                    {
                        "ad_id": "120243814566250320",
                        "headline": "Tu descanso no espera",
                        "image_url": "https://img.test/a.png",
                        "source_url": "https://fb.me/x",
                        "started": 5,
                        "converted": 3,
                    }
                ]
            },
        }

    def test_ads_summary_empty_returns_empty_list(self, client: TestClient, auth_headers):
        with patch(
            "app.services.metrics.messaging_service.get_ads_summary",
            new=AsyncMock(return_value={"success": True, "data": {"ads": []}}),
        ):
            response = client.get(
                "/api/v1/metrics/ads-summary?period=last_30_days",
                headers=auth_headers,
            )
        assert response.status_code == 200
        body = response.json()
        assert body["ads"] == []
        assert body["total_ads"] == 0

    def test_ads_summary_calculates_rate_correctly(
        self, client: TestClient, auth_headers, mock_rails_response
    ):
        with patch(
            "app.services.metrics.messaging_service.get_ads_summary",
            new=AsyncMock(return_value=mock_rails_response),
        ):
            response = client.get(
                "/api/v1/metrics/ads-summary?period=last_30_days",
                headers=auth_headers,
            )
        assert response.status_code == 200
        ad = response.json()["ads"][0]
        assert ad["conversations_started"] == 5
        assert ad["conversations_converted"] == 3
        assert ad["conversion_rate"] == 60.0

    def test_ads_summary_handles_zero_started(self, client: TestClient, auth_headers):
        payload = {
            "success": True,
            "data": {
                "ads": [
                    {
                        "ad_id": "x",
                        "headline": None,
                        "image_url": None,
                        "source_url": None,
                        "started": 0,
                        "converted": 0,
                    }
                ]
            },
        }
        with patch(
            "app.services.metrics.messaging_service.get_ads_summary",
            new=AsyncMock(return_value=payload),
        ):
            response = client.get(
                "/api/v1/metrics/ads-summary?period=last_30_days",
                headers=auth_headers,
            )
        assert response.status_code == 200
        ad = response.json()["ads"][0]
        assert ad["conversion_rate"] == 0.0

    def test_ads_summary_requires_permission(
        self, client: TestClient, viewer_auth_headers
    ):
        response = client.get(
            "/api/v1/metrics/ads-summary?period=last_30_days",
            headers=viewer_auth_headers,
        )
        assert response.status_code == 403

    def test_ads_summary_filters_validated_orders_by_tenant(
        self, client: TestClient, auth_headers, db_session, mock_tenant, other_tenant
    ):
        # Crear orders: una validada del tenant correcto, otra de tenant distinto
        # (depende de fixtures locales — adaptar a conftest.py existente)
        # Verificar que sólo conv_ids del tenant correcto se pasan a Rails
        captured_call = {}

        async def fake_get_ads_summary(**kwargs):
            captured_call.update(kwargs)
            return {"success": True, "data": {"ads": []}}

        with patch(
            "app.services.metrics.messaging_service.get_ads_summary",
            side_effect=fake_get_ads_summary,
        ):
            client.get(
                "/api/v1/metrics/ads-summary?period=last_30_days",
                headers=auth_headers,
            )

        # Asegurar que ningún conv_id del otro tenant aparece
        conv_ids = captured_call.get("converted_conversation_ids", [])
        # Los IDs de other_tenant.orders.messaging_conversation_id no deben estar
        # (validar contra fixtures concretas del conftest)
```

**Nota:** los fixtures `client`, `auth_headers`, `viewer_auth_headers`, `db_session`, `mock_tenant` provienen de `tests/conftest.py`. Adaptar al estilo existente del proyecto inspeccionando `test_metrics.py` o similar para alinear patrones.

**Criterio de éxito:**
- `cd apps/backend && uv run pytest tests/test_metrics_ads_summary.py -v` pasa.
- `uv run pytest` (suite completa) no rompe nada existente.

---

## Capa 3 — Frontend (apps/frontend/)

### Paso 3.1 — Tipos y fetcher

**Archivo:** `apps/frontend/lib/services/metrics-service.ts`

Agregar al final del archivo (después de la sección de no-purchase-reasons):

```ts
// --- Ads Summary ---

export interface AdSummaryItem {
  ad_id: string;
  headline: string | null;
  image_url: string | null;
  source_url: string | null;
  conversations_started: number;
  conversations_converted: number;
  conversion_rate: number;
}

export interface AdsSummaryResponse {
  ads: AdSummaryItem[];
  total_ads: number;
  period: { start_date: string; end_date: string };
}

export async function fetchAdsSummary(
  accessToken: string,
  params: { period?: string; start_date?: string; end_date?: string },
): Promise<AdsSummaryResponse> {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  const url = `${API_URL}/metrics/ads-summary?${search}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch ads summary' }));
    throw new Error(error.detail || 'Failed to fetch ads summary');
  }

  return response.json();
}
```

**Criterio de éxito:**
- `cd apps/frontend && pnpm tsc --noEmit` pasa.
- `pnpm lint` pasa.

---

### Paso 3.2 — Widget `ads-summary-widget.tsx`

**Archivo nuevo:** `apps/frontend/components/dashboard/ads-summary-widget.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ImageOff, Megaphone } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdSummaryItem } from "@/lib/services/metrics-service";

type SortKey = "started" | "rate";
type SortDir = "asc" | "desc";

export function AdsSummaryWidget({
  ads,
  isLoading = false,
}: {
  ads: AdSummaryItem[];
  isLoading?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("started");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedAds = useMemo(() => {
    const copy = [...ads];
    copy.sort((a, b) => {
      const av = sortKey === "started" ? a.conversations_started : a.conversion_rate;
      const bv = sortKey === "started" ? b.conversations_started : b.conversion_rate;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return copy;
  }, [ads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" aria-hidden />
          Performance por anuncio
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : ads.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("started")}
                    className={cn(
                      "hover:underline",
                      sortKey === "started" && "font-semibold",
                    )}
                  >
                    Iniciadas {sortKey === "started" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </TableHead>
                <TableHead className="text-right">Convertidas</TableHead>
                <TableHead className="text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("rate")}
                    className={cn(
                      "hover:underline",
                      sortKey === "rate" && "font-semibold",
                    )}
                  >
                    Tasa {sortKey === "rate" ? (sortDir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAds.map((ad) => (
                <AdRow key={ad.ad_id} ad={ad} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AdRow({ ad }: { ad: AdSummaryItem }) {
  const [imgError, setImgError] = useState(false);
  const showImage = ad.image_url && !imgError;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {showImage ? (
              <Image
                src={ad.image_url!}
                alt={ad.headline ?? ad.ad_id}
                fill
                sizes="48px"
                unoptimized
                onError={() => setImgError(true)}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {ad.headline ?? "Anuncio sin título"}
            </p>
            {ad.source_url && (
              <a
                href={ad.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline"
              >
                Ver en Meta
              </a>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {ad.conversations_started}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {ad.conversations_converted}
      </TableCell>
      <TableCell className="text-right">
        <RatePill rate={ad.conversion_rate} />
      </TableCell>
    </TableRow>
  );
}

function RatePill({ rate }: { rate: number }) {
  const color =
    rate >= 50
      ? "bg-emerald-100 text-emerald-700"
      : rate >= 20
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        color,
      )}
    >
      {rate.toFixed(1)}%
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Megaphone className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Aún no hay conversaciones iniciadas desde anuncios de Meta en este período.
      </p>
      <Button variant="outline" size="sm" asChild>
        <a
          href="https://business.facebook.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Conecta Meta Ads
        </a>
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
```

**Criterio de éxito:**
- `pnpm tsc --noEmit` pasa.
- `pnpm lint` pasa.

---

### Paso 3.3 — Integración al dashboard

**Archivos:**
- `apps/frontend/app/dashboard/page.tsx` (server component que hace fetch)
- `apps/frontend/app/dashboard/dashboard-client.tsx` (client component que renderiza)

**Cambios en `page.tsx`:** sumar `fetchAdsSummary` al `Promise.allSettled` existente. Pasar el resultado (o array vacío en caso de error) al client component. Patrón idéntico al de `no-purchase-reasons`.

```ts
// Junto a los otros fetches existentes
const [ /* ... existentes ... */, adsSummaryResult ] = await Promise.allSettled([
  // ... existentes,
  fetchAdsSummary(accessToken, { period: 'last_30_days' }),
]);

const adsSummary = adsSummaryResult.status === 'fulfilled'
  ? adsSummaryResult.value.ads
  : [];

return <DashboardClient /* ... */ adsSummary={adsSummary} />;
```

**Cambios en `dashboard-client.tsx`:** agregar prop `adsSummary` y renderizar `<AdsSummaryWidget />` en una nueva fila del grid (siguiendo el layout actual de los otros widgets).

```tsx
import { AdsSummaryWidget } from "@/components/dashboard/ads-summary-widget";

// ... en el JSX, en la fila apropiada del grid:
<AdsSummaryWidget ads={adsSummary} />
```

**Criterio de éxito:**
- `pnpm tsc --noEmit` pasa.
- `pnpm lint` pasa.
- `pnpm build` completa sin errores.

---

## Capa 4 — Smoke test e2e

### Paso 4.1 — Verificación con datos reales

Con servicios corriendo (`pnpm docker:up` o `pnpm dev`):

1. Identificar al menos una conversación de prueba con `messages.content_attributes->'referral'->>'source_id'` no nulo (puede sembrarse via SQL si es necesario).
2. Asegurar que al menos una de esas conversaciones tiene una orden validada (`orders.validado = true`, `orders.messaging_conversation_id` apuntando a la conversación, `orders.validated_at` dentro del rango).
3. Loguear al dashboard.
4. Verificar que el widget renderiza la fila esperada con miniatura, headline, counts y tasa correctos.
5. Verificar empty state: cambiar rango a uno sin datos.
6. Verificar fallback de imagen: invalidar manualmente `image_url` y refrescar.

**Criterio de éxito:** widget se ve correcto en navegador (Chrome/Safari), sin errores en consola.

---

## Checklist final

- [ ] Capa 1 (Rails) PR creado y aprobado
- [ ] Capa 2 (Backend) PR creado y aprobado
- [ ] Capa 3 (Frontend) PR creado y aprobado
- [ ] Smoke test e2e pasado
- [ ] Tarea ClickUp "Resumido de conversaciones x anuncio" movida a Done
