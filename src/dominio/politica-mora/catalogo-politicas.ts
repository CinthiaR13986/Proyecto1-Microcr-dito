/**
 * catalogo-politicas.ts — resuelve QUÉ política rige un crédito (CP-03).
 *
 * "Sin alterar los créditos ya otorgados, que conservan la política vigente a
 * su fecha de otorgamiento" (Acta 09-2026). Un crédito desembolsado el 15 de
 * agosto de 2026 se sigue calculando al 24 % plano aunque hoy rija la
 * escalonada; uno del 10 de octubre usa la escalonada. Ambos conviven en el
 * mismo cierre.
 *
 * La resolución es una búsqueda sobre datos ordenados por vigencia, no un
 * `switch` sobre un tipo de política: agregar la política de 2027 será
 * agregar una entrada a este arreglo, y el despacho seguirá siendo
 * polimórfico (GRASP: polimorfismo, no condicionales que crecen).
 */

import { POLITICA_ESCALONADA } from "./politica-escalonada.ts";
import { POLITICA_PLANA_24 } from "./politica-plana.ts";
import type { PoliticaMoratoria } from "./politica-mora.ts";

/** Políticas VIGENTES del Sistema, de la más antigua a la más reciente. */
export const CATALOGO_POLITICAS_MORATORIAS: readonly PoliticaMoratoria[] = [POLITICA_PLANA_24, POLITICA_ESCALONADA];

/**
 * Política aplicable a un crédito según su fecha de otorgamiento (AAAA-MM-DD).
 *
 * La fecha es un PARÁMETRO, nunca el reloj del sistema: con mora escalonada
 * esto importa más que nunca, porque de la fecha depende qué tabla de tasas se
 * usa durante toda la vida del crédito.
 */
export function resolverPoliticaMoratoria(fechaOtorgamiento: string): PoliticaMoratoria {
  const aplicables = CATALOGO_POLITICAS_MORATORIAS.filter((p) => p.version.vigenteDesde <= fechaOtorgamiento);
  if (aplicables.length === 0) {
    throw new Error(
      `No hay política moratoria vigente para un crédito otorgado el '${fechaOtorgamiento}': ` +
        `la más antigua del catálogo rige desde '${CATALOGO_POLITICAS_MORATORIAS[0].version.vigenteDesde}'.`,
    );
  }
  return aplicables.reduce((masReciente, p) => (p.version.vigenteDesde > masReciente.version.vigenteDesde ? p : masReciente));
}
