"use client";

import Image from "next/image";
import Link from "next/link";
import { FaTiktok, FaInstagram, FaLinkedin } from "react-icons/fa";

const linkColumns = [
  {
    title: "Producto",
    links: [
      { label: "Soluciones", href: "#soluciones" },
      { label: "Planes", href: "#planes" },
      { label: "Preguntas Frecuentes", href: "/preguntas-frecuentes" },
    ],
  },
  {
    title: "Contacto",
    links: [
      { label: "ventas@ventia-latam.com", href: "mailto:ventas@ventia-latam.com" },
      { label: "+51 951 752 355", href: "tel:+51951752355" },
      { label: "Agenda una demo", href: "https://calendly.com/tarek-ventia-latam/ventia", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Términos y Condiciones", href: "/terms-and-conditions" },
      { label: "Política de Privacidad", href: "/privacy-policy" },
      { label: "Libro de Reclamaciones", href: "https://docs.google.com/forms/d/e/1FAIpQLSfCUOtWIsBN84P8g2HFGWejHpPuhZbuGQOKitRpitTaXqxinQ/viewform?usp=send_form", external: true },
    ],
  },
];

const socials = [
  { icon: FaTiktok, href: "https://www.tiktok.com/@ventia_latam?_t=ZS-90NWJHIQZAV&_r=1", label: "TikTok" },
  { icon: FaInstagram, href: "https://www.instagram.com/ventia_latam/", label: "Instagram" },
  { icon: FaLinkedin, href: "https://www.linkedin.com/company/ventia-latam", label: "LinkedIn" },
];

export default function Footer() {
  return (
    <footer className="bg-[#182432]">
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-14 pb-8 md:pt-16 md:pb-10">

        {/* Desktop: 4 columnas en fila | Mobile: apilado */}
        <div className="hidden md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
          {/* Brand */}
          <div>
            <Image
              src="/images/logo-ventia-header.png"
              alt="VentIA"
              width={130}
              height={36}
              className="h-11 w-auto mb-4"
            />
            <p className="text-white text-sm leading-relaxed max-w-[260px]">
              Tu equipo de ventas con IA que trabaja 24/7 por ti.
            </p>
          </div>

          {/* Link columns */}
          {linkColumns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white mb-3.5">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => {
                  const isExternal = "external" in link && link.external;
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-[13px] text-white hover:text-[#5ACAF0] transition-colors duration-200"
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Mobile: logo arriba, luego links centrados */}
        <div className="md:hidden">
          {/* Logo + descripción centrados */}
          <div className="text-center mb-8">
            <Image
              src="/images/logo-ventia-header.png"
              alt="VentIA"
              width={130}
              height={36}
              className="h-10 w-auto mb-3 mx-auto"
            />
            <p className="text-white text-sm leading-relaxed max-w-[260px] mx-auto">
              Tu equipo de ventas con IA que trabaja 24/7 por ti.
            </p>
          </div>

          {/* Link columns — 2 arriba, 1 abajo centrada */}
          <div className="grid grid-cols-2 gap-8">
            {linkColumns.map((col) => (
              <div key={col.title} className="text-center last:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white mb-3">
                  {col.title}
                </p>
                <ul className="space-y-2">
                  {col.links.map((link) => {
                    const isExternal = "external" in link && link.external;
                    return (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                          className="text-[13px] text-white hover:text-[#5ACAF0] transition-colors duration-200"
                        >
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[12px] text-white order-2 sm:order-1">&copy; {new Date().getFullYear()} VentIA</span>

          <div className="flex items-center gap-3 order-1 sm:order-2">
            {socials.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="text-white hover:text-[#5ACAF0] transition-colors duration-200 text-lg"
              >
                <s.icon />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
