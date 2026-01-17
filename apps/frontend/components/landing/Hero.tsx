"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[url('/images/imagen-hero-mobile.avif')] md:bg-[url('/images/imagen-hero-desktop.avif')] bg-[50%_50%] bg-cover bg-no-repeat pt-32 md:pt-40 lg:pt-44 pb-8 md:pb-12 lg:pb-14 w-full"
    >
      {/* Contenedor principal - centrado con max-width y padding lateral responsive */}
      <div className="w-full max-w-[100%] mx-auto px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        {/* Layout flex con gap proporcional */}
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10 md:gap-14 lg:gap-24 xl:gap-28 py-6 md:py-8 lg:py-12">

          {/* Contenedor de Texto - flex-1 para escalar proporcionalmente */}
          <div className="w-full lg:flex-1 lg:max-w-[45%] text-center lg:text-left order-1 lg:pt-12 xl:pt-32">

            <FadeUp delay={0}>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] leading-tight lg:leading-[44px] font-semibold text-black font-['Libre_Franklin',Helvetica,Arial,Lucida,sans-serif] mb-4 md:mb-6 lg:mb-8">
                VENDEMOS Y
                <br />
                ENTREGAMOS POR TI.
              </h1>
            </FadeUp>

            <FadeUp delay={0.1}>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed lg:leading-[28px] text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] mb-4 md:mb-6 lg:mb-8 text-justify lg:text-left">
                Ventia automatiza tus ventas y entregas para que tu negocio esté{" "}
                <strong className="font-bold">activo 24/7.</strong>{" "}
                Usamos inteligencia artificial, logística y supervisión humana
                para cerrar pedidos, despachar de inmediato y asegurar la
                mejor experiencia de compra para tus clientes.
              </p>
            </FadeUp>

            <FadeUp delay={0.2}>
              {/* Botones con ancho máximo en mobile, flex en desktop */}
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4 max-w-[320px] sm:max-w-none mx-auto lg:mx-0">
                <a
                  href="#contacto"
                  className="flex-1 text-center text-sm md:text-base lg:text-lg font-bold bg-[rgb(33,40,53)] text-white border-2 border-[rgb(33,40,53)] rounded-full py-3 md:py-3.5 px-6 no-underline transition-colors hover:bg-[#48c1ec] hover:border-[#48c1ec]"
                >
                  AGENDA TU DEMO
                </a>
                <a
                  href="#planes"
                  className="flex-1 text-center text-sm md:text-base lg:text-lg font-bold bg-transparent text-[rgb(33,40,53)] border-2 border-[rgb(33,40,53)] rounded-full py-3 md:py-3.5 px-6 no-underline transition-colors hover:bg-[#212835] hover:text-white"
                >
                  Ver Planes
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Imagen del Hero - flex-1 para escalar proporcionalmente */}
          <div className="w-full lg:flex-1 lg:max-w-[50%] order-2">
            <FadeUp delay={0.3}>
              <Image
                src="/images/imagen-hero.png"
                alt="Vista de VentIA en acción"
                width={2560}
                height={2387}
                className="w-full h-auto"
                priority
              />
            </FadeUp>
          </div>

        </div>
      </div>
    </section>
  );
}
