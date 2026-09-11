/**
 * calculadora-mora.ts — MOTOR de cálculo del interés moratorio.
 *
 * Este archivo es el sujeto del experimento del Proyecto 2: si el diseño
 * aplicó SOLID, agregar una política nueva NO debe obligar a volver a
 * abrirlo. No contiene ninguna tasa, ninguna fecha de vigencia y ningún
 * `if` sobre el tipo de política.
 *
 * Reparto de responsabilidades:
 *   · clasificacion-tramo.ts → en qué tramo cae cada día  (Specification)
 *   · PoliticaMoratoria      → cuánto cuesta un día de ese tramo  (Strategy)
 *   · este archivo           → recorrer, sumar y redondear UNA vez
 *
 * Reglas de dominio que el motor sí conserva, porque no dependen de la
 * política vigente:
 *   · Redondeo una sola vez, al cerrar la cuota (§7.3). Redondear tramo por
 *     tramo da Q18.15 donde corresponde Q18.14: un centavo por cuota vencida,
 *     por miles de cuotas al mes, es un descuadre contable real.
 *   · Tope: el moratorio acumulado de una cuota nunca excede su propio
 *     capital en mora.
 *   · Anatocismo prohibido: se calcula SOLO sobre capital en mora, jamás
 *     sobre interés (Código Civil, Decreto-Ley 106).
 *   · Los tramos que no devengan (cuota al día, crédito incobrable) no entran
 *     al cálculo, sea cual sea la política: el moratorio se congela el día que
 *     el crédito sale de la cartera.
 */

import { devengaMoratorio, tramosRecorridos, type TramoAtraso } from "./clasificacion-tramo.ts";
import type { PoliticaMoratoria } from "./politica-mora/politica-mora.ts";

export interface TramoCobrado {
  readonly tramo: TramoAtraso;
  readonly dias: number;
  readonly tasaDiaria: number;
  /** Importe del tramo SIN redondear. Es de exhibición: nunca se redondea por separado. */
  readonly importeCent: number;
}

export interface DesgloseMoratorio {
  /** Tramos efectivamente recorridos, en orden. Alimenta la pantalla "Detalle de la mora". */
  readonly tramos: readonly TramoCobrado[];
  readonly diasAtraso: number;
  /** Único valor redondeado del cálculo, en centavos. */
  readonly interesMoratorioCent: number;
  /** true si el tope (moratorio ≤ capital en mora) recortó el resultado. */
  readonly topeAplicado: boolean;
}

/**
 * Interés moratorio de UNA cuota vencida. Cada cuota se calcula por separado,
 * con su propio capital en mora y sus propios días de atraso: nunca se suma el
 * capital de dos cuotas para calcular una sola vez (§7.4).
 */
export function calcularInteresMoratorio(
  capitalEnMoraCent: number,
  diasAtraso: number,
  politica: PoliticaMoratoria,
): DesgloseMoratorio {
  const tramos = tramosRecorridos(diasAtraso)
    .filter((recorrido) => devengaMoratorio(recorrido.tramo))
    .map((recorrido) => {
      const tasaDiaria = politica.tasaDiaria(recorrido.tramo, diasAtraso);
      return {
        tramo: recorrido.tramo,
        dias: recorrido.dias,
        tasaDiaria,
        importeCent: capitalEnMoraCent * tasaDiaria * recorrido.dias,
      };
    });

  const totalSinRedondear = tramos.reduce((suma, tramo) => suma + tramo.importeCent, 0);
  const redondeado = Math.round(totalSinRedondear);
  const topeAplicado = redondeado > capitalEnMoraCent;

  return {
    tramos,
    diasAtraso: Math.max(0, diasAtraso),
    interesMoratorioCent: topeAplicado ? capitalEnMoraCent : redondeado,
    topeAplicado,
  };
}
