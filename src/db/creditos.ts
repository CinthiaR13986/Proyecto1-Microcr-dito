import { Tabla } from "./tablas.ts";

export interface FilaCredito extends Record<string, string> {
  creditoId: string;
  clienteId: string;
  solicitudId: string;
  estado: string;
  montoOriginalValor: string;
  saldoCapitalValor: string;
  tasaAprobadaAnual: string;
  plazoMeses: string;
  fechaDesembolso: string;
  creadoEn: string;
  diasAtraso: string;
  tramoMora: string;
  /** Fecha de referencia más reciente conocida para este crédito (fechaDesembolso o el fechaPago más reciente). */
  ultimaReferencia: string;
}

export const tablaCreditos = new Tabla<FilaCredito>("creditos", [
  "creditoId",
  "clienteId",
  "solicitudId",
  "estado",
  "montoOriginalValor",
  "saldoCapitalValor",
  "tasaAprobadaAnual",
  "plazoMeses",
  "fechaDesembolso",
  "creadoEn",
  "diasAtraso",
  "tramoMora",
  "ultimaReferencia",
]);
