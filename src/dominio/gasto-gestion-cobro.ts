/**
 * gasto-gestion-cobro.ts — CP-02, gasto de gestión de cobro en campo.
 *
 * El Proyecto 1 colocó "gastos y comisiones" como primer eslabón de la
 * prelación, pero el rubro valió Q0.00 en todos sus ejemplos: el eslabón nunca
 * se ejercitó. Esta pieza lo cierra.
 *
 * Qué es: la visita del asesor al domicilio o negocio del cliente moroso. Es
 * un servicio efectivamente prestado, condición que exige el artículo 42 del
 * Decreto 19-2002 — no es una penalización encubierta.
 *
 * IDEMPOTENCIA POR CONSTRUCCIÓN. El gasto no se modela como un evento que se
 * dispara y acumula, sino como una cantidad DERIVADA del atraso de la cuota:
 * "a una cuota con 31 días o más le corresponde exactamente un gasto".
 * Reejecutar el cierre del mismo día recalcula el mismo número en vez de
 * sumar otro. Si se modelara como acumulación, el segundo cierre del día 31
 * dejaría el total adeudado en Q1,072.76 en vez de Q1,047.76 y el cliente
 * quedaría cobrado dos veces por una sola visita.
 */

import { ESCALA_TRAMOS } from "./clasificacion-tramo.ts";

/** Q25.00 fijos por cuota vencida. */
export const GASTO_GESTION_COBRO_CENT = 2_500;

/**
 * Se genera al entrar a Mora 2, nunca en Mora 1: un atraso de pocos días es
 * descuido y no justifica mandar a un asesor al domicilio del cliente. El
 * umbral sale de la escala de tramos, no de un 31 escrito a mano.
 */
export const DIAS_ATRASO_PARA_GENERAR: number =
  ESCALA_TRAMOS.find((rango) => rango.tramo === "mora_2")!.diaInicial;

/**
 * Gasto TOTAL que le corresponde a una cuota vencida por sus días de atraso.
 *
 * Es constante desde el día 31 en adelante: pasar de Mora 2 a Mora 3 o a
 * Vencido NO genera un gasto nuevo, porque no hubo una segunda visita. El
 * hecho que se cobra es la gestión, no el tramo.
 */
export function gastoGestionCobroCorrespondiente(diasAtraso: number): number {
  return diasAtraso >= DIAS_ATRASO_PARA_GENERAR ? GASTO_GESTION_COBRO_CENT : 0;
}

export interface EstadoGastoCuota {
  readonly diasAtraso: number;
  /** Gasto ya generado para esta cuota en cierres anteriores. */
  readonly gastoGeneradoCent: number;
}

/**
 * Gasto NUEVO que este cierre debe registrar para la cuota. Cero si ya se
 * había generado antes: es lo que hace que reejecutar un cierre sea inocuo.
 */
export function gastoGestionCobroPorDevengar(estado: EstadoGastoCuota): number {
  return Math.max(0, gastoGestionCobroCorrespondiente(estado.diasAtraso) - estado.gastoGeneradoCent);
}
