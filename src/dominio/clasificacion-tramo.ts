/**
 * clasificacion-tramo.ts — Specification: días de atraso → tramo.
 *
 * Esta pieza responde UNA sola pregunta: "¿en qué tramo cae este día de
 * atraso?". No sabe cuánto cuesta un tramo — eso es responsabilidad de la
 * política (ver politica-mora/politica-mora.ts) — ni sabe sumar intereses —
 * eso es del motor (calculadora-mora.ts). Separarlas es lo que permite
 * cambiar las tasas sin tocar la clasificación y viceversa.
 *
 * El tramo NUNCA se persiste: es una clasificación derivada que se mueve en
 * ambas direcciones (una cuota que se pone al día vuelve a "ninguno").
 */

export type TramoAtraso = "ninguno" | "mora_1" | "mora_2" | "mora_3" | "vencido" | "incobrable";

export interface RangoTramo {
  readonly tramo: TramoAtraso;
  readonly diaInicial: number;
  /** `Infinity` en el último tramo: la incobrabilidad no tiene día de cierre. */
  readonly diaFinal: number;
}

/**
 * Escala de tramos del enunciado (§7.2). Es data, no lógica: agregar o mover
 * un tramo no obliga a reescribir ninguna función de este archivo.
 */
export const ESCALA_TRAMOS: readonly RangoTramo[] = [
  { tramo: "mora_1", diaInicial: 1, diaFinal: 30 },
  { tramo: "mora_2", diaInicial: 31, diaFinal: 60 },
  { tramo: "mora_3", diaInicial: 61, diaFinal: 90 },
  { tramo: "vencido", diaInicial: 91, diaFinal: 120 },
  { tramo: "incobrable", diaInicial: 121, diaFinal: Infinity },
];

export function clasificarTramoDeAtraso(diasAtraso: number): TramoAtraso {
  if (diasAtraso <= 0) return "ninguno";
  const rango = ESCALA_TRAMOS.find((r) => diasAtraso >= r.diaInicial && diasAtraso <= r.diaFinal);
  return rango ? rango.tramo : "incobrable";
}

/**
 * Tramos que NO generan interés moratorio, bajo ninguna política:
 *   · `ninguno`     → la cuota está al día, no hay nada que devengar.
 *   · `incobrable`  → el crédito se dio de baja contable, salió de la cartera
 *                     y DEJA de generar moratorio (§7.4, P1 6.7).
 *
 * Es una regla del Sistema, no de una política concreta: si cada política
 * tuviera que acordarse de poner su tasa en cero, la primera que lo olvidara
 * rompería el invariante en silencio y seguiría cobrándole a un crédito ya
 * dado de baja.
 */
const TRAMOS_NO_DEVENGABLES: readonly TramoAtraso[] = ["ninguno", "incobrable"];

export function devengaMoratorio(tramo: TramoAtraso): boolean {
  return !TRAMOS_NO_DEVENGABLES.includes(tramo);
}

/** Último día de atraso que genera devengo; a partir de aquí el moratorio se congela. */
export const ULTIMO_DIA_DEVENGABLE: number = ESCALA_TRAMOS.filter((r) => Number.isFinite(r.diaFinal)).reduce(
  (ultimo, r) => Math.max(ultimo, r.diaFinal),
  0,
);

/**
 * Tramo alcanzado por la cuota, sin pasar del último día devengable. Lo usa la
 * política retroactiva para no "alcanzar" la incobrabilidad y hacer
 * desaparecer el moratorio ya causado.
 */
export function tramoDevengableAlcanzado(diasAtraso: number): TramoAtraso {
  return clasificarTramoDeAtraso(Math.min(diasAtraso, ULTIMO_DIA_DEVENGABLE));
}

/**
 * Días que una cuota con `diasAtraso` días de atraso pasó dentro de `rango`.
 * Fórmula del enunciado §7.3: max(0, min(d, fin) − ini + 1).
 *
 * Es la regla que distingue "tramos recorridos" de "tramo actual": una cuota
 * con 45 días de atraso NO pasó 45 días en Mora 2; pasó 30 en Mora 1 y 15 en
 * Mora 2.
 */
export function diasEnTramo(diasAtraso: number, rango: RangoTramo): number {
  return Math.max(0, Math.min(diasAtraso, rango.diaFinal) - rango.diaInicial + 1);
}

export interface TramoRecorrido {
  readonly tramo: TramoAtraso;
  readonly dias: number;
}

/** Descompone los días de atraso en los tramos que la cuota efectivamente recorrió. */
export function tramosRecorridos(diasAtraso: number): TramoRecorrido[] {
  if (diasAtraso <= 0) return [];
  return ESCALA_TRAMOS.map((rango) => ({ tramo: rango.tramo, dias: diasEnTramo(diasAtraso, rango) })).filter(
    (recorrido) => recorrido.dias > 0,
  );
}
