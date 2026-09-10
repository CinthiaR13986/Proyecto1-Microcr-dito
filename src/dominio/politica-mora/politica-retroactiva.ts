/**
 * politica-retroactiva.ts — política NO ADOPTADA por el Sistema.
 *
 * Aplica la tasa del tramo ALCANZADO a todos los días de atraso recorridos:
 * una cuota con 100 días de atraso pagaría los 100 días al 36 %, Q72.58 en vez
 * de los Q50.80 de la escalonada. El enunciado la marca explícitamente como
 * regla incorrecta y penaliza usarla como política del Sistema (§10).
 *
 * Existe por una sola razón: la prueba de sustitución de Liskov. Si el motor
 * de cálculo puede ejecutar esta política —que es deliberadamente distinta—
 * sin romper ninguno de sus invariantes, entonces el puerto está bien
 * definido y no depende del comportamiento de una implementación concreta.
 *
 * NO EXPORTAR al catálogo de políticas vigentes.
 */

import { tramoDevengableAlcanzado, type TramoAtraso } from "../clasificacion-tramo.ts";
import { tasaDiariaDesdeAnual, type PoliticaMoratoria, type TasasPorTramo, type VersionPolitica } from "./politica-mora.ts";

export function crearPoliticaRetroactiva(version: VersionPolitica, tasasAnuales: TasasPorTramo): PoliticaMoratoria {
  return {
    version,
    // Ignora el tramo del día y cobra todo al precio del tramo alcanzado: es
    // el uso que justifica el segundo parámetro del puerto. El tramo alcanzado
    // se topa en el último día devengable; si "alcanzara" la incobrabilidad,
    // el moratorio ya causado desaparecería y la mora dejaría de ser monótona.
    tasaDiaria(_tramo: TramoAtraso, diasAtrasoTotal: number): number {
      return tasaDiariaDesdeAnual(tasasAnuales[tramoDevengableAlcanzado(diasAtrasoTotal)]);
    },
  };
}

export const VERSION_RETROACTIVA: VersionPolitica = {
  id: "POL-CONTRASTE",
  vigenteDesde: "9999-12-31",
  autor: "—  (política de contraste, nunca adoptada)",
  motivo: "Solo para la prueba de sustituibilidad del puerto. No rige ningún crédito.",
};
