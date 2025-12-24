import { PaymentRecord } from "@/lib/types/payment-record"

export const mockPayments: PaymentRecord[] = [
  {
    id: "1",
    fechaIngresada: "2025-11-18T00:00:00Z",
    fechaEntrega: "2025-11-19T00:00:00Z",
    horarioDespacho: "9am a 1pm y 2pm a 7pm",
    resumenPedido: "¡Excelente, Sebastián! Ya registramos tu pedido. Aquí tienes un resumen de tu compra:\n\n- 2 Autobronceadores Corporales - S/198.00\nDelivery a Miraflores: S/10.00\nMonto cancelado: S/208.00\n\nTus datos son:\nNombre: Sebastián Casabonne\nDNI: 74598459\nContacto: 989123452\nDirección completa: calle Lima 101, Miraflores\nHorario de entrega: Mañana de 9am a 1pm y de 2pm a 7pm.\n\n¡Muchas gracias por tu compra! Tu pedido llegará pronto. 🧡",
    correo: "scasabonne26@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 208,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "2",
    fechaIngresada: "2025-10-05T00:00:00Z",
    fechaEntrega: "2025-10-06T00:00:00Z",
    horarioDespacho: "2pm a 6pm",
    resumenPedido: "Pedido confirmado:\n\n- Aceite Corporal Bronceador - S/79.00\nDelivery: S/8.00\nTotal: S/87.00\n\nCliente: Ana Rodríguez\nDNI: 75698214\nTel: 987654321\nDirección: Jr. Carabaya 450, Lima\nEntrega: Tarde",
    correo: "ana.rod@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 87,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "3",
    fechaIngresada: "2025-09-22T00:00:00Z",
    fechaEntrega: "2025-09-23T00:00:00Z",
    horarioDespacho: "8am a 12pm",
    resumenPedido: "Compra registrada:\n\n- Pack Bronceador + Hidratante - S/120.00\nDelivery: S/10.00\nTotal: S/130.00\n\nCliente: Luis Martínez\nDNI: 74851236\nTel: 912345678\nDirección: Av. Angamos 780, Surquillo\nEntrega: Mañana",
    correo: "luism@hotmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 130,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "4",
    fechaIngresada: "2025-07-10T00:00:00Z",
    fechaEntrega: "2025-07-11T00:00:00Z",
    horarioDespacho: "10am a 1pm",
    resumenPedido: "Detalle del pedido:\n\n- Autobronceador Facial - S/69.00\nDelivery: S/7.00\nTotal: S/76.00\n\nCliente: Karla Gómez\nDNI: 75231489\nTel: 900123456\nDirección: Calle Los Robles 150, Barranco",
    correo: "karla.gmz@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 76,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "5",
    fechaIngresada: "2025-06-01T00:00:00Z",
    fechaEntrega: "2025-06-02T00:00:00Z",
    horarioDespacho: "1pm a 4pm",
    resumenPedido: "Confirmación de pedido:\n\n- Pack Autobronceador Pro - S/150.00\nDelivery: S/8.00\nTotal: S/158.00\n\nCliente: Diego Salazar\nDNI: 70123459\nTel: 989453212\nDirección: Av. Brasil 1230, Jesús María",
    correo: "diego.sal@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 158,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "6",
    fechaIngresada: "2025-05-15T00:00:00Z",
    fechaEntrega: "2025-05-16T00:00:00Z",
    horarioDespacho: "9am a 1pm",
    resumenPedido: "Pedido:\n\n- Hidratante Post-Bronceado - S/60.00\nDelivery: S/5.00\nTotal: S/65.00\n\nCliente: Mariela Cruz\nDNI: 76985412\nTel: 945612789\nDirección: San Isidro 230",
    correo: "mcruz@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 65,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "7",
    fechaIngresada: "2025-04-12T00:00:00Z",
    fechaEntrega: "2025-04-13T00:00:00Z",
    horarioDespacho: "2pm a 6pm",
    resumenPedido: "Resumen:\n\n- Autobronceador Express - S/85.00\nDelivery: S/7.00\nTotal: S/92.00\n\nCliente: Jorge Paredes\nDNI: 74851236\nTel: 923456781\nDirección: Pueblo Libre, Lima",
    correo: "jparedes@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 92,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "8",
    fechaIngresada: "2025-03-20T00:00:00Z",
    fechaEntrega: "2025-03-21T00:00:00Z",
    horarioDespacho: "8am a 12pm",
    resumenPedido: "Pedido procesado:\n\n- Serum Bronceador Luminoso - S/95.00\nDelivery: S/6.00\nTotal: S/101.00\n\nCliente: Adriana Torres\nDNI: 75932148\nTel: 987321654\nDirección: Av. Universitaria 1230",
    correo: "adritorres@hotmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 101,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "9",
    fechaIngresada: "2025-02-08T00:00:00Z",
    fechaEntrega: "2025-02-09T00:00:00Z",
    horarioDespacho: "9am a 1pm",
    resumenPedido: "Compra:\n\n- Autobronceador Natural - S/89.00\nDelivery: S/8.00\nTotal: S/97.00\n\nCliente: Sofía Herrera\nDNI: 71563924\nTel: 948123654\nDirección: Miraflores, Lima",
    correo: "sofiah@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 97,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "10",
    fechaIngresada: "2025-01-19T00:00:00Z",
    fechaEntrega: "2025-01-20T00:00:00Z",
    horarioDespacho: "2pm a 5pm",
    resumenPedido: "Pedido realizado:\n\n- Bronceador en Spray - S/75.00\nDelivery: S/5.00\nTotal: S/80.00\n\nCliente: Mateo Aguilar\nDNI: 70123569\nTel: 932156478\nDirección: Av. Benavides 1400, Surco",
    correo: "mateo.ag@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 80,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "11",
    fechaIngresada: "2024-12-12T00:00:00Z",
    fechaEntrega: "2024-12-13T00:00:00Z",
    horarioDespacho: "9am a 1pm",
    resumenPedido: "Pedido:\n\n- Autobronceador Corporal Intensivo - S/110.00\nDelivery: S/10.00\nTotal: S/120.00\n\nCliente: Camila Ibáñez\nDNI: 74859623\nContacto: 934512678\nDirección: Magdalena del Mar",
    correo: "camila.ibz@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 120,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "12",
    fechaIngresada: "2024-11-05T00:00:00Z",
    fechaEntrega: "2024-11-06T00:00:00Z",
    horarioDespacho: "2pm a 7pm",
    resumenPedido: "Detalle:\n\n- Bronceador Ultra Shine - S/98.00\nDelivery: S/8.00\nTotal: S/106.00\n\nCliente: Fernanda Ruiz\nDNI: 75489621\nTel: 987654210\nDirección: San Borja",
    correo: "fernanda.ruiz@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 106,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "13",
    fechaIngresada: "2024-10-29T00:00:00Z",
    fechaEntrega: "2024-10-30T00:00:00Z",
    horarioDespacho: "10am a 2pm",
    resumenPedido: "Pedido:\n\n- Autobronceador Cuerpo & Rostro - S/140.00\nDelivery: S/9.00\nTotal: S/149.00\n\nCliente: Claudia Morales\nDNI: 74012589\nTel: 970852314\nDirección: Callao",
    correo: "claudia.mor@hotmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 149,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "14",
    fechaIngresada: "2024-09-15T00:00:00Z",
    fechaEntrega: "2024-09-16T00:00:00Z",
    horarioDespacho: "12pm a 4pm",
    resumenPedido: "Compra realizada:\n\n- Extensor de Bronceado Pro - S/60.00\nDelivery: S/5.00\nTotal: S/65.00\n\nCliente: Daniela Vera\nDNI: 78125496\nContacto: 945632178\nDirección: La Molina",
    correo: "daniela.v@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 65,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "15",
    fechaIngresada: "2024-08-23T00:00:00Z",
    fechaEntrega: "2024-08-24T00:00:00Z",
    horarioDespacho: "8am a 11am",
    resumenPedido: "Pedido registrado:\n\n- Autobronceador Matte Look - S/89.00\nDelivery: S/7.00\nTotal: S/96.00\n\nCliente: Ricardo Torres\nDNI: 74125896\nTel: 915623478\nDirección: Surco",
    correo: "ricardo.t@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 96,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "16",
    fechaIngresada: "2024-07-30T00:00:00Z",
    fechaEntrega: "2024-07-31T00:00:00Z",
    horarioDespacho: "2pm a 6pm",
    resumenPedido: "Compra:\n\n- Glow Serum Bronceador - S/120.00\nDelivery: S/8.00\nTotal: S/128.00\n\nCliente: Melissa Rojas\nDNI: 78965412\nContacto: 987456321\nDirección: San Miguel",
    correo: "melissa.rj@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 128,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "17",
    fechaIngresada: "2024-06-12T00:00:00Z",
    fechaEntrega: "2024-06-13T00:00:00Z",
    horarioDespacho: "9am a 1pm",
    resumenPedido: "Pedido:\n\n- Autobronceador Efecto Playa - S/75.00\nDelivery: S/7.00\nTotal: S/82.00\n\nCliente: José Alvarado\nDNI: 71329485\nTel: 923456789\nDirección: Magdalena",
    correo: "jose.alv@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 82,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "18",
    fechaIngresada: "2024-05-21T00:00:00Z",
    fechaEntrega: "2024-05-22T00:00:00Z",
    horarioDespacho: "1pm a 5pm",
    resumenPedido: "Confirmación:\n\n- Autobronceador Iluminador - S/85.00\nDelivery: S/6.00\nTotal: S/91.00\n\nCliente: Patricia Chávez\nDNI: 71568942\nContacto: 987123654\nDirección: Chorrillos",
    correo: "patricia.ch@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 91,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  },
  {
    id: "19",
    fechaIngresada: "2024-04-09T00:00:00Z",
    fechaEntrega: "2024-04-10T00:00:00Z",
    horarioDespacho: "10am a 1pm",
    resumenPedido: "Orden:\n\n- Pack Bronceado Natural - S/140.00\nDelivery: S/10.00\nTotal: S/150.00\n\nCliente: Santiago López\nDNI: 72315948\nTel: 945213678\nDirección: San Isidro",
    correo: "slopez@gmail.com",
    marcaEmpresa: "La Doré",
    montoTotal: 150,
    moneda: "S/",
    tipoValidacion: "REQUIERE VALIDACIÓN MANUAL DE LA MARCA",
    validado: false
  },
  {
    id: "20",
    fechaIngresada: "2024-03-30T00:00:00Z",
    fechaEntrega: "2024-03-31T00:00:00Z",
    horarioDespacho: "3pm a 7pm",
    resumenPedido: "Pedido confirmado:\n\n- Autobronceador Glow Max - S/160.00\nDelivery: S/8.00\nTotal: S/168.00\n\nCliente: Valentina Serrano\nDNI: 78931245\nContacto: 987654789\nDirección: Miraflores",
    correo: "valentina.serr@gmail.com",
    marcaEmpresa: "GlowSkin",
    montoTotal: 168,
    moneda: "S/",
    tipoValidacion: "VALIDACIÓN AUTOMÁTICA",
    validado: true
  }
]

// Datos para la tabla de actividad reciente del dashboard
export interface RecentActivity {
  id: string
  cliente: string
  fecha: string
  monto: string
  estado: "Pagado" | "Pendiente" | "Enviado" | "Cancelado"
}

export const recentActivity: RecentActivity[] = [
  {
    id: "#ORD-001",
    cliente: "Tech Solutions S.A.",
    fecha: "Oct 24, 2023",
    monto: "$1,200.00",
    estado: "Pagado"
  },
  {
    id: "#ORD-002",
    cliente: "Inversiones Beta",
    fecha: "Oct 24, 2023",
    monto: "$850.50",
    estado: "Pendiente"
  },
  {
    id: "#ORD-003",
    cliente: "Grupo Comercial",
    fecha: "Oct 23, 2023",
    monto: "$2,300.00",
    estado: "Enviado"
  },
  {
    id: "#ORD-004",
    cliente: "Alpha Retail",
    fecha: "Oct 23, 2023",
    monto: "$450.00",
    estado: "Pagado"
  },
  {
    id: "#ORD-005",
    cliente: "Consultores X",
    fecha: "Oct 22, 2023",
    monto: "$1,100.00",
    estado: "Cancelado"
  }
]
