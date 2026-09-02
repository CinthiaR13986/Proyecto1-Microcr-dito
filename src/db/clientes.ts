import { Tabla } from "./tablas.ts";

export interface FilaCliente extends Record<string, string> {
  clienteId: string;
  nombre: string;
  identificacion: string;
  telefono: string;
  email: string;
  direccion: string;
  registradoEn: string;
}

export const tablaClientes = new Tabla<FilaCliente>("clientes", [
  "clienteId",
  "nombre",
  "identificacion",
  "telefono",
  "email",
  "direccion",
  "registradoEn",
]);
