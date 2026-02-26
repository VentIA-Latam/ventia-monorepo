"use client";

import { useState, useRef } from "react";
import FadeUp from "@/components/ui/FadeUp";

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRight = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const plans = [
  {
    name: "Start",
    price: "99",
    features: ["700 conversaciones / mes", "250 SKUs (Hasta 50 productos activos)"],
    extra: null,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "249",
    features: ["2,000 conversaciones / mes", "500 SKUs (Hasta 100 productos activos)"],
    extra: "Incluye configuración de recordatorios a tu agente",
    highlighted: true,
  },
  {
    name: "Business",
    price: "399",
    features: ["3,500 conversaciones / mes", "1,250 SKUs (Hasta 250 productos activos)"],
    extra: "Incluye todo lo anterior y opción de envío de campañas masivas",
    highlighted: false,
  },
  {
    name: "Enterprise",
    price: "699",
    features: ["5,000 conversaciones / mes", "2,500 SKUs (Hasta 500 productos activos)"],
    extra: "Incluye todo lo anterior",
    highlighted: false,
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

  const renderCard = (plan: typeof plans[number]) => (
    <div
      className={`
        relative rounded-2xl p-6 lg:p-7 flex flex-col h-full
        transition-all duration-300
        ${plan.highlighted
          ? "bg-white border-2 border-[#5ACAF0] shadow-xl shadow-[#5ACAF0]/15 scale-[1.02]"
          : "bg-white border border-transparent hover:shadow-lg"
        }
      `}
    >
      {/* Badge */}
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#5ACAF0] text-white text-[10px] font-bold font-sans uppercase tracking-wider px-4 py-1 rounded-full shadow-sm shadow-[#5ACAF0]/30">
          Más popular
        </span>
      )}

      {/* Nombre */}
      <h3 className={`text-xs font-bold uppercase tracking-widest font-sans mb-5 ${
        plan.highlighted ? "text-[#5ACAF0]" : "text-[#182432]/40"
      }`}>
        {plan.name}
      </h3>

      {/* Precio */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-xs font-medium font-sans text-[#182432]/35">USD</span>
          <span className="text-4xl lg:text-5xl font-bold font-libre text-[#182432]">
            {plan.price}
          </span>
        </div>
        <p className="text-xs font-medium font-sans mt-1 text-[#182432]/35">/ mes + IGV</p>
      </div>

      {/* CTA */}
      <a
        href="https://calendly.com/tarek-ventia-latam/ventia"
        target="_blank"
        rel="noopener noreferrer"
        className={`
          w-full inline-flex items-center justify-center rounded-full py-2.5
          text-sm font-bold font-sans uppercase tracking-wide transition-colors duration-300 mb-6
          bg-[#182432] text-white hover:bg-[#5ACAF0]
        `}
      >
        Contáctanos
      </a>

      {/* Separador */}
      <div className="h-px mb-5 bg-[#182432]/[0.08]" />

      {/* Features con checks */}
      <ul className="space-y-3 flex-1">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon className={`w-4 h-4 shrink-0 mt-0.5 ${
              plan.highlighted ? "text-[#5ACAF0]" : "text-[#5ACAF0]/70"
            }`} />
            <span className="text-sm font-sans leading-snug text-[#182432]/60">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* Extra note */}
      {plan.extra && (
        <p className="text-[11px] text-[#182432]/40 font-sans italic mt-4 leading-relaxed text-center">
          {plan.extra}
        </p>
      )}
    </div>
  );

  return (
    <section
      id="planes"
      className="bg-[#182432] py-16 md:py-24 lg:py-32 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        {/* Encabezado */}
        <div className="text-center mb-10 md:mb-14 lg:mb-16">
          <FadeUp delay={0}>
            <p className="text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
              Pricing
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-libre leading-tight mb-4">
              NUESTROS PLANES
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base lg:text-lg text-white/50 font-sans max-w-md mx-auto">
              Elige tu camino. Siempre puedes escalar después.
            </p>
          </FadeUp>
        </div>

        {/* Desktop: Grid de cards */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {plans.map((plan, index) => (
            <FadeUp key={plan.name} delay={0.05 * (index + 1)}>
              {renderCard(plan)}
            </FadeUp>
          ))}
        </div>

        {/* Mobile: Carousel */}
        <div className="md:hidden relative max-w-[340px] sm:max-w-[400px] mx-auto">
          <button
            onClick={() => scrollByOne("left")}
            className="absolute -left-4 sm:-left-5 top-1/2 -translate-y-1/2 z-20 p-1.5 text-white/60 hover:text-white transition"
            aria-label="Plan anterior"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          <button
            onClick={() => scrollByOne("right")}
            className="absolute -right-4 sm:-right-5 top-1/2 -translate-y-1/2 z-20 p-1.5 text-white/60 hover:text-white transition"
            aria-label="Plan siguiente"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>

          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory gap-0 pt-4 pb-6 no-scrollbar"
          >
            {plans.map((plan) => (
              <div key={plan.name} className="min-w-full w-full snap-center shrink-0 px-2">
                {renderCard(plan)}
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-2 mt-2">
            {plans.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  if (carouselRef.current) {
                    carouselRef.current.scrollTo({
                      left: i * carouselRef.current.offsetWidth,
                      behavior: "smooth",
                    });
                  }
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-5 bg-[#5ACAF0]" : "w-1.5 bg-white/25"
                }`}
                aria-label={`Plan ${plans[i].name}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
