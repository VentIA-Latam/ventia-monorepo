"use client";

import Image from "next/image";
import Link from "next/link";
import { FaTiktok, FaInstagram, FaLinkedin } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="bg-[#182432] text-white py-12 md:py-24">
      <div className="mx-auto w-full px-6 md:px-20 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">

        {/* IZQUIERDA */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">

          <div className="flex items-center gap-3 mb-6 md:mb-8">
            {/* LOGO VENTIA: Aumentado en móvil (h-16 w-56) */}
            <div className="relative h-16 w-56 md:h-20 md:w-72">
              <Image
                src="/images/logo-ventia-header.png"
                alt="VentIA logo"
                fill
                className="object-contain object-center md:object-left"
              />
            </div>
          </div>

          {/* TEXTO: Más pequeño en móvil (text-xs/sm) y centrado */}
          <p className="text-xs sm:text-sm md:text-lg leading-relaxed font-sans mb-8 md:mb-10 max-w-xs md:max-w-lg mx-auto md:mx-0">
            VentIA no es un chatbot ni una empresa de envíos.<br className="hidden md:block" />
            <span className="md:hidden"> </span>
            Es tu nuevo equipo de ventas y logística trabajando <span className="font-semibold">24/7</span> por ti.
          </p>

          {/* REDES SOCIALES: Centradas en móvil */}
          <div className="flex items-center gap-4 md:gap-5 justify-center md:justify-start w-full">
            <Link
              href="https://www.tiktok.com/@ventia_latam?_t=ZS-90NWJHIQZAV&_r=1"
              target="_blank"
              className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center bg-white text-[#182432] rounded-full text-xl md:text-2xl hover:scale-110 transition"
            >
              <FaTiktok />
            </Link>

            <Link
              href="https://www.instagram.com/ventia_latam/"
              target="_blank"
              className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center bg-white text-[#182432] rounded-full text-xl md:text-2xl hover:scale-110 transition"
            >
              <FaInstagram />
            </Link>

            <Link
              href="https://www.linkedin.com/company/ventia-latam"
              target="_blank"
              className="h-10 w-10 md:h-12 md:w-12 flex items-center justify-center bg-white text-[#182432] rounded-full text-xl md:text-2xl hover:scale-110 transition"
            >
              <FaLinkedin />
            </Link>
          </div>
        </div>

        {/* DERECHA */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right gap-8 md:gap-5">

          {/* LIBRO DE RECLAMACIONES */}
          <Link
            href="https://docs.google.com/forms/d/e/1FAIpQLSfCUOtWIsBN84P8g2HFGWejHpPuhZbuGQOKitRpitTaXqxinQ/viewform?usp=send_form"
            target="_blank"
          >
            <div className="flex flex-col items-center md:items-end cursor-pointer hover:opacity-90 transition">
              <p className="text-[10px] md:text-xs font-sans mb-1 uppercase tracking-widest md:hidden">
                LIBRO DE RECLAMACIONES
              </p>
              <div className="relative h-10 w-16 md:h-20 md:w-32">
                <Image
                  src="/images/libro-reclamaciones.avif"
                  alt="Libro de reclamaciones"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </Link>

          <div className="md:text-right text-center md:mt-2">
            <h3 className="font-libre font-bold tracking-wide text-sm md:text-base mb-2 uppercase">
              CONTACTO
            </h3>
            <p className="text-xs md:text-lg font-sans mb-1">ventas@ventia-latam.com</p>
            <p className="text-xs md:text-lg font-sans">+51 951 752 355</p>
          </div>

          {/* LINKS LEGALES */}
          <div className="md:text-right text-center flex flex-col gap-2">
            <Link
              href="/terms-and-conditions"
              className="text-xs md:text-sm font-sans text-white/80 hover:text-white transition"
            >
              Términos y Condiciones
            </Link>
            <Link
              href="/privacy-policy"
              className="text-xs md:text-sm font-sans text-white/80 hover:text-white transition"
            >
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
