"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[url('/images/imagen-hero-mobile.avif')] md:bg-[url('/images/imagen-hero-desktop.avif')] bg-cover bg-center bg-no-repeat pt-32 pt-40 md:pt-50 lg:pt-40 pb-8 sm:pb-12 md:pb-[54px]"
    >
      <div className="max-w-[90%] sm:max-w-[600px] md:max-w-[90%] mx-auto relative flex flex-col items-center md:flex-row md:items-start pt-4 sm:pt-6 md:pt-[27px] pb-4 sm:pb-6 md:pb-[27px] px-4 md:px-0">

        {/* Contenedor de Texto */}
        <div className="w-full md:w-[47.25%] relative z-[2] text-center md:text-left order-1 md:order-1 md:mt-[274.219px] md:mb-[274.219px] md:mr-[94.2969px]">
          <FadeUp delay={0}>
            <div className="relative animate-[0.2s_linear] break-words mb-6 sm:mb-8 md:-mt-[100px] md:mb-[47.1406px]">
              <div className="relative">
                <p className="text-2xl sm:text-3xl md:text-[40px] leading-tight sm:leading-snug md:leading-[44px] font-semibold text-black font-['Libre_Franklin',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  VENDEMOS Y
                  <br />
                  ENTREGAMOS POR TI.
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="text-justify relative animate-[0.2s_linear] break-words mb-6 sm:mb-8 md:mb-[47.1406px]">
              <div className="relative">
                <p className="text-shadow-[0_0_0.5px_black] text-sm sm:text-base md:text-[20px] leading-relaxed sm:leading-normal md:leading-[24px] text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  Ventia automatiza tus ventas y entregas para que tu negocio esté{" "}
                  <strong className="font-bold">
                    activo 24/7.
                  </strong>
                  {" "}Usamos inteligencia artificial, logística y supervisión humana
                  para cerrar pedidos, despachar de inmediato y asegurar la
                  mejor experiencia de compra para tus clientes.
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2}>
            <div className="relative animate-[0.2s_linear] break-words mb-8 sm:mb-12 md:mb-0">
              <div className="relative">
                <div className="flex flex-col md:flex-row gap-3 sm:gap-4 md:gap-5 w-full max-w-[300px] md:max-w-full mx-auto md:mx-0">
                  <a
                    href="#contacto"
                    className="md:flex-1 text-center font-bold text-sm sm:text-base md:text-[20px] font-sans bg-[#212835] text-white border-2 border-[#212835] rounded-[50px] py-3 px-6 md:py-2.5 md:px-0 md:pb-2 transition-colors hover:bg-[#48c1ec] hover:border-[#48c1ec]"
                  >
                    AGENDA TU DEMO
                  </a>

                  <a
                    href="#planes"
                    className="md:flex-1 text-center font-bold text-sm sm:text-base md:text-[20px] font-sans bg-transparent text-[#212835] border-2 border-[#212835] rounded-[50px] py-3 px-6 md:py-2.5 md:px-0 md:pb-2 transition-colors hover:bg-[#212835] hover:text-white"
                  >
                    Ver Planes
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Imagen del Hero */}
        <div className="w-full md:w-[47.25%] relative z-[2] mt-6 sm:mt-8 md:mt-0 order-2 md:order-2 mb-6 md:mb-0">
          <FadeUp delay={0.3}>
            <div className="relative animate-[0.2s_linear] leading-[0px] block text-center max-w-full">
              <span className="inline-block relative max-w-full">
                <Image
                  src="/images/imagen-hero.png"
                  alt="Vista de VentIA en acción"
                  width={2560}
                  height={2387}
                  className="max-w-full h-auto relative"
                  priority
                />
              </span>
            </div>
          </FadeUp>
        </div>

        <span className="w-0 max-w-none static block"></span>
      </div>
    </section>
  );
}
