import { Metadata } from "next";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Términos y Condiciones - VentIA",
  description:
    "Términos y condiciones de uso de la plataforma VentIA. Conoce tus derechos y responsabilidades al utilizar nuestros servicios.",
};

export default function TerminosYCondicionesPage() {
  return (
    <main className="pt-20 bg-white min-h-screen">
      <article className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        {/* Header del documento */}
        <div className="border-b border-gray-200 pb-8 mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-libre font-bold text-[#182432] mb-4">
            Términos de Uso
          </h1>
          <p className="text-sm text-gray-500 font-sans uppercase tracking-wide">
            Última actualización: 20 de octubre de 2025
          </p>
        </div>

        {/* Contenido del documento */}
        <div className="space-y-10 font-sans text-[#182432]">
          {/* Sección 1 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              1. ¿Qué es VentIA?
            </h2>
            <p className="text-base leading-relaxed">
              VentIA es una plataforma B2B que ayuda a marcas a automatizar sus
              ventas con inteligencia artificial, gestionar pedidos y emitir
              comprobantes de pago. VentIA no vende productos propios ni es
              responsable por los productos o servicios ofrecidos por sus
              usuarios.
            </p>
          </section>

          {/* Sección 2 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              2. Uso aceptable
            </h2>
            <p className="text-base leading-relaxed">
              VentIA debe utilizarse únicamente para fines legítimos y conforme
              a la ley. No está permitido:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>Intentar acceder a datos ajenos</li>
              <li>Enviar mensajes no solicitados o spam</li>
              <li>
                Realizar ingeniería inversa, descompilar o extraer código
              </li>
              <li>Publicar contenido ilegal, engañoso o dañino</li>
            </ul>
            <p className="text-base leading-relaxed">
              El incumplimiento de estas reglas puede resultar en la suspensión
              o cancelación del acceso al servicio.
            </p>
          </section>

          {/* Sección 3 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              3. Tu cuenta y tu responsabilidad
            </h2>
            <p className="text-base leading-relaxed">
              Al registrarte, debes proporcionar información veraz y mantenerla
              actualizada. Eres responsable de toda actividad realizada desde tu
              cuenta y del uso de tus credenciales.
            </p>
            <p className="text-base leading-relaxed">
              El tratamiento de datos personales se realiza conforme a nuestra
              Política de Privacidad.
            </p>
          </section>

          {/* Sección 4 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              4. Propiedad intelectual
            </h2>
            <p className="text-base leading-relaxed">
              Todo el software, la tecnología, los modelos de inteligencia
              artificial, el diseño y el contenido de VentIA son de nuestra
              propiedad o de nuestros licenciantes. Se otorga al usuario una
              licencia limitada, no exclusiva y revocable para utilizar la
              plataforma mientras mantenga una relación activa con VentIA.
            </p>
          </section>

          {/* Sección 5 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              5. Limitación de responsabilidad
            </h2>
            <p className="text-base leading-relaxed">
              VentIA se ofrece &quot;tal cual&quot;, sin garantías de
              funcionamiento ininterrumpido o libre de errores. En la medida
              permitida por la ley, la responsabilidad total de VentIA se limita
              al monto efectivamente pagado por el usuario por el uso del
              servicio durante un período razonable previo al reclamo. VentIA no
              será responsable por daños indirectos o pérdida de ingresos.
            </p>
          </section>

          {/* Sección 6 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              6. Suspensión o terminación
            </h2>
            <p className="text-base leading-relaxed">
              El usuario puede cancelar su cuenta con 30 días de anticipación.
              VentIA podrá suspender o terminar el servicio en caso de
              incumplimiento de estos términos, falta de pago o para proteger la
              seguridad de la plataforma y de otros usuarios.
            </p>
          </section>

          {/* Sección de contacto */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-base font-semibold text-[#182432] mb-3">
              Contacto
            </p>
            <div className="text-base leading-relaxed space-y-1">
              <p className="font-medium">VentIA S.A.C.</p>
              <p>Calle Monterosa 255, Chacarilla</p>
              <p>Santiago de Surco, Lima – Perú</p>
              <p>RUC: 20614382741</p>
            </div>
          </div>
        </div>
      </article>
      <Footer />
    </main>
  );
}

