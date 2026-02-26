"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

export default function Hero() {
  return (
    <section
      id="inicio"
      className="relative bg-[url('/images/imagen-hero-mobile.avif')] md:bg-[url('/images/imagen-hero-desktop.avif')] bg-[50%_50%] bg-cover bg-no-repeat pt-36 md:pt-44 lg:pt-52 pb-14 md:pb-20 lg:pb-24 w-full"
    >
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        <div className="flex flex-col lg:flex-row items-center justify-center gap-10 md:gap-14 lg:gap-24 xl:gap-28 py-8 md:py-12 lg:py-16">

          {/* Texto */}
          <div className="w-full lg:flex-1 lg:max-w-[45%] text-center lg:text-left order-1">

            <FadeUp delay={0}>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] leading-tight lg:leading-[44px] font-bold text-[#182432] font-libre mb-4 md:mb-6 lg:mb-8">
                VENDEMOS Y
                <br />
                ENTREGAMOS POR TI.
              </h1>
            </FadeUp>

            <FadeUp delay={0.1}>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed lg:leading-[28px] text-[#182432]/70 font-sans mb-4 md:mb-6 lg:mb-8 text-justify lg:text-left">
                Ventia automatiza tus ventas y entregas para que tu negocio esté{" "}
                <strong className="font-bold text-[#182432]">activo 24/7.</strong>{" "}
                Usamos inteligencia artificial, logística y supervisión humana
                para cerrar pedidos, despachar de inmediato y asegurar la
                mejor experiencia de compra para tus clientes.
              </p>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 max-w-[320px] sm:max-w-none mx-auto lg:mx-0">
                <a
                  href="https://calendly.com/tarek-ventia-latam/ventia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto text-center text-sm md:text-base lg:text-lg font-bold bg-[#182432] text-white rounded-full py-3 md:py-3.5 px-8 no-underline transition-colors hover:bg-[#5ACAF0]"
                >
                  AGENDA TU DEMO
                </a>
                <a
                  href="#planes"
                  className="text-sm md:text-base font-semibold text-[#182432]/50 hover:text-[#182432] transition-colors"
                >
                  Ver Planes &rarr;
                </a>
              </div>
            </FadeUp>

            {/* Social proof */}
            <FadeUp delay={0.3}>
              <div className="mt-10 md:mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-6 md:gap-8">
                <div>
                  <p className="text-2xl md:text-3xl font-bold text-[#182432] font-libre">200+</p>
                  <p className="text-[11px] text-[#182432]/40 font-medium">pedidos / día</p>
                </div>
                <div className="h-8 w-px bg-[#182432]/10" />
                <div>
                  <p className="text-2xl md:text-3xl font-bold text-[#182432] font-libre">3 seg</p>
                  <p className="text-[11px] text-[#182432]/40 font-medium">tiempo de respuesta</p>
                </div>
                <div className="h-8 w-px bg-[#182432]/10" />
                <div>
                  <p className="text-2xl md:text-3xl font-bold text-[#182432] font-libre">8+</p>
                  <p className="text-[11px] text-[#182432]/40 font-medium">marcas activas</p>
                </div>
              </div>
            </FadeUp>
          </div>

          {/* Mockup con sombra/glow */}
          <div className="w-full lg:flex-1 lg:max-w-[50%] order-2">
            <FadeUp delay={0.3}>
              <div className="relative">
                <div className="absolute inset-0 bg-[#5ACAF0]/10 rounded-full blur-[80px] scale-90 pointer-events-none" />
                <Image
                  src="/images/imagen-hero.png"
                  alt="Vista de VentIA en acción"
                  width={2560}
                  height={2387}
                  className="relative w-full h-auto drop-shadow-xl"
                  priority
                />
              </div>
            </FadeUp>
          </div>

        </div>
      </div>
    </section>
  );
}
