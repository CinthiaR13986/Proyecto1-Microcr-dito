/**
 * pagos.ts — aplicación de un pago en el orden de prelación (sección 2.6):
 * gastos → interés moratorio → interés corriente → capital, cuota por cuota
 * en orden desde la más antigua. El remanente tras cubrir todo lo vencido
 * ("excedente") se adelanta como capital a las cuotas futuras, también en
 * orden.
 *
 * Regla de mora asumida (no fijada en el contrato): interés moratorio simple
 * sobre el capital pendiente de la cuota, a la tasa anual aprobada / 360,
 * por los días transcurridos desde su vencimiento hasta la fecha de pago.
 * `gastos` no tiene política definida en el contrato: siempre Q0.00.
 */

import { diasEntre } from "../util/fechas.ts";

export interface CuotaMutable {
  numero: number;
  vencimiento: string;
  capitalPendiente: number;
  interesPendiente: number;
}

export interface CuotaActualizada {
  numero: number;
  capitalPendiente: number;
  interesPendiente: number;
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
  tasaAnual: number,
): ResultadoAplicacion {
  const ordenadas = [...cuotasPendientes].sort((a, b) => a.numero - b.numero);
  const vencidas = ordenadas.filter((c) => c.vencimiento <= fechaPago);
  const futuras = ordenadas.filter((c) => c.vencimiento > fechaPago);

  let restante = montoPagoCent;
  let interesMoratorio = 0;
  let interesCorriente = 0;
  let capital = 0;
  const actualizacionesPorNumero = new Map<number, Omit<CuotaActualizada, "numero">>();

  for (const cuota of vencidas) {
    const diasAtrasoCuota = Math.max(0, diasEntre(cuota.vencimiento, fechaPago));
    const moraCuota = diasAtrasoCuota > 0 ? Math.round((cuota.capitalPendiente * tasaAnual * diasAtrasoCuota) / 360) : 0;

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
    actualizacionesPorNumero.set(cuota.numero, {
      capitalPendiente,
      interesPendiente,
      pagada: capitalPendiente < UMBRAL_CENTAVOS && interesPendiente < UMBRAL_CENTAVOS,
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
      pagada: capitalPendiente < UMBRAL_CENTAVOS && cuota.interesPendiente < UMBRAL_CENTAVOS,
    });
  }

  // Crédito ya cubierto por completo (no quedan cuotas para absorber el resto): se reporta igual como excedente.
  excedente += restante;

  const cuotasActualizadas = ordenadas.map((c) => ({ numero: c.numero, ...actualizacionesPorNumero.get(c.numero)! }));

  return { gastos: 0, interesMoratorio, interesCorriente, capital, excedente, cuotasActualizadas };
}
