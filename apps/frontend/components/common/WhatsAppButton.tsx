"use client";

import Link from "next/link";
import { FaWhatsapp } from "react-icons/fa";

export default function WhatsAppButton() {
  return (
    <Link
      href="https://wa.me/51951752355" 
      target="_blank"
      className="
        fixed
        bottom-6 right-6
        z-50
        w-16 h-16
        rounded-full
        bg-[#25D366]
        flex items-center justify-center
        shadow-xl
        hover:scale-110
        transition
      "
      aria-label="WhatsApp Chat"
    >
      <FaWhatsapp className="w-8 h-8 text-white" />
    </Link>
  );
}
