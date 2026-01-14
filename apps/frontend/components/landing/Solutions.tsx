"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

// Flechas SVG
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2.5}
    stroke="currentColor"
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2.5}
    stroke="currentColor"
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const solutions = [
  {
    id: 1,
    etapa: "ETAPA 1",
    titulo: "Agente IA",
    descripcion:
      "Atendemos consultas y pedidos 24/7 por WhatsApp, Instagram o chat web, con respuestas inmediatas y precisas.",
    image: "/images/etapa-1.png",
  },
  {
    id: 2,
    etapa: "ETAPA 2",
    titulo: "Inventario",
    descripcion:
      "Verificamos y modificamos el stock en tiempo real para evitar ventas de productos agotados.",
    image: "/images/etapa-2.png",
  },
  {
    id: 3,
    etapa: "ETAPA 3",
    titulo: "Pagos y Datos",
    descripcion:
      "Confirmamos de inmediato los pagos realizados, así como dirección e información del cliente.",
    image: "/images/etapa-3.png",
  },
  {
    id: 4,
    etapa: "ETAPA 4",
    titulo: "Despacho",
    descripcion:
      "Del almacén (ya sea de VentIA o de la empresa) a la puerta del cliente en menos de 24 horas.",
    image: "/images/etapa-4.png",
  },
  {
    id: 5,
    etapa: "ETAPA 5",
    titulo: "Seguimiento y Contabilidad",
    descripcion:
      "Supervisamos para garantizar ventas correctas y entregas puntuales. También nos encargamos de tu facturación y contabilidad.",
    image: "/images/etapa-5.png",
  },
];

export default function Solutions() {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (carouselRef.current) {
      const index = Math.round(
        carouselRef.current.scrollLeft / carouselRef.current.offsetWidth
      );
      setActiveIndex(index);
    }
  };

  const scrollByOne = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth;
      carouselRef.current.scrollBy({
        left: direction === "left" ? -cardWidth : cardWidth,
        behavior: "smooth",
      });
    }
  };

  return (
    <section
      id="soluciones"
      className="relative bg-[#fafafa] py-12 sm:py-16 md:py-20 lg:py-[80px] w-full scroll-mt-24 sm:scroll-mt-28 md:scroll-mt-[109px]"
    >
      {/* FONDO MARCA DE AGUA */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center opacity-40">
        <div className="relative w-[500px] sm:w-[650px] md:w-[850px] aspect-square">
          <Image
            src="/images/logo-ventia-gris.png"
            alt="Fondo soluciones"
            fill
            className="object-contain pt-8 sm:pt-10 md:pt-[55px]"
          />
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="relative max-w-[90%] mx-auto px-4 sm:px-0">

        {/* TÍTULO Y DESCRIPCIÓN */}
        <FadeUp delay={0}>
          <div className="relative text-center mb-8 sm:mb-10 md:mb-[47px]">
            <h2 className="text-2xl sm:text-3xl md:text-[40px] leading-tight sm:leading-snug md:leading-[44px] font-libre font-semibold text-shadow-[0_0_1px_black] text-black m-0 mb-6 sm:mb-8 md:mb-[47px] p-0">
              NUESTRAS SOLUCIONES
            </h2>
            <div className="max-w-full sm:max-w-[700px] md:max-w-[857px] mx-auto px-4 sm:px-0">
              <p className="text-sm sm:text-base md:text-[20px] leading-relaxed sm:leading-normal md:leading-[24px] font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] text-black m-0 p-0">
                Nos encargamos de todo: atender, vender, cobrar y entregar.
                Olvídate de la operación diaria y dedica cada minuto a hacer
                crecer tus ventas.
              </p>
            </div>
          </div>
        </FadeUp>

        {/* WRAPPER CARDS CON FLECHAS (MOBILE) */}
        <div className="relative max-w-[340px] sm:max-w-[400px] mx-auto md:max-w-none">

          {/* FLECHA IZQUIERDA (Móvil) */}
          <button
            onClick={() => scrollByOne("left")}
            className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 p-1.5 sm:p-2 text-[#212835] hover:text-black transition md:hidden"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* FLECHA DERECHA (Móvil) */}
          <button
            onClick={() => scrollByOne("right")}
            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 p-1.5 sm:p-2 text-[#212835] hover:text-black transition md:hidden"
            aria-label="Siguiente"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* CONTENEDOR SCROLLABLE / GRID */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="
              /* MOBILE: Carrusel */
              flex overflow-x-auto snap-x snap-mandatory gap-0 pb-8 no-scrollbar pt-8 sm:pt-12 md:pt-14

              /* DESKTOP: Grid con gaps específicos y altura uniforme */
              md:grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5
              md:gap-8 lg:gap-12 xl:gap-15
              md:overflow-visible md:pb-0
              md:auto-rows-fr
            "
          >
            {solutions.map((solution, index) => (
              <FadeUp
                key={solution.id}
                delay={0.05 * index}
                className="
                  /* MOBILE */
                  min-w-full w-full snap-center shrink-0 px-2

                  /* DESKTOP */
                  md:min-w-0 md:w-auto md:px-0
                  md:h-full
                "
              >
                <article className="bg-white rounded-[30px] overflow-hidden h-full flex flex-col items-center text-center p-6 sm:p-8">

                  {/* BADGE ETAPA */}
                  <div className="w-[80px] sm:w-[90px] h-[28px] sm:h-[32px] bg-[#48c1ec] text-white text-sm sm:text-[16px] font-bold rounded-full flex items-center justify-center mt-2 sm:mt-4 mb-4 sm:mb-[31.6375px]">
                    <p className="m-0 p-0">{solution.etapa}</p>
                  </div>

                  {/* TÍTULO */}
                  <div className="mb-4 sm:mb-[31.6375px] min-h-[56px] md:min-h-[58px] flex items-center justify-center">
                    <p className="text-lg sm:text-xl md:text-[24px] leading-tight sm:leading-normal md:leading-[28.8px] font-['Helvetica_Italic',Helvetica,Arial,Lucida,sans-serif] italic text-black m-0 p-0">
                      {solution.titulo}
                    </p>
                  </div>

                  {/* DESCRIPCIÓN */}
                  <div className="mb-4 sm:mb-6 md:mb-[31.6375px] flex-grow flex items-start">
                    <p className="text-xs sm:text-sm md:text-[15px] leading-relaxed sm:leading-normal md:leading-[18px] font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] font-light text-shadow-[0_0_0.5px_black] text-black m-0 p-0">
                      {solution.descripcion}
                    </p>
                  </div>

                  {/* IMAGEN */}
                  <div className="w-full flex justify-center leading-[0px] mt-auto">
                    <span className="inline-block relative max-w-full">
                      <Image
                        src={solution.image}
                        alt={solution.titulo}
                        width={220}
                        height={167}
                        className="max-w-[180px] sm:max-w-[200px] md:max-w-full h-auto relative"
                      />
                    </span>
                  </div>
                </article>
              </FadeUp>
            ))}
          </div>

          {/* PAGINACIÓN (DOTS) - Solo Móvil */}
          <div className="flex justify-center gap-2.5 mt-5 md:hidden">
            {solutions.map((_, i) => (
              <a
                key={i}
                href="#"
                onClick={(e) => e.preventDefault()}
                className={`
                  inline-block w-[7px] h-[7px] rounded-full bg-[#212835]
                  ${i === activeIndex ? "opacity-100" : "opacity-50"}
                  transition-opacity
                `}
                style={{ textIndent: "-9999px" }}
              >
                {i + 1}
              </a>
            ))}
          </div>
        </div>

        {/* BOTÓN CTA */}
        <FadeUp delay={0.15}>
          <div className="relative text-center mt-6 sm:mt-8 md:mt-[27px] p-0">
            <a
              href="#contacto"
              className="
                inline-block
                bg-[#212835] text-white
                text-sm sm:text-base md:text-[20px] leading-tight sm:leading-normal md:leading-[34px]
                font-['Helvetica_Medium',Helvetica,Arial,Lucida,sans-serif]
                rounded-[36px]
                pt-2.5 sm:pt-3 md:pt-3 pb-1.5 px-10 sm:px-16 md:px-20
                border-0
                transition-all duration-300
                hover:bg-[#48c1ec]
              "
            >
              AGENDA TU DEMO
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
