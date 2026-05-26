import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const schema = z.object({
  nombre: z.string().min(3),
  dni: z.string().min(6).max(20),
  domicilio: z.string().optional(),
  correo: z.string().email(),
  codigoPais: z.string().default("+51"),
  telefono: z.string().regex(/^\d{7,15}$/, "Teléfono inválido"),
  menorDeEdad: z.enum(["si", "no"]),
  tipoProducto: z.enum(["producto", "servicio"]),
  montoReclamado: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal("")),
  productoEntregado: z.enum(["si", "no"]),
  descripcionBien: z.string().optional(),
  tipoRegistro: z.enum(["reclamo", "queja", "felicitacion"]),
  detalle: z.string().min(20),
  pedidoConsumidor: z.string().min(10),
  declaracionVeracidad: z.literal(true),
  firmaDigital: z.string().min(3),
});

const TIPO_LABEL: Record<string, string> = {
  reclamo: "Reclamo",
  queja: "Queja",
  felicitacion: "Felicitación",
};

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Los datos proporcionados no son válidos" }, { status: 400 });
  }

  const data = result.data;
  const tipoLabel = TIPO_LABEL[data.tipoRegistro];
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const refNumber = `REC-${Date.now()}-${suffix}`;
  const fecha = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.RECLAMACIONES_TO_EMAIL;

  if (!apiKey || !toEmail) {
    console.error("Missing RESEND_API_KEY or RECLAMACIONES_TO_EMAIL");
    return NextResponse.json({ error: "Configuración de correo incompleta" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const fromEmail = "VentIA — Libro de Reclamaciones <noreply@ventia-latam.com>";

  const errors: string[] = [];

  try {
    await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `[${tipoLabel}] ${escHtml(data.nombre)} — ${escHtml(data.dni)}`,
      html: buildTeamEmail(data, refNumber, fecha, tipoLabel),
    });
  } catch (err) {
    console.error("Resend team email error:", err);
    errors.push("equipo");
  }

  try {
    await resend.emails.send({
      from: fromEmail,
      to: data.correo,
      subject: `Hemos recibido tu ${tipoLabel} — VentIA`,
      html: buildConfirmationEmail(data, refNumber, fecha, tipoLabel),
    });
  } catch (err) {
    console.error("Resend confirmation email error:", err);
    errors.push("confirmacion");
  }

  if (errors.includes("equipo") && errors.includes("confirmacion")) {
    return NextResponse.json({ error: "Error al enviar el correo. Intente nuevamente." }, { status: 500 });
  }

  return NextResponse.json({ success: true, ref: refNumber });
}

function row(label: string, value: string | undefined) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:8px 12px;background:#f9fafb;font-weight:600;color:#374151;width:200px;font-size:13px;border-bottom:1px solid #e5e7eb;">${label}</td>
      <td style="padding:8px 12px;color:#111827;font-size:13px;border-bottom:1px solid #e5e7eb;">${escHtml(value)}</td>
    </tr>`;
}

function section(title: string, rows: string) {
  return `
    <h3 style="margin:24px 0 8px;font-size:14px;font-weight:700;color:#182432;text-transform:uppercase;letter-spacing:0.05em;">${title}</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-collapse:collapse;">
      ${rows}
    </table>`;
}

function buildTeamEmail(data: z.infer<typeof schema>, ref: string, fecha: string, tipoLabel: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nueva ${tipoLabel}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);max-width:600px;">
      <tr><td style="background:#182432;padding:24px 32px;">
        <p style="margin:0;color:#5ACAF0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Libro de Reclamaciones</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">Nueva ${tipoLabel} recibida</h1>
      </td></tr>
      <tr><td style="padding:8px 32px 4px;">
        <p style="margin:0;font-size:13px;color:#6b7280;">Ref: <strong>${ref}</strong> · ${fecha}</p>
        ${section("Datos del consumidor",
          row("Nombre y Apellidos", data.nombre) +
          row("DNI / CE / Pasaporte", data.dni) +
          row("Correo", data.correo) +
          row("Teléfono", data.codigoPais + " " + data.telefono) +
          row("Domicilio", data.domicilio) +
          row("Menor de edad", data.menorDeEdad === "si" ? "Sí" : "No")
        )}
        ${section("Identificación del bien",
          row("Bien contratado", data.tipoProducto === "producto" ? "Producto" : "Servicio") +
          row("Monto reclamado", data.montoReclamado ? `S/ ${data.montoReclamado}` : undefined) +
          row("Producto entregado", data.productoEntregado === "si" ? "Sí" : "No") +
          row("Descripción del bien", data.descripcionBien)
        )}
        ${section("Detalle de la reclamación",
          row("Tipo de registro", tipoLabel) +
          row("Detalle / Descripción", data.detalle) +
          row("Pedido del consumidor", data.pedidoConsumidor)
        )}
        ${section("Cierre",
          row("Firma digital", data.firmaDigital) +
          row("Declaración de veracidad", "Aceptada")
        )}
        <p style="margin:24px 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
          Este correo fue generado automáticamente desde el Libro de Reclamaciones de VentIA.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildConfirmationEmail(data: z.infer<typeof schema>, ref: string, fecha: string, tipoLabel: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Confirmación de ${tipoLabel}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);max-width:600px;">
      <tr><td style="background:#182432;padding:24px 32px;">
        <p style="margin:0;color:#5ACAF0;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Libro de Reclamaciones</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:22px;font-weight:700;">Hemos recibido tu ${tipoLabel}</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hola <strong>${escHtml(data.nombre)}</strong>,</p>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
          Tu ${tipoLabel.toLowerCase()} ha sido registrada correctamente en nuestro Libro de Reclamaciones.
          Te responderemos en un plazo no mayor a <strong>15 días hábiles</strong>, conforme a lo establecido
          en el Código de Protección y Defensa del Consumidor.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
          <tr>
            <td style="font-size:13px;color:#6b7280;">Número de referencia</td>
            <td align="right" style="font-size:13px;font-weight:700;color:#182432;">${ref}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding-top:8px;">Fecha de registro</td>
            <td align="right" style="font-size:13px;color:#182432;padding-top:8px;">${fecha}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding-top:8px;">Tipo</td>
            <td align="right" style="font-size:13px;color:#182432;padding-top:8px;">${tipoLabel}</td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
          Si tienes alguna consulta, puedes escribirnos a
          <a href="mailto:pedidos@ventia-latam.com" style="color:#5ACAF0;text-decoration:none;">pedidos@ventia-latam.com</a>
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
          © ${new Date().getFullYear()} VentIA S.A.C. · RUC 20614382741 · Calle Monterosa 255, Chacarilla, Santiago de Surco, Lima – Perú
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
