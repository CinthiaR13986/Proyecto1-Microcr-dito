import { Tabla } from "./tablas.ts";

export interface FilaCierre extends Record<string, string> {
  cierreId: string;
  tipo: string;
  fechaCorte: string;
  carteraActivaValor: string;
  saldoEnRiesgoValor: string;
  dadoPorIncobrableValor: string;
  generadoEn: string;
}

export const tablaCierres = new Tabla<FilaCierre>("cierres", [
  "cierreId",
  "tipo",
  "fechaCorte",
  "carteraActivaValor",
  "saldoEnRiesgoValor",
  "dadoPorIncobrableValor",
  "generadoEn",
]);
