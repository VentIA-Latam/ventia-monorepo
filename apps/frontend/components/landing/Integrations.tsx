"use client";

import Image from "next/image";
import FadeUp from "@/components/ui/FadeUp";

const integrations = [
  {
    name: "Shopify",
    icon: "/external-icons/shopify-icon.png",
    tagline: "Sincroniza pedidos, inventario y clientes automáticamente.",
  },
  {
    name: "WooCommerce",
    icon: "/external-icons/woo-icon.png",
    tagline: "Conecta tu tienda WordPress y gestiona todo desde VentIA.",
  },
  {
    name: "WhatsApp",
    icon: "/external-icons/whatsapp-icon.svg",
    tagline: "Tu agente IA atiende, vende y cobra directo por WhatsApp.",
  },
  {
    name: "SUNAT",
    icon: "/external-icons/logo-sunat.jpg",
    tagline: "Genera boletas y facturas electrónicas de forma automática.",
  },
];

export default function Integrations() {
  return (
    <section className="bg-white py-16 md:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10 lg:px-16 xl:px-20">

        {/* Header */}
        <div className="text-center mb-12 md:mb-16">
          <FadeUp delay={0}>
            <p className="text-sm font-semibold tracking-widest uppercase text-[#5ACAF0] font-sans mb-3">
              Integraciones
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#182432] font-libre leading-tight mb-4">
              SE CONECTA CON LO QUE YA USAS
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base lg:text-lg text-[#182432]/60 font-sans max-w-md mx-auto">
              Sin migraciones, sin fricción. Activa VentIA sobre tu stack actual.
            </p>
          </FadeUp>
        </div>

        {/* Grid 2x2 — cards horizontales */}
        <div className="grid sm:grid-cols-2 gap-5 md:gap-6 max-w-4xl mx-auto">
          {integrations.map((item, index) => (
            <FadeUp key={item.name} delay={0.05 * (index + 1)}>
              <div className="flex items-center gap-5 rounded-2xl border border-[#182432]/[0.08] px-6 py-6 md:px-8 md:py-7 hover:border-[#5ACAF0]/40 hover:shadow-sm transition-all duration-200">
                <Image
                  src={item.icon}
                  alt={item.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 object-contain shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-bold text-[#182432] font-sans">
                    {item.name}
                  </h3>
                  <p className="text-sm text-[#182432]/50 font-sans leading-relaxed mt-1">
                    {item.tagline}
                  </p>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* Bottom link */}
        <FadeUp delay={0.3}>
          <p className="text-center text-sm text-[#182432]/40 font-sans mt-8 md:mt-10">
            ¿Usas otra plataforma?{" "}
            <a
              href="https://calendly.com/tarek-ventia-latam/ventia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5ACAF0] hover:underline font-semibold"
            >
              Conversemos
            </a>
          </p>
        </FadeUp>

      </div>
    </section>
  );
}
