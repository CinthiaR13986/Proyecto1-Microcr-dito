/**
 * contrato-politica.test.ts — prueba de sustitución de Liskov.
 *
 * UNA sola batería, ejecutada contra las TRES implementaciones del puerto
 * PoliticaMoratoria. Si el motor de cálculo dependiera del comportamiento de
 * una implementación concreta, alguna de las tres rompería aquí.
 *
 * La política retroactiva se incluye precisamente porque es la más distinta:
 * ignora el tramo del día y cobra todo al precio del tramo alcanzado. Que el
 * motor la ejecute sin romper ningún invariante es la evidencia de que el
 * puerto está bien definido.
 */

import { describe, expect, it } from "vitest";
import { calcularInteresMoratorio } from "../src/dominio/calculadora-mora.ts";
import { ESCALA_TRAMOS } from "../src/dominio/clasificacion-tramo.ts";
import { POLITICA_ESCALONADA, TASAS_ESCALONADAS_2026 } from "../src/dominio/politica-mora/politica-escalonada.ts";
import { POLITICA_PLANA_24 } from "../src/dominio/politica-mora/politica-plana.ts";
import { crearPoliticaRetroactiva, VERSION_RETROACTIVA } from "../src/dominio/politica-mora/politica-retroactiva.ts";
import type { PoliticaMoratoria } from "../src/dominio/politica-mora/politica-mora.ts";

const CAPITAL_EN_MORA = 72_576;

const POLITICAS: readonly [string, PoliticaMoratoria][] = [
  ["plana 24 %", POLITICA_PLANA_24],
  ["escalonada por tramo", POLITICA_ESCALONADA],
  ["retroactiva (no adoptada)", crearPoliticaRetroactiva(VERSION_RETROACTIVA, TASAS_ESCALONADAS_2026)],
];

describe.each(POLITICAS)("contrato del puerto PoliticaMoratoria · %s", (_nombre, politica) => {
  it("declara su versión institucional completa", () => {
    expect(politica.version.id).toBeTruthy();
    expect(politica.version.vigenteDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(politica.version.autor).toBeTruthy();
    expect(politica.version.motivo).toBeTruthy();
  });

  it("responde a TODOS los tramos de la escala sin lanzar 'no soportado'", () => {
    for (const rango of ESCALA_TRAMOS) {
      const tasa = politica.tasaDiaria(rango.tramo, rango.diaInicial);
      expect(Number.isFinite(tasa)).toBe(true);
      expect(tasa).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(politica.tasaDiaria("ninguno", 0))).toBe(true);
  });

  it("no devenga nada sobre una cuota al día", () => {
    expect(calcularInteresMoratorio(CAPITAL_EN_MORA, 0, politica).interesMoratorioCent).toBe(0);
    expect(calcularInteresMoratorio(CAPITAL_EN_MORA, -1, politica).interesMoratorioCent).toBe(0);
  });

  it("es monótona creciente respecto de los días de atraso", () => {
    let anterior = 0;
    for (let dias = 0; dias <= 150; dias++) {
      const actual = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, politica).interesMoratorioCent;
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it("respeta el tope: el moratorio nunca excede el capital en mora", () => {
    for (let dias = 0; dias <= 400; dias++) {
      expect(calcularInteresMoratorio(CAPITAL_EN_MORA, dias, politica).interesMoratorioCent).toBeLessThanOrEqual(
        CAPITAL_EN_MORA,
      );
    }
  });

  it("devuelve centavos enteros: el redondeo ocurre una sola vez y al final", () => {
    for (const dias of [1, 15, 30, 45, 61, 90, 100, 120]) {
      expect(Number.isInteger(calcularInteresMoratorio(CAPITAL_EN_MORA, dias, politica).interesMoratorioCent)).toBe(true);
    }
  });

  it("los días del desglose suman siempre el atraso total", () => {
    for (const dias of [1, 45, 100, 120]) {
      const desglose = calcularInteresMoratorio(CAPITAL_EN_MORA, dias, politica);
      expect(desglose.tramos.reduce((suma, t) => suma + t.dias, 0)).toBe(dias);
    }
  });

  it("deja de acumular a partir de la incobrabilidad (día 121)", () => {
    const a120 = calcularInteresMoratorio(CAPITAL_EN_MORA, 120, politica).interesMoratorioCent;
    const a200 = calcularInteresMoratorio(CAPITAL_EN_MORA, 200, politica).interesMoratorioCent;
    expect(a200).toBe(a120);
  });

  it("es una función pura: mismos datos, mismo resultado", () => {
    const primera = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, politica);
    const segunda = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, politica);
    expect(segunda).toEqual(primera);
  });

  it("es proporcional al capital en mora", () => {
    const sencillo = calcularInteresMoratorio(CAPITAL_EN_MORA, 45, politica).interesMoratorioCent;
    const doble = calcularInteresMoratorio(CAPITAL_EN_MORA * 2, 45, politica).interesMoratorioCent;
    expect(doble).toBeGreaterThanOrEqual(sencillo * 2 - 1);
    expect(doble).toBeLessThanOrEqual(sencillo * 2 + 1);
  });
});
