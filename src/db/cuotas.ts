import { Tabla } from "./tablas.ts";

export interface FilaCuota extends Record<string, string> {
  creditoId: string;
  numero: string;
  vencimiento: string;
  saldoInicialValor: string;
  cuotaValor: string;
  interesValor: string;
  amortizacionValor: string;
  saldoFinalValor: string;
  /** Saldo mutable: se reduce con cada pago. Los campos de arriba son el plan original, inmutable. */
  capitalPendienteValor: string;
  interesPendienteValor: string;
  estado: string;
}

export const tablaCuotas = new Tabla<FilaCuota>("cuotas", [
  "creditoId",
  "numero",
  "vencimiento",
  "saldoInicialValor",
  "cuotaValor",
  "interesValor",
  "amortizacionValor",
  "saldoFinalValor",
  "capitalPendienteValor",
  "interesPendienteValor",
  "estado",
]);
