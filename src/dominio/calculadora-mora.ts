/**
 * calculadora-mora.ts
 *
 * Módulo encargado del cálculo de intereses moratorios y de la
 * clasificación de los créditos según sus días de atraso.
 *
 * Reglas de negocio:
 *  - Los días de atraso se reciben como parámetro.
 *  - El interés moratorio se calcula únicamente sobre el capital
 *    pendiente en mora.
 *  - No se aplica interés moratorio sobre intereses generados.
 *  - El cálculo utiliza una tasa moratoria y una base de conteo
 *    configurables.
 *  - El resultado monetario se redondea a dos decimales por cuota.
 *
 * Clasificación de mora:
 *  - 0 días: al día.
 *  - 1 a 30 días: Mora 1.
 *  - 31 a 60 días: Mora 2.
 *  - 61 a 90 días: Mora 3.
 *  - 91 a 120 días: Vencido.
 *  - Más de 120 días: Incobrable.
 *
 * Diseño:
 *  La política de cálculo se recibe como parámetro para evitar que
 * las reglas financieras queden acopladas a valores constantes.
 */
import { Dinero } from './dinero';

/**
 * Base utilizada para convertir la tasa anual moratoria
 * en una tasa diaria.
 *
 * ACTUAL_360:
 *   utiliza los días reales transcurridos sobre una base de 360 días.
 *
 * ACTUAL_365:
 *   utiliza los días reales transcurridos sobre una base de 365 días.
 *
 * 30_360:
 *   utiliza la convención financiera de 30 días por mes y
 *   360 días por año.
 */
export type BaseConteo = 'ACTUAL_360' | 'ACTUAL_365' | '30_360';

const DIVISOR_BASE: Record<BaseConteo, number> = {
  ACTUAL_360: 360,
  ACTUAL_365: 365,
  '30_360': 360,
};

/**
 * Define los parámetros que intervienen en el cálculo del interés
 * moratorio.
 *
 * La política se recibe desde fuera del cálculo para permitir
 * modificar tasas o convenciones sin modificar la fórmula.
 *
 * tnaMoratoria:
 *   tasa nominal anual utilizada para calcular la mora.
 *
 * base:
 *   convención empleada para convertir la tasa anual a una tasa diaria.
 */
export interface PoliticaMoratoria {
  readonly tnaMoratoria: number | string; // ej. 0.24 = 24 % TNA moratoria
  readonly base: BaseConteo;
}

/** Política del caso de referencia (6.5): 24 % TNA moratoria, base Actual/360. */
export const POLITICA_REFERENCIA: PoliticaMoratoria = {
  tnaMoratoria: 0.24,
  base: 'ACTUAL_360',
};

/** Tramo de mora: clasificación DERIVADA, no es un estado (6.7). */
export type TramoMora =
  | 'AL_DIA'
  | 'MORA_1'
  | 'MORA_2'
  | 'MORA_3'
  | 'VENCIDO'
  | 'INCOBRABLE';

/**
 * Clasifica según días de atraso. Pura y bidireccional: la misma función
 * sirve cuando el tramo sube (pasa el tiempo sin pago) y cuando baja
 * (un pago reduce el atraso).
 */
export function clasificarTramo(diasDeAtraso: number): TramoMora {
  if (!Number.isInteger(diasDeAtraso) || diasDeAtraso < 0) {
    throw new Error('clasificarTramo: los días de atraso deben ser un entero >= 0');
  }
  if (diasDeAtraso === 0) return 'AL_DIA';
  if (diasDeAtraso <= 30) return 'MORA_1';
  if (diasDeAtraso <= 60) return 'MORA_2';
  if (diasDeAtraso <= 90) return 'MORA_3';
  if (diasDeAtraso <= 120) return 'VENCIDO';
  return 'INCOBRABLE';
}

/**
 * Interés moratorio de UNA cuota vencida (6.5).
 * Solo sobre el capital en mora: jamás incluye el interés de la cuota
 * (anatocismo prohibido).
 */
export function calcularInteresMoratorio(
  capitalEnMora: Dinero,
  diasDeAtraso: number,
  politica: PoliticaMoratoria,
): Dinero {
  if (!Number.isInteger(diasDeAtraso) || diasDeAtraso < 0) {
    throw new Error('calcularInteresMoratorio: días de atraso inválidos');
  }
  if (diasDeAtraso === 0) {
    return Dinero.cero(); // sin atraso no hay penalización
  }
  return capitalEnMora
    .multiplicarPor(politica.tnaMoratoria)
    .dividirEntre(DIVISOR_BASE[politica.base])
    .multiplicarPor(diasDeAtraso)
    .redondeado(); // redondeo por cuota (6.2)
}

/** Una cuota vencida, con su propio capital y sus propios días de atraso. */
export interface CuotaVencida {
  readonly capitalEnMora: Dinero;
  readonly diasDeAtraso: number;
}

/**
 * Moratorio con varias cuotas vencidas (6.5): cada cuota genera su propio
 * cálculo sobre su propio capital y sus propios días; NUNCA uno sobre la suma.
 */
export function calcularMoratorioTotal(
  cuotasVencidas: readonly CuotaVencida[],
  politica: PoliticaMoratoria,
): Dinero {
  return cuotasVencidas.reduce(
    (acc, c) =>
      acc.sumar(calcularInteresMoratorio(c.capitalEnMora, c.diasDeAtraso, politica)),
    Dinero.cero(),
  );
}