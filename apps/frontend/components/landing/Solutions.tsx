"use client";

import { useState } from "react";
import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";
import { AnimatePresence, motion } from "framer-motion";

const solutions = [
  {
    id: 1,
    title: "Agente IA",
    description:
      "Atendemos consultas y pedidos 24/7 por WhatsApp, Instagram o chat web, con respuestas inmediatas y precisas.",
    image: "/images/etapa-1.png",
  },
  {
    id: 2,
    title: "Inventario",
    description:
      "Verificamos y modificamos el stock en tiempo real para evitar ventas de productos agotados.",
    image: "/images/etapa-2.png",
  },
  {
    id: 3,
    title: "Pagos y Datos",
    description:
      "Confirmamos de inmediato los pagos realizados, así como dirección e información del cliente.",
    image: "/images/etapa-3.png",
  },
  {
    id: 4,
    title: "Despacho",
    description:
      "Del almacén a la puerta del cliente en menos de 24 horas.",
    image: "/images/etapa-4.png",
  },
  {
    id: 5,
    title: "Seguimiento",
    description:
      "Supervisamos entregas puntuales y nos encargamos de tu facturación y contabilidad.",
    image: "/images/etapa-5.png",
  },
];

export default function Solutions() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section
      id="soluciones"
      className="relative bg-[#fafafa] py-16 md:py-24 lg:py-32 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        {/* Encabezado */}
        <div className="text-center mb-10 md:mb-14 lg:mb-16">
          <FadeUp delay={0}>
            <p className="text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
              Nuestras soluciones
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#182432] font-libre leading-tight mb-4">
              DE PUNTA A PUNTA
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base lg:text-lg text-[#182432]/60 font-sans max-w-lg mx-auto">
              Nos encargamos de todo: atender, vender, cobrar y entregar.
              Olvídate de la operación diaria.
            </p>
          </FadeUp>
        </div>

        {/* Tab bar */}
        <FadeUp delay={0.15}>
          <div className="flex justify-center mb-10 md:mb-14">
            <div className="flex gap-1 p-1 bg-[#182432]/[0.04] rounded-full overflow-x-auto no-scrollbar">
              {solutions.map((solution, index) => (
                <button
                  key={solution.id}
                  onClick={() => setActiveTab(index)}
                  className={`
                    relative shrink-0 flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-full
                    text-sm font-semibold font-sans transition-all duration-300 whitespace-nowrap
                    ${activeTab === index
                      ? "bg-[#182432] text-white shadow-md shadow-[#182432]/20"
                      : "text-[#182432]/50 hover:text-[#182432]/70"
                    }
                  `}
                >
                  <span className={`text-xs font-bold ${activeTab === index ? "text-[#5ACAF0]" : "text-[#182432]/30"}`}>
                    0{solution.id}
                  </span>
                  <span className="hidden sm:inline">{solution.title}</span>
                </button>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* Contenido del tab activo */}
        <div className="relative min-h-[360px] md:min-h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={solutions[activeTab].id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20"
            >
              {/* Ilustración */}
              <div className="relative w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] md:w-[280px] md:h-[280px] shrink-0">
                <div className="absolute inset-0 bg-[#5ACAF0]/8 rounded-full blur-[50px] scale-125 pointer-events-none" />
                <Image
                  src={solutions[activeTab].image}
                  alt={solutions[activeTab].title}
                  fill
                  className="relative object-contain drop-shadow-lg"
                />
              </div>

              {/* Texto */}
              <div className="text-center lg:text-left max-w-md">
                <div className="flex items-baseline gap-3 justify-center lg:justify-start mb-3">
                  <span className="text-5xl md:text-6xl font-bold font-libre text-[#5ACAF0]/20 leading-none">
                    0{solutions[activeTab].id}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold text-[#182432] font-libre">
                    {solutions[activeTab].title}
                  </h3>
                </div>

                <p className="text-base md:text-lg text-[#182432]/55 font-sans leading-relaxed">
                  {solutions[activeTab].description}
                </p>

                {/* Indicador de progreso */}
                <div className="flex items-center gap-2 mt-8 justify-center lg:justify-start">
                  {solutions.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveTab(i)}
                      className={`h-1 rounded-full transition-all duration-400 ${
                        i === activeTab
                          ? "w-8 bg-[#5ACAF0]"
                          : i < activeTab
                            ? "w-3 bg-[#5ACAF0]/30"
                            : "w-3 bg-[#182432]/10"
                      }`}
                      aria-label={`Etapa ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
