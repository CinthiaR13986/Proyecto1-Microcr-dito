/**
 * politica-mora.ts — PUERTO de política moratoria.
 *
 * El motor de cálculo (calculadora-mora.ts) depende de esta abstracción y
 * nunca de una implementación concreta: la política llega inyectada como
 * parámetro, jamás importada por nombre ni construida adentro. Eso es lo que
 * permite que agregar la política escalonada no obligue a abrir el motor.
 *
 * La interfaz expone lo mínimo que el motor necesita: qué versión de política
 * institucional es, y cuánto cuesta un día dentro de un tramo. Nada más. No
 * sabe sumar, no sabe redondear y no sabe clasificar.
 */

import type { TramoAtraso } from "../clasificacion-tramo.ts";

/**
 * Una política es institucional y versionada (§7.2): tiene identificador,
 * fecha de vigencia, autor y motivo. Sin estos datos no se puede auditar bajo
 * qué reglas se calculó un crédito concreto, ni justificar ante el cliente
 * por qué su mora creció distinto que la del vecino.
 */
export interface VersionPolitica {
  readonly id: string;
  readonly vigenteDesde: string;
  readonly autor: string;
  readonly motivo: string;
}

export interface PoliticaMoratoria {
  readonly version: VersionPolitica;

  /**
   * Tasa moratoria DIARIA aplicable a los días que la cuota pasó en `tramo`.
   *
   * `diasAtrasoTotal` es el contexto completo del atraso de la cuota. La
   * política escalonada y la plana lo ignoran (su tasa depende solo del tramo,
   * o de nada); la política retroactiva lo necesita porque aplica la tasa del
   * tramo ALCANZADO a todos los días recorridos. Gracias a ese parámetro las
   * tres son intercambiables sin que ninguna tenga que lanzar "no soportado".
   */
  tasaDiaria(tramo: TramoAtraso, diasAtrasoTotal: number): number;
}

/** Tasas nominales ANUALES por tramo. Es data de negocio, no lógica. */
export type TasasPorTramo = Readonly<Record<TramoAtraso, number>>;

/** Base de conteo del Sistema (§7.2): Actual/360, igual que en el Proyecto 1. */
export const DIAS_BASE_ANUAL = 360;

export function tasaDiariaDesdeAnual(tasaNominalAnual: number): number {
  return tasaNominalAnual / DIAS_BASE_ANUAL;
}
