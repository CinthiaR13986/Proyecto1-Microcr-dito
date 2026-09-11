/**
 * politica-escalonada.ts — política moratoria por tramo de atraso (CP-01).
 *
 * Archivo NUEVO. El motor de cálculo no se abrió para admitirlo: la escalonada
 * entra por el mismo puerto que la plana. Esa es la prueba del principio
 * abierto/cerrado que mide el informe de impacto.
 *
 * Acta 09-2026 del Comité de Crédito: la tasa única "no distingue el descuido
 * del deterioro". Cada tramo tiene ahora su propio precio, y la cuota paga
 * cada día a la tasa del tramo al que ese día pertenece (§7.3).
 */

import type { TramoAtraso } from "../clasificacion-tramo.ts";
import { tasaDiariaDesdeAnual, type PoliticaMoratoria, type TasasPorTramo, type VersionPolitica } from "./politica-mora.ts";

export function crearPoliticaEscalonada(version: VersionPolitica, tasasAnuales: TasasPorTramo): PoliticaMoratoria {
  return {
    version,
    tasaDiaria(tramo: TramoAtraso, _diasAtrasoTotal: number): number {
      return tasaDiariaDesdeAnual(tasasAnuales[tramo]);
    },
  };
}

/**
 * Las cinco cifras del enunciado §7.2. Viven aquí, como DATA de una versión de
 * política, y no dentro del motor: cambiar el 30 % de Mora 3 mañana es editar
 * esta tabla o publicar una versión nueva, nunca recompilar la lógica de
 * cálculo.
 *
 * `ninguno` e `incobrable` valen 0 porque no tienen precio que fijar: que esos
 * tramos no devenguen es una regla del Sistema que el motor aplica por su
 * cuenta (ver clasificacion-tramo.ts), no algo que cada política deba recordar.
 */
export const TASAS_ESCALONADAS_2026: TasasPorTramo = {
  ninguno: 0,
  mora_1: 0.18,
  mora_2: 0.24,
  mora_3: 0.3,
  vencido: 0.36,
  incobrable: 0,
};

export const VERSION_ESCALONADA_2026: VersionPolitica = {
  id: "POL-2026-10",
  vigenteDesde: "2026-10-01",
  autor: "Comité de Crédito de Crédito Vecino, S. A. (Acta 09-2026)",
  motivo:
    "La tasa moratoria única castiga igual al cliente que se atrasa cinco días que al que lleva cuatro meses. " +
    "Se escalona por tramo para distinguir el descuido del deterioro.",
};

/** Política vigente para todo crédito otorgado desde el 1 de octubre de 2026. */
export const POLITICA_ESCALONADA = crearPoliticaEscalonada(VERSION_ESCALONADA_2026, TASAS_ESCALONADAS_2026);
