"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="
        relative overflow-hidden
        bg-[url('/images/imagen-hero-mobile.avif')]
        md:bg-[url('/images/imagen-hero-desktop.avif')]
        bg-cover bg-center bg-no-repeat
        text-black
        scroll-mt-24 md:scroll-mt-28
      "
    >
      <div
        className="
          mx-auto max-w-7xl
          px-6 lg:px-10
          min-h-screen
          flex flex-col md:flex-row
          /* CAMBIO 1: 'md:items-center' para bajar el texto y centrarlo con la imagen */
          items-center md:items-center
          justify-between
          gap-10 md:gap-12 lg:gap-16
          pt-24 md:pt-0 /* Quitamos padding top extra en desktop para que el centrado flex actúe mejor */
          pb-20 md:pb-0
        "
      >
        {/* Contenedor de Texto */}
        <div className="max-w-xl lg:max-w-2xl flex flex-col items-center md:items-start z-10 relative">
          <FadeUp delay={0}>
            <h1
              className="
                text-4xl sm:text-5xl lg:text-[3.8rem]
                font-heading font-semibold
                leading-[1.1]
                mb-8
                text-center md:text-left
              "
            >
              VENDEMOS Y
              <br />
              ENTREGAMOS POR TI.
            </h1>
          </FadeUp>

          <FadeUp delay={0.1}>
            <p
              className="
                font-sans
                text-sm sm:text-base lg:text-lg
                leading-[1.3]
                mb-10
                text-justify
              "
            >
              Ventia automatiza tus ventas y entregas para que tu negocio esté{" "}
              <span className="font-semibold">activo 24/7</span>. Usamos
              inteligencia artificial, logística y supervisión humana para cerrar
              pedidos, despachar de inmediato y asegurar la mejor experiencia de
              compra para tus clientes.
            </p>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-4 mb-4 w-full">
              <a
                href="#contacto"
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  bg-[#182432] text-white
                  w-72
                  py-3 lg:py-3.5
                  text-sm sm:text-base lg:text-lg
                  font-sans font-medium
                  shadow-md
                  hover:bg-[#2F7CF4]
                  transition
                "
              >
                AGENDA TU DEMO
              </a>

              <a
                href="#planes"
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  border border-black
                  bg-sky-200
                  w-72
                  py-3 lg:py-3.5
                  text-sm sm:text-base lg:text-lg
                  font-sans font-medium
                  text-[#182432]
                  hover:bg-[#182432] hover:text-white
                  transition
                "
              >
                Ver Planes
              </a>
            </div>
          </FadeUp>
        </div>

        {/* Imagen del Hero */}
        <div 
          className="
            w-full 
            /* CAMBIO 2: Imagen mucho más grande en desktop (58% width y max-w-800px) */
            md:w-[58%] 
            md:max-w-[800px]
            relative z-0
            mt-8 md:mt-0
          "
        >
          <FadeUp delay={0.3}>
            <Image
              src="/images/imagen-hero.png"
              alt="Vista de VentIA en acción"
              width={1200}
              height={1200}
              className="
                w-full h-auto
                object-contain object-center
                select-none pointer-events-none
                /* Escala un poco más la imagen visualmente */
                scale-110 md:scale-125 origin-center
              "
              priority
            />
          </FadeUp>
        </div>
      </div>
    </section>
  );
}