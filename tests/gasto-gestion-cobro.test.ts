/**
 * gasto-gestion-cobro.test.ts — CP-02 y caso M-5.
 *
 * Lo que este archivo tiene que demostrar, además de los montos: que el gasto
 * es IDEMPOTENTE. El enunciado da la prueba de fuego — ejecutar el cierre del
 * día 31 dos veces. Si el total adeudado pasa de Q1,047.76 a Q1,072.76, el
 * cliente quedó cobrado dos veces por una sola visita del asesor.
 */

import { describe, expect, it } from "vitest";
import { generarPlanFrances } from "../src/dominio/amortizacion.ts";
import {
  DIAS_ATRASO_PARA_GENERAR,
  GASTO_GESTION_COBRO_CENT,
  gastoGestionCobroCorrespondiente,
  gastoGestionCobroPorDevengar,
} from "../src/dominio/gasto-gestion-cobro.ts";
import { aplicarPago, type CuotaMutable } from "../src/dominio/pagos.ts";
import { POLITICA_ESCALONADA } from "../src/dominio/politica-mora/politica-escalonada.ts";
import { desdeCentavos } from "../src/util/dinero.ts";

const CUOTA_2 = generarPlanFrances(1_000_000, 0.36, 12, "2026-06-22")[1];
const CAPITAL_EN_MORA = CUOTA_2.amortizacion; // Q725.76
const INTERES_CORRIENTE = CUOTA_2.interes; // Q278.86

describe("CP-02 · cuándo se genera el gasto de gestión de cobro", () => {
  it("son Q25.00 fijos por cuota vencida", () => {
    expect(desdeCentavos(GASTO_GESTION_COBRO_CENT)).toBe("25.00");
  });

  it("se genera al entrar a Mora 2, es decir a los 31 días", () => {
    expect(DIAS_ATRASO_PARA_GENERAR).toBe(31);
  });

  it("NO se cobra en Mora 1", () => {
    for (const dias of [0, 1, 15, 29, 30]) {
      expect(gastoGestionCobroCorrespondiente(dias)).toBe(0);
    }
  });

  it("se cobra desde el día 31", () => {
    expect(gastoGestionCobroCorrespondiente(31)).toBe(GASTO_GESTION_COBRO_CENT);
  });

  it("pasar de Mora 2 a Mora 3 o a Vencido NO genera un gasto nuevo", () => {
    for (const dias of [31, 45, 61, 75, 91, 100, 120, 200]) {
      expect(gastoGestionCobroCorrespondiente(dias)).toBe(GASTO_GESTION_COBRO_CENT);
    }
  });
});

describe("CP-02 · idempotencia: una visita, un cobro", () => {
  it("el primer cierre que alcanza el día 31 devenga el gasto", () => {
    expect(gastoGestionCobroPorDevengar({ diasAtraso: 31, gastoGeneradoCent: 0 })).toBe(GASTO_GESTION_COBRO_CENT);
  });

  it("reejecutar el cierre del mismo día NO vuelve a devengarlo", () => {
    expect(gastoGestionCobroPorDevengar({ diasAtraso: 31, gastoGeneradoCent: GASTO_GESTION_COBRO_CENT })).toBe(0);
  });

  it("ejecutar cierres todos los días hasta el 120 deja exactamente UN gasto", () => {
    let acumulado = 0;
    for (let dias = 1; dias <= 120; dias++) {
      acumulado += gastoGestionCobroPorDevengar({ diasAtraso: dias, gastoGeneradoCent: acumulado });
    }
    expect(acumulado).toBe(GASTO_GESTION_COBRO_CENT);
    expect(desdeCentavos(acumulado)).toBe("25.00");
  });
});

/** Cuota 2 vencida el 2026-08-22, con el gasto de gestión ya generado. */
function cuotaConGasto(gastosPendientes: number): CuotaMutable {
  return {
    numero: 2,
    vencimiento: "2026-08-22",
    capitalPendiente: CAPITAL_EN_MORA,
    interesPendiente: INTERES_CORRIENTE,
    gastosPendientes,
  };
}

describe("§7.5 · M-5 · total adeudado de la cuota 2 con 45 días de atraso", () => {
  const TOTAL_ADEUDADO = 104_776; // Q1,047.76

  it("suma Q25.00 + Q18.14 + Q278.86 + Q725.76 = Q1,047.76", () => {
    const resultado = aplicarPago([cuotaConGasto(GASTO_GESTION_COBRO_CENT)], TOTAL_ADEUDADO, "2026-10-06", POLITICA_ESCALONADA);

    expect(desdeCentavos(resultado.gastos)).toBe("25.00");
    expect(desdeCentavos(resultado.interesMoratorio)).toBe("18.14");
    expect(desdeCentavos(resultado.interesCorriente)).toBe("278.86");
    expect(desdeCentavos(resultado.capital)).toBe("725.76");
    expect(resultado.excedente).toBe(0);
    expect(resultado.cuotasActualizadas[0].pagada).toBe(true);
  });

  it("con 15 días de atraso, sin gasto y en Mora 1, son Q1,010.06", () => {
    const totalA15Dias = 101_006;
    const resultado = aplicarPago([cuotaConGasto(0)], totalA15Dias, "2026-09-06", POLITICA_ESCALONADA);

    expect(resultado.gastos).toBe(0);
    expect(desdeCentavos(resultado.interesMoratorio)).toBe("5.44");
    expect(desdeCentavos(resultado.interesCorriente)).toBe("278.86");
    expect(desdeCentavos(resultado.capital)).toBe("725.76");
    expect(resultado.excedente).toBe(0);
  });

  it("reejecutar el cierre del día 31 NO lleva el total adeudado a Q1,072.76", () => {
    // Dos cierres seguidos sobre la misma cuota: el segundo no devenga nada.
    let gastoAcumulado = gastoGestionCobroPorDevengar({ diasAtraso: 45, gastoGeneradoCent: 0 });
    gastoAcumulado += gastoGestionCobroPorDevengar({ diasAtraso: 45, gastoGeneradoCent: gastoAcumulado });

    const resultado = aplicarPago([cuotaConGasto(gastoAcumulado)], 200_000, "2026-10-06", POLITICA_ESCALONADA);
    const totalCobrado = resultado.gastos + resultado.interesMoratorio + resultado.interesCorriente + resultado.capital;

    expect(desdeCentavos(totalCobrado)).toBe("1047.76");
    expect(desdeCentavos(totalCobrado)).not.toBe("1072.76");
  });
});

describe("§7.5 · el gasto es el PRIMER eslabón de la prelación", () => {
  it("un pago de Q25.00 exactos se va íntegro a gastos, antes que a la mora", () => {
    const resultado = aplicarPago([cuotaConGasto(GASTO_GESTION_COBRO_CENT)], 2_500, "2026-10-06", POLITICA_ESCALONADA);

    expect(desdeCentavos(resultado.gastos)).toBe("25.00");
    expect(resultado.interesMoratorio).toBe(0);
    expect(resultado.interesCorriente).toBe(0);
    expect(resultado.capital).toBe(0);
  });

  it("un pago parcial de Q10.00 no alcanza a cubrir el gasto y no toca la mora", () => {
    const resultado = aplicarPago([cuotaConGasto(GASTO_GESTION_COBRO_CENT)], 1_000, "2026-10-06", POLITICA_ESCALONADA);

    expect(desdeCentavos(resultado.gastos)).toBe("10.00");
    expect(resultado.interesMoratorio).toBe(0);
    expect(desdeCentavos(resultado.cuotasActualizadas[0].gastosPendientes)).toBe("15.00");
    expect(resultado.cuotasActualizadas[0].pagada).toBe(false);
  });

  it("una cuota con gasto pendiente no se marca pagada aunque capital e interés estén en cero", () => {
    const soloGasto: CuotaMutable = {
      numero: 2,
      vencimiento: "2026-08-22",
      capitalPendiente: 0,
      interesPendiente: 0,
      gastosPendientes: GASTO_GESTION_COBRO_CENT,
    };
    const resultado = aplicarPago([soloGasto], 0, "2026-10-06", POLITICA_ESCALONADA);
    expect(resultado.cuotasActualizadas[0].pagada).toBe(false);
  });
});
