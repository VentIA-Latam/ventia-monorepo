"use client";

import FadeUp from "@/components/ui/FadeUp";

const CALENDLY_URL = "https://calendly.com/tarek-ventia-latam/ventia";

export default function Contact() {
  return (
    <section
      id="contacto"
      className="bg-white py-20 md:py-24 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <FadeUp delay={0}>
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-libre font-semibold text-[#182432] mb-4">
              AGENDA TU DEMO
            </h2>
            <p className="text-sm md:text-xl font-sans text-[#321818] leading-relaxed">
              ¿Tienes alguna duda sobre nuestras soluciones? Agenda una demo
              personalizada y te mostraremos cómo VentIA puede ayudar a tu negocio.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="flex justify-center pt-2">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center justify-center rounded-full
                bg-[#5ACAF0] text-white px-16 md:px-24 py-3.5
                text-sm md:text-2xl font-sans font-medium shadow-md
                transition hover:bg-[#212835]
              "
            >
              AGENDAR DEMO
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
