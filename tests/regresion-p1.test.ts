/**
 * regresion-p1.test.ts — red de seguridad del Proyecto 2.
 *
 * El Proyecto 1 se entregó sin pruebas automatizadas: sus oráculos vivían en
 * el documento de arquitectura, no en el repositorio. Estas pruebas los fijan
 * contra el núcleo del P1 TAL COMO SE ENTREGÓ (commit etiquetado
 * `entrega-p1`), antes de tocar una sola línea para la mora escalonada.
 *
 * Por eso este archivo se escribe PRIMERO: a partir de aquí, cualquier
 * regresión que introduzca la evolución del núcleo se detecta sola. El
 * enunciado del P2 (E6) exige que "la suite completa del Proyecto 1 siga
 * pasando": esta es esa suite.
 *
 * NO se toca ningún valor esperado de este archivo durante el Proyecto 2.
 * Si una prueba de aquí se pone roja, se corrige el núcleo, no la prueba.
 *
 * Única adaptación registrada (CP-01, commit de la política escalonada): el
 * cuarto argumento de `aplicarPago` pasó de ser un `number` con la tasa anual
 * a ser la política moratoria inyectada. Cambió CÓMO se le pasa la tasa al
 * núcleo, no CUÁNTO cobra: los oráculos Q7.26 y Q21.77 siguen siendo los del
 * Proyecto 1, byte por byte. Queda declarado en el informe de impacto.
 */

import { describe, expect, it } from "vitest";
import { generarPlanFrances } from "../src/dominio/amortizacion.ts";
import { aplicarPago, type CuotaMutable } from "../src/dominio/pagos.ts";
import { calcularDiasAtraso, clasificarTramo } from "../src/dominio/mora.ts";
import { calcularCartera } from "../src/dominio/cartera.ts";
import { POLITICA_PLANA_24 } from "../src/dominio/politica-mora/politica-plana.ts";
import { desdeCentavos } from "../src/util/dinero.ts";

/* Caso de referencia del Proyecto 1 (enunciado P2, sección 6.2):
   capital Q10,000.00 · tasa nominal anual 36 % (3 % mensual) · 12 cuotas. */
const CAPITAL_CENT = 1_000_000;
const TASA_ORDINARIA_ANUAL = 0.36;
const PLAZO_MESES = 12;
const FECHA_DESEMBOLSO = "2026-06-22";

/* Política moratoria PLANA del P1 (6.5): 24 % nominal anual. Su tasa es
   distinta de la tasa ordinaria del crédito; la política escalonada del
   Proyecto 2 la sustituye solo para los créditos otorgados desde el
   1 de octubre de 2026. */
const POLITICA_MORATORIA_P1 = POLITICA_PLANA_24;

describe("P1 · plan de amortización francés (caso de referencia)", () => {
  const plan = generarPlanFrances(CAPITAL_CENT, TASA_ORDINARIA_ANUAL, PLAZO_MESES, FECHA_DESEMBOLSO);

  it("genera exactamente 12 cuotas", () => {
    expect(plan).toHaveLength(12);
  });

  it("la cuota nivelada es de Q1,004.62", () => {
    for (const cuota of plan.slice(0, 11)) {
      expect(desdeCentavos(cuota.cuota)).toBe("1004.62");
    }
  });

  it("la cuota 12 se ajusta a Q1,004.63 para cuadrar el saldo", () => {
    expect(desdeCentavos(plan[11].cuota)).toBe("1004.63");
  });

  it("el saldo de la última cuota es exactamente Q0.00", () => {
    expect(plan[11].saldoFinal).toBe(0);
  });

  it("la suma de las amortizaciones devuelve el capital completo", () => {
    const amortizado = plan.reduce((suma, cuota) => suma + cuota.amortizacion, 0);
    expect(amortizado).toBe(CAPITAL_CENT);
  });

  it("la cuota 2 amortiza Q725.76 y devenga Q278.86 de interés corriente", () => {
    expect(desdeCentavos(plan[1].amortizacion)).toBe("725.76");
    expect(desdeCentavos(plan[1].interes)).toBe("278.86");
  });
});

/* La cuota 2 del plan anterior es la base de todos los oráculos de mora del
   Proyecto 2 (casos M-1 a M-5): capital en mora Q725.76, interés Q278.86. */
function cuotaDosVencida(): CuotaMutable {
  return { numero: 2, vencimiento: "2026-08-22", capitalPendiente: 72_576, interesPendiente: 27_886 };
}

describe("P1 · interés moratorio con política plana del 24 %", () => {
  it("a 15 días de atraso cobra Q7.26 (oráculo original del Proyecto 1)", () => {
    const resultado = aplicarPago([cuotaDosVencida()], 101_188, "2026-09-06", POLITICA_MORATORIA_P1);
    expect(desdeCentavos(resultado.interesMoratorio)).toBe("7.26");
  });

  it("a 45 días de atraso cobra Q21.77 (política plana, crédito anterior al 1-oct-2026)", () => {
    const resultado = aplicarPago([cuotaDosVencida()], 200_000, "2026-10-06", POLITICA_MORATORIA_P1);
    expect(desdeCentavos(resultado.interesMoratorio)).toBe("21.77");
  });

  it("una cuota al día no genera interés moratorio", () => {
    const resultado = aplicarPago([cuotaDosVencida()], 100_462, "2026-08-22", POLITICA_MORATORIA_P1);
    expect(resultado.interesMoratorio).toBe(0);
  });
});

describe("P1 · orden de prelación de pagos (gastos → moratorio → corriente → capital)", () => {
  it("un pago que cubre todo lo vencido salda la cuota y no deja excedente", () => {
    const resultado = aplicarPago([cuotaDosVencida()], 101_188, "2026-09-06", POLITICA_MORATORIA_P1);

    expect(desdeCentavos(resultado.interesMoratorio)).toBe("7.26");
    expect(desdeCentavos(resultado.interesCorriente)).toBe("278.86");
    expect(desdeCentavos(resultado.capital)).toBe("725.76");
    expect(resultado.excedente).toBe(0);
    expect(resultado.cuotasActualizadas[0].pagada).toBe(true);
  });

  it("un pago insuficiente se consume en el orden de prelación y no toca capital", () => {
    // Q7.26 de mora + Q100.00 a interés corriente: el capital queda intacto.
    const resultado = aplicarPago([cuotaDosVencida()], 10_726, "2026-09-06", POLITICA_MORATORIA_P1);

    expect(desdeCentavos(resultado.interesMoratorio)).toBe("7.26");
    expect(desdeCentavos(resultado.interesCorriente)).toBe("100.00");
    expect(resultado.capital).toBe(0);
    expect(resultado.cuotasActualizadas[0].capitalPendiente).toBe(72_576);
    expect(resultado.cuotasActualizadas[0].pagada).toBe(false);
  });

  it("el rubro de gastos del P1 siempre valía Q0.00 (hueco que cierra CP-02)", () => {
    const resultado = aplicarPago([cuotaDosVencida()], 101_188, "2026-09-06", POLITICA_MORATORIA_P1);
    expect(resultado.gastos).toBe(0);
  });

  it("el excedente se adelanta a capital de las cuotas futuras, no a su interés", () => {
    const cuotas: CuotaMutable[] = [
      cuotaDosVencida(),
      { numero: 3, vencimiento: "2026-09-22", capitalPendiente: 74_753, interesPendiente: 25_709 },
    ];
    const resultado = aplicarPago(cuotas, 151_188, "2026-09-06", POLITICA_MORATORIA_P1);

    expect(desdeCentavos(resultado.excedente)).toBe("500.00");
    expect(resultado.cuotasActualizadas[1].capitalPendiente).toBe(74_753 - 50_000);
    expect(resultado.cuotasActualizadas[1].interesPendiente).toBe(25_709);
  });
});

describe("P1 · el tramo de mora es una clasificación derivada, no un estado", () => {
  it("clasifica cada tramo por sus días de atraso", () => {
    expect(clasificarTramo(0)).toBe("ninguno");
    expect(clasificarTramo(1)).toBe("mora_1");
    expect(clasificarTramo(30)).toBe("mora_1");
    expect(clasificarTramo(31)).toBe("mora_2");
    expect(clasificarTramo(60)).toBe("mora_2");
    expect(clasificarTramo(61)).toBe("mora_3");
    expect(clasificarTramo(90)).toBe("mora_3");
    expect(clasificarTramo(91)).toBe("vencido");
  });

  it("es reversible: al ponerse al día el crédito vuelve a 'ninguno'", () => {
    expect(clasificarTramo(45)).toBe("mora_2");
    expect(clasificarTramo(0)).toBe("ninguno");
  });

  it("los días de atraso se miden contra la cuota pendiente MÁS ANTIGUA", () => {
    const pendientes = [{ vencimiento: "2026-09-22" }, { vencimiento: "2026-08-22" }];
    expect(calcularDiasAtraso(pendientes, "2026-10-06")).toBe(45);
  });

  it("un crédito sin cuotas pendientes no tiene días de atraso", () => {
    expect(calcularDiasAtraso([], "2026-10-06")).toBe(0);
  });

  it("la fecha de referencia es un parámetro, nunca el reloj del sistema (puerto Reloj)", () => {
    const pendientes = [{ vencimiento: "2026-08-22" }];
    expect(calcularDiasAtraso(pendientes, "2026-09-06")).toBe(15);
    expect(calcularDiasAtraso(pendientes, "2026-12-20")).toBe(120);
  });
});

describe("P1 · agregados de cartera", () => {
  const cartera = [
    { creditoId: "C-001", estado: "vigente", saldoCapitalCent: 10_000_000, tramo: "ninguno" as const },
    { creditoId: "C-003", estado: "en_mora", saldoCapitalCent: 2_400_000, tramo: "mora_2" as const },
    { creditoId: "C-006", estado: "reestructurado", saldoCapitalCent: 600_000, tramo: "ninguno" as const },
    { creditoId: "C-007", estado: "incobrable", saldoCapitalCent: 900_000, tramo: "vencido" as const },
  ];

  it("excluye de la cartera activa los créditos incobrables", () => {
    const agregado = calcularCartera(cartera, true);
    expect(agregado.carteraActivaCent).toBe(13_000_000);
  });

  it("solo los créditos con tramo distinto de 'ninguno' entran en el saldo en riesgo", () => {
    const agregado = calcularCartera(cartera, true);
    expect(agregado.saldoEnRiesgoCent).toBe(2_400_000);
    expect(agregado.porTramo).toEqual([{ tramo: "mora_2", creditos: 1, saldoCapitalCent: 2_400_000 }]);
  });

  it("puede excluir los reestructurados de la base de cálculo", () => {
    const agregado = calcularCartera(cartera, false);
    expect(agregado.carteraActivaCent).toBe(12_400_000);
  });
});
