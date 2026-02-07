"use client";

import * as React from "react";
import Image from "next/image";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
  const plugin = React.useRef(
    Autoplay({ delay: 2200, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  return (
    <section
      id="clientes"
      className="bg-white py-18 md:py-20 scroll-mt-[109px]"
    >
      {/* Título centrado con max-width */}
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-[40px] font-libre font-bold tracking-wide text-[#182432] mb-4">
            CLIENTES QUE CONFÍAN
          </h2>
          <p className="text-[20px] font-sans text-[#182432] font-semibold">
            Marcas que ya automatizan sus ventas y/o logística con VentIA.
          </p>
        </div>
      </div>

      {/* Carrusel a todo ancho */}
      <div className="w-full">
        <div className="relative flex items-center justify-center gap-4 lg:gap-8 px-4 md:px-8 lg:px-12">
          <Carousel
            plugins={[plugin.current]}
            className="w-[90%]"
            opts={{
              align: "start",
              loop: true,
            }}
            onMouseEnter={() => plugin.current.stop()}
            onMouseLeave={() => plugin.current.play()}
          >
            {/* Botón Anterior - Solo Desktop */}
            <div className="hidden md:block absolute -left-12 lg:-left-16 top-1/2 -translate-y-1/2 z-10">
              <CarouselPrevious />
            </div>

            <CarouselContent className="-ml-0.5">
              {clients.map((client, index) => (
                <CarouselItem
                  key={index}
                  className="
                    pl-0.5
                    basis-1/3
                    sm:basis-1/4
                    md:basis-1/4
                    lg:basis-1/6
                  "
                >
                  <div className="h-14 sm:h-16 md:h-20 w-full flex items-center justify-center p-0.5">
                    <div className="relative h-full w-full transition-transform duration-300 ease-out hover:scale-110">
                      <Image
                        src={client.image}
                        alt={client.name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* Botón Siguiente - Solo Desktop */}
            <div className="hidden md:block absolute -right-12 lg:-right-16 top-1/2 -translate-y-1/2 z-10">
              <CarouselNext />
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  );
}
