/**
 * estados-y-devengo.test.ts — CP-04.1 (transición en_mora → cancelado) y
 * CP-04.2 (suspensión del devengo de interés corriente a los 91 días).
 */

import { describe, expect, it } from "vitest";
import { aplicarEvento, esTerminal, type ContextoTransicion } from "../src/dominio/maquina-estados.ts";
import {
  DEVENGO_INICIAL,
  PRIMER_DIA_SIN_DEVENGO,
  devengaInteresCorriente,
  devengarAlCorte,
  regularizarDevengo,
} from "../src/dominio/devengo-interes.ts";
import { desdeCentavos } from "../src/util/dinero.ts";

const LIQUIDADO: ContextoTransicion = { saldoCapitalCent: 0, cuotasVencidasPendientes: 0, diasAtraso: 0 };
const CON_SALDO: ContextoTransicion = { saldoCapitalCent: 50_000, cuotasVencidasPendientes: 2, diasAtraso: 45 };

describe("CP-04.1 · la transición que faltaba: en_mora → cancelado", () => {
  it("un crédito en mora que liquida todo su saldo pasa a cancelado", () => {
    const resultado = aplicarEvento("en_mora", "pago", LIQUIDADO);
    expect(resultado).toEqual({ permitida: true, estado: "cancelado" });
  });

  it("la guarda exige saldo en CERO EXACTO", () => {
    const porUnCentavo: ContextoTransicion = { saldoCapitalCent: 1, cuotasVencidasPendientes: 0, diasAtraso: 45 };
    const resultado = aplicarEvento("en_mora", "pago", porUnCentavo);
    expect(resultado.permitida).toBe(false);
  });

  it("la guarda exige además que no queden cuotas vencidas pendientes", () => {
    const saldoCeroPeroConVencidas: ContextoTransicion = {
      saldoCapitalCent: 0,
      cuotasVencidasPendientes: 1,
      diasAtraso: 45,
    };
    expect(aplicarEvento("en_mora", "pago", saldoCeroPeroConVencidas).permitida).toBe(false);
  });

  it("un pago parcial sobre un crédito en mora no lo cancela", () => {
    const resultado = aplicarEvento("en_mora", "pago", CON_SALDO);
    expect(resultado.permitida).toBe(false);
    if (!resultado.permitida) expect(resultado.motivo).toMatch(/saldo de capital en cero/);
  });
});

describe("CP-04.1 · sigue siendo imposible pagar un crédito en estado solicitado", () => {
  it("rechaza el evento de pago sobre un crédito solicitado", () => {
    const resultado = aplicarEvento("solicitado", "pago", LIQUIDADO);
    expect(resultado.permitida).toBe(false);
    if (!resultado.permitida) expect(resultado.motivo).toMatch(/No existe una transición/);
  });

  it("tampoco se puede pagar un crédito aprobado pero no desembolsado", () => {
    expect(aplicarEvento("aprobado", "pago", LIQUIDADO).permitida).toBe(false);
  });

  it("los estados terminales no admiten ningún evento", () => {
    for (const estado of ["cancelado", "incobrable", "rechazado", "anulado"] as const) {
      expect(esTerminal(estado)).toBe(true);
      const resultado = aplicarEvento(estado, "pago", LIQUIDADO);
      expect(resultado.permitida).toBe(false);
      if (!resultado.permitida) expect(resultado.motivo).toMatch(/terminal/);
    }
  });
});

describe("CP-04.1 · el resto del ciclo de vida sigue en pie", () => {
  it("recorre el camino feliz de solicitado a cancelado", () => {
    expect(aplicarEvento("solicitado", "aprobacion", LIQUIDADO)).toEqual({ permitida: true, estado: "aprobado" });
    expect(aplicarEvento("aprobado", "desembolso", LIQUIDADO)).toEqual({ permitida: true, estado: "vigente" });
    expect(aplicarEvento("vigente", "pago", LIQUIDADO)).toEqual({ permitida: true, estado: "cancelado" });
  });

  it("un crédito vigente que se atrasa cae en mora, y al regularizar vuelve a vigente", () => {
    expect(aplicarEvento("vigente", "atraso", CON_SALDO)).toEqual({ permitida: true, estado: "en_mora" });
    expect(aplicarEvento("en_mora", "regularizacion", LIQUIDADO)).toEqual({ permitida: true, estado: "vigente" });
  });

  it("no se puede regularizar un crédito que sigue con días de atraso", () => {
    expect(aplicarEvento("en_mora", "regularizacion", CON_SALDO).permitida).toBe(false);
  });

  it("solo se declara incobrable con más de 120 días de atraso", () => {
    const a120: ContextoTransicion = { saldoCapitalCent: 50_000, cuotasVencidasPendientes: 4, diasAtraso: 120 };
    const a121: ContextoTransicion = { ...a120, diasAtraso: 121 };
    expect(aplicarEvento("en_mora", "declaracion_incobrable", a120).permitida).toBe(false);
    expect(aplicarEvento("en_mora", "declaracion_incobrable", a121)).toEqual({ permitida: true, estado: "incobrable" });
  });
});

describe("CP-04.2 · suspensión del devengo de interés corriente", () => {
  it("el devengo se suspende a partir del día 91", () => {
    expect(PRIMER_DIA_SIN_DEVENGO).toBe(91);
    expect(devengaInteresCorriente(90)).toBe(true);
    expect(devengaInteresCorriente(91)).toBe(false);
  });

  it("entre un corte al día 90 y otro al día 100, el ingreso NO aumenta y el suspenso SÍ", () => {
    const interesDelPeriodo = 27_886; // Q278.86

    const alDia90 = devengarAlCorte(DEVENGO_INICIAL, interesDelPeriodo, 90);
    expect(desdeCentavos(alDia90.reconocidoCent)).toBe("278.86");
    expect(alDia90.enSuspensoCent).toBe(0);

    const alDia100 = devengarAlCorte(alDia90, interesDelPeriodo, 100);
    expect(desdeCentavos(alDia100.reconocidoCent)).toBe("278.86"); // ← congelado
    expect(desdeCentavos(alDia100.enSuspensoCent)).toBe("278.86"); // ← cuenta de orden
  });

  it("lo acumulado en suspenso nunca se pierde: al regularizar se reconoce", () => {
    let devengo = devengarAlCorte(DEVENGO_INICIAL, 27_886, 100);
    devengo = devengarAlCorte(devengo, 27_886, 110);
    expect(desdeCentavos(devengo.enSuspensoCent)).toBe("557.72");
    expect(devengo.reconocidoCent).toBe(0);

    const regularizado = regularizarDevengo(devengo);
    expect(desdeCentavos(regularizado.reconocidoCent)).toBe("557.72");
    expect(regularizado.enSuspensoCent).toBe(0);
  });

  it("el total devengado se conserva: reconocido + suspenso es invariante", () => {
    let devengo = DEVENGO_INICIAL;
    let totalDevengado = 0;
    for (const [interes, dias] of [
      [30_000, 0],
      [27_886, 45],
      [25_700, 95],
      [23_400, 120],
    ] as const) {
      devengo = devengarAlCorte(devengo, interes, dias);
      totalDevengado += interes;
    }
    expect(devengo.reconocidoCent + devengo.enSuspensoCent).toBe(totalDevengado);
    expect(regularizarDevengo(devengo).reconocidoCent).toBe(totalDevengado);
  });

  it("el interés en suspenso es cuenta de orden: jamás entra como ingreso mientras dura la mora", () => {
    const devengo = devengarAlCorte(DEVENGO_INICIAL, 50_000, 120);
    expect(devengo.reconocidoCent).toBe(0);
  });
});
