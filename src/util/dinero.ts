/**
 * dinero.ts — dinero como enteros de centavos (ADR-002: "decimal.js o
 * centavos enteros" en el núcleo). El contrato sigue viajando como cadena
 * decimal de 2 decimales; esta es la representación interna del servidor.
 */

export function aCentavos(valor: string): number {
  const coincidencia = /^(-?)(\d+)\.(\d{2})$/.exec(valor);
  if (!coincidencia) throw new Error(`Monto decimal inválido: '${valor}'`);
  const [, signo, entero, decimales] = coincidencia;
  const centavos = Number(entero) * 100 + Number(decimales);
  return signo === "-" ? -centavos : centavos;
}

export function desdeCentavos(centavos: number): string {
  const redondeado = Math.round(centavos);
  const signo = redondeado < 0 ? "-" : "";
  const abs = Math.abs(redondeado);
  const entero = Math.floor(abs / 100);
  const decimales = String(abs % 100).padStart(2, "0");
  return `${signo}${entero}.${decimales}`;
}
