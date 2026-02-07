"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BasicInfoSectionProps {
  sellerName: string;
  sellerGender: "masculino" | "femenino" | "no-especificado" | "otro" | "";
  companyName: string;
  operationCountry: string;
  companyDescription: string;
  onSellerNameChange: (value: string) => void;
  onSellerGenderChange: (value: "masculino" | "femenino" | "no-especificado" | "otro" | "") => void;
  onCompanyNameChange: (value: string) => void;
  onOperationCountryChange: (value: string) => void;
  onCompanyDescriptionChange: (value: string) => void;
}

export default function BasicInfoSection({
  sellerName,
  sellerGender,
  companyName,
  operationCountry,
  companyDescription,
  onSellerNameChange,
  onSellerGenderChange,
  onCompanyNameChange,
  onOperationCountryChange,
  onCompanyDescriptionChange,
}: BasicInfoSectionProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-6 h-6 rounded-full border-2 border-aqua flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-aqua"></div>
        </div>
        <h2 className="text-xl font-semibold text-ventia-blue">
          {"Informaci\u00f3n b\u00e1sica"}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Nombre del vendedor
            <span className="text-danger ml-1">*</span>
          </label>
          <input
            type="text"
            value={sellerName}
            onChange={(e) => onSellerNameChange(e.target.value)}
            placeholder="GenAssist"
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {"G\u00e9nero del vendedor"}
            <span className="text-danger ml-1">*</span>
          </label>
          <div className="flex flex-wrap gap-3">
            {[
              { value: "masculino", label: "Masculino" },
              { value: "femenino", label: "Femenino" },
              { value: "no-especificado", label: "No especificado" },
              { value: "otro", label: "Otro" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="sellerGender"
                  value={option.value}
                  checked={sellerGender === option.value}
                  onChange={(e) => onSellerGenderChange(e.target.value as any)}
                  className="w-4 h-4 text-aqua focus:ring-aqua"
                />
                <span className="text-sm text-muted-foreground">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Nombre de la empresa
            <span className="text-danger ml-1">*</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Nicara"
            className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            {"Pa\u00eds de operaci\u00f3n"}
            <span className="text-danger ml-1">*</span>
          </label>
          <Select
            value={operationCountry}
            onValueChange={onOperationCountryChange}
          >
            <SelectTrigger className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted">
              <SelectValue placeholder={"Seleccionar pa\u00eds"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PE">{"\uD83C\uDDF5\uD83C\uDDEA Per\u00fa"}</SelectItem>
              <SelectItem value="MX">{"\uD83C\uDDF2\uD83C\uDDFD M\u00e9xico"}</SelectItem>
              <SelectItem value="CO">{"\uD83C\uDDE8\uD83C\uDDF4 Colombia"}</SelectItem>
              <SelectItem value="AR">{"\uD83C\uDDE6\uD83C\uDDF7 Argentina"}</SelectItem>
              <SelectItem value="CL">{"\uD83C\uDDE8\uD83C\uDDF1 Chile"}</SelectItem>
              <SelectItem value="ES">{"\uD83C\uDDEA\uD83C\uDDF8 Espa\u00f1a"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          {"Descripci\u00f3n de la empresa"}
          <span className="text-danger ml-1">*</span>
        </label>
        <textarea
          value={companyDescription}
          onChange={(e) => onCompanyDescriptionChange(e.target.value)}
          placeholder={"Tienda gen\u00e9rica de productos variados."}
          rows={6}
          className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:border-aqua focus:ring-1 focus:ring-aqua bg-muted"
        />
      </div>
    </div>
  );
}
