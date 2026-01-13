"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[#B8E6F5] bg-cover bg-center bg-no-repeat pt-32 sm:pt-40 pb-8 sm:pb-12"
    >
      <div className="max-w-[90%] sm:max-w-[600px] mx-auto relative flex flex-col items-center pt-4 sm:pt-6 pb-4 sm:pb-6 px-4">

        {/* Contenedor de Texto */}
        <div className="w-full relative z-[2] text-center">
          <FadeUp delay={0}>
            <div className="relative animate-[0.2s_linear] break-words mb-6 sm:mb-8">
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
            <div className="text-justify relative animate-[0.2s_linear] break-words mb-6 sm:mb-8">
              <div className="relative">
                <p className="text-sm sm:text-base leading-relaxed sm:leading-normal text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
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
            <div className="relative animate-[0.2s_linear] break-words mb-8 sm:mb-12">
              <div className="relative">
                <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[350px] mx-auto">
                  <a
                    href="#contacto"
                    className="text-center font-bold text-sm sm:text-base font-sans bg-[#212835] text-white border-2 border-[#212835] rounded-[50px] py-3 px-6 transition-colors hover:bg-[#48c1ec] hover:border-[#48c1ec]"
                  >
                    AGENDA TU DEMO
                  </a>

                  <a
                    href="#planes"
                    className="text-center font-bold text-sm sm:text-base font-sans bg-transparent text-[#212835] border-2 border-[#212835] rounded-[50px] py-3 px-6 transition-colors hover:bg-[#212835] hover:text-white"
                  >
                    Ver Planes
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Imagen del Hero */}
        <div className="w-full relative z-[2] mt-6 sm:mt-8">
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
