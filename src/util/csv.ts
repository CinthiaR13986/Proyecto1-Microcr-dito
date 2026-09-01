/**
 * csv.ts — lectura/escritura mínima de tablas CSV (RFC 4180 simplificado).
 *
 * No soporta saltos de línea dentro de un campo entre comillas: los datos
 * del Sistema (nombres, direcciones, referencias) no los necesitan. Comas y
 * comillas dentro de un campo sí se escapan correctamente.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function escaparCampo(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

function parsearLinea(linea: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (entreComillas) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      campos.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  campos.push(actual);
  return campos;
}

/** Crea el archivo con su fila de encabezado si todavía no existe. */
export function asegurarTabla(ruta: string, columnas: readonly string[]): void {
  mkdirSync(dirname(ruta), { recursive: true });
  if (!existsSync(ruta)) writeFileSync(ruta, columnas.join(",") + "\n", "utf8");
}

export function leerTabla(ruta: string): Record<string, string>[] {
  const texto = readFileSync(ruta, "utf8");
  const lineas = texto.split(/\r?\n/).filter((l) => l.length > 0);
  if (lineas.length === 0) return [];
  const columnas = parsearLinea(lineas[0]);
  return lineas.slice(1).map((linea) => {
    const campos = parsearLinea(linea);
    const fila: Record<string, string> = {};
    columnas.forEach((col, i) => (fila[col] = campos[i] ?? ""));
    return fila;
  });
}

export function escribirTabla(ruta: string, columnas: readonly string[], filas: Record<string, string>[]): void {
  const lineas = [columnas.join(",")];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => escaparCampo(fila[c] ?? "")).join(","));
  }
  writeFileSync(ruta, lineas.join("\n") + "\n", "utf8");
}
