/**
 * politica-mora.test.ts — oráculos obligatorios de la política escalonada
 * (casos M-1 a M-4 del §7.4), coexistencia de políticas (CP-03, §7.6) e
 * invariantes del §7.9.
 *
 * Todos los casos usan la cuota 2 del caso de referencia del Proyecto 1:
 * capital en mora Q725.76. Esa cifra NO se copia del enunciado: sale del
 * núcleo, del plan de amortización que fija `regresion-p1.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { generarPlanFrances } from "../src/dominio/amortizacion.ts";
import { calcularInteresMoratorio } from "../src/dominio/calculadora-mora.ts";
import { clasificarTramoDeAtraso, diasEnTramo, tramosRecorridos } from "../src/dominio/clasificacion-tramo.ts";
import { resolverPoliticaMoratoria } from "../src/dominio/politica-mora/catalogo-politicas.ts";
import { POLITICA_ESCALONADA, TASAS_ESCALONADAS_2026 } from "../src/dominio/politica-mora/politica-escalonada.ts";
import { crearPoliticaPlana, POLITICA_PLANA_24, VERSION_PLANA_2024 } from "../src/dominio/politica-mora/politica-plana.ts";
import { crearPoliticaRetroactiva, VERSION_RETROACTIVA } from "../src/dominio/politica-mora/politica-retroactiva.ts";
import { desdeCentavos } from "../src/util/dinero.ts";

/** El capital en mora sale del núcleo: es la amortización de la cuota 2. */
const CAPITAL_EN_MORA = generarPlanFrances(1_000_000, 0.36, 12, "2026-06-22")[1].amortizacion;

const POLITICA_RETROACTIVA = crearPoliticaRetroactiva(VERSION_RETROACTIVA, TASAS_ESCALONADAS_2026);

function moraEscalonada(dias: number): string {
  return desdeCentavos(calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_ESCALONADA).interesMoratorioCent);
}

describe("el capital en mora de los oráculos sale del núcleo, no del enunciado", () => {
  it("la cuota 2 del caso de referencia amortiza Q725.76", () => {
    expect(desdeCentavos(CAPITAL_EN_MORA)).toBe("725.76");
  });
});

describe("§7.3 · tramos recorridos, no tramo actual", () => {
  it("una cuota con 45 días de atraso no pasó 45 días en Mora 2", () => {
    expect(tramosRecorridos(45)).toEqual([
      { tramo: "mora_1", dias: 30 },
      { tramo: "mora_2", dias: 15 },
    ]);
  });

  it("aplica la fórmula dias_en_tramo(d, ini, fin) = max(0, min(d, fin) − ini + 1)", () => {
    expect(diasEnTramo(45, { tramo: "mora_1", diaInicial: 1, diaFinal: 30 })).toBe(30);
    expect(diasEnTramo(45, { tramo: "mora_2", diaInicial: 31, diaFinal: 60 })).toBe(15);
    expect(diasEnTramo(20, { tramo: "mora_2", diaInicial: 31, diaFinal: 60 })).toBe(0);
  });

  it("los días recorridos suman siempre el total de días de atraso", () => {
    for (const dias of [1, 30, 31, 45, 60, 90, 100, 120]) {
      const total = tramosRecorridos(dias).reduce((suma, t) => suma + t.dias, 0);
      expect(total).toBe(dias);
    }
  });
});

describe("§7.4 · casos de referencia obligatorios (política escalonada)", () => {
  it("M-1 · 15 días de atraso (solo Mora 1) = Q5.44", () => {
    expect(moraEscalonada(15)).toBe("5.44");
  });

  it("M-2 · 45 días de atraso (Mora 1 completo + Mora 2 parcial) = Q18.14", () => {
    expect(moraEscalonada(45)).toBe("18.14");
  });

  it("M-3 · 100 días de atraso (los cuatro tramos) = Q50.80", () => {
    expect(moraEscalonada(100)).toBe("50.80");
  });

  it("M-4 · 120 días de atraso (frontera con incobrable) = Q65.32", () => {
    expect(moraEscalonada(120)).toBe("65.32");
  });

  it("M-3 desglosa los cuatro tramos con su tasa y sus días", () => {
    const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, 100, POLITICA_ESCALONADA);
    expect(desglose.tramos.map((t) => [t.tramo, t.dias])).toEqual([
      ["mora_1", 30],
      ["mora_2", 30],
      ["mora_3", 30],
      ["vencido", 10],
    ]);
    expect(desglose.tramos.map((t) => t.tasaDiaria.toFixed(9))).toEqual([
      "0.000500000",
      "0.000666667",
      "0.000833333",
      "0.001000000",
    ]);
  });
});

describe("§7.3 · el redondeo ocurre UNA sola vez, al cerrar la cuota", () => {
  it("redondear tramo por tramo daría Q18.15; el motor devuelve Q18.14", () => {
    const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, POLITICA_ESCALONADA);

    const redondeandoPorTramo = desglose.tramos.reduce((suma, t) => suma + Math.round(t.importeCent), 0);
    expect(desdeCentavos(redondeandoPorTramo)).toBe("18.15"); // ✗ la trampa
    expect(desdeCentavos(desglose.interesMoratorioCent)).toBe("18.14"); // ✓ lo correcto
  });

  it("los importes por tramo se exponen SIN redondear, para poder auditarlos", () => {
    const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, POLITICA_ESCALONADA);
    expect(desglose.tramos[0].importeCent).toBeCloseTo(1088.64, 6);
    expect(desglose.tramos[1].importeCent).toBeCloseTo(725.76, 6);
  });
});

describe("§7.4 · a partir del día 121 el crédito es incobrable y deja de devengar", () => {
  it("el moratorio del día 121 no supera al del día 120", () => {
    expect(calcularInteresMoratorio(CAPITAL_EN_MORA, 121, POLITICA_ESCALONADA).interesMoratorioCent).toBeLessThanOrEqual(
      calcularInteresMoratorio(CAPITAL_EN_MORA, 120, POLITICA_ESCALONADA).interesMoratorioCent,
    );
  });

  it("el moratorio se congela: 200 días cobran lo mismo que 120", () => {
    expect(moraEscalonada(200)).toBe(moraEscalonada(120));
  });

  it("el tramo incobrable no devenga tasa alguna", () => {
    expect(clasificarTramoDeAtraso(121)).toBe("incobrable");
    expect(POLITICA_ESCALONADA.tasaDiaria("incobrable", 121)).toBe(0);
  });
});

describe("§7.6 · CP-03 · coexistencia de políticas en el mismo sistema", () => {
  it("CV-2026-0100 (otorgado el 15-ago-2026) usa la política plana: Q21.77 a 45 días", () => {
    const politica = resolverPoliticaMoratoria("2026-08-15");
    expect(politica.version.id).toBe("POL-2024-01");
    expect(desdeCentavos(calcularInteresMoratorio(CAPITAL_EN_MORA, 45, politica).interesMoratorioCent)).toBe("21.77");
  });

  it("CV-2026-0410 (otorgado el 10-oct-2026) usa la escalonada: Q18.14 a 45 días", () => {
    const politica = resolverPoliticaMoratoria("2026-10-10");
    expect(politica.version.id).toBe("POL-2026-10");
    expect(desdeCentavos(calcularInteresMoratorio(CAPITAL_EN_MORA, 45, politica).interesMoratorioCent)).toBe("18.14");
  });

  it("la escalonada resulta MÁS BARATA para el atraso moderado (efecto buscado por el comité)", () => {
    const plana = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, POLITICA_PLANA_24).interesMoratorioCent;
    const escalonada = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, POLITICA_ESCALONADA).interesMoratorioCent;
    expect(escalonada).toBeLessThan(plana);
  });

  it("el 30 de septiembre de 2026 todavía rige la plana; el 1 de octubre, la escalonada", () => {
    expect(resolverPoliticaMoratoria("2026-09-30").version.id).toBe("POL-2024-01");
    expect(resolverPoliticaMoratoria("2026-10-01").version.id).toBe("POL-2026-10");
  });

  it("cada política declara versión, vigencia, autor y motivo auditables", () => {
    for (const politica of [POLITICA_PLANA_24, POLITICA_ESCALONADA]) {
      expect(politica.version.id).toMatch(/^POL-/);
      expect(politica.version.vigenteDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(politica.version.autor.length).toBeGreaterThan(0);
      expect(politica.version.motivo.length).toBeGreaterThan(0);
    }
  });

  it("un crédito anterior a cualquier política vigente es un error explícito, no un cálculo silencioso", () => {
    expect(() => resolverPoliticaMoratoria("2023-06-01")).toThrow(/No hay política moratoria vigente/);
  });
});

describe("§7.9 · invariantes de la política de mora", () => {
  it("el moratorio es monótono creciente respecto de los días de atraso", () => {
    let anterior = 0;
    for (let dias = 0; dias <= 150; dias++) {
      const actual = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_ESCALONADA).interesMoratorioCent;
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it("el cálculo por tramos recorridos nunca supera al de la política retroactiva", () => {
    for (let dias = 1; dias <= 120; dias++) {
      const escalonada = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_ESCALONADA).interesMoratorioCent;
      const retroactiva = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_RETROACTIVA).interesMoratorioCent;
      expect(escalonada).toBeLessThanOrEqual(retroactiva);
    }
  });

  it("la política retroactiva (NO adoptada) cobraría Q72.58 a los 100 días", () => {
    expect(desdeCentavos(calcularInteresMoratorio(CAPITAL_EN_MORA, 100, POLITICA_RETROACTIVA).interesMoratorioCent)).toBe(
      "72.58",
    );
  });

  it("el moratorio acumulado de una cuota nunca excede su propio capital en mora", () => {
    for (let dias = 0; dias <= 400; dias++) {
      const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_ESCALONADA);
      expect(desglose.interesMoratorioCent).toBeLessThanOrEqual(CAPITAL_EN_MORA);
    }
  });

  it("el tope recorta de verdad cuando una política lo haría estallar", () => {
    const politicaAbusiva = crearPoliticaPlana(VERSION_PLANA_2024, 36); // 3600 % anual
    const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, 120, politicaAbusiva);
    expect(desglose.topeAplicado).toBe(true);
    expect(desglose.interesMoratorioCent).toBe(CAPITAL_EN_MORA);
  });

  it("para 1 ≤ d ≤ 30 la escalonada equivale exactamente a una plana del 18 %", () => {
    const plana18 = crearPoliticaPlana(VERSION_PLANA_2024, 0.18);
    for (let dias = 1; dias <= 30; dias++) {
      expect(calcularInteresMoratorio(CAPITAL_EN_MORA, dias, POLITICA_ESCALONADA).interesMoratorioCent).toBe(
        calcularInteresMoratorio(CAPITAL_EN_MORA, dias, plana18).interesMoratorioCent,
      );
    }
  });

  it("una cuota al día no devenga moratorio bajo ninguna política", () => {
    for (const politica of [POLITICA_PLANA_24, POLITICA_ESCALONADA, POLITICA_RETROACTIVA]) {
      expect(calcularInteresMoratorio(CAPITAL_EN_MORA, 0, politica).interesMoratorioCent).toBe(0);
      expect(calcularInteresMoratorio(CAPITAL_EN_MORA, -5, politica).interesMoratorioCent).toBe(0);
    }
  });

  it("el moratorio se calcula solo sobre capital, jamás sobre interés (anatocismo prohibido)", () => {
    const soloCapital = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, POLITICA_ESCALONADA).interesMoratorioCent;
    const capitalMasInteres = calcularInteresMoratorio(CAPITAL_EN_MORA + 27_886, 45, POLITICA_ESCALONADA).interesMoratorioCent;
    expect(soloCapital).toBeLessThan(capitalMasInteres);
    expect(desdeCentavos(soloCapital)).toBe("18.14");
  });
});
