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

/**
 * Clasificación derivada del nivel de atraso de un crédito.
 *
 * Importante:
 * estos valores representan un tramo calculado a partir de los
 * días de atraso y no constituyen estados permanentes del crédito.
 */
export type TramoMora =
  | 'AL_DIA'
  | 'MORA_1'
  | 'MORA_2'
  | 'MORA_3'
  | 'VENCIDO'
  | 'INCOBRABLE';

/**
 * Determina el tramo de mora correspondiente a una cantidad
 * determinada de días de atraso.
 *
 * La función es pura: no modifica información del crédito ni
 * depende de fechas del sistema.
 *
 * La clasificación puede avanzar cuando aumenta el atraso o
 * retroceder cuando un pago reduce los días pendientes.
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
 * Calcula el interés moratorio correspondiente a una cuota vencida.
 *
 * Fórmula aplicada:
 *
 *   interés moratorio =
 *     capital en mora × (TNA moratoria / base) × días de atraso
 *
 * El cálculo se realiza exclusivamente sobre el capital pendiente.
 * Los intereses corrientes de la cuota no forman parte de la base
 * del cálculo moratorio.
 *
 * Si no existen días de atraso, el resultado es cero.
 */
export function calcularInteresMoratorio(
  capitalEnMora: Dinero,
  diasDeAtraso: number,
  politica: PoliticaMoratoria,
): Dinero {
  if (!Number.isInteger(diasDeAtraso) || diasDeAtraso < 0) {
    throw new Error('calcularInteresMoratorio: días de atraso inválidos');
  }
  // Sin días de atraso no existe interés moratorio.
  if (diasDeAtraso === 0) {
    return Dinero.cero(); // sin atraso no hay penalización
  }

   // 1. Aplica la tasa anual al capital en mora.
  // 2. Convierte la tasa anual a una tasa diaria según la base elegida.
  // 3. Multiplica por los días de atraso.
  // 4. Redondea el resultado a centavos.
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