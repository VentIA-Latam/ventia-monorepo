"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

// Flechas SVG simples y oscuras
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
      className="bg-white py-20 md:py-28 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6 relative">
        
        {/* --- FONDO MARCA DE AGUA (REVERTIDO: GRIS CON FILTROS) --- */}
        <div className="pointer-events-none absolute inset-x-0 top-20 md:top-0 flex justify-center opacity-35">
          <div className="relative w-[700px] md:w-[850px] aspect-square">
            <Image
              src="/images/logo-ventia-gris.png"
              alt="Fondo soluciones"
              fill
              className="object-contain brightness-[3.5] contrast-90"
            />
          </div>
        </div>
        {/* --------------------------------------------------------- */}

        <FadeUp delay={0}>
          <div className="relative text-center mb-10 md:mb-14">
            <h2 className="text-3xl md:text-4xl font-libre font-semibold mb-4 tracking-wide text-[#182432] uppercase">
              NUESTRAS
              <br className="md:hidden" /> SOLUCIONES
            </h2>
            <p className="max-w-3xl mx-auto text-sm md:text-base font-inter leading-relaxed text-[#182432]">
              Nos encargamos de todo: atender, vender, cobrar y entregar.
              Olvídate de la operación diaria y dedica cada minuto a hacer
              crecer tus ventas.
            </p>
          </div>
        </FadeUp>

        {/* WRAPPER PRINCIPAL */}
        <div className="relative z-1 max-w-[400px] mx-auto md:max-w-none">
          
          {/* FLECHA IZQUIERDA (Móvil) */}
          <button
            onClick={() => scrollByOne("left")}
            className="
              absolute -left-4 top-1/2 -translate-y-1/2 z-20
              p-2 text-[#182432] hover:text-black transition
              md:hidden
            "
            aria-label="Anterior"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          {/* FLECHA DERECHA (Móvil) */}
          <button
            onClick={() => scrollByOne("right")}
            className="
              absolute -right-4 top-1/2 -translate-y-1/2 z-20
              p-2 text-[#182432] hover:text-black transition
              md:hidden
            "
            aria-label="Siguiente"
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* CONTENEDOR SCROLLABLE */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="
              /* MOBILE: Carrusel w-full */
              flex
              overflow-x-auto
              snap-x snap-mandatory
              gap-0
              pb-8
              no-scrollbar

              /* DESKTOP: Grid con gap aumentado */
              md:grid
              md:grid-cols-2
              lg:grid-cols-3
              xl:grid-cols-5
              md:gap-8 xl:gap-10
              md:overflow-visible
              md:pb-0
            "
          >
            {solutions.map((solution, index) => (
              <FadeUp
                key={solution.id}
                delay={0.05 * index}
                className="
                  /* MOBILE */
                  min-w-full w-full
                  snap-center shrink-0
                  px-2 
                  
                  /* DESKTOP */
                  md:min-w-0 md:w-auto md:px-0
                  h-full
                "
              >
                <article
                  className="
                    h-full flex flex-col items-center text-center
                    bg-white rounded-[40px]
                    shadow-[0_12px_40px_rgba(0,0,0,0.08)]
                    px-6 py-10
                    border border-[#F1F4FA]
                    w-full
                  "
                >
                  <div className="mb-6">
                    <span className="inline-flex items-center justify-center px-7 py-1.5 rounded-full bg-[#5ACAF0] text-white text-xs font-inter font-semibold tracking-wide">
                      {solution.etapa}
                    </span>
                  </div>

                  <h3 className="text-2xl font-libre italic font-medium text-[#182432] mb-4">
                    {solution.titulo}
                  </h3>

                  {/* Texto en Medium/Semibold para que se vea "negrito" */}
                  <p className="text-sm font-inter font-medium leading-relaxed text-[#182432] mb-8 px-1">
                    {solution.descripcion}
                  </p>

                  <div className="mt-auto w-full flex justify-center">
                    <div className="relative w-full max-w-[220px] h-48">
                      <Image
                        src={solution.image}
                        alt={solution.titulo}
                        fill
                        className="object-contain object-bottom"
                      />
                    </div>
                  </div>
                </article>
              </FadeUp>
            ))}
          </div>

          {/* PAGINACIÓN (DOTS) - Solo Móvil */}
          <div className="flex justify-center gap-2 mt-2 md:hidden">
            {solutions.map((_, i) => (
              <div
                key={i}
                className={`
                  h-2 w-2 rounded-full transition-colors duration-300
                  ${i === activeIndex ? "bg-[#182432]" : "bg-gray-300"}
                `}
              />
            ))}
          </div>
        </div>

        <FadeUp delay={0.15}>
          <div className="relative flex justify-center mt-10 md:mt-16">
            <a
              href="#contacto"
              className="
                inline-flex items-center justify-center
                rounded-full
                bg-[#182432] text-white
                px-14 py-3
                text-base font-inter font-medium
                shadow-lg
                hover:bg-black transition
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