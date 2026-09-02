import { Tabla } from "./tablas.ts";

export interface FilaSolicitud extends Record<string, string> {
  solicitudId: string;
  clienteId: string;
  montoValor: string;
  plazoMeses: string;
  proposito: string;
  estado: string;
  creadoEn: string;
  creditoId: string;
  tasaAprobadaAnual: string;
  motivoRechazo: string;
}

export const tablaSolicitudes = new Tabla<FilaSolicitud>("solicitudes", [
  "solicitudId",
  "clienteId",
  "montoValor",
  "plazoMeses",
  "proposito",
  "estado",
  "creadoEn",
  "creditoId",
  "tasaAprobadaAnual",
  "motivoRechazo",
]);
