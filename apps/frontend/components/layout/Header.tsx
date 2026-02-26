"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#casos-exito", label: "Casos de Éxito" },
  { href: "/#soluciones", label: "Soluciones" },
  { href: "/#planes", label: "Planes" },
  { href: "/#faq", label: "FAQ" },
];

const CALENDLY_URL = "https://calendly.com/tarek-ventia-latam/ventia";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[9999] bg-[#182432] transition-shadow duration-300 ${
        scrolled ? "shadow-lg shadow-black/20" : ""
      }`}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between h-18 md:h-22 px-5 sm:px-8">
        {/* Logo */}
        <Link href="/#inicio" onClick={closeMenu} className="shrink-0">
          <Image
            src="/images/logo-ventia-header.png"
            alt="VentIA"
            width={110}
            height={28}
            className="h-9 md:h-11 w-auto brightness-0 invert"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/55 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-white/55 hover:text-white transition-colors duration-200"
          >
            Ingresar
          </Link>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-[#182432] bg-white px-5 py-2 rounded-full hover:bg-white/90 transition-colors duration-200"
          >
            Agenda Demo
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="lg:hidden p-1.5 text-white/70 hover:text-white transition-colors"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:hidden bg-[#182432] border-t border-white/[0.06] overflow-hidden"
          >
            <div className="px-5 py-4 flex flex-col gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  className="text-[14px] font-medium text-white/55 hover:text-white py-2.5 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-white/[0.06] my-2" />
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMenu}
                className="text-[14px] font-bold text-[#182432] bg-white py-2.5 rounded-full text-center mt-1"
              >
                Agenda Demo
              </a>
              <Link
                href="/login"
                onClick={closeMenu}
                className="text-[14px] font-medium text-white/40 hover:text-white py-2.5 text-center transition-colors"
              >
                Iniciar sesión
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
