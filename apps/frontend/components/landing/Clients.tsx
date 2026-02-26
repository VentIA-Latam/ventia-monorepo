"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

const clients = [
  { name: "Nassau", image: "/images/logo-nassau.avif" },
  { name: "Not Pepper", image: "/images/logo-not-pepper.avif" },
  { name: "Cromo", image: "/images/logo-cromo.avif" },
  { name: "Crayfish", image: "/images/logo-crayfish.avif" },
  { name: "La Doré", image: "/images/logo-la-dore.avif" },
  { name: "Go Active", image: "/images/logo-go-active.avif" },
  { name: "AquaFlask", image: "/images/logo-aquaflask.avif" },
  { name: "Nola", image: "/images/logo-nola.avif" },
];

export default function Clients() {
  // Duplicate for seamless infinite loop
  const marqueeItems = [...clients, ...clients];

  return (
    <section
      id="clientes"
      className="bg-white py-14 md:py-20 lg:py-24 scroll-mt-24 md:scroll-mt-28 overflow-hidden"
    >
      {/* Encabezado */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">
        <FadeUp delay={0}>
          <p className="text-center text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
            Confían en nosotros
          </p>
        </FadeUp>
        <FadeUp delay={0.05}>
          <h2 className="text-center text-3xl sm:text-4xl lg:text-5xl font-bold text-[#182432] font-libre leading-tight mb-4">
            NUESTROS CLIENTES
          </h2>
        </FadeUp>
        <FadeUp delay={0.1}>
          <p className="text-center text-base lg:text-lg text-[#182432]/50 font-sans max-w-lg mx-auto">
            Marcas que ya automatizan sus ventas y logística con VentIA.
          </p>
        </FadeUp>
      </div>

      {/* Marquee infinito */}
      <FadeUp delay={0.15}>
        <div className="relative mt-12 md:mt-16">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 md:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 md:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          {/* Track */}
          <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
            {marqueeItems.map((client, i) => (
              <div
                key={`${client.name}-${i}`}
                className="flex items-center justify-center px-8 sm:px-10 md:px-12 lg:px-14"
              >
                <div className="relative h-10 sm:h-12 md:h-14 w-24 sm:w-28 md:w-32 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
                  <Image
                    src={client.image}
                    alt={client.name}
                    fill
                    className="object-contain"
                    sizes="128px"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeUp>
    </section>
  );
}
