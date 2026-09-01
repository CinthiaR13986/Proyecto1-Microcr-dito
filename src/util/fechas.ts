/**
 * fechas.ts — aritmética de fechas en UTC puro (evita que el huso horario
 * del host mueva un día completo) más el instante actual expresado en
 * América/Guatemala (UTC-6, sin horario de verano) para timestamps de
 * auditoría (`registradoEn`, `creadoEn`, `recibidoEn`, `generadoEn`).
 *
 * Estos timestamps de auditoría NO son fechas de negocio: las fechas de
 * negocio (`fechaPago`, `fechaCorte`, `fechaDesembolso`) siempre las envía
 * el cliente (ver comunes.ts).
 */

const OFFSET_GUATEMALA_MS = 6 * 60 * 60 * 1000;

function aPartes(fechaISO: string): [number, number, number] {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return [a, m, d];
}

function aEpocaDias(fechaISO: string): number {
  const [a, m, d] = aPartes(fechaISO);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/** Días transcurridos de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return aEpocaDias(hasta) - aEpocaDias(desde);
}

export function sumarMeses(fechaISO: string, meses: number): string {
  const [a, m, d] = aPartes(fechaISO);
  return new Date(Date.UTC(a, m - 1 + meses, d)).toISOString().slice(0, 10);
}

/** Último día calendario del mes AAAA-MM. */
export function finDeMes(mesISO: string): string {
  const [a, m] = mesISO.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Fecha calendario actual en América/Guatemala. */
export function hoyGuatemala(): string {
  return new Date(Date.now() - OFFSET_GUATEMALA_MS).toISOString().slice(0, 10);
}

/** Instante actual como RFC 3339 con offset -06:00 (América/Guatemala). */
export function instanteGuatemala(): string {
  const local = new Date(Date.now() - OFFSET_GUATEMALA_MS).toISOString();
  return `${local.slice(0, 19)}-06:00`;
}
