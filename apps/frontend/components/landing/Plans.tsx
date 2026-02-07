"use client";

import { useState, useRef } from "react";
import FadeUp from "@/components/ui/FadeUp";

// Flechas SVG (Color blanco para resaltar en fondo oscuro)
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

const plans = [
  {
    name: "IA\nBÁSICO",
    price: "$49.90",
    subtitle: "DESDE",
    priceDetails: "",
    features: [
      "IA conversacional 24/7",
      "Atención desde redes sociales y WhatsApp",
      "Validación automática de pagos",
      "Gestión de inventario",
    ],
  },
  {
    name: "IA +\nLOGÍSTICA",
    price: "$69.90",
    subtitle: "DESDE",
    priceDetails: "+ un fee por cada entrega",
    features: [
      "Todo lo del plan IA Básico",
      "Recogemos de tu punto de venta y entregamos al cliente.",
    ],
  },
  {
    name: "FULL\nOPERACIÓN",
    price: "Variable",
    subtitle: "",
    priceDetails: "+ un fee por cada entrega",
    features: [
      "Todo lo del plan IA Básico",
      "Almacenamiento de stock",
      "Armado de pedidos.",
      "Entrega al cliente.",
      "Nos encargamos de tu contabilidad.",
    ],
  },
];

export default function Plans() {
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
      id="planes"
      className="bg-[#182432] py-12 sm:py-16 md:py-20 lg:py-28 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-350 px-4 sm:px-6 md:px-10 relative">

        <FadeUp delay={0}>
          <h2 className="text-center text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-libre font-semibold mb-8 sm:mb-10 md:mb-14">
            NUESTROS PLANES
          </h2>
        </FadeUp>

        {/* WRAPPER DEL CARRUSEL */}
        <div className="relative z-1 max-w-[340px] sm:max-w-[400px] mx-auto md:max-w-none">

          {/* FLECHA IZQUIERDA (Móvil) */}
          <button
            onClick={() => scrollByOne("left")}
            className="
              absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-20
              p-1.5 sm:p-2 text-white hover:text-gray-300 transition
              md:hidden
            "
            aria-label="Plan anterior"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* FLECHA DERECHA (Móvil) */}
          <button
            onClick={() => scrollByOne("right")}
            className="
              absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 z-20
              p-1.5 sm:p-2 text-white hover:text-gray-300 transition
              md:hidden
            "
            aria-label="Plan siguiente"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>

          {/* CONTENEDOR SCROLLABLE */}
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="
              /* MOBILE: Carrusel */
              flex
              overflow-x-auto
              snap-x snap-mandatory
              gap-0
              pb-8
              no-scrollbar

              /* DESKTOP: Grid */
              md:grid
              md:grid-cols-3
              md:gap-6 lg:gap-10 xl:gap-20
              items-stretch
              md:overflow-visible
              md:pb-0
            "
          >
            {plans.map((plan, index) => (
              <FadeUp
                key={index}
                delay={0.05 * (index + 1)}
                className="
                  min-w-full w-full
                  snap-center shrink-0
                  px-2 
                  md:min-w-0 md:w-auto md:px-0
                  h-full
                "
              >
                <div
                  className="
                    bg-white rounded-[30px] sm:rounded-[40px]
                    shadow-[0_40px_140px_rgba(0,0,0,0.40)]
                    px-6 py-8 sm:px-8 sm:py-10 md:px-12 md:py-12
                    flex flex-col items-center text-center
                    h-full relative
                  "
                >
                  {/* --- ENCABEZADO DEL PLAN --- */}
                  <h3 className="text-lg sm:text-xl md:text-2xl tracking-widest text-black mb-3 sm:mb-4 uppercase font-sans font-bold whitespace-pre-line leading-tight">
                    {plan.name}
                  </h3>

                  {/* Subtítulo (DESDE) */}
                  <p
                    className={`
                      text-xs md:text-sm font-sans text-[#182432]/60 mb-1
                      ${!plan.subtitle ? "invisible" : ""}
                    `}
                  >
                    {plan.subtitle || "DESDE"}
                  </p>

                  {/* Precio y Detalle */}
                  <div className="mb-4 sm:mb-5 md:mb-6 w-full">
                    {/* CAMBIO AQUÍ: text-black para negro puro */}
                    <p className="text-3xl sm:text-4xl md:text-5xl font-libre font-bold text-black">
                      {plan.price}
                    </p>

                    <p
                      className={`
                        text-xs md:text-sm font-sans font-medium text-[#182432] mt-2
                        ${!plan.priceDetails ? "invisible select-none" : ""}
                      `}
                    >
                      {plan.priceDetails || "+ un fee por cada entrega"}
                    </p>
                  </div>

                  {/* --- BOTÓN --- */}
                  <a
                    href="https://calendly.com/tarek-ventia-latam/ventia"
                    //href="https://wa.me/51951752355?text=Hola!%20Quiero%20más%20información%20sobre%20los%20planes%20de%20VentIA."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center justify-center
                      rounded-full
                      bg-[#5ACAF0]
                      px-8 sm:px-10 py-2.5 sm:py-3
                      text-xs sm:text-sm md:text-base font-sans font-bold text-white
                      shadow-md
                      border-2 border-[#5ACAF0]
                      hover:bg-white hover:text-[#48C1EC] hover:border-[#48C1EC]
                      transition
                      uppercase tracking-wide
                      mb-6 sm:mb-8
                    "
                  >
                    CONTÁCTANOS
                  </a>

                  {/* --- CARACTERÍSTICAS --- */}
                  <ul className="w-full text-left text-xs sm:text-sm md:text-base font-sans font-medium text-[#182432] space-y-2 sm:space-y-3 px-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 sm:gap-3">
                        <span className="mt-1.5 sm:mt-2 h-1.5 w-1.5 min-w-1.5 rounded-full bg-[#182432]" />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>

                </div>
              </FadeUp>
            ))}
          </div>

          {/* PAGINACIÓN (DOTS) - Solo Móvil */}
          <div className="flex justify-center gap-2 mt-2 md:hidden">
            {plans.map((_, i) => (
              <div
                key={i}
                className={`
                  h-2 w-2 rounded-full transition-colors duration-300
                  ${i === activeIndex ? "bg-white" : "bg-white/30"}
                `}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
