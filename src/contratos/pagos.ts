/**
 * pagos.ts — contrato del recurso Pago.   ***VERSIÓN DE TALLER***
 *
 * Caso de uso: RegistrarPago (puerto primario del Proyecto 1).
 * Es el endpoint más delicado del Sistema: mueve dinero, se puede reintentar,
 * y su resultado depende de la prelación de la sección 6.6 del enunciado del P1.
 *
 * El archivo COMPILA y GENERA tal como está, pero el contrato está incompleto.
 * Complete los cinco TODO. Después de cada uno ejecute:
 *     npm run generar && npm run validar
 * y observe cómo cambia openapi.yaml.
 */

import { z } from "zod";
import { CreditoId, Dinero, FechaISO, InstanteISO, MontoDecimal } from "./comunes";

/* ------------------------------------------------------------------ */
/* Petición                                                            */
/* ------------------------------------------------------------------ */

// TODO 1 · Enumere los medios de pago del negocio.
// Pregunta guía: ¿por qué una enumeración cerrada y no un `string` libre?
// ¿Agregar un medio nuevo mañana rompe a los clientes que ya consumen la API?

export const MedioDePago = z
  .enum([
    "efectivo",
    "agente_bancario",
    "transferencia",
    "tarjeta",
  ])
  .meta({
    id: "MedioDePago",
    description: "Canal por el que se recibió el pago",
  });


// TODO 2 · Complete la petición: monto (Dinero), fechaPago (FechaISO),
// medio (MedioDePago) y una referencia opcional de máximo 40 caracteres.
// Pregunta guía: la fecha del pago, ¿la envía el cliente o la toma el servidor
// de su reloj? Piense en el puerto Reloj del P1 y en pruebas reproducibles.
export const RegistrarPagoRequest = z
  .object({
    monto: Dinero,
    fechaPago: FechaISO,
    medio: MedioDePago,
    referencia: z.string().max(40).optional(),
  })
  .meta({ id: "RegistrarPagoRequest" });
/* ------------------------------------------------------------------ */
/* Respuesta                                                           */
/* ------------------------------------------------------------------ */

// TODO 3 · Devuelva el desglose del pago, rubro por rubro, en el ORDEN DE
// PRELACIÓN (sección 6.6 del enunciado del Proyecto 1).
// Pregunta guía: si la respuesta solo dijera { ok: true }, ¿qué le explica el
// asesor al cliente que abonó Q500 y ve que su saldo casi no bajó?

export const AplicacionDelPago = z
  .object({
    gastos: MontoDecimal.meta({ example: "0.00" }),
    interesMoratorio: MontoDecimal.meta({ example: "125.00" }),
    interesCorriente: MontoDecimal.meta({ example: "80.00" }),
    capital: MontoDecimal.meta({ example: "725.76" }),
    excedente: MontoDecimal.meta({ example: "0.00" }),
  })
  .meta({
    id: "AplicacionDelPago",
    description:
      "Desglose del pago en el orden de prelación: gastos → moratorio → corriente → capital.",
  });

  

export const EstadoCredito = z
  .enum(["vigente", "en_mora", "cancelado", "reestructurado", "incobrable"])
  .meta({ id: "EstadoCredito" });



// TODO 4 · Modele el tramo de mora (sección 6.7 del enunciado).
// El tramo no cambia el estado del crédito.
// Es una clasificación calculada a partir de los días de atraso.
// "ninguno" representa AL_DIA en el dominio.
export const TramoMora = z
  .enum([
    "ninguno",
    "mora_1",
    "mora_2",
    "mora_3",
    "vencido",
    "incobrable",
  ])
  .meta({
    id: "TramoMora",
    description:
      "Clasificación derivada de los días de atraso; no representa el estado del crédito.",
  });

// TODO 5 · Complete la respuesta del pago registrado.
// La respuesta debe diferenciar un pago nuevo de la reproducción de un pago
// anterior enviado nuevamente con la misma clave de idempotencia.
export const PagoRegistrado = z
  .object({
    // Identificador único del pago registrado.
    pagoId: z.string().meta({ example: "PG-2026-000731" }),

    // Identificador del crédito afectado.
    creditoId: CreditoId,

    // Momento en que el sistema registró el pago.
    recibidoEn: InstanteISO,

    // Monto recibido, representado como cadena decimal y moneda.
    montoRecibido: Dinero,

    // Distribución del pago según la prelación del dominio.
    aplicacion: AplicacionDelPago,

    // Saldo de capital que queda después de aplicar el pago.
    saldoCapitalDespues: Dinero,

    // Estado actual del crédito según la máquina de estados del dominio.
    estadoCredito: EstadoCredito,

    // Clasificación derivada de los días de atraso.
    // Este campo no sustituye a estadoCredito.
    tramoMora: TramoMora,

    // Cantidad de días de atraso; nunca puede ser negativa.
    diasAtraso: z.int().min(0),

    // false: pago nuevo; true: respuesta reproducida por idempotencia.
    reproducido: z.boolean(),
  })
  .meta({ id: "PagoRegistrado" });