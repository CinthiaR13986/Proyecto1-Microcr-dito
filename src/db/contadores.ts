/**
 * contadores.ts — secuencias de ids (CL-001, SO-001, C-001, PG-000001...),
 * persistidas en su propia tabla para que sobrevivan reinicios del server.
 */

import { Tabla } from "./tablas.ts";

interface FilaContador extends Record<string, string> {
  entidad: string;
  ultimo: string;
}

const tablaContadores = new Tabla<FilaContador>("contadores", ["entidad", "ultimo"]);

export function siguienteId(entidad: string, prefijo: string, ancho = 3): string {
  const fila = tablaContadores.buscar((f) => f.entidad === entidad);
  const siguiente = (fila ? Number(fila.ultimo) : 0) + 1;
  if (fila) tablaContadores.actualizar((f) => f.entidad === entidad, { ultimo: String(siguiente) });
  else tablaContadores.agregar({ entidad, ultimo: String(siguiente) });
  return `${prefijo}-${String(siguiente).padStart(ancho, "0")}`;
}
