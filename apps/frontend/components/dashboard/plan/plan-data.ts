export interface Plan {
  id: string
  name: string
  price: number
  tagline: string
  features: string[]
  popular?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "start",
    name: "Start",
    price: 99,
    tagline: "Ideal para empezar a vender 24/7",
    features: [
      "300 conversaciones / mes",
      "50 SKUs · hasta 10 productos activos",
      "Canal WhatsApp incluido",
      "Soporte por email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 249,
    tagline: "El equilibrio entre volumen y costo",
    popular: true,
    features: [
      "2,000 conversaciones / mes",
      "500 SKUs · hasta 100 productos activos",
      "WhatsApp + Instagram + Web",
      "Configuración de recordatorios al agente",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 399,
    tagline: "Para marcas con catálogo amplio",
    features: [
      "3,500 conversaciones / mes",
      "1,250 SKUs · hasta 250 productos activos",
      "Todo lo del plan Pro",
      "Envío de campañas masivas",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 699,
    tagline: "Volumen sin techo y soporte dedicado",
    features: [
      "5,000 conversaciones / mes",
      "2,500 SKUs · hasta 500 productos activos",
      "Todo lo del plan Business",
      "Account manager dedicado",
    ],
  },
]
