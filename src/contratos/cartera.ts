/**
 * Contrato del recurso Cartera en riesgo.
 *
 * El dominio calcula el indicador en:
 * src/dominio/cartera.ts
 *
 * Este archivo define únicamente la representación externa
 * que recibe y devuelve la API.
 */

import { z } from "zod";
import { Dinero, FechaISO } from "./comunes";

/**
 * Desglose de la cartera por tramo de mora.
 *
 * Los créditos incobrables no aparecen aquí porque el dominio
 * los excluye de la cartera activa.
 */
export const TramoCartera = z
  .object({
    // Clasificación derivada de los días de atraso.
    tramo: z.enum([
      "mora_1",
      "mora_2",
      "mora_3",
      "vencido",
    ]),

    // Cantidad de créditos dentro del tramo.
    creditos: z.int().min(0).meta({
      example: 3,
    }),

    // El saldo completo de capital en riesgo.
    saldoCapital: Dinero,
  })
  .meta({
    id: "TramoCartera",
    description: "Resumen de cartera agrupado por tramo de mora",
  });

/**
 * Parámetros de consulta del indicador.
 *
 * La fecha es obligatoria para que una auditoría sea reproducible.
 * El valor por defecto incluye los créditos reestructurados,
 * porque el dominio los considera en riesgo aunque estén al día.
 */
export const CarteraEnRiesgoQuery = z
  .object({
    fechaCorte: FechaISO,

    incluirReestructurados: z.boolean().default(true),
  })
  .meta({
    id: "CarteraEnRiesgoQuery",
    description:
      "Parámetros para calcular la cartera en riesgo a una fecha determinada",
  });

/**
 * Respuesta del indicador de cartera en riesgo.
 *
 * porcentajeEnRiesgo usa el formato decimal:
 * 0.07 representa 7 %.
 *
 * El dominio internamente calcula el porcentaje como 7,
 * por lo que una capa de aplicación debe convertirlo a 0.07
 * antes de devolver la respuesta de la API.
 */
export const CarteraEnRiesgoResponse = z
  .object({
    // Fecha exacta sobre la que se calculó el indicador.
    fechaCorte: FechaISO,

    // Total de cartera activa, excluyendo incobrables.
    carteraActiva: Dinero,

    // Saldo de capital perteneciente a créditos en riesgo.
    saldoEnRiesgo: Dinero,

    // Decimal entre 0 y 1. Ejemplo: 0.07 equivale a 7 %.
    porcentajeEnRiesgo: z.number().min(0).max(1).meta({
      example: 0.07,
    }),

    // Dato obligatorio para no ocultar las bajas contables del período.
    dadoPorIncobrableEnElPeriodo: Dinero,

    // Desglose de los créditos que forman el saldo en riesgo.
    porTramo: z.array(TramoCartera),
  })
  .meta({
    id: "CarteraEnRiesgoResponse",
    description:
      "Indicador de cartera en riesgo acompañado del monto dado por incobrable",
  });