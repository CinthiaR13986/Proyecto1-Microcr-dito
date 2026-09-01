/**
 * cartera.ts — agregados de cartera en riesgo (sección 2.6). Reutilizado
 * tanto por `GET /cartera-riesgo` como por los cierres diario y mensual: es
 * el mismo cálculo, solo cambia si se persiste o no.
 */

import type { Tramo } from "./mora.ts";

export interface CreditoConTramo {
  creditoId: string;
  estado: string;
  saldoCapitalCent: number;
  tramo: Tramo;
}

export interface AgregadoCartera {
  carteraActivaCent: number;
  saldoEnRiesgoCent: number;
  porTramo: { tramo: Exclude<Tramo, "ninguno">; creditos: number; saldoCapitalCent: number }[];
}

const ESTADOS_ACTIVOS = new Set(["vigente", "en_mora", "reestructurado"]);

export function calcularCartera(creditos: CreditoConTramo[], incluirReestructurados: boolean): AgregadoCartera {
  const activos = creditos.filter((c) => {
    if (!ESTADOS_ACTIVOS.has(c.estado)) return false;
    if (c.estado === "reestructurado" && !incluirReestructurados) return false;
    return true;
  });

  const carteraActivaCent = activos.reduce((suma, c) => suma + c.saldoCapitalCent, 0);
  const enRiesgo = activos.filter((c) => c.tramo !== "ninguno");
  const saldoEnRiesgoCent = enRiesgo.reduce((suma, c) => suma + c.saldoCapitalCent, 0);

  const porTramoMapa = new Map<string, { creditos: number; saldoCapitalCent: number }>();
  for (const c of enRiesgo) {
    const actual = porTramoMapa.get(c.tramo) ?? { creditos: 0, saldoCapitalCent: 0 };
    actual.creditos += 1;
    actual.saldoCapitalCent += c.saldoCapitalCent;
    porTramoMapa.set(c.tramo, actual);
  }
  const porTramo = [...porTramoMapa.entries()].map(([tramo, v]) => ({
    tramo: tramo as Exclude<Tramo, "ninguno">,
    ...v,
  }));

  return { carteraActivaCent, saldoEnRiesgoCent, porTramo };
}
