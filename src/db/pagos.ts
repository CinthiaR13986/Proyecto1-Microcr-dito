import { Tabla } from "./tablas.ts";

export interface FilaPago extends Record<string, string> {
  pagoId: string;
  creditoId: string;
  recibidoEn: string;
  montoValor: string;
  fechaPago: string;
  medio: string;
  referencia: string;
  gastos: string;
  interesMoratorio: string;
  interesCorriente: string;
  capital: string;
  excedente: string;
  saldoCapitalDespuesValor: string;
  estadoCredito: string;
  tramoMora: string;
  diasAtraso: string;
  idempotencyKey: string;
}

export const tablaPagos = new Tabla<FilaPago>("pagos", [
  "pagoId",
  "creditoId",
  "recibidoEn",
  "montoValor",
  "fechaPago",
  "medio",
  "referencia",
  "gastos",
  "interesMoratorio",
  "interesCorriente",
  "capital",
  "excedente",
  "saldoCapitalDespuesValor",
  "estadoCredito",
  "tramoMora",
  "diasAtraso",
  "idempotencyKey",
]);
