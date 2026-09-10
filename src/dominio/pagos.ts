/**
 * pagos.ts — aplicación de un pago en el orden de prelación (sección 2.6):
 * gastos → interés moratorio → interés corriente → capital, cuota por cuota
 * en orden desde la más antigua. El remanente tras cubrir todo lo vencido
 * ("excedente") se adelanta como capital a las cuotas futuras, también en
 * orden.
 *
 * El interés moratorio NO se calcula aquí: se delega en calculadora-mora.ts,
 * que a su vez recibe la política moratoria inyectada. Este archivo solo sabe
 * repartir el dinero en el orden de prelación; no conoce ninguna tasa.
 * Los gastos de gestión de cobro (CP-02) llegan ya generados en la cuota: este
 * archivo solo los cobra en primer lugar. Quién decide cuándo se generan y por
 * qué monto es gasto-gestion-cobro.ts.
 */

import { calcularInteresMoratorio } from "./calculadora-mora.ts";
import type { PoliticaMoratoria } from "./politica-mora/politica-mora.ts";
import { diasEntre } from "../util/fechas.ts";

export interface CuotaMutable {
  numero: number;
  vencimiento: string;
  capitalPendiente: number;
  interesPendiente: number;
  /**
   * Gastos de gestión de cobro ya generados y todavía no cobrados (CP-02).
   * Opcional: una cuota sin gestión registrada no debe nada por este rubro, que
   * es el caso de todas las cuotas del Proyecto 1.
   */
  gastosPendientes?: number;
}

export interface CuotaActualizada {
  numero: number;
  capitalPendiente: number;
  interesPendiente: number;
  gastosPendientes: number;
  pagada: boolean;
}

export interface ResultadoAplicacion {
  gastos: number;
  interesMoratorio: number;
  interesCorriente: number;
  capital: number;
  excedente: number;
  cuotasActualizadas: CuotaActualizada[];
}

const UMBRAL_CENTAVOS = 1;

export function aplicarPago(
  cuotasPendientes: CuotaMutable[],
  montoPagoCent: number,
  fechaPago: string,
  politicaMoratoria: PoliticaMoratoria,
): ResultadoAplicacion {
  const ordenadas = [...cuotasPendientes].sort((a, b) => a.numero - b.numero);
  const vencidas = ordenadas.filter((c) => c.vencimiento <= fechaPago);
  const futuras = ordenadas.filter((c) => c.vencimiento > fechaPago);

  let restante = montoPagoCent;
  let gastos = 0;
  let interesMoratorio = 0;
  let interesCorriente = 0;
  let capital = 0;
  const actualizacionesPorNumero = new Map<number, Omit<CuotaActualizada, "numero">>();

  for (const cuota of vencidas) {
    const diasAtrasoCuota = Math.max(0, diasEntre(cuota.vencimiento, fechaPago));
    const moraCuota = calcularInteresMoratorio(cuota.capitalPendiente, diasAtrasoCuota, politicaMoratoria).interesMoratorioCent;

    const pagoGastos = Math.min(restante, cuota.gastosPendientes ?? 0);
    restante -= pagoGastos;
    gastos += pagoGastos;

    const pagoMora = Math.min(restante, moraCuota);
    restante -= pagoMora;
    interesMoratorio += pagoMora;

    const pagoInteres = Math.min(restante, cuota.interesPendiente);
    restante -= pagoInteres;
    interesCorriente += pagoInteres;

    const pagoCapital = Math.min(restante, cuota.capitalPendiente);
    restante -= pagoCapital;
    capital += pagoCapital;

    const capitalPendiente = cuota.capitalPendiente - pagoCapital;
    const interesPendiente = cuota.interesPendiente - pagoInteres;
    const gastosPendientes = (cuota.gastosPendientes ?? 0) - pagoGastos;
    actualizacionesPorNumero.set(cuota.numero, {
      capitalPendiente,
      interesPendiente,
      gastosPendientes,
      pagada:
        capitalPendiente < UMBRAL_CENTAVOS && interesPendiente < UMBRAL_CENTAVOS && gastosPendientes < UMBRAL_CENTAVOS,
    });
  }

  let excedente = 0;
  for (const cuota of futuras) {
    let capitalPendiente = cuota.capitalPendiente;
    if (restante > 0) {
      const abono = Math.min(restante, capitalPendiente);
      capitalPendiente -= abono;
      restante -= abono;
      excedente += abono;
    }
    actualizacionesPorNumero.set(cuota.numero, {
      capitalPendiente,
      interesPendiente: cuota.interesPendiente,
      // Una cuota futura no ha generado gestión de cobro: no hay visita que cobrar.
      gastosPendientes: cuota.gastosPendientes ?? 0,
      pagada: capitalPendiente < UMBRAL_CENTAVOS && cuota.interesPendiente < UMBRAL_CENTAVOS,
    });
  }

  // Crédito ya cubierto por completo (no quedan cuotas para absorber el resto): se reporta igual como excedente.
  excedente += restante;

  const cuotasActualizadas = ordenadas.map((c) => ({ numero: c.numero, ...actualizacionesPorNumero.get(c.numero)! }));

  return { gastos, interesMoratorio, interesCorriente, capital, excedente, cuotasActualizadas };
}
