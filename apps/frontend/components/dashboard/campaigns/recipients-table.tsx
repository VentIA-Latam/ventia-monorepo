"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccessToken } from "@/hooks/use-access-token";
import { fetchCampaignRecipients } from "@/lib/services/campaigns-service";
import type { CampaignRecipient, RecipientStatus } from "@/lib/types/campaign";
import { RecipientStatusPill } from "./recipient-status-pill";

interface Props {
  campaignId: number;
  initialRecipients: CampaignRecipient[];
  initialMeta: { total_count: number; current_page: number; total_pages: number };
}

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos los estados" },
  { value: "failed", label: "Solo fallidos" },
  { value: "omitted", label: "Solo omitidos" },
  { value: "read", label: "Solo leídos" },
  { value: "delivered", label: "Solo entregados" },
  { value: "sent", label: "Solo enviados" },
];

export function RecipientsTable({
  campaignId,
  initialRecipients,
  initialMeta,
}: Props) {
  const accessToken = useAccessToken();
  const [recipients, setRecipients] = useState(initialRecipients);
  const [meta, setMeta] = useState(initialMeta);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!accessToken) return;
    // Skip fetch on initial mount when filters/search are empty (already have data)
    if (page === 1 && !status && !debouncedSearch) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchCampaignRecipients(accessToken, campaignId, {
      page,
      per_page: 25,
      status: status || undefined,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        setRecipients(res.data);
        if (res.meta) {
          setMeta({
            total_count: res.meta.total_count,
            current_page: res.meta.current_page,
            total_pages: res.meta.total_pages,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [accessToken, campaignId, page, status, debouncedSearch]);

  const onFilterChange = (newStatus: string) => {
    setStatus(newStatus);
    setPage(1);
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground tabular-nums">
          Destinatarios ({meta.total_count})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar phone o nombre…"
              className="h-8 pl-8 text-xs w-56"
            />
          </div>
          <select
            value={status}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5">Contacto</th>
              <th className="px-5 py-2.5">Estado</th>
              <th className="px-5 py-2.5">Enviado</th>
              <th className="px-5 py-2.5">Entregado</th>
              <th className="px-5 py-2.5">Leído</th>
              <th className="px-5 py-2.5">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <Row key={r.id} recipient={r} />
            ))}
            {!loading && recipients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sin resultados para los filtros actuales.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span>
          {loading
            ? "Cargando…"
            : `Mostrando ${recipients.length} de ${meta.total_count}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={meta.current_page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2.5 text-xs"
          >
            ← Anterior
          </Button>
          <span className="tabular-nums">
            Página {meta.current_page} de {meta.total_pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={meta.current_page >= meta.total_pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="h-7 px-2.5 text-xs"
          >
            Siguiente →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ recipient: r }: { recipient: CampaignRecipient }) {
  const attention: RecipientStatus[] = ["failed", "omitted"];
  const rowClass = attention.includes(r.status)
    ? "border-b border-border bg-[color-mix(in_oklch,var(--danger-bg)_30%,var(--card))]"
    : "border-b border-border";

  return (
    <tr className={rowClass}>
      <td className="px-5 py-3 align-top">
        <div className="font-medium text-foreground">
          {r.contact_name ?? "Sin nombre"}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {r.phone}
        </div>
      </td>
      <td className="px-5 py-3 align-top">
        <RecipientStatusPill status={r.status} />
      </td>
      <td className="px-5 py-3 align-top text-xs tabular-nums text-muted-foreground">
        {fmt(r.sent_at)}
      </td>
      <td className="px-5 py-3 align-top text-xs tabular-nums text-muted-foreground">
        {fmt(r.delivered_at)}
      </td>
      <td className="px-5 py-3 align-top text-xs tabular-nums text-muted-foreground">
        {fmt(r.read_at)}
      </td>
      <td className="px-5 py-3 align-top">
        {r.external_error ? (
          <span className="text-xs text-[var(--danger)]">{r.external_error}</span>
        ) : r.conversation_id ? (
          <Link
            href={`/dashboard/conversations?id=${r.conversation_id}`}
            className="text-xs font-medium text-volt hover:underline"
          >
            Ver conv. →
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
