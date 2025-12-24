"use client";

import { useState } from "react";
import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";
import { AnimatePresence, motion } from "framer-motion";

const steps = [
  { id: 1, image: "/images/paso-1.jpg" },
  { id: 2, image: "/images/paso-2.jpg" },
  { id: 3, image: "/images/paso-3.jpg" },
  { id: 4, image: "/images/paso-4.jpg" },
  { id: 5, image: "/images/paso-5.jpg" },
  { id: 6, image: "/images/paso-6.jpg" },
  { id: 7, image: "/images/paso-7.jpg" },
  { id: 8, image: "/images/paso-8.jpg" },
];

export default function Steps() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStep = steps[currentIndex];

  const next = () => setCurrentIndex((p) => (p + 1) % steps.length);
  const prev = () => setCurrentIndex((p) => (p === 0 ? steps.length - 1 : p - 1));

  return (
    <section
      id="casos-exito"
      className="bg-white py-20 md:py-28 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10 grid grid-cols-1 md:grid-cols-2 gap-14 md:gap-20 items-center">

        {/* IZQUIERDA */}
        <FadeUp delay={0}>
          <div className="max-w-2xl">

            <p className="text-lg md:text-xl italic font-inter text-[#182432] mb-3">
              Casos de éxito
            </p>

            <h2 className="text-3xl md:text-5xl font-libre font-semibold leading-tight text-black mb-8">
              ASÍ FUNCIONA VENTIA
              <br /> PASO A PASO
            </h2>

            <p className="text-sm sm:text-base md:text-lg font-inter leading-relaxed text-[#182432] mb-10">
              Este mismo proceso de venta puede implementarse en tu empresa en{" "}
              <span className="font-semibold">3 días.</span>
            </p>

            <a
              href="#contacto"
              className="
                inline-flex items-center justify-center
                rounded-full
                bg-[#5ACAF0] text-[#182432]
                px-12 py-3.5
                text-sm md:text-lg font-inter font-medium
                shadow-md
                hover:bg-[#2F7CF4] hover:text-white
                transition
              "
            >
              AGENDA TU DEMO
            </a>
          </div>
        </FadeUp>

        {/* DERECHA */}
        <FadeUp delay={0.15}>
          <div className="w-full flex flex-col items-center gap-4">

            <div className="w-full max-w-[520px] flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm uppercase tracking-[0.18em] text-[#182432]/60 font-inter font-semibold">
                PROCESO DE VENTA
              </span>

              <span className="text-xs md:text-sm font-inter text-[#182432]/60">
                {currentIndex + 1} / {steps.length}
              </span>
            </div>

            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-full max-w-[520px] h-[480px] sm:h-[540px] md:h-[600px]"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -60 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="relative w-full h-full rounded-4xl overflow-hidden bg-[#0b2435]"
                >
                  <Image
                    src={currentStep.image}
                    alt={`Paso ${currentStep.id}`}
                    fill
                    className="object-contain object-center"
                  />
                </motion.div>
              </AnimatePresence>

              <button
                onClick={prev}
                className="
                  flex absolute -left-6 top-1/2 -translate-y-1/2
                  h-10 w-10 md:h-12 md:w-12 rounded-full
                  bg-white shadow-sm border border-[#E5EAF4]
                  text-[#182432]
                  items-center justify-center hover:bg-[#F3F7FF] transition
                  text-2xl
                "
              >
                ‹
              </button>

              <button
                onClick={next}
                className="
                  flex absolute -right-6 top-1/2 -translate-y-1/2
                  h-10 w-10 md:h-12 md:w-12 rounded-full
                  bg-white shadow-sm border border-[#E5EAF4]
                  text-[#182432]
                  items-center justify-center hover:bg-[#F3F7FF] transition
                  text-2xl
                "
              >
                ›
              </button>
            </motion.div>

            <div className="flex items-center justify-center gap-1.5 mt-3">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`
                    rounded-full transition-all
                    ${
                      i === currentIndex
                        ? "w-4 h-2 bg-[#2F7CF4]"
                        : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                    }
                  `}
                />
              ))}
            </div>

          </div>
        </FadeUp>
      </div>
    </section>
  );
}
