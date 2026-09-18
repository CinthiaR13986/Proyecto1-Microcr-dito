/**
 * cartera-por-tramo.ts — CP-04.3, desglose de la cartera en riesgo por tramo.
 *
 * El Proyecto 1 reportaba la cartera en riesgo como un solo porcentaje
 * agregado (6.8.1). El tablero gerencial necesita el desglose, y el enunciado
 * es explícito en que debe salir del núcleo: si la interfaz lo recalcula, dos
 * pantallas acabarán mostrando dos números distintos para lo mismo.
 *
 * CARTERA EN MORA Y CARTERA EN RIESGO SON INDICADORES DISTINTOS
 *
 *   Cartera en mora   = todo crédito con al menos UN día de atraso.
 *   Cartera en riesgo = solo los de MÁS DE 30 días, más los reestructurados.
 *
 * Ambos son correctos y miden cosas distintas. Un tablero que muestre uno sin
 * decir cuál es, o que los rotule igual, lleva al comité a decidir sobre el
 * número equivocado; la evaluación de usabilidad lo clasifica como hallazgo de
 * severidad 4. Por eso este módulo devuelve SIEMPRE los dos, cada uno con su
 * nombre, y nunca un "porcentaje de cartera" a secas.
 */

import { clasificarTramoDeAtraso, type TramoAtraso } from "./clasificacion-tramo.ts";
import { estaEnCarteraActiva, type EstadoCredito } from "./estados.ts";

export interface CreditoEnCartera {
  readonly creditoId: string;
  readonly estado: EstadoCredito;
  readonly saldoCapitalCent: number;
  /** Calculado contra la fecha de corte, que es un parámetro (puerto Reloj). */
  readonly diasAtraso: number;
}

/** Filas del desglose de riesgo. `reestructurado` no es un tramo: es una condición del crédito. */
export type CategoriaRiesgo = Exclude<TramoAtraso, "ninguno" | "incobrable"> | "reestructurado";

const CATEGORIAS: readonly CategoriaRiesgo[] = ["mora_1", "mora_2", "mora_3", "vencido", "reestructurado"];

/** Tramos que entran en la cartera en RIESGO: más de 30 días de atraso. */
const TRAMOS_EN_RIESGO: readonly TramoAtraso[] = ["mora_2", "mora_3", "vencido"];

export interface LineaCartera {
  readonly categoria: CategoriaRiesgo;
  readonly creditos: number;
  readonly saldoCapitalCent: number;
  readonly porcentajeCarteraActiva: number;
}

export interface DesgloseCartera {
  readonly carteraActivaCent: number;
  readonly carteraEnMoraCent: number;
  readonly porcentajeCarteraEnMora: number;
  readonly carteraEnRiesgoCent: number;
  readonly creditosEnRiesgo: number;
  readonly porcentajeCarteraEnRiesgo: number;
  readonly porCategoria: readonly LineaCartera[];
  readonly dadoPorIncobrableCent: number;
}

function porcentaje(parteCent: number, totalCent: number): number {
  if (totalCent === 0) return 0;
  return Math.round((parteCent / totalCent) * 10_000) / 100;
}

/**
 * Categoría de riesgo de un crédito, o `null` si no está en riesgo.
 * Ser reestructurado pesa más que el tramo: un crédito reestructurado está en
 * riesgo aunque esté perfectamente al día, porque ya falló una vez.
 */
function categoriaDeRiesgo(credito: CreditoEnCartera): CategoriaRiesgo | null {
  if (credito.estado === "reestructurado") return "reestructurado";
  const tramo = clasificarTramoDeAtraso(credito.diasAtraso);
  return TRAMOS_EN_RIESGO.includes(tramo) ? (tramo as CategoriaRiesgo) : null;
}

export function calcularDesgloseCartera(creditos: readonly CreditoEnCartera[]): DesgloseCartera {
  const activos = creditos.filter((c) => estaEnCarteraActiva(c.estado));
  const carteraActivaCent = activos.reduce((suma, c) => suma + c.saldoCapitalCent, 0);

  const enMora = activos.filter((c) => c.diasAtraso >= 1);
  const carteraEnMoraCent = enMora.reduce((suma, c) => suma + c.saldoCapitalCent, 0);

  const enRiesgo = activos.filter((c) => categoriaDeRiesgo(c) !== null);
  const carteraEnRiesgoCent = enRiesgo.reduce((suma, c) => suma + c.saldoCapitalCent, 0);

  const porCategoria = CATEGORIAS.map((categoria) => {
    // Mora 1 aparece siempre en 0.00: el tramo existe, pero un atraso de menos
    // de 31 días no entra en la cartera en riesgo. La fila se muestra para que
    // el gerente vea que la categoría fue considerada y no asuma que falta.
    const delGrupo = enRiesgo.filter((c) => categoriaDeRiesgo(c) === categoria);
    const saldoCapitalCent = delGrupo.reduce((suma, c) => suma + c.saldoCapitalCent, 0);
    return {
      categoria,
      creditos: delGrupo.length,
      saldoCapitalCent,
      porcentajeCarteraActiva: porcentaje(saldoCapitalCent, carteraActivaCent),
    };
  });

  const dadoPorIncobrableCent = creditos
    .filter((c) => c.estado === "incobrable")
    .reduce((suma, c) => suma + c.saldoCapitalCent, 0);

  return {
    carteraActivaCent,
    carteraEnMoraCent,
    porcentajeCarteraEnMora: porcentaje(carteraEnMoraCent, carteraActivaCent),
    carteraEnRiesgoCent,
    creditosEnRiesgo: enRiesgo.length,
    porcentajeCarteraEnRiesgo: porcentaje(carteraEnRiesgoCent, carteraActivaCent),
    porCategoria,
    dadoPorIncobrableCent,
  };
}
