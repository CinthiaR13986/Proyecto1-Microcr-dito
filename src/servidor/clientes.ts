import { RegistrarClienteRequest } from "../contratos/clientes.ts";
import { tablaClientes, type FilaCliente } from "../db/clientes.ts";
import { siguienteId } from "../db/contadores.ts";
import { instanteGuatemala } from "../util/fechas.ts";
import { enviarJson, ErrorHttp, leerCuerpoJson, validarConEsquema, Router } from "./comun.ts";

function filaAJson(fila: FilaCliente) {
  return {
    clienteId: fila.clienteId,
    nombre: fila.nombre,
    identificacion: fila.identificacion,
    contacto: {
      telefono: fila.telefono,
      ...(fila.email ? { email: fila.email } : {}),
      ...(fila.direccion ? { direccion: fila.direccion } : {}),
    },
    registradoEn: fila.registradoEn,
  };
}

export function registrarRutasClientes(router: Router): void {
  router.registrar("POST", "/clientes", async (req, res) => {
    const cuerpo = validarConEsquema(RegistrarClienteRequest, await leerCuerpoJson(req));

    const duplicado = tablaClientes.buscar((f) => f.identificacion === cuerpo.identificacion);
    if (duplicado) {
      throw new ErrorHttp(
        422,
        "identificacion-duplicada",
        "Ya existe un cliente con esta identificación",
        `La identificación '${cuerpo.identificacion}' ya está registrada para el cliente '${duplicado.clienteId}'.`,
      );
    }

    const clienteId = siguienteId("clientes", "CL");
    const fila: FilaCliente = {
      clienteId,
      nombre: cuerpo.nombre,
      identificacion: cuerpo.identificacion,
      telefono: cuerpo.contacto.telefono,
      email: cuerpo.contacto.email ?? "",
      direccion: cuerpo.contacto.direccion ?? "",
      registradoEn: instanteGuatemala(),
    };
    tablaClientes.agregar(fila);
    enviarJson(res, 201, filaAJson(fila), { Location: `/clientes/${clienteId}` });
  });

  router.registrar("GET", "/clientes/:clienteId", (req, res, params) => {
    const fila = tablaClientes.buscar((f) => f.clienteId === params.clienteId);
    if (!fila) {
      throw new ErrorHttp(404, "cliente-no-encontrado", "El cliente no existe", `No existe ningún cliente con el identificador '${params.clienteId}'.`);
    }
    enviarJson(res, 200, filaAJson(fila));
  });
}
