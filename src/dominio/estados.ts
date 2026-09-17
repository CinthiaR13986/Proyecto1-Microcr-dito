/**
 * estados.ts — estados persistentes del crédito, en el lenguaje del dominio.
 *
 * El mismo conjunto existe en `contratos/comunes.ts` como esquema Zod, porque
 * ahí es formato de cable y necesita validarse en tiempo de ejecución. Aquí es
 * un tipo del núcleo y nada más: el dominio no importa Zod ni ninguna otra
 * dependencia de infraestructura.
 *
 * Mora 1/2/3 y Vencido NO están en esta lista. No son estados: son
 * clasificaciones derivadas de los días de atraso, y se mueven en ambas
 * direcciones (ver clasificacion-tramo.ts).
 */

export type EstadoCredito =
  | "solicitado"
  | "aprobado"
  | "vigente"
  | "en_mora"
  | "reestructurado"
  | "rechazado"
  | "anulado"
  | "cancelado"
  | "incobrable";

/** Estados que forman parte de la cartera activa (§7.8 y P1 6.8.1). */
export const ESTADOS_EN_CARTERA_ACTIVA: readonly EstadoCredito[] = ["vigente", "en_mora", "reestructurado"];

export function estaEnCarteraActiva(estado: EstadoCredito): boolean {
  return ESTADOS_EN_CARTERA_ACTIVA.includes(estado);
}
