/**
 * comun.ts — router HTTP mínimo (node:http nativo, sin framework) y las
 * piezas compartidas por todos los recursos: envío de JSON, envío de
 * `application/problem+json` (RFC 9457) y validación de cuerpo/query contra
 * los esquemas Zod de src/contratos — el mismo esquema que ya genera el
 * contrato OpenAPI valida aquí en tiempo de ejecución.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { z } from "zod";

export class ErrorHttp extends Error {
  constructor(
    public readonly status: number,
    public readonly tipo: string,
    public readonly title: string,
    public readonly detail: string,
    public readonly errores?: { campo: string; mensaje: string }[],
  ) {
    super(title);
  }
}

export function enviarJson(res: ServerResponse, status: number, cuerpo: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(cuerpo));
}

export function enviarProblema(
  res: ServerResponse,
  status: number,
  tipo: string,
  title: string,
  detail: string,
  instance: string,
  errores?: { campo: string; mensaje: string }[],
): void {
  const cuerpo: Record<string, unknown> = {
    type: `https://api.creditovecino.gt/problemas/${tipo}`,
    title,
    status,
    detail,
    instance,
    traceId: randomUUID(),
  };
  if (errores) cuerpo.errores = errores;
  res.writeHead(status, { "Content-Type": "application/problem+json; charset=utf-8" });
  res.end(JSON.stringify(cuerpo));
}

export async function leerCuerpoJson(req: IncomingMessage): Promise<unknown> {
  const trozos: Buffer[] = [];
  for await (const trozo of req) trozos.push(trozo as Buffer);
  const texto = Buffer.concat(trozos).toString("utf8");
  if (texto.trim().length === 0) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorHttp(400, "cuerpo-invalido", "El cuerpo no es JSON válido", "No fue posible interpretar el cuerpo de la petición como JSON.");
  }
}

export function validarConEsquema<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const errores = resultado.error.issues.map((i) => ({
      campo: i.path.length > 0 ? i.path.join(".") : "(raíz)",
      mensaje: i.message,
    }));
    throw new ErrorHttp(400, "validacion", "El cuerpo o los parámetros no cumplen el contrato", "Uno o más campos no cumplen las reglas del esquema.", errores);
  }
  return resultado.data;
}

export type Manejador = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  query: URLSearchParams,
) => Promise<void> | void;

interface RutaCompilada {
  metodo: string;
  regex: RegExp;
  nombres: string[];
  manejador: Manejador;
}

export class Router {
  private readonly rutas: RutaCompilada[] = [];

  registrar(metodo: string, patron: string, manejador: Manejador): void {
    const nombres: string[] = [];
    const piezas = patron
      .split("/")
      .filter((pieza) => pieza.length > 0)
      .map((pieza) => {
        if (pieza.startsWith(":")) {
          nombres.push(pieza.slice(1));
          return "([^/]+)";
        }
        return pieza.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      });
    this.rutas.push({ metodo, regex: new RegExp(`^/${piezas.join("/")}/?$`), nombres, manejador });
  }

  async despachar(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    for (const ruta of this.rutas) {
      if (ruta.metodo !== req.method) continue;
      const coincidencia = ruta.regex.exec(url.pathname);
      if (!coincidencia) continue;
      const params: Record<string, string> = {};
      ruta.nombres.forEach((nombre, i) => (params[nombre] = decodeURIComponent(coincidencia[i + 1])));
      try {
        await ruta.manejador(req, res, params, url.searchParams);
      } catch (error) {
        if (error instanceof ErrorHttp) {
          enviarProblema(res, error.status, error.tipo, error.title, error.detail, url.pathname, error.errores);
        } else {
          console.error(error);
          enviarProblema(
            res,
            500,
            "error-servidor",
            "Error no previsto del servidor",
            "Ocurrió un error inesperado al procesar la petición. Consulte el traceId con soporte.",
            url.pathname,
          );
        }
      }
      return;
    }
    enviarProblema(res, 404, "recurso-no-encontrado", "Recurso no encontrado", `No existe una ruta ${req.method ?? ""} ${url.pathname}.`, url.pathname);
  }
}
