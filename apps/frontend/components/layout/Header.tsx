"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { HiMenu } from "react-icons/hi";

export default function Header() {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  const navLinks = [
    { href: "/#inicio", label: "Inicio" },
    { href: "/#casos-exito", label: "Casos de Éxito" },
    { href: "/#soluciones", label: "Nuestras Soluciones" },
    { href: "/#faq", label: "Preguntas Frecuentes" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#182432] text-white">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        {/* CAMBIO: Altura aumentada en desktop (h-24) */}
        <div className="h-16 md:h-24 flex items-center justify-between">

          {/* LOGO (Izquierda) */}
          <Link
            href="/#inicio"
            onClick={closeMenu}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="relative h-8 w-40 md:h-12 md:w-48">
              <Image
                src="/images/logo-ventia-header.png"
                alt="VentIA logo"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>

          {/* CONTENEDOR DERECHA (Nav + Botones) */}
          {/* Esto agrupa el menú y los botones a la derecha, dejando espacio en el medio */}
          <div className="hidden md:flex items-center gap-8 lg:gap-12">

            {/* NAV DESKTOP */}
            <nav className="flex items-center gap-6 lg:gap-8 text-sm font-semibold">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-sky-200 transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* BOTONES DESKTOP */}
            <div className="flex items-center gap-4">
              <Link
                href="/#planes"
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  border border-white
                  bg-transparent
                  px-6 py-2.5
                  text-sm font-semibold
                  hover:bg-white/10
                  transition
                  whitespace-nowrap
                "
              >
                Ver Planes
              </Link>



              <Link
                href="/#contacto"
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  bg-white text-[#182432]
                  px-6 py-2.5
                  text-sm font-bold
                  hover:bg-slate-100
                  transition
                  whitespace-nowrap
                "
              >
                Agenda tu Demo
              </Link>

              <Link
                href="/login"
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  border border-sky-400
                  bg-sky-500/10
                  px-6 py-2.5
                  text-sm font-semibold
                  text-sky-400
                  hover:bg-sky-500/20
                  transition
                  whitespace-nowrap
                "
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>

          {/* BOTÓN HAMBURGER (MOBILE - Derecha) */}
          <button
            type="button"
            onClick={toggleMenu}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-white hover:bg-white/10 transition"
            aria-label="Abrir menú"
          >
            <HiMenu className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* MENÚ MOBILE */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#182432] animate-in slide-in-from-top-5 fade-in duration-200">
          <div className="px-4 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="text-base font-medium py-2 border-b border-white/5 hover:text-sky-200 transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="flex flex-col gap-3 mt-4">
              <Link
                href="/#planes"
                onClick={closeMenu}
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  border border-white
                  bg-transparent
                  px-6 py-3
                  text-sm font-semibold
                  hover:bg-white/10
                  transition
                "
              >
                Ver Planes
              </Link>

              <Link
                href="/login"
                onClick={closeMenu}
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  border border-sky-400
                  bg-sky-500/10
                  px-6 py-3
                  text-sm font-semibold
                  text-sky-400
                  hover:bg-sky-500/20
                  transition
                "
              >
                Iniciar Sesión
              </Link>

              <Link
                href="/#contacto"
                onClick={closeMenu}
                className="
                  inline-flex items-center justify-center
                  rounded-full
                  bg-white text-[#182432]
                  px-6 py-3
                  text-sm font-bold
                  hover:bg-gray-100
                  transition
                "
              >
                Agenda tu Demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}