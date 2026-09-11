/**
 * politica-plana.ts — política moratoria de tasa única (la del Proyecto 1).
 *
 * SE CONSERVA VIVA. No es código muerto ni histórico: los créditos otorgados
 * antes del 1 de octubre de 2026 se siguen calculando con ella (§7.6), porque
 * un crédito conserva la política vigente a su fecha de otorgamiento.
 */

import type { TramoAtraso } from "../clasificacion-tramo.ts";
import { tasaDiariaDesdeAnual, type PoliticaMoratoria, type VersionPolitica } from "./politica-mora.ts";

export function crearPoliticaPlana(version: VersionPolitica, tasaNominalAnual: number): PoliticaMoratoria {
  const tasaDiaria = tasaDiariaDesdeAnual(tasaNominalAnual);
  return {
    version,
    // La tasa no depende del tramo ni del atraso acumulado: por eso el cliente
    // que se atrasa cinco días paga proporcionalmente lo mismo que el que
    // lleva cuatro meses. Es exactamente lo que el comité decidió corregir.
    tasaDiaria(_tramo: TramoAtraso, _diasAtrasoTotal: number): number {
      return tasaDiaria;
    },
  };
}

export const VERSION_PLANA_2024: VersionPolitica = {
  id: "POL-2024-01",
  vigenteDesde: "2024-01-01",
  autor: "Comité de Crédito de Crédito Vecino, S. A.",
  motivo: "Tasa moratoria única del 24 % nominal anual sobre el capital en mora (Proyecto 1, 6.5).",
};

/** Política vigente para todo crédito otorgado antes del 1 de octubre de 2026. */
export const POLITICA_PLANA_24 = crearPoliticaPlana(VERSION_PLANA_2024, 0.24);
