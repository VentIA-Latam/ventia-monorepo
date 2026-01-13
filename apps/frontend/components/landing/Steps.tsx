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
      className="relative bg-white pt-8 sm:pt-12 md:pt-[54px] pb-8 sm:pb-12 md:pb-[54px] scroll-mt-24 sm:scroll-mt-28 md:scroll-mt-[109px]"
    >
      <div className="max-w-[90%] mx-auto relative flex flex-col md:flex-row pt-4 sm:pt-6 md:pt-[27px] pb-4 sm:pb-6 md:pb-[27px] px-4 sm:px-0">

        {/* IZQUIERDA - Contenedor de Texto */}
        <div className="w-full md:w-[47.25%] relative z-[2] order-2 md:order-1 mb-8 md:mb-0 md:mt-[137.672px] md:mb-[137.672px] md:mr-[94.2969px] md:pl-[100px]">
          <FadeUp delay={0}>
            <div className="text-left sm:text-justify relative animate-[0.2s_linear] break-words mb-6 sm:mb-8 md:mb-[41.3125px]">
              <div className="relative">
                <p className="text-2xl sm:text-3xl md:text-[36px] leading-tight sm:leading-normal md:leading-[43.2px] text-black font-['Helvetica_Italic',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  Casos de éxito
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="text-left relative animate-[0.2s_linear] break-words mb-6 sm:mb-8 md:mb-[41.3125px]">
              <div className="relative">
                <p className="text-2xl sm:text-3xl md:text-[40px] leading-tight sm:leading-snug md:leading-[44px] font-semibold text-black font-['Libre_Franklin',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  ASÍ FUNCIONA VENTIA
                  <br />
                  PASO A PASO
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="text-left relative animate-[0.2s_linear] break-words max-w-full md:max-w-[70%] mb-6 sm:mb-8 md:mb-[41.3125px] md:mr-[213.031px]">
              <div className="relative">
                <p className="text-sm sm:text-base md:text-[20px] leading-relaxed sm:leading-normal md:leading-[24px] text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  Este mismo proceso de venta puede ser implementado en tu empresa{" "}
                  <strong className="font-bold">
                    en 3 días.
                  </strong>
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div className="relative animate-[0.2s_linear] mb-6 sm:mb-8 md:mb-[41.3125px]">
              <a
                href="#contacto"
                className="inline-block relative text-sm sm:text-base md:text-[20px] leading-tight sm:leading-normal md:leading-[34px] font-medium bg-[#48c1ec] text-white font-['Helvetica_Medium',Helvetica,Arial,Lucida,sans-serif] transition-all duration-300 border-2 border-white rounded-[36px] py-2.5 sm:py-3 md:py-3 pb-1.5 px-8 sm:px-12 md:px-20 hover:bg-[#212835]"
              >
                AGENDA TU DEMO
              </a>
            </div>
          </FadeUp>
        </div>

        {/* DERECHA - Carrusel de Imágenes */}
        <div className="w-full md:w-[47.25%] relative z-[2] order-1 md:order-2 mb-6 md:mb-0 md:mt-0">
          <FadeUp delay={0.4}>
            <div className="w-full flex flex-col items-center gap-4">


              <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full max-w-[320px] sm:max-w-[420px] md:max-w-[520px] h-[360px] sm:h-[440px] md:h-[600px]"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -60 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="relative w-full h-full rounded-b-sm overflow-hidden bg-[#0b2435]"
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
                  className="flex absolute -left-4 sm:-left-5 md:-left-6 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full bg-white shadow-sm border border-[#E5EAF4] text-[#182432] items-center justify-center hover:bg-[#F3F7FF] transition text-xl sm:text-2xl"
                >
                  ‹
                </button>

                <button
                  onClick={next}
                  className="flex absolute -right-4 sm:-right-5 md:-right-6 top-1/2 -translate-y-1/2 h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full bg-white shadow-sm border border-[#E5EAF4] text-[#182432] items-center justify-center hover:bg-[#F3F7FF] transition text-xl sm:text-2xl"
                >
                  ›
                </button>
              </motion.div>

              <div className="flex items-center justify-center gap-1.5 mt-3">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`rounded-full transition-all ${i === currentIndex
                        ? "w-4 h-2 bg-[#2F7CF4]"
                        : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                      }`}
                  />
                ))}
              </div>

            </div>
          </FadeUp>
        </div>

        <span className="w-0 max-w-none static block"></span>
      </div>
    </section>
  );
}
