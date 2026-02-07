"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import type { Variants } from "framer-motion";
import {
  MessageSquare,
  Package,
  CreditCard,
  Truck,
  BarChart3,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  Star,
  CheckCircle2,
} from "lucide-react";

const CALENDLY_URL = "https://calendly.com/tarek-ventia-latam/ventia";

// --- Animations ---
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.08 } },
};

// --- Data ---
const FEATURES = [
  {
    icon: MessageSquare,
    title: "Agente IA 24/7",
    description: "Atiende WhatsApp, Instagram y web chat con IA conversacional que cierra ventas mientras duermes.",
    accent: "from-volt to-aqua",
    iconBg: "bg-volt/10",
    iconColor: "text-volt",
  },
  {
    icon: Package,
    title: "Inventario inteligente",
    description: "Stock sincronizado en tiempo real. Sin sobre-ventas, sin quiebres de stock.",
    accent: "from-aqua to-luma",
    iconBg: "bg-aqua/10",
    iconColor: "text-aqua",
  },
  {
    icon: CreditCard,
    title: "Pagos y validación",
    description: "Confirmación automática de pagos y datos de cliente en un solo flujo.",
    accent: "from-success to-aqua",
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    icon: Truck,
    title: "Despacho en <24h",
    description: "Entregas optimizadas con tracking en tiempo real para ti y tu cliente.",
    accent: "from-warning to-volt",
    iconBg: "bg-warning/10",
    iconColor: "text-warning",
  },
  {
    icon: BarChart3,
    title: "Analytics y contabilidad",
    description: "Dashboard con métricas clave y facturación electrónica integrada.",
    accent: "from-marino to-volt",
    iconBg: "bg-marino/10",
    iconColor: "text-marino",
  },
];

const PLANS = [
  {
    name: "IA Básico",
    price: "$49.90",
    period: "/mes",
    description: "Automatiza tus ventas con IA",
    features: [
      "IA conversacional 24/7",
      "WhatsApp + Instagram + Web",
      "Validación automática de pagos",
      "Gestión de inventario",
      "Dashboard de métricas",
    ],
    highlighted: false,
  },
  {
    name: "IA + Logística",
    price: "$69.90",
    period: "/mes",
    description: "Vende y entrega sin esfuerzo",
    features: [
      "Todo de IA Básico",
      "Recojo en tu tienda/almacén",
      "Entrega al cliente final",
      "Tracking en tiempo real",
      "Soporte prioritario",
    ],
    highlighted: true,
  },
  {
    name: "Full Operación",
    price: "Custom",
    period: "",
    description: "Operación completa externalizada",
    features: [
      "Todo de IA + Logística",
      "Almacenamiento de stock",
      "Armado de pedidos",
      "Gestión contable incluida",
      "Account manager dedicado",
    ],
    highlighted: false,
  },
];

const STATS = [
  { value: "24/7", label: "Disponibilidad" },
  { value: "<24h", label: "Tiempo de entrega" },
  { value: "3 días", label: "Implementación" },
  { value: "+95%", label: "Satisfacción" },
];

const CLIENTS = [
  { name: "Nassau", image: "/images/logo-nassau.avif" },
  { name: "Not Pepper", image: "/images/logo-not-pepper.avif" },
  { name: "Cromo", image: "/images/logo-cromo.avif" },
  { name: "Crayfish", image: "/images/logo-crayfish.avif" },
  { name: "La Doré", image: "/images/logo-la-dore.avif" },
  { name: "Go Active", image: "/images/logo-go-active.avif" },
  { name: "AquaFlask", image: "/images/logo-aquaflask.avif" },
  { name: "Nola", image: "/images/logo-nola.avif" },
];

// --- Page ---
export default function LandingV2Page() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* --- NAV --- */}
      <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/landing-v2" className="flex items-center gap-2">
            <div className="relative h-8 w-28">
              <Image src="/images/logo-ventia-sidebar.png" alt="VentIA" fill className="object-contain" />
            </div>
            <span className="text-[10px] font-bold text-marino bg-luma/15 border border-luma/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              V2
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Soluciones</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Planes</a>
            <a href="#clients" className="hover:text-foreground transition-colors">Clientes</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex"
            >
              Iniciar sesión
            </Link>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-volt text-white hover:bg-volt/90 transition-colors shadow-sm shadow-volt/20"
            >
              Agenda demo
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* --- HERO --- */}
      <section ref={heroRef} className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-volt/5 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-aqua/5 blur-[100px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_50%,oklch(0.93_0.04_230/0.15),transparent_70%)]" />
        </div>

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="max-w-7xl mx-auto px-6"
        >
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Text */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="max-w-xl"
            >
              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-volt/20 bg-volt/5 text-volt text-xs font-semibold mb-6">
                <Zap className="w-3.5 h-3.5" />
                Automatización inteligente para e-commerce
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-noche leading-[1.1] font-heading">
                Vendemos y{" "}
                <span className="bg-gradient-to-r from-volt to-aqua bg-clip-text text-transparent">
                  entregamos
                </span>{" "}
                por ti.
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="mt-6 text-lg text-muted-foreground leading-relaxed">
                VentIA automatiza tus ventas y entregas para que tu negocio esté
                activo <strong className="text-foreground font-semibold">24/7</strong>.
                IA conversacional, logística y supervisión humana en una sola plataforma.
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-col sm:flex-row gap-3 mt-8">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg bg-volt text-white hover:bg-volt/90 transition-all shadow-lg shadow-volt/25 hover:shadow-xl hover:shadow-volt/30 hover:-translate-y-0.5"
                >
                  Agenda tu demo gratis
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  Conoce más
                  <ChevronRight className="w-4 h-4" />
                </a>
              </motion.div>

              {/* Social proof */}
              <motion.div variants={fadeUp} custom={4} className="flex items-center gap-4 mt-10 pt-6 border-t border-border/50">
                <div className="flex -space-x-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-background bg-gradient-to-br from-volt/20 to-aqua/20 flex items-center justify-center"
                    >
                      <Star className="w-3 h-3 text-volt" />
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-foreground">+50 marcas</span>
                  <span className="text-muted-foreground"> confían en VentIA</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-noche/10 border border-border/50">
                <Image
                  src="/images/imagen-hero.png"
                  alt="VentIA Dashboard"
                  width={1280}
                  height={1194}
                  className="w-full h-auto"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
              </div>
              {/* Floating stat card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute -bottom-4 -left-4 md:-left-8 bg-card border border-border/80 rounded-xl px-4 py-3 shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pedido validado</p>
                    <p className="text-sm font-semibold">+S/1,250.00</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* --- STATS BAR --- */}
      <section className="border-y border-border/50 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {STATS.map((stat, i) => (
              <motion.div key={stat.label} variants={fadeUp} custom={i} className="text-center">
                <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-volt to-marino bg-clip-text text-transparent font-heading">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold text-volt uppercase tracking-wider mb-3">
              Soluciones
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-bold text-foreground font-heading">
              Todo lo que necesitas para vender y entregar
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 text-muted-foreground text-lg">
              Cinco etapas integradas que cubren desde la primera conversación hasta la entrega y facturación.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i}
                className="group relative rounded-2xl border border-border/60 bg-card p-6 hover:border-volt/30 transition-all duration-300 hover:shadow-lg hover:shadow-volt/5 hover:-translate-y-1"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundImage: `linear-gradient(to right, transparent, var(--volt), transparent)` }}
                />
                <div className={`w-11 h-11 rounded-xl ${feature.iconBg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}

            {/* CTA card */}
            <motion.div
              variants={fadeUp}
              custom={FEATURES.length}
              className="relative rounded-2xl bg-gradient-to-br from-volt/10 via-aqua/5 to-transparent border border-volt/20 p-6 flex flex-col justify-center"
            >
              <h3 className="text-base font-semibold text-foreground mb-2">
                Implementación en 3 días
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Conectamos tu tienda, configuramos la IA y empiezas a vender.
              </p>
              <a
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-volt hover:underline"
              >
                Comenzar ahora
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* --- VALUE PROPS --- */}
      <section className="py-20 md:py-28 bg-noche text-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold text-aqua uppercase tracking-wider mb-3">
                Por qué VentIA
              </motion.p>
              <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-bold font-heading">
                No somos un chatbot.{" "}
                <span className="text-aqua">Somos tu equipo.</span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="mt-4 text-white/60 text-lg leading-relaxed">
                VentIA combina IA avanzada con logística real y supervisión humana. Tu negocio opera 24/7 mientras tú te enfocas en crecer.
              </motion.p>
            </div>

            <motion.div
              variants={stagger}
              className="grid sm:grid-cols-2 gap-4"
            >
              {[
                { icon: Zap, title: "Automatización real", text: "IA que cierra ventas, no solo responde mensajes." },
                { icon: Clock, title: "Siempre activo", text: "Tus clientes compran a cualquier hora del día." },
                { icon: Truck, title: "Entrega incluida", text: "Despacho en menos de 24 horas en Lima y provincias." },
                { icon: Shield, title: "Datos protegidos", text: "Infraestructura segura con encriptación end-to-end." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  variants={fadeUp}
                  custom={i}
                  className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-aqua mb-3" />
                  <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{item.text}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section id="pricing" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <motion.p variants={fadeUp} custom={0} className="text-sm font-semibold text-volt uppercase tracking-wider mb-3">
              Planes
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl md:text-4xl font-bold text-foreground font-heading">
              Simple, transparente, sin sorpresas
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="mt-4 text-muted-foreground text-lg">
              Elige el plan que mejor se adapta a tu operación. Escala cuando quieras.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto"
          >
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  plan.highlighted
                    ? "bg-noche text-white border-2 border-volt shadow-xl shadow-volt/10 scale-[1.02]"
                    : "bg-card border border-border/60"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold bg-volt text-white rounded-full">
                    Más popular
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={`text-sm font-semibold uppercase tracking-wider ${plan.highlighted ? "text-aqua" : "text-muted-foreground"}`}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-4xl font-bold font-heading">{plan.price}</span>
                    {plan.period && <span className={`text-sm ${plan.highlighted ? "text-white/50" : "text-muted-foreground"}`}>{plan.period}</span>}
                  </div>
                  <p className={`text-sm mt-2 ${plan.highlighted ? "text-white/60" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-3 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-volt" : "text-success"}`} />
                      <span className={`text-sm ${plan.highlighted ? "text-white/80" : "text-muted-foreground"}`}>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    plan.highlighted
                      ? "bg-volt text-white hover:bg-volt/90 shadow-lg shadow-volt/25"
                      : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  Contáctanos
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* --- CLIENTS --- */}
      <section id="clients" className="py-16 border-y border-border/50 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm font-medium text-muted-foreground mb-10 uppercase tracking-wider"
          >
            Marcas que confían en VentIA
          </motion.p>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-4 md:grid-cols-8 gap-8 items-center"
          >
            {CLIENTS.map((client, i) => (
              <motion.div
                key={client.name}
                variants={fadeUp}
                custom={i}
                className="flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0"
              >
                <Image
                  src={client.image}
                  alt={client.name}
                  width={120}
                  height={60}
                  className="h-8 md:h-10 w-auto object-contain"
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="relative rounded-3xl overflow-hidden bg-noche text-white px-8 py-16 md:px-16 md:py-20 text-center"
          >
            {/* Background glow */}
            <div className="absolute inset-0 -z-0">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-volt/10 blur-[100px]" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <motion.h2 variants={fadeUp} custom={0} className="text-3xl md:text-4xl font-bold font-heading">
                Agenda tu demo personalizada
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="mt-4 text-white/60 text-lg">
                Te mostramos cómo VentIA puede transformar tu operación en solo 3 días. Sin compromiso.
              </motion.p>
              <motion.div variants={fadeUp} custom={2} className="mt-8">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold rounded-lg bg-volt text-white hover:bg-volt/90 transition-all shadow-xl shadow-volt/30 hover:shadow-2xl hover:shadow-volt/40 hover:-translate-y-0.5"
                >
                  Agendar demo gratis
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-border/50 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-24">
                <Image src="/images/logo-ventia-sidebar.png" alt="VentIA" fill className="object-contain" />
              </div>
              <span className="text-xs text-muted-foreground">
                Landing V2 — Propuesta de rediseño
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="mailto:ventas@ventia-latam.com" className="hover:text-foreground transition-colors">
                ventas@ventia-latam.com
              </a>
              <span className="hidden sm:inline">|</span>
              <a href="tel:+51951752355" className="hover:text-foreground transition-colors">
                +51 951 752 355
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} VentIA. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <Link href="/terms-and-conditions" className="hover:text-foreground transition-colors">
                Términos y Condiciones
              </Link>
              <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                Política de Privacidad
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
