export interface PaymentRecord {
  id: string
  fechaIngresada: string
  fechaEntrega: string
  horarioDespacho: string
  resumenPedido: string
  correo: string
  marcaEmpresa: string
  montoTotal: number
  moneda: string
  tipoValidacion: string
  validado: boolean
}
