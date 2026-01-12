"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[url('/images/imagen-hero-mobile.avif')] md:bg-[url('/images/imagen-hero-desktop.avif')] bg-cover bg-center bg-no-repeat pt-50 lg:pt-40 pb-[54px]"
    >
      <div className="max-w-[90%] mx-auto relative flex flex-col md:flex-row pt-[27px] pb-[27px]">

        {/* Contenedor de Texto */}
        <div className="w-full md:w-[47.25%] float-left relative z-[2] min-h-[1px] order-1 md:mt-[274.219px] md:mb-[274.219px] md:mr-[94.2969px]">
          <FadeUp delay={0}>
            <div className="text-left relative animate-[0.2s_linear] break-words -mt-[100px] mb-[47.1406px]">
              <div className="relative">
                <p className="text-[40px] leading-[44px] font-semibold text-black font-['Libre_Franklin',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
                  VENDEMOS Y
                  <br />
                  ENTREGAMOS POR TI.
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="text-justify relative animate-[0.2s_linear] break-words mb-[47.1406px]">
              <div className="relative">
                <p className="text-[20px] leading-[24px] text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] m-0 p-0">
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
            <div className="text-justify relative animate-[0.2s_linear] break-words">
              <div className="relative">
                <div className="flex gap-5 w-full">
                  <a
                    href="#contacto"
                    className="flex-1 text-center font-bold text-[20px] font-sans bg-[#212835] text-white border-2 border-[#212835] rounded-[50px] py-3 px-0 pb-2 transition-colors hover:bg-[#48c1ec] hover:border-[#48c1ec]"
                  >
                    AGENDA TU DEMO
                  </a>

                  <a
                    href="#planes"
                    className="flex-1 text-center font-bold text-[20px] font-sans bg-transparent text-[#212835] border-2 border-[#212835] rounded-[50px] py-3 px-0 pb-2 transition-colors hover:bg-[#212835] hover:text-white"
                  >
                    Ver Planes
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Imagen del Hero */}
        <div className="w-full md:w-[47.25%] float-left relative z-[2] min-h-[1px] order-1 mt-8 md:mt-0">
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
