"use client";

import { useState } from "react";
import { HiChevronDown } from "react-icons/hi";

const faqs = [
  {
    question: "¿VentIA reemplaza a mi equipo de ventas?",
    answer:
      "No, lo potencia. VentIA automatiza lo repetitivo (responder mensajes, cerrar ventas, validar pagos) mientras tu equipo se enfoca en lo estratégico: conseguir clientes.",
  },
  {
    question: "¿Necesito tener una tienda online para usar VentIA?",
    answer:
      "No. VentIA puede vender directamente desde tus redes sociales y WhatsApp.",
  },
  {
    question: "¿Qué pasa si un cliente tiene un problema con su pedido?",
    answer:
      "Nuestro equipo de operaciones supervisa cada paso y resuelve cualquier incidencia de forma inmediata, garantizando que el cliente quede satisfecho.",
  },
  {
    question: "¿Cómo supervisan que los pedidos se entreguen correctamente?",
    answer:
      "Nuestro equipo humano monitorea todo el proceso en tiempo real y confirma cada entrega, garantizando que el cliente reciba su pedido sin problemas.",
  },
  {
    question: "¿Necesito tener un gran volumen de ventas para usar VentIA?",
    answer:
      "No. VentIA funciona para negocios pequeños, medianos y grandes. Te ayuda a escalar sin aumentar personal.",
  },
  {
    question: "¿VentIA puede integrarse con mi sistema de inventario?",
    answer:
      "Sí. Podemos conectarnos con tus sistemas para actualizar stock en tiempo real y evitar ventas de productos agotados.",
  },
  {
    question: "¿Cómo funciona la validación de pagos?",
    answer:
      "VentIA verifica automáticamente el pago antes de coordinar la entrega, evitando errores o fraudes en el proceso.",
  },
  {
    question: "¿Puedo probar VentIA antes de contratar un plan completo?",
    answer:
      "Sí. Puedes agendar una demo personalizada para ver cómo funcionaría en tu negocio.",
  },
  {
    question: "¿Qué redes sociales integra VentIA?",
    answer:
      "Nos conectamos con WhatsApp, messenger, Instagram y TikTok.",
  },
  {
    question: "¿Qué diferencia a VentIA de un chatbot tradicional?",
    answer:
      "VentIA combina IA conversacional con supervisión humana y logística real. No solo responde mensajes: vende, válida pagos y entrega tus productos.",
  },
  {
    question: "¿Ustedes se encargan de la entrega de los pedidos?",
    answer:
      "Sí, si eliges los planes que incluyen logística. Podemos encargarnos de la recolección, armado, almacenamiento y entrega.",
  },
  {
    question: "¿Cuál es el tiempo promedio de implementación?",
    answer:
      "Podemos activar tu operación en menos de 48 horas.",
  },
  {
    question: "¿VentIA maneja devoluciones o cambios de productos?",
    answer:
      "Podemos coordinar devoluciones o cambios según la política de tu negocio, notificándote y gestionando la logística cuando sea necesario.",
  },
  {
    question: "¿Mi información y la de mis clientes está segura con VentIA?",
    answer:
      "Sí. Cumplimos con altos estándares de seguridad y protección de datos. Tu información y la de tus clientes están protegidas.",
  },
  {
    question: "¿Puedo recibir reportes de mis ventas y entregas?",
    answer:
      "Sí. VentIA te brinda reportes detallados de ventas, pagos y entregas en un solo panel de control.",
  },
  {
    question: "¿VentIA atiende a mis clientes en horarios nocturnos o fines de semana?",
    answer:
      "Sí. Nuestra IA conversacional está disponible 24/7, y la supervisión humana asegura que cualquier incidencia se atienda sin importar la hora.",
  },
];

type FaqProps = {
  limit?: number | null;
  showMoreButton?: boolean;
};

export default function Faq({ limit = null, showMoreButton = true }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const listToShow = limit ? faqs.slice(0, limit) : faqs;

  const toggleIndex = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section
      id="faq"
      className="bg-white py-16 md:py-20 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        
        {/* TÍTULO */}
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-libre font-semibold tracking-wide text-[#182432] mb-4">
            PREGUNTAS FRECUENTES
          </h2>
        </div>

        {/* LISTA FAQ */}
        <div className="space-y-4">
          {listToShow.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div key={index} className="space-y-2">

                {/* BOTÓN PREGUNTA */}
                <button
                  type="button"
                  onClick={() => toggleIndex(index)}
                  className="
                    w-full flex items-center justify-between
                    rounded-full bg-[#182432] text-white
                    px-6 py-3 md:px-8 md:py-4
                    text-sm md:text-base font-sans font-semibold
                    shadow-md
                  "
                >
                  <span className="pr-4">{item.question}</span>

                  <span
                    className={`flex items-center justify-center h-7 w-7 rounded-full bg-[#111827] transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <HiChevronDown className="h-4 w-4" />
                  </span>
                </button>

                {/* RESPUESTA */}
                {isOpen && (
                  <div
                    className="
                      w-full rounded-3xl bg-white text-[#182432]
                      px-6 md:px-8 py-3 md:py-4
                      text-sm md:text-base font-sans leading-relaxed
                      shadow-md
                    "
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTÓN "VER MÁS" */}
        {showMoreButton && (
          <div className="flex justify-center mt-10 md:mt-12">
            <a
              href="/preguntas-frecuentes"
              className="
                inline-flex items-center justify-center
                rounded-full bg-[#5ACAF0] text-white
                px-16 md:px-20 py-3.5
                text-xl md:text-2xl font-sans font-medium
                shadow-md
                hover:bg-[#212835] transition
              "
            >
              VER MÁS
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
