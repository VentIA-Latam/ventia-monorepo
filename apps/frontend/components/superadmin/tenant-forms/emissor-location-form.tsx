"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface EmissorLocationValues {
  emisor_ubigeo: string;
  emisor_departamento: string;
  emisor_provincia: string;
  emisor_distrito: string;
  emisor_direccion: string;
}

export interface EmissorLocationFormProps {
  values: EmissorLocationValues;
  onChange: (values: EmissorLocationValues) => void;
  /** HTML id prefix for field elements */
  idPrefix?: string;
  /** Spacing class used between fields. Defaults to "space-y-2" */
  fieldSpacing?: string;
  /** Gap class for the 3-col grid. Defaults to "gap-4" */
  gridGap?: string;
}

export function EmissorLocationForm({
  values,
  onChange,
  idPrefix = "",
  fieldSpacing = "space-y-2",
  gridGap = "gap-4",
}: EmissorLocationFormProps) {
  const prefix = idPrefix ? `${idPrefix}-` : "";

  return (
    <>
      {/* UBIGEO */}
      <div className={fieldSpacing}>
        <Label htmlFor={`${prefix}emisor_ubigeo`} className="flex items-center gap-2">
          Código UBIGEO
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="inline-block w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Código UBIGEO de 6 dígitos según INEI (Ej: 150101 para Lima)</p>
            </TooltipContent>
          </Tooltip>
        </Label>
        <Input
          id={`${prefix}emisor_ubigeo`}
          value={values.emisor_ubigeo}
          onChange={(e) => onChange({ ...values, emisor_ubigeo: e.target.value })}
          placeholder="150101"
          maxLength={6}
        />
      </div>

      {/* Grid 3 columnas: Departamento, Provincia, Distrito */}
      <div className={`grid grid-cols-3 ${gridGap}`}>
        <div className={fieldSpacing}>
          <Label htmlFor={`${prefix}emisor_departamento`}>Departamento</Label>
          <Input
            id={`${prefix}emisor_departamento`}
            value={values.emisor_departamento}
            onChange={(e) => onChange({ ...values, emisor_departamento: e.target.value })}
            placeholder="LIMA"
          />
        </div>

        <div className={fieldSpacing}>
          <Label htmlFor={`${prefix}emisor_provincia`}>Provincia</Label>
          <Input
            id={`${prefix}emisor_provincia`}
            value={values.emisor_provincia}
            onChange={(e) => onChange({ ...values, emisor_provincia: e.target.value })}
            placeholder="LIMA"
          />
        </div>

        <div className={fieldSpacing}>
          <Label htmlFor={`${prefix}emisor_distrito`}>Distrito</Label>
          <Input
            id={`${prefix}emisor_distrito`}
            value={values.emisor_distrito}
            onChange={(e) => onChange({ ...values, emisor_distrito: e.target.value })}
            placeholder="LIMA"
          />
        </div>
      </div>

      {/* Dirección */}
      <div className={fieldSpacing}>
        <Label htmlFor={`${prefix}emisor_direccion`}>Dirección Fiscal</Label>
        <Input
          id={`${prefix}emisor_direccion`}
          value={values.emisor_direccion}
          onChange={(e) => onChange({ ...values, emisor_direccion: e.target.value })}
          placeholder="Av. Ejemplo 123, Lima, Perú"
        />
      </div>
    </>
  );
}
