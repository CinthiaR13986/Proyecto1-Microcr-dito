/**
 * maquina-estados.ts — CP-04.1, transiciones del ciclo de vida del crédito.
 *
 * El Proyecto 1 tenía la tabla de transiciones en el documento (6.7.1) y la
 * decisión en el adaptador HTTP, en una línea suelta:
 *
 *   estado = saldo <= 0 ? "cancelado" : diasAtraso > 0 ? "en_mora" : "vigente";
 *
 * Esa línea no es una máquina de estados: no tiene guardas, no valida el
 * evento y vive fuera del núcleo. Aquí la tabla pasa a ser código ejecutable,
 * y con ella el hueco que reporta CP-04.1: la tabla del P1 no contemplaba
 * `en_mora → cancelado`, pero su propio escenario de pago de más (6.6.5)
 * afirmaba que un excedente que liquida el saldo cancela el crédito. Un
 * crédito en mora que paga todo no tenía, según la tabla, a dónde ir.
 */

import type { EstadoCredito } from "./estados.ts";

export type EventoCredito =
  | "aprobacion"
  | "rechazo"
  | "anulacion"
  | "desembolso"
  | "pago"
  | "atraso"
  | "regularizacion"
  | "reestructuracion"
  | "declaracion_incobrable";

/**
 * Datos que las guardas necesitan para decidir. Los provee quien conoce el
 * crédito; la máquina no los calcula ni los va a buscar.
 */
export interface ContextoTransicion {
  readonly saldoCapitalCent: number;
  readonly cuotasVencidasPendientes: number;
  readonly diasAtraso: number;
}

export type ResultadoTransicion =
  | { readonly permitida: true; readonly estado: EstadoCredito }
  | { readonly permitida: false; readonly motivo: string };

interface Transicion {
  readonly desde: EstadoCredito;
  readonly evento: EventoCredito;
  readonly hacia: EstadoCredito;
  readonly guarda?: (contexto: ContextoTransicion) => boolean;
  readonly exigencia?: string;
}

/**
 * Guarda de cancelación: saldo en CERO EXACTO y sin cuotas vencidas
 * pendientes. No basta con que el saldo de capital llegue a cero: una cuota
 * vencida con interés o gastos sin cubrir deja el crédito vivo.
 */
function liquidaElCredito(contexto: ContextoTransicion): boolean {
  return contexto.saldoCapitalCent === 0 && contexto.cuotasVencidasPendientes === 0;
}

export const TABLA_TRANSICIONES: readonly Transicion[] = [
  { desde: "solicitado", evento: "aprobacion", hacia: "aprobado" },
  { desde: "solicitado", evento: "rechazo", hacia: "rechazado" },
  { desde: "solicitado", evento: "anulacion", hacia: "anulado" },

  { desde: "aprobado", evento: "desembolso", hacia: "vigente" },
  { desde: "aprobado", evento: "anulacion", hacia: "anulado" },

  {
    desde: "vigente",
    evento: "atraso",
    hacia: "en_mora",
    guarda: (c) => c.diasAtraso > 0,
    exigencia: "se requiere al menos un día de atraso",
  },
  {
    desde: "vigente",
    evento: "pago",
    hacia: "cancelado",
    guarda: liquidaElCredito,
    exigencia: "se requiere saldo de capital en cero y sin cuotas vencidas pendientes",
  },
  { desde: "vigente", evento: "reestructuracion", hacia: "reestructurado" },

  {
    desde: "en_mora",
    evento: "regularizacion",
    hacia: "vigente",
    guarda: (c) => c.diasAtraso === 0,
    exigencia: "se requiere que no queden días de atraso",
  },
  // ─── CP-04.1: la transición que faltaba en la tabla 6.7.1 del Proyecto 1 ───
  {
    desde: "en_mora",
    evento: "pago",
    hacia: "cancelado",
    guarda: liquidaElCredito,
    exigencia: "se requiere saldo de capital en cero y sin cuotas vencidas pendientes",
  },
  { desde: "en_mora", evento: "reestructuracion", hacia: "reestructurado" },
  {
    desde: "en_mora",
    evento: "declaracion_incobrable",
    hacia: "incobrable",
    guarda: (c) => c.diasAtraso > 120,
    exigencia: "se requieren más de 120 días de atraso",
  },

  {
    desde: "reestructurado",
    evento: "pago",
    hacia: "cancelado",
    guarda: liquidaElCredito,
    exigencia: "se requiere saldo de capital en cero y sin cuotas vencidas pendientes",
  },
  {
    desde: "reestructurado",
    evento: "atraso",
    hacia: "en_mora",
    guarda: (c) => c.diasAtraso > 0,
    exigencia: "se requiere al menos un día de atraso",
  },
];

/** Estados finales: ninguna transición sale de ellos. */
export const ESTADOS_TERMINALES: readonly EstadoCredito[] = ["cancelado", "incobrable", "rechazado", "anulado"];

export function esTerminal(estado: EstadoCredito): boolean {
  return ESTADOS_TERMINALES.includes(estado);
}

/**
 * Aplica un evento a un estado. Devuelve el estado resultante o el motivo por
 * el que la transición no procede: nunca lanza para control de flujo, porque
 * "este crédito no admite pagos" es una respuesta de negocio legítima que el
 * adaptador debe poder convertir en un 422.
 */
export function aplicarEvento(
  estado: EstadoCredito,
  evento: EventoCredito,
  contexto: ContextoTransicion,
): ResultadoTransicion {
  const candidatas = TABLA_TRANSICIONES.filter((t) => t.desde === estado && t.evento === evento);

  if (candidatas.length === 0) {
    return {
      permitida: false,
      motivo: esTerminal(estado)
        ? `El crédito está en estado terminal '${estado}': no admite el evento '${evento}'.`
        : `No existe una transición '${estado}' --${evento}--> en la tabla del Sistema.`,
    };
  }

  for (const transicion of candidatas) {
    if (!transicion.guarda || transicion.guarda(contexto)) {
      return { permitida: true, estado: transicion.hacia };
    }
  }

  // El evento existe para este estado, pero ninguna guarda se cumplió: el
  // crédito permanece donde está. Un pago parcial sobre un crédito en mora es
  // el caso típico — se aplica, pero no cancela nada.
  return {
    permitida: false,
    motivo: `El evento '${evento}' no procede desde '${estado}': ${candidatas[0].exigencia ?? "no se cumple la guarda"}.`,
  };
}
