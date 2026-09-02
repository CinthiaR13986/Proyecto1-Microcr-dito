import { AprobarSolicitudRequest, CrearSolicitudRequest, RechazarSolicitudRequest } from "../contratos/solicitudes.ts";
import { tablaClientes } from "../db/clientes.ts";
import { siguienteId } from "../db/contadores.ts";
import { tablaCreditos, type FilaCredito } from "../db/creditos.ts";
import { tablaSolicitudes, type FilaSolicitud } from "../db/solicitudes.ts";
import { aCentavos } from "../util/dinero.ts";
import { instanteGuatemala } from "../util/fechas.ts";
import { enviarJson, ErrorHttp, leerCuerpoJson, validarConEsquema, Router } from "./comun.ts";

const MONTO_MIN_CENT = 1_000_00;
const MONTO_MAX_CENT = 25_000_00;

function filaAJson(fila: FilaSolicitud) {
  return {
    solicitudId: fila.solicitudId,
    clienteId: fila.clienteId,
    montoSolicitado: { valor: fila.montoValor, moneda: "GTQ" as const },
    plazoMeses: Number(fila.plazoMeses),
    estado: fila.estado,
    creadoEn: fila.creadoEn,
    ...(fila.creditoId ? { creditoId: fila.creditoId } : {}),
  };
}

function buscarSolicitudOFallar(solicitudId: string): FilaSolicitud {
  const fila = tablaSolicitudes.buscar((f) => f.solicitudId === solicitudId);
  if (!fila) {
    throw new ErrorHttp(404, "solicitud-no-encontrada", "La solicitud no existe", `No existe ninguna solicitud con el identificador '${solicitudId}'.`);
  }
  return fila;
}

function exigirPendienteDeDecision(fila: FilaSolicitud): void {
  if (fila.estado !== "solicitado" && fila.estado !== "en_evaluacion") {
    throw new ErrorHttp(
      409,
      "solicitud-ya-decidida",
      "La solicitud ya fue decidida",
      `La solicitud '${fila.solicitudId}' ya se encuentra en estado '${fila.estado}' y no admite una nueva decisión.`,
    );
  }
}

export function registrarRutasSolicitudes(router: Router): void {
  router.registrar("POST", "/solicitudes", async (req, res) => {
    const cuerpo = validarConEsquema(CrearSolicitudRequest, await leerCuerpoJson(req));

    const cliente = tablaClientes.buscar((f) => f.clienteId === cuerpo.clienteId);
    if (!cliente) {
      throw new ErrorHttp(404, "cliente-no-encontrado", "El cliente no existe", `No existe ningún cliente con el identificador '${cuerpo.clienteId}'.`);
    }

    const montoCent = aCentavos(cuerpo.montoSolicitado.valor);
    if (montoCent < MONTO_MIN_CENT || montoCent > MONTO_MAX_CENT) {
      throw new ErrorHttp(
        422,
        "fuera-de-rango-producto",
        "Monto o plazo fuera del rango del producto",
        `El monto solicitado '${cuerpo.montoSolicitado.valor}' está fuera del rango Q1,000.00–Q25,000.00 permitido para microcrédito.`,
      );
    }

    const solicitudId = siguienteId("solicitudes", "SO");
    const fila: FilaSolicitud = {
      solicitudId,
      clienteId: cuerpo.clienteId,
      montoValor: cuerpo.montoSolicitado.valor,
      plazoMeses: String(cuerpo.plazoMeses),
      proposito: cuerpo.proposito ?? "",
      estado: "solicitado",
      creadoEn: instanteGuatemala(),
      creditoId: "",
      tasaAprobadaAnual: "",
      motivoRechazo: "",
    };
    tablaSolicitudes.agregar(fila);
    enviarJson(res, 201, filaAJson(fila), { Location: `/solicitudes/${solicitudId}` });
  });

  router.registrar("GET", "/solicitudes/:solicitudId", (req, res, params) => {
    enviarJson(res, 200, filaAJson(buscarSolicitudOFallar(params.solicitudId)));
  });

  router.registrar("POST", "/solicitudes/:solicitudId/aprobacion", async (req, res, params) => {
    const cuerpo = validarConEsquema(AprobarSolicitudRequest, await leerCuerpoJson(req));
    const solicitud = buscarSolicitudOFallar(params.solicitudId);
    exigirPendienteDeDecision(solicitud);

    const creditoId = siguienteId("creditos", "C");
    const creditoNuevo: FilaCredito = {
      creditoId,
      clienteId: solicitud.clienteId,
      solicitudId: solicitud.solicitudId,
      estado: "aprobado",
      montoOriginalValor: solicitud.montoValor,
      saldoCapitalValor: solicitud.montoValor,
      tasaAprobadaAnual: String(cuerpo.tasaAprobadaAnual),
      plazoMeses: solicitud.plazoMeses,
      fechaDesembolso: "",
      creadoEn: instanteGuatemala(),
      diasAtraso: "0",
      tramoMora: "ninguno",
      ultimaReferencia: "",
    };
    tablaCreditos.agregar(creditoNuevo);

    tablaSolicitudes.actualizar((f) => f.solicitudId === solicitud.solicitudId, {
      estado: "aprobado",
      creditoId,
      tasaAprobadaAnual: String(cuerpo.tasaAprobadaAnual),
    });

    enviarJson(res, 200, filaAJson(buscarSolicitudOFallar(solicitud.solicitudId)));
  });

  router.registrar("POST", "/solicitudes/:solicitudId/rechazo", async (req, res, params) => {
    const cuerpo = validarConEsquema(RechazarSolicitudRequest, await leerCuerpoJson(req));
    const solicitud = buscarSolicitudOFallar(params.solicitudId);
    exigirPendienteDeDecision(solicitud);

    tablaSolicitudes.actualizar((f) => f.solicitudId === solicitud.solicitudId, {
      estado: "rechazado",
      motivoRechazo: cuerpo.motivo,
    });

    enviarJson(res, 200, filaAJson(buscarSolicitudOFallar(solicitud.solicitudId)));
  });
}
