/**
 * amortizacion.ts — plan de amortización, método francés (sección 2.6 de la
 * propuesta de arquitectura). Invariante del dominio: el saldo final de la
 * última cuota es siempre exactamente Q0.00; se logra ajustando la última
 * cuota en vez de arrastrar el redondeo de las anteriores.
 */

import { sumarMeses } from "../util/fechas.ts";

export interface CuotaCalculada {
  numero: number;
  vencimiento: string;
  saldoInicial: number;
  cuota: number;
  interes: number;
  amortizacion: number;
  saldoFinal: number;
}

export function generarPlanFrances(
  capitalCent: number,
  tasaAnual: number,
  plazoMeses: number,
  fechaDesembolso: string,
): CuotaCalculada[] {
  const tasaMensual = tasaAnual / 12;
  const cuotaTeorica =
    tasaMensual === 0 ? capitalCent / plazoMeses : (capitalCent * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses));
  const cuotaCent = Math.round(cuotaTeorica);

  const cuotas: CuotaCalculada[] = [];
  let saldo = capitalCent;
  for (let numero = 1; numero <= plazoMeses; numero++) {
    const saldoInicial = saldo;
    const interes = Math.round(saldoInicial * tasaMensual);
    let amortizacion = cuotaCent - interes;
    let cuota = cuotaCent;
    let saldoFinal = saldoInicial - amortizacion;

    if (numero === plazoMeses) {
      amortizacion = saldoInicial;
      cuota = interes + amortizacion;
      saldoFinal = 0;
    }

    cuotas.push({ numero, vencimiento: sumarMeses(fechaDesembolso, numero), saldoInicial, cuota, interes, amortizacion, saldoFinal });
    saldo = saldoFinal;
  }
  return cuotas;
}
