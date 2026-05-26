import { Metadata } from "next";
import Footer from "@/components/layout/Footer";
import ReclamacionesForm from "@/components/landing/reclamaciones-form";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones - VentIA",
  description:
    "Registra aquí tu queja, reclamo o felicitación. Conforme al Código de Protección y Defensa del Consumidor, VentIA cuenta con un Libro de Reclamaciones a tu disposición.",
};

export default function LibroReclamacionesPage() {
  return (
    <main className="pt-20 bg-white min-h-screen">
      <article className="mx-auto max-w-4xl px-6 py-12 md:py-20">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-libre font-bold tracking-widest text-[#0b7fad] uppercase mb-3">
            Libro de Reclamaciones
          </h1>
          <p className="text-sm md:text-base font-semibold text-[#182432] max-w-2xl mx-auto leading-relaxed">
            Conforme a lo establecido en el Código de Protección y Defensa del Consumidor,
            esta institución cuenta con un Libro de Reclamaciones a su disposición.
          </p>
        </div>

        <hr className="border-gray-200 mb-8" />

        {/* Texto legal */}
        <div className="bg-[#e8f7ff] rounded-xl p-6 mb-10 space-y-4 text-sm text-gray-700 leading-relaxed">
          <p>
            Los datos personales recabados serán incorporados a nuestro Banco de Datos{" "}
            <em className="font-semibold">&ldquo;LIBRO DE RECLAMACIONES&rdquo;</em> de VENTIA SAC.
            (RUC N° 20614382741). Dirección: CAL. MONTEROSA NRO. 255 INT. 601 URB. CHACARILLA
            LIMA - LIMA - SANTIAGO DE SURCO.
          </p>
          <p>
            En cumplimiento de la Ley N° 29733, Ley de Protección de Datos Personales, los datos
            recopilados a través del Libro de Reclamaciones serán utilizados para la atención de
            quejas y reclamos. Para ejercer derechos ARCO podrá comunicarse al correo electrónico{" "}
            <a href="mailto:pedidos@ventia-latam.com" className="text-[#5ACAF0] hover:underline">
              pedidos@ventia-latam.com
            </a>
          </p>
          <ul className="space-y-2">
            <li>
              <span className="text-[#182432] font-medium">*</span>{" "}
              La respuesta a este reclamo o queja será enviada al mail indicado en este formulario.
            </li>
            <li>
              <span className="text-[#182432] font-medium">*</span>{" "}
              La formulación del reclamo no impide acudir a otras vías de solución de controversias
              ni es requisito previo para interponer una denuncia ante el{" "}
              <span className="font-semibold">INDECOPI</span>.
            </li>
            <li>
              <span className="text-[#182432] font-medium">*</span>{" "}
              El proveedor deberá dar respuesta al reclamo en un plazo no mayor a{" "}
              <strong>quince (15) días hábiles</strong>, pudiendo ampliar el plazo hasta por
              treinta (30) días más, previa comunicación al consumidor.
            </li>
            <li>
              <span className="text-[#182432] font-medium">*</span>{" "}
              <strong>Reclamo:</strong> Manifestación mediante el cual un consumidor expresa una
              disconformidad relacionada a los bienes o servicios suministrados. La reclamación no
              constituye una denuncia y en consecuencia, no inicia un procedimiento administrativo
              sancionador por infracción a la normativa de protección al consumidor.
            </li>
            <li>
              <span className="text-[#182432] font-medium">*</span>{" "}
              <strong>Queja:</strong> Manifestación que un consumidor realiza para expresar el
              malestar o descontento por la atención al público, sin que tenga por finalidad la
              obtención de un procedimiento por parte del proveedor.
            </li>
          </ul>
          <p className="text-xs text-gray-500 pt-2">
            * Indica que la pregunta es obligatoria
          </p>
        </div>

        {/* Formulario */}
        <ReclamacionesForm />

      </article>
      <Footer />
    </main>
  );
}
