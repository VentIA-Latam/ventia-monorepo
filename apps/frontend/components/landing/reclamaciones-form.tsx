"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { code: "+51",  label: "PE +51" },
  { code: "+54",  label: "AR +54" },
  { code: "+55",  label: "BR +55" },
  { code: "+56",  label: "CL +56" },
  { code: "+57",  label: "CO +57" },
  { code: "+52",  label: "MX +52" },
  { code: "+58",  label: "VE +58" },
  { code: "+593", label: "EC +593" },
  { code: "+591", label: "BO +591" },
  { code: "+595", label: "PY +595" },
  { code: "+598", label: "UY +598" },
  { code: "+1",   label: "US +1" },
  { code: "+34",  label: "ES +34" },
  { code: "+44",  label: "GB +44" },
];

const schema = z.object({
  nombre: z.string().min(3, "Ingresa tu nombre completo"),
  dni: z.string().min(6, "Documento inválido").max(20, "Documento inválido"),
  domicilio: z.string().optional(),
  correo: z.string().email("Correo electrónico inválido"),
  codigoPais: z.string(),
  telefono: z.string().regex(/^\d{7,15}$/, "Solo dígitos, sin espacios ni guiones"),
  menorDeEdad: z.enum(["si", "no"], { error: "Selecciona una opción" }),
  tipoProducto: z.enum(["producto", "servicio"], { error: "Selecciona una opción" }),
  montoReclamado: z.string().optional(),
  productoEntregado: z.enum(["si", "no"], { error: "Selecciona una opción" }),
  descripcionBien: z.string().optional(),
  tipoRegistro: z.enum(["reclamo", "queja", "felicitacion"], { error: "Selecciona una opción" }),
  detalle: z.string().min(20, "Describe el hecho con al menos 20 caracteres"),
  pedidoConsumidor: z.string().min(10, "Indica tu pedido con al menos 10 caracteres"),
  declaracionVeracidad: z.boolean().refine((v) => v === true, {
    message: "Debes aceptar la declaración de veracidad",
  }),
  firmaDigital: z.string().min(3, "Ingresa tu nombre completo como firma"),
});

type FormData = z.infer<typeof schema>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1 text-xs text-red-500">{message}</p>;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-[#0b7fad] pl-3 mb-4">
      <h3 className="font-semibold text-[#182432] text-sm uppercase tracking-wide">{children}</h3>
    </div>
  );
}

function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const errorId = `error-${name}`;
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{legend}</legend>
      <div className="flex gap-6" role="radiogroup" aria-describedby={error ? errorId : undefined}>
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              aria-required="true"
              className="peer sr-only"
            />
            <span className="relative w-[18px] h-[18px] rounded-full border-2 border-gray-300 bg-white transition-colors peer-checked:border-[#0b7fad] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0b7fad]/40 group-hover:border-gray-400 before:content-[''] before:absolute before:inset-[3px] before:rounded-full before:bg-[#0b7fad] before:opacity-0 before:transition-opacity peer-checked:before:opacity-100" />
            <span className="text-sm text-gray-700">{opt.label}</span>
          </label>
        ))}
      </div>
      {error && <p id={errorId} role="alert" className="text-xs text-red-500">{error}</p>}
    </fieldset>
  );
}

export default function ReclamacionesForm() {
  const [submitted, setSubmitted] = useState(false);
  const [refNumber, setRefNumber] = useState("");
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { codigoPais: "+51" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await fetch("/api/reclamaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      let json: { error?: string; ref?: string } = {};
      try {
        json = await res.json();
      } catch {
        throw new Error("Error de conexión. Intenta nuevamente.");
      }

      if (!res.ok) {
        throw new Error(json.error || "Error al enviar el formulario");
      }

      setRefNumber(json.ref ?? "");
      setSubmitted(true);
    } catch (err) {
      toast({
        title: "Error al enviar",
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-libre font-bold text-[#182432] mb-3">
          Registro recibido
        </h2>
        <p className="text-gray-600 max-w-md mb-2">
          Tu registro ha sido enviado correctamente. Recibirás un correo de confirmación
          y te responderemos en un plazo no mayor a <strong>15 días hábiles</strong>.
        </p>
        <p className="text-sm text-gray-400 mb-8">
          Número de referencia: <span className="font-mono font-semibold text-[#182432]">{refNumber}</span>
        </p>
        <button
          onClick={() => { reset(); setSubmitted(false); }}
          className="text-sm text-[#0b7fad] hover:underline underline-offset-2"
        >
          Enviar otra reclamación
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="reclamaciones-form space-y-8" noValidate>

      {/* Sección 1: Datos del consumidor */}
      <section className="space-y-4">
        <SectionHeader>Datos del consumidor</SectionHeader>

        {/* Nombre */}
        <div>
          <Label htmlFor="nombre" className="text-sm font-medium text-gray-700">
            Nombre y Apellidos <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <Input
            id="nombre"
            {...register("nombre")}
            placeholder="Tu respuesta"
            aria-required="true"
            aria-invalid={!!errors.nombre}
            aria-describedby={errors.nombre ? "error-nombre" : undefined}
            className={cn("mt-1", errors.nombre && "border-red-400 focus-visible:border-red-400")}
          />
          <FieldError id="error-nombre" message={errors.nombre?.message} />
        </div>

        {/* DNI + Domicilio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dni" className="text-sm font-medium text-gray-700">
              DNI / CE / Pasaporte <span className="text-red-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="dni"
              {...register("dni")}
              placeholder="Tu respuesta"
              aria-required="true"
              aria-invalid={!!errors.dni}
              aria-describedby={errors.dni ? "error-dni" : undefined}
              className={cn("mt-1", errors.dni && "border-red-400 focus-visible:border-red-400")}
            />
            <FieldError id="error-dni" message={errors.dni?.message} />
          </div>
          <div>
            <Label htmlFor="domicilio" className="text-sm font-medium text-gray-700">
              Domicilio
            </Label>
            <Input
              id="domicilio"
              {...register("domicilio")}
              placeholder="Tu respuesta"
              className="mt-1"
            />
          </div>
        </div>

        {/* Correo + Teléfono */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="correo" className="text-sm font-medium text-gray-700">
              Correo <span className="text-red-500" aria-hidden="true">*</span>
            </Label>
            <Input
              id="correo"
              type="email"
              {...register("correo")}
              placeholder="Tu dirección de correo electrónico"
              aria-required="true"
              aria-invalid={!!errors.correo}
              aria-describedby={errors.correo ? "error-correo" : undefined}
              className={cn("mt-1", errors.correo && "border-red-400 focus-visible:border-red-400")}
            />
            <FieldError id="error-correo" message={errors.correo?.message} />
          </div>
          <div>
            <Label htmlFor="telefono" className="text-sm font-medium text-gray-700">
              Teléfono / Celular <span className="text-red-500" aria-hidden="true">*</span>
            </Label>
            <div className="flex mt-1 gap-0">
              <label htmlFor="codigoPais" className="sr-only">Código de país</label>
              <select
                id="codigoPais"
                {...register("codigoPais")}
                className="h-9 w-[92px] rounded-l-md border border-r-0 border-input bg-white px-2 text-sm text-gray-700 focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <Input
                id="telefono"
                type="tel"
                inputMode="numeric"
                {...register("telefono")}
                placeholder="999999999"
                aria-required="true"
                aria-invalid={!!errors.telefono}
                aria-describedby={errors.telefono ? "error-telefono" : undefined}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "");
                }}
                className={cn(
                  "flex-1 rounded-l-none",
                  errors.telefono && "border-red-400 focus-visible:border-red-400"
                )}
              />
            </div>
            <FieldError id="error-telefono" message={errors.telefono?.message} />
          </div>
        </div>

        {/* Menor de edad */}
        <div>
          <p id="label-menorDeEdad" className="text-sm font-medium text-gray-700 mb-2">
            ¿Eres menor de edad? <span className="text-red-500" aria-hidden="true">*</span>
          </p>
          <RadioGroup
            name="menorDeEdad"
            legend="¿Eres menor de edad?"
            options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]}
            value={watch("menorDeEdad") ?? ""}
            onChange={(v) => setValue("menorDeEdad", v as "si" | "no", { shouldValidate: true })}
            error={errors.menorDeEdad?.message}
          />
        </div>
      </section>

      {/* Sección 2: Identificación del bien contratado */}
      <section className="space-y-4">
        <SectionHeader>Identificación del bien contratado</SectionHeader>

        {/* Tipo producto + Monto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Bien contratado <span className="text-red-500" aria-hidden="true">*</span>
            </p>
            <RadioGroup
              name="tipoProducto"
              legend="Bien contratado"
              options={[{ value: "producto", label: "Producto" }, { value: "servicio", label: "Servicio" }]}
              value={watch("tipoProducto") ?? ""}
              onChange={(v) => setValue("tipoProducto", v as "producto" | "servicio", { shouldValidate: true })}
              error={errors.tipoProducto?.message}
            />
          </div>
          <div>
            <Label htmlFor="montoReclamado" className="text-sm font-medium text-gray-700">
              Monto Reclamado
            </Label>
            <Input
              id="montoReclamado"
              {...register("montoReclamado")}
              placeholder="Ej. 150.00"
              className="mt-1"
            />
          </div>
        </div>

        {/* Producto entregado */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            ¿Tu producto fue entregado? <span className="text-red-500" aria-hidden="true">*</span>
          </p>
          <RadioGroup
            name="productoEntregado"
            legend="¿Tu producto fue entregado?"
            options={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]}
            value={watch("productoEntregado") ?? ""}
            onChange={(v) => setValue("productoEntregado", v as "si" | "no", { shouldValidate: true })}
            error={errors.productoEntregado?.message}
          />
        </div>

        {/* Descripción del bien */}
        <div>
          <Label htmlFor="descripcionBien" className="text-sm font-medium text-gray-700">
            Descripción del bien/servicio contratado
          </Label>
          <Textarea
            id="descripcionBien"
            {...register("descripcionBien")}
            placeholder="Tu respuesta"
            className="mt-1 resize-none"
            rows={3}
          />
        </div>
      </section>

      {/* Sección 3: Detalle de la reclamación */}
      <section className="space-y-4">
        <SectionHeader>Detalle de la reclamación y pedido del consumidor</SectionHeader>

        {/* Tipo de registro */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Tipo de Registro <span className="text-red-500" aria-hidden="true">*</span>
          </p>
          <RadioGroup
            name="tipoRegistro"
            legend="Tipo de Registro"
            options={[
              { value: "reclamo", label: "Reclamo" },
              { value: "queja", label: "Queja" },
              { value: "felicitacion", label: "Felicitación" },
            ]}
            value={watch("tipoRegistro") ?? ""}
            onChange={(v) => setValue("tipoRegistro", v as "reclamo" | "queja" | "felicitacion", { shouldValidate: true })}
            error={errors.tipoRegistro?.message}
          />
        </div>

        {/* Detalle */}
        <div>
          <Label htmlFor="detalle" className="text-sm font-medium text-gray-700">
            Detalle o Descripción del Registro <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="detalle"
            {...register("detalle")}
            placeholder="Tu respuesta"
            aria-required="true"
            aria-invalid={!!errors.detalle}
            aria-describedby={errors.detalle ? "error-detalle" : undefined}
            className={cn("mt-1 resize-none", errors.detalle && "border-red-400 focus-visible:border-red-400")}
            rows={4}
          />
          <FieldError id="error-detalle" message={errors.detalle?.message} />
        </div>

        {/* Pedido del consumidor */}
        <div>
          <Label htmlFor="pedidoConsumidor" className="text-sm font-medium text-gray-700">
            Pedido del consumidor <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <Textarea
            id="pedidoConsumidor"
            {...register("pedidoConsumidor")}
            placeholder="Tu respuesta"
            aria-required="true"
            aria-invalid={!!errors.pedidoConsumidor}
            aria-describedby={errors.pedidoConsumidor ? "error-pedido" : undefined}
            className={cn("mt-1 resize-none", errors.pedidoConsumidor && "border-red-400 focus-visible:border-red-400")}
            rows={4}
          />
          <FieldError id="error-pedido" message={errors.pedidoConsumidor?.message} />
        </div>
      </section>

      {/* Sección 4: Cierre */}
      <section className="space-y-4 pb-2">
        <SectionHeader>Declaración y firma</SectionHeader>

        {/* Declaración de veracidad */}
        <div className="flex items-start gap-3">
          <Checkbox
            id="declaracionVeracidad"
            checked={watch("declaracionVeracidad") === true}
            onCheckedChange={(checked) =>
              setValue("declaracionVeracidad", checked === true, { shouldValidate: true })
            }
            aria-required="true"
            aria-invalid={!!errors.declaracionVeracidad}
            aria-describedby={errors.declaracionVeracidad ? "error-declaracion" : undefined}
            className="mt-0.5"
          />
          <div>
            <label htmlFor="declaracionVeracidad" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
              Declaro que los datos consignados son ciertos y responden a la verdad.{" "}
              <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <FieldError id="error-declaracion" message={errors.declaracionVeracidad?.message} />
          </div>
        </div>

        {/* Firma digital */}
        <div>
          <Label htmlFor="firmaDigital" className="text-sm font-medium text-gray-700">
            Firma Digital (nombre y apellidos) <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <Input
            id="firmaDigital"
            {...register("firmaDigital")}
            placeholder="Tu respuesta"
            aria-required="true"
            aria-invalid={!!errors.firmaDigital}
            aria-describedby={errors.firmaDigital ? "error-firma" : undefined}
            className={cn("mt-1", errors.firmaDigital && "border-red-400 focus-visible:border-red-400")}
          />
          <FieldError id="error-firma" message={errors.firmaDigital?.message} />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-8 py-2.5 bg-[#182432] text-white text-sm font-semibold rounded-md hover:bg-[#1e3045] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar"
            )}
          </button>
        </div>
      </section>
    </form>
  );
}
