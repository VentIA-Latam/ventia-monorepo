"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[url('/images/imagen-hero-mobile.avif')] md:bg-[url('/images/imagen-hero-desktop.avif')] bg-[50%_50%] bg-cover bg-no-repeat pt-32 md:pt-[calc(110.5px+54px)] pb-8 md:pb-[54px] m-0 w-full"
    >
      {/* Contenedor principal - width: 1368.71px, maxWidth: 90%, margin: 0 76px */}
      <div className="max-w-[90%] md:w-[1368.71px] md:max-w-[90%] relative flex flex-col md:flex-row items-center md:items-start pt-[27px] pb-[27px] mx-auto md:mx-[76.05px] my-0">

        {/* Contenedor de Texto - width: 646.713px, margin: 195.988px 75.275px */}
        <div className="w-full md:w-[646.713px] md:float-left relative z-[2] md:min-h-[1px] text-center md:text-left order-1 mb-8 md:mb-[195.988px] md:mt-[195.988px] md:mr-[75.275px] md:pl-[0.0125px]">

          <FadeUp delay={0}>
            {/* Título - fontSize: 40px, lineHeight: 44px, margin: -100px 0 37.6375px */}
            <div className="relative break-words text-2xl md:text-[40px] leading-tight md:leading-[44px] font-semibold text-black font-['Libre_Franklin',Helvetica,Arial,Lucida,sans-serif] mb-6 md:mb-[37.6375px] md:-mt-[100px] p-0">
              <div className="relative p-0 m-0">
                <p className="text-2xl md:text-[40px] p-0 m-0">
                  VENDEMOS Y
                  <br />
                  ENTREGAMOS POR TI.
                </p>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            {/* Párrafo - fontSize: 20px, lineHeight: 24px, margin: 0 0 37.6375px */}
            <div className="text-justify relative break-words text-sm md:text-[20px] leading-relaxed md:leading-[24px] text-black font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif] mb-6 md:mb-[37.6375px] p-0">
              <div className="relative p-0 m-0">
                <p className="text-sm md:text-[20px] p-0 m-0">
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
            {/* Botones - display: flex, width: 646.713px, gap: 20px */}
            <div className="relative break-words p-0 m-0">
              <div className="relative p-0 m-0">
                <div className="flex flex-col md:flex-row w-full md:w-[646.713px] gap-3 md:gap-[20px] max-w-[300px] md:max-w-full mx-auto md:mx-0 p-0 m-0">
                  <a
                    href="#contacto"
                    className="md:flex-1 text-center text-sm md:text-[20px] font-bold bg-[rgb(33,40,53)] text-white border-2 md:border-[1.6px] border-[rgb(33,40,53)] rounded-[50px] py-3 md:pt-[12px] md:pr-0 md:pb-[8px] md:pl-0 m-0 no-underline hover:bg-[#48c1ec] hover:border-[#48c1ec]"
                  >
                    AGENDA TU DEMO
                  </a>

                  <a
                    href="#planes"
                    className="md:flex-1 text-center text-sm md:text-[20px] font-bold bg-transparent text-[rgb(33,40,53)] border-2 md:border-[1.6px] border-[rgb(33,40,53)] rounded-[50px] py-3 md:pt-[12px] md:pr-0 md:pb-[8px] md:pl-0 m-0 no-underline hover:bg-[#212835] hover:text-white"
                  >
                    Ver Planes
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        {/* Imagen del Hero - width: 646.713px, margin: 0 */}
        <div className="w-full md:w-[646.713px] md:float-left relative z-[2] md:min-h-[1px] order-2 mt-6 md:mt-0 p-0 m-0">
          <FadeUp delay={0.3}>
            <div className="relative leading-[0px] block text-center max-w-full p-0 m-0">
              <span className="box-border inline-block relative max-w-full">
                <Image
                  src="/images/imagen-hero.png"
                  alt="Vista de VentIA en acción"
                  width={2560}
                  height={2387}
                  className="max-w-full h-auto md:h-[603.25px] box-border relative p-0 m-0"
                  priority
                />
              </span>
            </div>
          </FadeUp>
        </div>

      </div>
    </section>
  );
}

