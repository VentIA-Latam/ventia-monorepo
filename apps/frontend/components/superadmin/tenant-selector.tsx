"use client";

import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TenantOption {
  id: number;
  name: string;
}

interface TenantSelectorProps {
  tenants: TenantOption[];
  value: number | null;
  onChange: (tenantId: number | null) => void;
}

export function TenantSelector({ tenants, value, onChange }: TenantSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={value?.toString() ?? "all"}
        onValueChange={(v) => onChange(v === "all" ? null : parseInt(v))}
      >
        <SelectTrigger className="w-full sm:w-[260px]">
          <SelectValue placeholder="Seleccionar empresa" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tenants</SelectItem>
          {tenants.map((t) => (
            <SelectItem key={t.id} value={t.id.toString()}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
