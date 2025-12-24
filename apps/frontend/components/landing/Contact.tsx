"use client";

import { useState, useRef } from "react";
import emailjs from "@emailjs/browser";
import FadeUp from "@/components/ui/FadeUp";

export default function Contact() {
  const formRef = useRef<HTMLFormElement>(null); // Referencia al formulario
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");

    // Validaciones de entorno...
    if (
      !process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ||
      !process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ||
      !process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
    ) {
      console.error("Faltan credenciales .env");
      setStatus("error");
      setLoading(false);
      return;
    }

    try {
      await emailjs.sendForm(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID,
        formRef.current!, // Usamos la referencia al form
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
      );

      setStatus("success");
      
      // --- AQUÍ ESTÁ EL CAMBIO ---
      // En lugar de e.currentTarget.reset(), usamos la referencia segura:
      if (formRef.current) {
        formRef.current.reset();
      }
      
    } catch (error) {
      console.error("Error enviando email:", error);
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      id="contacto"
      className="bg-white py-20 md:py-24 scroll-mt-24 md:scroll-mt-28"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <FadeUp delay={0}>
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-libre font-semibold text-[#182432] mb-4">
              TE RESPONDEMOS HOY MISMO
            </h2>
            <p className="text-sm md:text-base font-inter text-[#182432] leading-relaxed">
              Tienes alguna duda sobre nuestras soluciones, déjanos un mensaje y nos
              contactaremos contigo.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.1}>
          {/* Agregamos la referencia 'ref={formRef}' al form */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 font-inter">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <input
                  required
                  type="text"
                  name="name" // Debe coincidir con la variable {{name}} en EmailJS
                  placeholder="Nombre y Apellido"
                  className="w-full rounded-full bg-[#f9f8f8] px-6 md:px-8 py-3 md:py-4 text-sm md:text-base font-inter outline-none border border-transparent focus:border-[#5ACAF0]"
                />
              </div>

              <div>
                <input
                  required
                  type="email"
                  name="email" // Debe coincidir con la variable {{email}} en EmailJS
                  placeholder="Correo electrónico"
                  className="w-full rounded-full bg-[#f9f8f8] px-6 md:px-8 py-3 md:py-4 text-sm md:text-base font-inter outline-none border border-transparent focus:border-[#5ACAF0]"
                />
              </div>
            </div>

            <div>
              <textarea
                required
                name="message" // Debe coincidir con la variable {{message}} en EmailJS
                rows={5}
                placeholder="Mensaje"
                className="w-full rounded-[999px] bg-[#f9f8f8] px-6 md:px-8 py-4 md:py-6 text-sm md:text-base font-inter outline-none border border-transparent focus:border-[#5ACAF0] resize-none"
              />
            </div>

            {/* Feedback Visual */}
            {status === "success" && (
              <p className="text-green-600 text-center font-medium animate-in fade-in">
                ¡Mensaje enviado con éxito! Gracias por contactarnos.
              </p>
            )}
            {status === "error" && (
              <p className="text-red-500 text-center font-medium animate-in fade-in">
                Ocurrió un error al enviar. Por favor intenta nuevamente.
              </p>
            )}

            <div className="flex justify-center pt-2">
              <button
                type="submit"
                disabled={loading}
                className={`
                  inline-flex items-center justify-center rounded-full 
                  bg-[#5ACAF0] text-white px-16 md:px-24 py-3.5 
                  text-sm md:text-base font-inter font-medium shadow-md 
                  transition hover:bg-[#2F7CF4]
                  ${loading ? "opacity-70 cursor-not-allowed" : ""}
                `}
              >
                {loading ? "ENVIANDO..." : "ENVIAR"}
              </button>
            </div>
          </form>
        </FadeUp>
      </div>
    </section>
  );
}