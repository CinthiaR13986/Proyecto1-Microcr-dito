/**
 * openapi.ts — construye el documento OpenAPI 3.1 a partir de los esquemas Zod.
 *
 * Idea central de la sesión: el contrato NO se escribe dos veces.
 * Los esquemas de src/contratos/ son la única fuente de verdad; aquí solo se
 * describen las operaciones (rutas, métodos, cabeceras y códigos de estado) y
 * se enlazan los esquemas ya definidos.
 */

import { z } from "zod";
import {
  CarteraEnRiesgoQuery,
  CarteraEnRiesgoResponse,
} from "./contratos/cartera";
import { PagoRegistrado, RegistrarPagoRequest } from "./contratos/pagos";
import { CreditoId, IdempotencyKey, ProblemDetails } from "./contratos/comunes";

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** OpenAPI 3.1 usa JSON Schema 2020-12: `examples` (arreglo), no `example`. */
function normalizar(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(normalizar);
  if (nodo && typeof nodo === "object") {
    const src = nodo as Record<string, unknown>;
    const salida: Record<string, unknown> = {};
    for (const [clave, valor] of Object.entries(src)) {
      if (clave === "$schema" || clave === "$id") continue; // ruido dentro de components
      if (clave === "example") {
        salida.examples = [valor];
        continue;
      }
      salida[clave] = normalizar(valor);
    }
    return salida;
  }
  return nodo;
}

/** Convierte todos los esquemas con `id` registrados por Zod en components.schemas. */
function componentesDesdeZod(): Record<string, unknown> {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    target: "draft-2020-12",
  }) as { schemas: Record<string, unknown> };
  return normalizar(schemas) as Record<string, unknown>;
}

/**
 * Referencia a un esquema ya registrado.
 *
 * Recibe el ESQUEMA, no una cadena. Dos motivos, y ambos son de diseño:
 *   1. Un id mal escrito deja de ser posible: si el esquema no está registrado
 *      con `.meta({ id })`, esto falla al generar y no en el consumidor.
 *   2. Usar el esquema como valor obliga a TypeScript a conservar el import.
 *      Si solo se citara el id como texto, el compilador eliminaria el import
 *      por considerarlo sin uso, el modulo nunca se evaluaria y sus esquemas
 *      no llegarian a components.schemas. Es un error real y silencioso.
 */
const ref = (esquema: z.ZodType) => {
  const id = z.globalRegistry.get(esquema)?.id;
  if (!id) {
    throw new Error(
      "Se intento referenciar un esquema que no esta registrado con .meta({ id: \"...\" })."
    );
  }
  return { $ref: `#/components/schemas/${id}` };
};

/**
 * Respuesta de error uniforme (RFC 9457).
 *
 * Recibe un EJEMPLO propio de este código de estado, no solo la descripción.
 * Si se omitiera, Prism (y cualquier mock generado desde el contrato) cae al
 * ejemplo genérico del esquema ProblemDetails para TODAS las respuestas de
 * error del documento -- ese fue exactamente el defecto que produjo un 422
 * con un cuerpo que describía un 409 de idempotencia. Cada código de estado
 * cuenta su propia historia; el ejemplo debe contarla.
 */
const problema = (descripcion: string, ejemplo: Record<string, unknown>) => ({
  description: descripcion,
  content: {
    "application/problem+json": {
      schema: ref(ProblemDetails),
      examples: { caso: { summary: descripcion, value: ejemplo } },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Documento                                                           */
/* ------------------------------------------------------------------ */

export function construirDocumento() {
  const schemas = componentesDesdeZod();

  // Parámetros y cabeceras: se derivan de los mismos esquemas Zod.
  const esquemaCreditoId = normalizar(z.toJSONSchema(CreditoId));
  const esquemaIdempotencyKey = normalizar(z.toJSONSchema(IdempotencyKey));
  const esquemaQueryCartera = normalizar(z.toJSONSchema(CarteraEnRiesgoQuery, { io: "input" })) as {
    properties: Record<string, unknown>;
    required?: string[];
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "SGMC · API de Crédito Vecino, S. A.",
      version: "1.0.0",
      description:
        "Contrato del Sistema de Gestión de Microcrédito. Los esquemas se generan desde Zod: el contrato y la validación en ejecución son el mismo artefacto.",
      contact: { name: "Análisis de Sistemas II (037) — UMG" },
      license: { name: "Uso académico" },
    },
    servers: [{ url: "https://api.creditovecino.gt/v1", description: "Producción (ficticia)" }],
    tags: [
      { name: "Cartera y cobros", description: "Registro de pagos y saldos" },
      { name: "Cierres e indicadores", description: "Cartera en riesgo y cierres" },
    ],
    paths: {
      "/creditos/{creditoId}/pagos": {
        post: {
          tags: ["Cartera y cobros"],
          operationId: "registrarPago",
          summary: "Registra un pago sobre un crédito",
          description:
            "Aplica el pago en el orden de prelación (gastos → interés moratorio → interés corriente → capital) y devuelve el desglose. Operación NO idempotente por método: la idempotencia se obtiene con la cabecera Idempotency-Key.",
          parameters: [
            {
              name: "creditoId",
              in: "path",
              required: true,
              description: "Identificador del crédito",
              schema: esquemaCreditoId,
            },
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              description:
                "Clave generada por el cliente. Si se reintenta el mismo pago con la misma clave y el mismo cuerpo, se devuelve la respuesta original (200) sin volver a cobrar.",
              schema: esquemaIdempotencyKey,
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ref(RegistrarPagoRequest),
                examples: {
                  pagoExacto: {
                    summary: "Pago exacto de la cuota 2 vencida (caso de referencia 6.6.3)",
                    value: {
                      monto: { valor: "1011.88", moneda: "GTQ" },
                      fechaPago: "2026-08-22",
                      medio: "agente_bancario",
                      referencia: "BOL-88213",
                    },
                  },
                  pagoParcial: {
                    summary: "Pago de menos (caso de referencia 6.6.4)",
                    value: { monto: { valor: "500.00", moneda: "GTQ" }, fechaPago: "2026-08-22", medio: "efectivo" },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Pago registrado por primera vez",
              headers: {
                Location: { description: "URI del pago creado", schema: { type: "string" } },
              },
              content: { "application/json": { schema: ref(PagoRegistrado) } },
            },
            "200": {
              description:
                "Reintento con la misma clave y el mismo contenido: se reproduce la respuesta original (reproducido = true). No se cobró de nuevo.",
              content: { "application/json": { schema: ref(PagoRegistrado) } },
            },
            "404": problema("El crédito no existe", {
              type: "https://api.creditovecino.gt/problemas/credito-no-encontrado",
              title: "El crédito no existe",
              status: 404,
              detail: "No existe ningún crédito con el identificador 'C-999'.",
              instance: "/creditos/C-999/pagos",
              traceId: "01J9Z4T900",
            }),
            "409": problema(
              "Conflicto: la clave de idempotencia se reutilizó con un contenido distinto, o el estado del crédito no admite pagos (p. ej. 'solicitado').",
              {
                type: "https://api.creditovecino.gt/problemas/clave-idempotencia-reutilizada",
                title: "Clave de idempotencia reutilizada con otro contenido",
                status: 409,
                detail: "La clave 5b0b9e2e… se usó antes con un monto distinto.",
                instance: "/creditos/C-004/pagos",
                traceId: "01J9Z4T8Q2",
              }
            ),
            "422": problema("El cuerpo es sintácticamente válido pero viola una regla del contrato o del dominio", {
              type: "https://api.creditovecino.gt/problemas/estado-no-admite-pago",
              title: "El crédito no admite pagos en su estado actual",
              status: 422,
              detail: "El crédito 'C-010' está en estado 'solicitado': aún no fue desembolsado y no puede recibir pagos.",
              instance: "/creditos/C-010/pagos",
              traceId: "01J9Z4T9K1",
            }),
            "429": problema("Demasiadas solicitudes", {
              type: "https://api.creditovecino.gt/problemas/limite-excedido",
              title: "Demasiadas solicitudes en poco tiempo",
              status: 429,
              detail: "Se superó el límite de 60 solicitudes por minuto para este cliente. Reintente tras 'Retry-After'.",
              instance: "/creditos/C-004/pagos",
              traceId: "01J9Z4T9X7",
            }),
            "500": problema("Error no previsto del servidor", {
              type: "https://api.creditovecino.gt/problemas/error-servidor",
              title: "Error no previsto del servidor",
              status: 500,
              detail: "Ocurrió un error inesperado al procesar el pago. Consulte el traceId con soporte.",
              instance: "/creditos/C-004/pagos",
              traceId: "01J9Z4TA02",
            }),
          },
        },
      },
      "/cartera-riesgo": {
        get: {
          tags: ["Cierres e indicadores"],
          operationId: "consultarCarteraEnRiesgo",
          summary: "Consulta el indicador de cartera en riesgo a una fecha de corte",
          description:
            "Operación segura e idempotente. Devuelve siempre, junto al porcentaje, lo dado por incobrable en el período: reportar el indicador solo es engañoso.",
          // Los parámetros de consulta se DERIVAN del esquema Zod: si mañana se
          // agrega un filtro al esquema, aparece solo en el contrato.
          parameters: Object.entries(esquemaQueryCartera.properties).map(([nombre, esquema]) => ({
            name: nombre,
            in: "query",
            required: (esquemaQueryCartera.required ?? []).includes(nombre),
            schema: esquema,
          })),
          responses: {
            "200": {
              description: "Indicador calculado",
              content: {
                "application/json": {
                  schema: ref(CarteraEnRiesgoResponse),
                  examples: {
                    casoDeReferencia: {
                      summary: "Caso de referencia 6.8.1 del Proyecto 1 (7.00 %)",
                      value: {
                        fechaCorte: "2026-08-22",
                        carteraActiva: { valor: "800000.00", moneda: "GTQ" },
                        saldoEnRiesgo: { valor: "56000.00", moneda: "GTQ" },
                        porcentajeEnRiesgo: 0.07,
                        dadoPorIncobrableEnElPeriodo: { valor: "15000.00", moneda: "GTQ" },
                        porTramo: [
                          { tramo: "mora_2", creditos: 1, saldoCapital: { valor: "24000.00", moneda: "GTQ" } },
                          { tramo: "mora_3", creditos: 1, saldoCapital: { valor: "18000.00", moneda: "GTQ" } },
                          { tramo: "vencido", creditos: 1, saldoCapital: { valor: "8000.00", moneda: "GTQ" } },
                        ],
                      },
                    },
                  },
                },
              },
            },
            "400": problema("Parámetros de consulta inválidos", {
              type: "https://api.creditovecino.gt/problemas/validacion",
              title: "Parámetros de consulta inválidos",
              status: 400,
              detail: "El parámetro 'fechaCorte' no cumple el formato AAAA-MM-DD.",
              instance: "/cartera-riesgo",
              traceId: "01J9Z4TB14",
              errores: [{ campo: "fechaCorte", mensaje: "Formato esperado: AAAA-MM-DD, p. ej. '2026-08-22'." }],
            }),
            "422": problema("Fecha de corte fuera del rango permitido", {
              type: "https://api.creditovecino.gt/problemas/fecha-fuera-de-rango",
              title: "Fecha de corte fuera del rango permitido",
              status: 422,
              detail: "La fecha de corte no puede ser posterior a la fecha del día ni anterior a la puesta en marcha del Sistema (01/01/2025).",
              instance: "/cartera-riesgo",
              traceId: "01J9Z4TBZ3",
            }),
          },
        },
      },
    },
    components: { schemas },
  };
}
