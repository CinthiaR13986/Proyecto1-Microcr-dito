/**
 * tablas.ts — abstracción de "tabla" sobre un archivo CSV. Cada operación
 * lee/escribe el archivo completo: el CSV en disco ES la fuente de verdad
 * en todo momento, no una copia en memoria (dataset pequeño de proyecto
 * académico; simplicidad ganó sobre rendimiento a propósito).
 */

import { join } from "node:path";
import { asegurarTabla, escribirTabla, leerTabla } from "../util/csv.ts";

const DIR_DATOS = join(process.cwd(), "data");

export class Tabla<T extends Record<string, string>> {
  private readonly ruta: string;

  constructor(nombre: string, private readonly columnas: readonly (keyof T & string)[]) {
    this.ruta = join(DIR_DATOS, `${nombre}.csv`);
    asegurarTabla(this.ruta, this.columnas);
  }

  todas(): T[] {
    return leerTabla(this.ruta) as T[];
  }

  private guardarTodas(filas: T[]): void {
    escribirTabla(this.ruta, this.columnas, filas);
  }

  agregar(fila: T): void {
    const filas = this.todas();
    filas.push(fila);
    this.guardarTodas(filas);
  }

  actualizar(predicado: (fila: T) => boolean, cambios: Partial<T>): boolean {
    const filas = this.todas();
    const indice = filas.findIndex(predicado);
    if (indice === -1) return false;
    filas[indice] = { ...filas[indice], ...cambios };
    this.guardarTodas(filas);
    return true;
  }

  buscar(predicado: (fila: T) => boolean): T | undefined {
    return this.todas().find(predicado);
  }

  filtrar(predicado: (fila: T) => boolean): T[] {
    return this.todas().filter(predicado);
  }
}
