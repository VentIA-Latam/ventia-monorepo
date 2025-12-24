"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { HiChevronLeft, HiChevronRight } from "react-icons/hi";

const clients = [
  { name: "Nassau", image: "/images/logo-nassau.avif" },
  { name: "Not Pepper", image: "/images/logo-not-pepper.avif" },
  { name: "Cromo", image: "/images/logo-cromo.avif" },
  { name: "La Doré", image: "/images/logo-la-dore.avif" },
  { name: "Go Active", image: "/images/logo-go-active.avif" },
  { name: "AquaFlask", image: "/images/logo-aquaflask.avif" },
  { name: "Nola", image: "/images/logo-nola.avif" },
];

const VISIBLE_DESKTOP = 5;

export default function Clients() {
  const [startIndex, setStartIndex] = useState(0);
  const total = clients.length;

  const handleNext = () => setStartIndex((prev) => (prev + 1) % total);
  const handlePrev = () => setStartIndex((prev) => (prev - 1 + total) % total);

  const getClientAt = (offset: number) => {
    const index = (startIndex + offset + total) % total;
    return clients[index];
  };

  const visibleMobile = 3;
  const visibleTablet = 4;

  useEffect(() => {
    const interval = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % total);
    }, 2200);
    return () => clearInterval(interval);
  }, [total]);

  return (
    <section
      id="clientes"
      className="bg-white py-18 md:py-20 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-libre font-semibold tracking-wide text-[#182432] mb-4">
            CLIENTES QUE CONFÍAN
          </h2>
          <p className="text-sm md:text-base font-inter text-[#182432]">
            Marcas que ya automatizan sus ventas y/o logística con VentIA.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 lg:gap-8">
          <button
            type="button"
            onClick={handlePrev}
            className="
              hidden md:inline-flex
              items-center justify-center
              h-10 w-10
              rounded-full
              border border-gray-300
              text-[#111827]
              hover:bg-gray-100
              transition
              font-inter
            "
            aria-label="Anterior"
          >
            <HiChevronLeft className="h-6 w-6" />
          </button>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full flex items-center justify-center gap-8 md:gap-10 lg:gap-14">
              {/* MOBILE: 3 logos */}
              <div className="flex md:hidden items-center justify-center gap-8">
                {Array.from({ length: visibleMobile }).map((_, i) => {
                  const client = getClientAt(i);
                  return (
                    <div
                      key={`${client.name}-m-${i}`}
                      className="h-14 w-[100px] flex items-center justify-center"
                    >
                      <div className="relative h-full w-full transition-transform duration-300 ease-out">
                        <Image
                          src={client.image}
                          alt={client.name}
                          fill
                          className="object-contain"
                          sizes="33vw"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TABLET: 4 logos */}
              <div className="hidden md:flex lg:hidden items-center justify-center gap-10">
                {Array.from({ length: visibleTablet }).map((_, i) => {
                  const client = getClientAt(i);
                  return (
                    <div
                      key={`${client.name}-t-${i}`}
                      className="h-16 w-[130px] flex items-center justify-center"
                    >
                      <div className="relative h-full w-full transition-transform duration-300 ease-out">
                        <Image
                          src={client.image}
                          alt={client.name}
                          fill
                          className="object-contain"
                          sizes="25vw"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP: 5 logos */}
              <div className="hidden lg:flex items-center justify-center gap-14">
                {Array.from({ length: VISIBLE_DESKTOP }).map((_, i) => {
                  const client = getClientAt(i);
                  return (
                    <div
                      key={`${client.name}-d-${i}`}
                      className="h-20 w-[170px] flex items-center justify-center"
                    >
                      <div className="relative h-full w-full transition-transform duration-300 ease-out lg:hover:scale-110">
                        <Image
                          src={client.image}
                          alt={client.name}
                          fill
                          className="object-contain"
                          sizes="(max-width:1200px) 18vw, 170px"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="
              hidden md:inline-flex
              items-center justify-center
              h-10 w-10
              rounded-full
              border border-gray-300
              text-[#111827]
              hover:bg-gray-100
              transition
              font-inter
            "
            aria-label="Siguiente"
          >
            <HiChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>
    </section>
  );
}
