"use client";

import FadeUp from "@/components/ui/FadeUp";

const CALENDLY_URL = "https://calendly.com/tarek-ventia-latam/ventia";

export default function Contact() {
  return (
    <section
      id="contacto"
      className="py-16 md:py-20 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <FadeUp delay={0}>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#182432] via-[#1e3a5f] to-[#182432] px-8 py-14 md:py-20 text-center">
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-[#5ACAF0]/15 rounded-full blur-[100px]" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-libre font-bold text-white leading-tight max-w-2xl mx-auto">
                ¿Tienes alguna duda sobre nuestras soluciones?
              </h2>
              <p className="mt-4 text-white/60 text-lg max-w-lg mx-auto">
                Agenda una demo personalizada y te mostraremos cómo VentIA puede ayudar a tu negocio.
              </p>
              <div className="mt-8 flex justify-center">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-[#5ACAF0] text-white font-bold px-8 py-4 rounded-full hover:brightness-110 transition-all shadow-lg shadow-[#5ACAF0]/30 text-sm"
                >
                  Agendar Demo
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
