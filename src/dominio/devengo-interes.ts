/**
 * devengo-interes.ts — CP-04.2, suspensión del devengo de interés corriente.
 *
 * El Proyecto 1 enunció la regla en 6.5 —"a los 90 días se suspende el
 * devengo"— pero nunca la cuantificó ni la probó: ningún caso de referencia la
 * ejercitaba, así que una implementación que la ignorara habría pasado todas
 * las pruebas. Esta pieza la hace verificable.
 *
 * La regla contable: a partir del día 91 el crédito deja de reconocer interés
 * corriente como INGRESO. Lo devengado no desaparece — se acumula en una
 * cuenta de orden, `interesEnSuspenso`. Reconocer como ingreso el interés de
 * un crédito que probablemente no se cobrará infla el resultado del período
 * con dinero que no existe.
 *
 * Al regularizar, el devengo se reactiva y lo acumulado se reconoce en el
 * período de la regularización — no se reparte hacia atrás.
 */

import { ESCALA_TRAMOS } from "./clasificacion-tramo.ts";

/**
 * Primer día sin devengo. Coincide con la entrada al tramo Vencido, que es
 * justo lo que el §7.2 describe: "último tramo con devengo de interés
 * corriente" es Mora 3. El umbral sale de la escala, no de un 91 escrito a
 * mano.
 */
export const PRIMER_DIA_SIN_DEVENGO: number =
  ESCALA_TRAMOS.find((rango) => rango.tramo === "vencido")!.diaInicial;

export function devengaInteresCorriente(diasAtraso: number): boolean {
  return diasAtraso < PRIMER_DIA_SIN_DEVENGO;
}

export interface EstadoDevengo {
  /** Interés corriente reconocido como ingreso del período. */
  readonly reconocidoCent: number;
  /** Cuenta de ORDEN: devengado pero no reconocido. Nunca es ingreso. */
  readonly enSuspensoCent: number;
}

export const DEVENGO_INICIAL: EstadoDevengo = { reconocidoCent: 0, enSuspensoCent: 0 };

/**
 * Aplica el devengo de un período de corte. El interés del período lo calcula
 * el plan de amortización; aquí solo se decide a qué cuenta va.
 */
export function devengarAlCorte(
  estado: EstadoDevengo,
  interesDelPeriodoCent: number,
  diasAtraso: number,
): EstadoDevengo {
  if (devengaInteresCorriente(diasAtraso)) {
    return { reconocidoCent: estado.reconocidoCent + interesDelPeriodoCent, enSuspensoCent: estado.enSuspensoCent };
  }
  return { reconocidoCent: estado.reconocidoCent, enSuspensoCent: estado.enSuspensoCent + interesDelPeriodoCent };
}

/**
 * Regularización: el crédito se pone al día, el devengo se reactiva y todo lo
 * acumulado en suspenso se reconoce como ingreso del período en que ocurre la
 * regularización.
 */
export function regularizarDevengo(estado: EstadoDevengo): EstadoDevengo {
  return { reconocidoCent: estado.reconocidoCent + estado.enSuspensoCent, enSuspensoCent: 0 };
}
