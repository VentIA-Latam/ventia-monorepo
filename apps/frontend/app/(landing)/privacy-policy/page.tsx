import { Metadata } from "next";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Política de Privacidad - VentIA",
  description:
    "Política de privacidad de VentIA. Conoce cómo recopilamos, usamos y protegemos tus datos personales.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="pt-20 bg-white min-h-screen">
      <article className="mx-auto max-w-4xl px-6 py-12 md:py-20">
        {/* Header del documento */}
        <div className="border-b border-gray-200 pb-8 mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-libre font-bold text-[#182432] mb-4">
            Política de Privacidad
          </h1>
          <p className="text-sm text-gray-500 font-inter uppercase tracking-wide">
            Última actualización: 20 de octubre de 2025
          </p>
        </div>

        {/* Contenido del documento */}
        <div className="space-y-10 font-inter text-[#182432]">
          {/* Sección 1 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              1. Introducción
            </h2>
            <p className="text-base leading-relaxed">
              VentIA S.A.C., identificada con RUC 20614382741 y domiciliada en
              Calle Monterosa 255, Chacarilla, Santiago de Surco, Lima – Perú,
              actúa como responsable del tratamiento de los datos personales de
              sus clientes empresariales, representantes y prospectos, y como
              encargado del tratamiento respecto de los datos de los usuarios
              finales de sus clientes, conforme a la Ley N.º 29733, su
              Reglamento (D.S. N.º 003-2013-JUS) y normas complementarias. Esta
              política aplica a toda la información personal tratada en el marco
              de la prestación de servicios B2B de VentIA.
            </p>
          </section>

          {/* Sección 2 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              2. Datos personales que recopilamos
            </h2>
            <p className="text-base leading-relaxed">
              Recopilamos los siguientes tipos de datos personales:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>
                <strong>Información de identificación:</strong> nombre, cargo,
                área, razón social, RUC.
              </li>
              <li>
                <strong>Información de contacto:</strong> correo corporativo,
                teléfono, dirección fiscal.
              </li>
              <li>
                <strong>Credenciales de acceso:</strong> usuario o correo
                registrado para acceder a la plataforma.
              </li>
              <li>
                <strong>Información operativa:</strong> incidencias,
                solicitudes, comunicaciones, documentos cargados por el cliente
                (catálogos, políticas de entrega, etc.).
              </li>
              <li>
                <strong>Datos de usuarios finales:</strong> nombre, contacto,
                órdenes, direcciones de entrega e interacciones con la IA
                conversacional, cuando actuamos como encargado por instrucción
                del cliente.
              </li>
              <li>
                <strong>Información técnica:</strong> dirección IP, tipo y
                versión de navegador, sistema operativo, zona horaria, logs de
                uso y eventos generados en la plataforma.
              </li>
            </ul>
          </section>

          {/* Sección 3 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              3. Finalidad del tratamiento de datos
            </h2>
            <p className="text-base leading-relaxed">
              Los datos personales se tratan para:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>
                Prestar, mantener y mejorar los servicios (IA conversacional,
                validación de pagos, coordinación logística).
              </li>
              <li>
                Gestionar la relación contractual B2B (registro, autenticación,
                facturación, cobros, soporte).
              </li>
              <li>
                Ejecutar instrucciones del cliente respecto de sus usuarios
                finales.
              </li>
              <li>
                Enviar comunicaciones relacionadas con el servicio
                (actualizaciones, alertas, incidencias).
              </li>
              <li>
                Garantizar la seguridad (prevención de fraudes, accesos no
                autorizados).
              </li>
              <li>
                Realizar análisis de rendimiento y mejora continua del servicio.
              </li>
              <li>
                Cumplir obligaciones legales (tributarias, contables,
                regulatorias).
              </li>
              <li>
                Enviar comunicaciones comerciales B2B, respetando las normas
                aplicables.
              </li>
            </ul>
          </section>

          {/* Sección 4 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              4. Base legal para el tratamiento
            </h2>
            <p className="text-base leading-relaxed">
              El tratamiento de datos se sustenta en:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>
                La ejecución del contrato o medidas precontractuales con el
                cliente B2B.
              </li>
              <li>El consentimiento del titular, cuando la ley lo exija.</li>
              <li>
                El interés legítimo de VentIA en la seguridad, mejora del
                servicio y comunicaciones comerciales pertinentes.
              </li>
              <li>El cumplimiento de obligaciones legales aplicables.</li>
            </ul>
          </section>

          {/* Sección 5 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              5. Uso de cookies y tecnologías similares
            </h2>
            <p className="text-base leading-relaxed">
              Utilizamos cookies y tecnologías afines para habilitar
              funcionalidades, mantener sesiones, analizar el uso y rendimiento
              de la plataforma, y mejorar la experiencia del usuario. VentIA no
              utiliza cookies para publicidad basada en el comportamiento ni
              para seguimiento en sitios de terceros. El usuario puede gestionar
              o bloquear estas tecnologías mediante su navegador, aunque ello
              podría afectar ciertas funcionalidades del servicio.
            </p>
          </section>

          {/* Sección 6 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              6. Compartición de datos con terceros
            </h2>
            <p className="text-base leading-relaxed">
              Los datos personales pueden compartirse con:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>
                Proveedores que prestan servicios esenciales para la operación
                (infraestructura en la nube, mensajería, herramientas de
                administración, proveedores de IA), bajo instrucciones
                específicas y obligaciones de confidencialidad y seguridad.
              </li>
              <li>
                Autoridades competentes, cuando sea exigido por ley o en el
                marco de un procedimiento legal válido.
              </li>
            </ul>
          </section>

          {/* Sección 7 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              7. Seguridad de la información
            </h2>
            <p className="text-base leading-relaxed">
              VentIA implementa medidas técnicas y organizativas adecuadas para
              proteger la confidencialidad, integridad y disponibilidad de los
              datos personales, incluyendo controles de acceso, cifrado en
              tránsito y almacenamiento (cuando corresponda), gestión de claves,
              registro de eventos y planes de respuesta a incidentes.
            </p>
          </section>

          {/* Sección 8 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              8. Conservación de los datos
            </h2>
            <p className="text-base leading-relaxed">
              Los datos se conservan únicamente durante el tiempo necesario para
              cumplir con las finalidades del tratamiento y las obligaciones
              legales o contractuales. Al finalizar la relación:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>
                Si VentIA actúa como responsable, eliminará o anonimizará los
                datos conforme a los plazos de prescripción aplicables.
              </li>
              <li>
                Si actúa como encargado, devolverá o eliminará los datos
                tratados por cuenta del cliente, salvo que deba conservarlos por
                mandato legal o en copias de seguridad que se sobrescribirán en
                su ciclo normal.
              </li>
            </ul>
          </section>

          {/* Sección 9 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              9. Derechos del titular de los datos
            </h2>
            <p className="text-base leading-relaxed">
              Los titulares tienen derecho a acceder, rectificar, cancelar,
              oponerse o solicitar la supresión de sus datos personales, cuando
              corresponda. Para ejercer estos derechos, deben enviar una
              solicitud que incluya:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>Nombre completo y documento de identidad.</li>
              <li>Petición específica.</li>
              <li>Domicilio o correo electrónico para notificaciones.</li>
              <li>Fecha y firma.</li>
              <li>
                Documentos que sustenten la solicitud, si corresponden.
              </li>
            </ul>
          </section>

          {/* Sección 10 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              10. Transferencias internacionales
            </h2>
            <p className="text-base leading-relaxed">
              Algunos proveedores pueden procesar o alojar datos fuera del Perú.
              Dichas transferencias se realizan conforme a la Ley N.º 29733,
              mediante cláusulas contractuales y medidas de seguridad
              equivalentes.
            </p>
          </section>

          {/* Sección 11 */}
          <section className="space-y-4">
            <h2 className="text-xl md:text-2xl font-libre font-semibold text-[#182432]">
              11. Cambios en esta política
            </h2>
            <p className="text-base leading-relaxed">
              Podemos modificar esta política para reflejar cambios en nuestras
              prácticas o por razones legales. Se recomienda revisar esta
              política periódicamente. Las modificaciones entrarán en vigor
              desde su publicación en la plataforma.
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
