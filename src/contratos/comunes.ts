/**
 * Piezas compartidas por todos los contratos de la API.
 *
 * Estos esquemas representan la forma externa de los datos JSON.
 * El dominio utiliza sus propias clases internas, por ejemplo Dinero.
 */

import { z } from "zod";

/**
 * El dinero viaja como cadena decimal para evitar errores de precisión
 * de los números flotantes de JavaScript.
 */
export const MontoDecimal = z
  .string()
  .regex(
    /^-?\d{1,13}\.\d{2}$/,
    "Debe ser decimal con exactamente dos decimales, por ejemplo '1004.62'",
  )
  .meta({
    description: "Importe como cadena decimal con dos decimales exactos",
    example: "1004.62",
  });

/**
 * El contrato externo opera únicamente con quetzales.
 * El dominio puede tener más monedas, pero esta API solo expone GTQ.
 */
export const Moneda = z
  .literal("GTQ")
  .meta({
    description: "Código ISO 4217. El sistema opera únicamente en quetzales",
    example: "GTQ",
  });

/**
 * Objeto de valor monetario en la API.
 *
 * Ejemplo:
 * {
 *   "valor": "500.00",
 *   "moneda": "GTQ"
 * }
 */
export const Dinero = z
  .object({
    valor: MontoDecimal,
    moneda: Moneda,
  })
  .meta({
    id: "Dinero",
    description:
      "Representación externa del dinero. Internamente el dominio utiliza decimal.js.",
  });

/**
 * Fecha calendario enviada por el cliente.
 * No se obtiene automáticamente del reloj del servidor.
 */
export const FechaISO = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Formato esperado: AAAA-MM-DD",
  )
  .meta({
    description: "Fecha calendario en formato AAAA-MM-DD",
    example: "2026-08-22",
  });

/**
 * Instante exacto en formato RFC 3339.
 * El offset es obligatorio para conocer la zona horaria.
 */
export const InstanteISO = z
  .iso.datetime({ offset: true })
  .meta({
    description: "Instante en formato RFC 3339 con zona horaria",
    example: "2026-08-22T09:15:00-06:00",
  });

/**
 * Identificador público de un crédito.
 */
export const CreditoId = z
  .string()
  .regex(/^C-\d{3,8}$/, "Formato esperado: C-004")
  .meta({
    description: "Identificador del crédito",
    example: "C-004",
  });

/**
 * Clave enviada por el cliente para evitar cobrar dos veces
 * cuando una petición se reintenta.
 */
export const IdempotencyKey = z
  .uuid()
  .meta({
    description:
      "UUID que identifica de forma única un intento de pago",
    example: "5b0b9e2e-6a1f-4a5c-9c1e-0d6d1a1f0b3a",
  });

/**
 * Error asociado a un campo específico de la petición.
 */
export const ErrorDeCampo = z
  .object({
    campo: z.string().meta({
      example: "monto.valor",
    }),
    mensaje: z.string().meta({
      example: "Debe tener dos decimales",
    }),
  })
  .meta({
    id: "ErrorDeCampo",
  });

/**
 * Formato uniforme de errores HTTP según RFC 9457.
 */
export const ProblemDetails = z
  .object({
    type: z.url().meta({
      description: "URI estable que identifica el tipo de problema",
      example:
        "https://api.creditovecino.gt/problemas/validacion",
    }),

    title: z.string().meta({
      example: "Parámetros inválidos",
    }),

    status: z.int().min(400).max(599).meta({
      example: 400,
    }),

    detail: z.string().optional().meta({
      description: "Explicación específica de esta ocurrencia",
      example: "El campo monto.valor no tiene el formato esperado",
    }),

    instance: z.string().optional().meta({
      description: "URI de la petición que produjo el error",
      example: "/creditos/C-004/pagos",
    }),

    traceId: z.string().optional().meta({
      description: "Identificador para rastrear el error en los logs",
      example: "01J9Z4T8Q2",
    }),

    errores: z.array(ErrorDeCampo).optional(),
  })
  .meta({
    id: "ProblemDetails",
    description:
      "Cuerpo uniforme de error para application/problem+json",
  });

/**
 * Parámetros comunes de paginación.
 */
export const Paginacion = z
  .object({
    limite: z.int().min(1).max(200).default(50),

    cursor: z.string().optional().meta({
      description: "Cursor opaco devuelto por la página anterior",
    }),
  })
  .meta({
    id: "Paginacion",
  });