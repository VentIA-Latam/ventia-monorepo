"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FadeUp from "@/components/ui/FadeUp";

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

interface FaqProps {
  limit?: number | null;
  showMoreButton?: boolean;
}

export default function Faq({ limit = null, showMoreButton = true }: FaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const listToShow = limit ? faqs.slice(0, limit) : faqs;

  const toggleIndex = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section
      id="faq"
      className="bg-[#fafafa] py-16 md:py-24 lg:py-32 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-3xl px-5 sm:px-8 md:px-10">

        {/* Encabezado */}
        <div className="text-center mb-10 md:mb-14 lg:mb-16">
          <FadeUp delay={0}>
            <p className="text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
              FAQ
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#182432] font-libre leading-tight mb-4">
              PREGUNTAS FRECUENTES
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base lg:text-lg text-[#182432]/50 font-sans max-w-md mx-auto">
              Todo lo que necesitas saber antes de empezar.
            </p>
          </FadeUp>
        </div>

        {/* Accordion */}
        <div className="divide-y divide-[#182432]/[0.08]">
          {listToShow.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <FadeUp key={index} delay={0.03 * (index + 1)}>
                <div>
                  <button
                    type="button"
                    onClick={() => toggleIndex(index)}
                    className="w-full flex items-center justify-between gap-4 py-5 md:py-6 text-left group"
                  >
                    <span className={`text-sm md:text-base font-semibold font-sans transition-colors duration-200 ${
                      isOpen ? "text-[#182432]" : "text-[#182432]/70 group-hover:text-[#182432]"
                    }`}>
                      {item.question}
                    </span>

                    <span className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all duration-300 ${
                      isOpen ? "bg-[#5ACAF0] text-white rotate-45" : "bg-[#182432]/[0.06] text-[#182432]/40 group-hover:bg-[#182432]/[0.1]"
                    }`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 1v10M1 6h10" />
                      </svg>
                    </span>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="text-sm md:text-base text-[#182432]/50 font-sans leading-relaxed pb-5 md:pb-6 pr-12">
                          {item.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeUp>
            );
          })}
        </div>

        {/* Ver más */}
        {showMoreButton && (
          <FadeUp delay={0.2}>
            <div className="flex justify-center mt-10 md:mt-14">
              <a
                href="/preguntas-frecuentes"
                className="inline-flex items-center gap-2 text-sm font-semibold font-sans text-[#182432]/50 hover:text-[#5ACAF0] transition-colors duration-200"
              >
                Ver todas las preguntas
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </a>
            </div>
          </FadeUp>
        )}
      </div>
    </section>
  );
}
