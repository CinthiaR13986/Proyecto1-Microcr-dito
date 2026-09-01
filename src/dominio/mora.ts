/**
 * mora.ts — tramo de mora: clasificación DERIVADA de los días de atraso
 * (comunes.ts: TramoMora). Nunca se persiste como estado; se recalcula a
 * partir de la cuota pendiente más antigua frente a una fecha de referencia
 * (fechaPago de un pago, fechaCorte de un cierre/cartera-riesgo).
 */

export type Tramo = "ninguno" | "mora_1" | "mora_2" | "mora_3" | "vencido";

import { diasEntre } from "../util/fechas.ts";

export function clasificarTramo(diasAtraso: number): Tramo {
  if (diasAtraso <= 0) return "ninguno";
  if (diasAtraso <= 30) return "mora_1";
  if (diasAtraso <= 60) return "mora_2";
  if (diasAtraso <= 90) return "mora_3";
  return "vencido";
}

export interface CuotaConVencimiento {
  vencimiento: string;
}

/** Días de atraso = distancia entre la cuota pendiente MÁS ANTIGUA y la fecha de referencia. */
export function calcularDiasAtraso(cuotasPendientes: CuotaConVencimiento[], fechaReferencia: string): number {
  if (cuotasPendientes.length === 0) return 0;
  const masAntigua = cuotasPendientes.reduce((a, b) => (a.vencimiento < b.vencimiento ? a : b));
  return Math.max(0, diasEntre(masAntigua.vencimiento, fechaReferencia));
}
