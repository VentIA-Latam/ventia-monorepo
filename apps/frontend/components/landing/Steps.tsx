"use client";

import { useState } from "react";
import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";
import { AnimatePresence, motion } from "framer-motion";

const steps = [
  {
    id: 1,
    image: "/images/paso-1.jpg",
    title: "Cliente escribe por WhatsApp",
    description: "Tu cliente inicia una conversación y el agente IA lo atiende al instante.",
  },
  {
    id: 2,
    image: "/images/paso-2.jpg",
    title: "Consulta stock en tiempo real",
    description: "El agente se conecta a tu inventario y muestra productos disponibles.",
  },
  {
    id: 3,
    image: "/images/paso-3.jpg",
    title: "Coordina entrega y horario",
    description: "Se pacta la dirección, fecha y franja horaria de entrega.",
  },
  {
    id: 4,
    image: "/images/paso-4.jpg",
    title: "Confirma datos y pedido",
    description: "Se recopilan los datos del cliente y se genera el resumen del pedido.",
  },
  {
    id: 5,
    image: "/images/paso-5.jpg",
    title: "Valida el pago",
    description: "El cliente elige su método de pago y envía el comprobante.",
  },
  {
    id: 6,
    image: "/images/paso-6.jpg",
    title: "Registra en tus sistemas",
    description: "El pedido se crea en Shopify y se actualiza el stock automáticamente.",
  },
  {
    id: 7,
    image: "/images/paso-7.jpg",
    title: "Empaquetamos tu pedido",
    description: "Preparamos el paquete con cuidado desde nuestro centro de fulfillment.",
  },
  {
    id: 8,
    image: "/images/paso-8.jpg",
    title: "Entrega al cliente",
    description: "Dejamos el pedido en la puerta del cliente el mismo día o al siguiente.",
  },
];

export default function Steps() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section
      id="casos-exito"
      className="relative bg-white py-16 md:py-24 lg:py-32 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        {/* Encabezado */}
        <FadeUp delay={0}>
          <p className="text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
            Así funciona
          </p>
        </FadeUp>
        <FadeUp delay={0.05}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#182432] font-libre leading-tight mb-4">
            VENTIA PASO A PASO
          </h2>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-base lg:text-lg text-[#182432]/60 font-sans max-w-xl mb-12 md:mb-16">
            Este mismo proceso de venta puede ser implementado en tu empresa{" "}
            <strong className="font-bold text-[#182432]">en 3 días.</strong>
          </p>
        </FadeUp>

        {/* Layout principal: Timeline + Imagen */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start lg:justify-center gap-8 lg:gap-14 xl:gap-20">

          {/* Timeline (izquierda) */}
          <div className="w-full lg:w-auto lg:max-w-[380px] xl:max-w-[420px]">
            <div className="relative">
              {/* Línea vertical */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[#182432]/10" />

              {/* Línea de progreso animada */}
              <motion.div
                className="absolute left-[15px] top-2 w-px bg-[#5ACAF0]"
                animate={{
                  height: `${((activeStep) / (steps.length - 1)) * 100}%`,
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />

              <div className="space-y-1">
                {steps.map((step, index) => {
                  const isActive = index === activeStep;
                  const isPast = index < activeStep;

                  return (
                    <button
                      key={step.id}
                      onClick={() => setActiveStep(index)}
                      className={`
                        relative w-full text-left flex items-start gap-4 py-3 px-2 rounded-xl
                        transition-all duration-300 cursor-pointer group
                        ${isActive ? "bg-[#182432]/[0.04]" : "hover:bg-[#182432]/[0.02]"}
                      `}
                    >
                      {/* Número / Indicador */}
                      <div
                        className={`
                          relative z-10 shrink-0 flex items-center justify-center
                          w-[30px] h-[30px] rounded-full text-xs font-bold font-sans
                          transition-all duration-300 border-2
                          ${isActive
                            ? "bg-[#5ACAF0] border-[#5ACAF0] text-white scale-110"
                            : isPast
                              ? "bg-[#5ACAF0]/20 border-[#5ACAF0]/40 text-[#5ACAF0]"
                              : "bg-white border-[#182432]/15 text-[#182432]/40 group-hover:border-[#182432]/30"
                          }
                        `}
                      >
                        {index + 1}
                      </div>

                      {/* Texto */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p
                          className={`
                            text-sm font-semibold font-sans leading-snug transition-colors duration-300
                            ${isActive ? "text-[#182432]" : isPast ? "text-[#182432]/70" : "text-[#182432]/45 group-hover:text-[#182432]/60"}
                          `}
                        >
                          {step.title}
                        </p>

                        {/* Descripción expandible */}
                        <AnimatePresence>
                          {isActive && (
                            <motion.p
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                              className="text-xs text-[#182432]/50 font-sans leading-relaxed mt-1 overflow-hidden"
                            >
                              {step.description}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Flecha activa */}
                      <div
                        className={`
                          shrink-0 mt-1 transition-all duration-300
                          ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}
                        `}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#5ACAF0" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M6 4l4 4-4 4" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Imagen (derecha) */}
          <div className="w-full lg:w-auto">
            <FadeUp delay={0.2}>
              <div className="relative aspect-[4/5] w-[320px] sm:w-[360px] lg:w-[400px] mx-auto rounded-2xl overflow-hidden shadow-xl shadow-[#182432]/15">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={steps[activeStep].id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={steps[activeStep].image}
                      alt={`Paso ${steps[activeStep].id}: ${steps[activeStep].title}`}
                      fill
                      className="object-cover object-top"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </FadeUp>

            {/* Navegación rápida mobile (flechas debajo de la imagen) */}
            <div className="flex items-center justify-center gap-4 mt-4 lg:hidden">
              <button
                onClick={() => setActiveStep((p) => (p === 0 ? steps.length - 1 : p - 1))}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-[#182432]/15 text-[#182432]/60 hover:border-[#5ACAF0] hover:text-[#5ACAF0] transition-colors"
                aria-label="Paso anterior"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>

              <span className="text-sm font-semibold text-[#182432]/60 font-sans tabular-nums">
                {activeStep + 1} / {steps.length}
              </span>

              <button
                onClick={() => setActiveStep((p) => (p + 1) % steps.length)}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-[#182432]/15 text-[#182432]/60 hover:border-[#5ACAF0] hover:text-[#5ACAF0] transition-colors"
                aria-label="Paso siguiente"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
