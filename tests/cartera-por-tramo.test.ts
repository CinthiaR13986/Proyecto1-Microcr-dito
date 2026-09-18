/**
 * cartera-por-tramo.test.ts — CP-04.3, oráculo del tablero (§7.8).
 *
 * La cartera de siete créditos del Proyecto 1 (6.8.1): cartera activa
 * Q800,000.00, con C-007 excluido por incobrable.
 *
 * Lo que este archivo protege, más que los montos, es que CARTERA EN MORA y
 * CARTERA EN RIESGO no se confundan. Rotularlas igual en el tablero es un
 * hallazgo de severidad 4 y una penalización directa.
 */

import { describe, expect, it } from "vitest";
import { calcularDesgloseCartera, type CreditoEnCartera } from "../src/dominio/cartera-por-tramo.ts";
import { desdeCentavos } from "../src/util/dinero.ts";

const CARTERA: readonly CreditoEnCartera[] = [
  { creditoId: "C-001", estado: "vigente", saldoCapitalCent: 62_000_000, diasAtraso: 0 },
  { creditoId: "C-002", estado: "en_mora", saldoCapitalCent: 12_400_000, diasAtraso: 8 },
  { creditoId: "C-003", estado: "en_mora", saldoCapitalCent: 2_400_000, diasAtraso: 45 },
  { creditoId: "C-004", estado: "en_mora", saldoCapitalCent: 1_800_000, diasAtraso: 75 },
  { creditoId: "C-005", estado: "en_mora", saldoCapitalCent: 800_000, diasAtraso: 100 },
  { creditoId: "C-006", estado: "reestructurado", saldoCapitalCent: 600_000, diasAtraso: 0 },
  { creditoId: "C-007", estado: "incobrable", saldoCapitalCent: 900_000, diasAtraso: 200 },
];

const desglose = calcularDesgloseCartera(CARTERA);

function linea(categoria: string) {
  return desglose.porCategoria.find((l) => l.categoria === categoria)!;
}

describe("§7.8 · base de cálculo", () => {
  it("la cartera activa es de Q800,000.00, con el incobrable excluido", () => {
    expect(desdeCentavos(desglose.carteraActivaCent)).toBe("800000.00");
  });

  it("reporta por separado lo dado por incobrable en el período", () => {
    expect(desdeCentavos(desglose.dadoPorIncobrableCent)).toBe("9000.00");
  });
});

describe("§7.8 · desglose de la cartera en riesgo por tramo", () => {
  it("Mora 1 · C-002 con 8 días NO entra: 0.00 y 0.00 %", () => {
    expect(desdeCentavos(linea("mora_1").saldoCapitalCent)).toBe("0.00");
    expect(linea("mora_1").porcentajeCarteraActiva.toFixed(2)).toBe("0.00");
  });

  it("Mora 2 · C-003 con 45 días: Q24,000.00 = 3.00 %", () => {
    expect(desdeCentavos(linea("mora_2").saldoCapitalCent)).toBe("24000.00");
    expect(linea("mora_2").porcentajeCarteraActiva.toFixed(2)).toBe("3.00");
  });

  it("Mora 3 · C-004 con 75 días: Q18,000.00 = 2.25 %", () => {
    expect(desdeCentavos(linea("mora_3").saldoCapitalCent)).toBe("18000.00");
    expect(linea("mora_3").porcentajeCarteraActiva.toFixed(2)).toBe("2.25");
  });

  it("Vencido · C-005 con 100 días: Q8,000.00 = 1.00 %", () => {
    expect(desdeCentavos(linea("vencido").saldoCapitalCent)).toBe("8000.00");
    expect(linea("vencido").porcentajeCarteraActiva.toFixed(2)).toBe("1.00");
  });

  it("Reestructurado al día · C-006: Q6,000.00 = 0.75 %", () => {
    expect(desdeCentavos(linea("reestructurado").saldoCapitalCent)).toBe("6000.00");
    expect(linea("reestructurado").porcentajeCarteraActiva.toFixed(2)).toBe("0.75");
  });

  it("cartera en riesgo total: 4 créditos, Q56,000.00 = 7.00 %", () => {
    expect(desglose.creditosEnRiesgo).toBe(4);
    expect(desdeCentavos(desglose.carteraEnRiesgoCent)).toBe("56000.00");
    expect(desglose.porcentajeCarteraEnRiesgo.toFixed(2)).toBe("7.00");
  });

  it("los porcentajes por tramo suman el total, sin errores de redondeo acumulados", () => {
    const suma = desglose.porCategoria.reduce((total, l) => total + l.porcentajeCarteraActiva, 0);
    expect(suma.toFixed(2)).toBe("7.00");
    expect(suma.toFixed(2)).toBe(desglose.porcentajeCarteraEnRiesgo.toFixed(2));
  });
});

describe("§7.8 · cartera en mora y cartera en riesgo son indicadores DISTINTOS", () => {
  it("cartera en mora = todo atraso ≥ 1 día = Q174,000.00 = 21.75 %", () => {
    expect(desdeCentavos(desglose.carteraEnMoraCent)).toBe("174000.00");
    expect(desglose.porcentajeCarteraEnMora.toFixed(2)).toBe("21.75");
  });

  it("cartera en riesgo = solo los de más de 30 días, más reestructurados = 7.00 %", () => {
    expect(desglose.porcentajeCarteraEnRiesgo.toFixed(2)).toBe("7.00");
  });

  it("los dos indicadores no coinciden, y el núcleo los entrega con nombres distintos", () => {
    expect(desglose.porcentajeCarteraEnMora).not.toBe(desglose.porcentajeCarteraEnRiesgo);
    expect(desglose.carteraEnMoraCent).toBeGreaterThan(desglose.carteraEnRiesgoCent);
  });

  it("la diferencia es exactamente C-002, que está en mora pero no en riesgo", () => {
    expect(desdeCentavos(desglose.carteraEnMoraCent - desglose.carteraEnRiesgoCent)).toBe("118000.00");
  });
});

describe("P1 6.8 · dar por incobrable baja el indicador sin haber cobrado nada", () => {
  it("al declarar incobrable a C-005, la cartera en riesgo cae de 7.00 % a 6.06 %", () => {
    const conC005Incobrable = CARTERA.map((c) =>
      c.creditoId === "C-005" ? { ...c, estado: "incobrable" as const } : c,
    );
    const despues = calcularDesgloseCartera(conC005Incobrable);

    expect(desdeCentavos(despues.carteraActivaCent)).toBe("792000.00");
    expect(desdeCentavos(despues.carteraEnRiesgoCent)).toBe("48000.00");
    expect(despues.porcentajeCarteraEnRiesgo.toFixed(2)).toBe("6.06");
  });

  it("por eso el tablero debe mostrar la cartera en riesgo JUNTO CON lo dado por incobrable", () => {
    const conC005Incobrable = CARTERA.map((c) =>
      c.creditoId === "C-005" ? { ...c, estado: "incobrable" as const } : c,
    );
    const despues = calcularDesgloseCartera(conC005Incobrable);
    expect(desdeCentavos(despues.dadoPorIncobrableCent)).toBe("17000.00");
  });
});

describe("§7.8 · un crédito reestructurado está en riesgo aunque esté al día", () => {
  it("C-006 tiene cero días de atraso y aun así cuenta en la cartera en riesgo", () => {
    expect(linea("reestructurado").creditos).toBe(1);
  });

  it("pero NO cuenta en la cartera en mora, porque no tiene días de atraso", () => {
    const sinReestructurado = CARTERA.filter((c) => c.creditoId !== "C-006");
    const sinEl = calcularDesgloseCartera(sinReestructurado);
    expect(desdeCentavos(sinEl.carteraEnMoraCent)).toBe("174000.00");
  });
});
