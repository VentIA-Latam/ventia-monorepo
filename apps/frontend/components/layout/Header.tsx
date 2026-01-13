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
    <header className="fixed top-0 w-full bg-[#212835] text-white z-[9999] font-['Helvetica_Roman',Helvetica,Arial,Lucida,sans-serif]">
      <div className="max-w-[90%] mx-auto relative">
        <div className="h-[109px] flex items-center justify-between transition-all duration-[400ms] ease-in-out">

          {/* LOGO */}
          <div className="relative flex items-center">
            <Link
              href="/#inicio"
              onClick={closeMenu}
              className="bg-transparent border-0 p-0"
            >
              <Image
                src="/images/logo-ventia-header.png"
                alt="VentIA logo"
                width={170}
                height={35}
                className="max-w-full h-auto transition-all duration-[400ms] ease-in-out inline-block"
                priority
              />
            </Link>
          </div>

          {/* NAVEGACIÓN DESKTOP */}
          <div className="hidden lg:flex items-center font-semibold">
            <nav className="flex items-center">
              <ul className="list-none m-0 p-0 bg-transparent flex items-center gap-[15px]">
                {/* Enlaces de navegación */}
                {navLinks.map((link) => (
                  <li
                    key={link.href}
                    className="inline-flex items-center"
                  >
                    <Link
                      href={link.href}
                      className="text-white text-[14px] leading-[14px] bg-transparent relative transition-opacity duration-[400ms] ease-in-out border-0 hover:opacity-80"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}

                {/* Ver Planes */}
                <li className="inline-flex items-center">
                  <Link
                    href="/#planes"
                    className="text-white bg-transparent inline-flex relative transition-all duration-200 ease items-center justify-center w-[170px] h-11 font-bold text-[14px] leading-[14px] border border-white rounded-full hover:bg-white/60 hover:border-white/60 hover:text-[#182432]"
                  >
                    Ver Planes
                  </Link>
                </li>

                {/* Agenda tu Demo */}
                <li className="inline-flex items-center">
                  <Link
                    href="/#contacto"
                    className="text-[#1e2532] bg-white inline-flex relative transition-all duration-200 ease items-center justify-center w-[170px] h-11 font-bold text-[14px] leading-[14px] border border-white rounded-full hover:bg-white/10 hover:text-white/70"
                  >
                    Agenda tu Demo
                  </Link>
                </li>

                {/* Iniciar Sesión */}
                <li className="inline-flex items-center">
                  <Link
                    href="/login"
                    className="text-white text-[14px] leading-[14px] bg-transparent relative transition-opacity duration-[400ms] ease-in-out border-0 hover:opacity-80"
                  >
                    Iniciar sesión
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* BOTÓN HAMBURGER MOBILE */}
          <button
            type="button"
            onClick={toggleMenu}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-white hover:bg-white/10 transition"
            aria-label="Abrir menú"
          >
            <HiMenu className="h-7 w-7" />
          </button>
        </div>
      </div>

      {/* MENÚ MOBILE */}
      {open && (
        <div className="lg:hidden border-t-[3px] border-t-[#2ea3f2] bg-[#212835] shadow-[0_2px_5px_0_rgba(0,0,0,0.1)]">
          <div className="p-[5%] flex flex-col">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="text-white bg-transparent transition-[opacity,background-color] duration-200 ease-in-out block border-b border-b-[rgba(0,0,0,0.03)] py-2.5 px-[5%]"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/#planes"
              onClick={closeMenu}
              className="text-white bg-transparent transition-[opacity,background-color] duration-200 ease-in-out block border-b border-b-[rgba(0,0,0,0.03)] py-2.5 px-[5%]"
            >
              Ver Planes
            </Link>

            <Link
              href="/#contacto"
              onClick={closeMenu}
              className="text-white bg-transparent transition-[opacity,background-color] duration-200 ease-in-out block border-b border-b-[rgba(0,0,0,0.03)] py-2.5 px-[5%]"
            >
              Agenda tu Demo
            </Link>

            <Link
              href="/login"
              onClick={closeMenu}
              className="text-white bg-transparent transition-[opacity,background-color] duration-200 ease-in-out block border-b border-b-[rgba(0,0,0,0.03)] py-2.5 px-[5%]"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
