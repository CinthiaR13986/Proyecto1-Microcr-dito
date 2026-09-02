import { IdempotencyKey } from "../contratos/comunes.ts";
import { RegistrarPagoRequest } from "../contratos/pagos.ts";
import { siguienteId } from "../db/contadores.ts";
import { tablaCreditos } from "../db/creditos.ts";
import { tablaCuotas } from "../db/cuotas.ts";
import { tablaPagos, type FilaPago } from "../db/pagos.ts";
import { aplicarPago } from "../dominio/pagos.ts";
import { calcularDiasAtraso, clasificarTramo } from "../dominio/mora.ts";
import { aCentavos, desdeCentavos } from "../util/dinero.ts";
import { instanteGuatemala } from "../util/fechas.ts";
import { buscarCreditoOFallar } from "./creditos.ts";
import { enviarJson, ErrorHttp, leerCuerpoJson, validarConEsquema, Router } from "./comun.ts";

const ESTADOS_ADMITEN_PAGO = new Set(["vigente", "en_mora", "reestructurado"]);

function pagoAJson(fila: FilaPago, reproducido: boolean) {
  return {
    pagoId: fila.pagoId,
    creditoId: fila.creditoId,
    recibidoEn: fila.recibidoEn,
    montoRecibido: { valor: fila.montoValor, moneda: "GTQ" as const },
    aplicacion: {
      gastos: fila.gastos,
      interesMoratorio: fila.interesMoratorio,
      interesCorriente: fila.interesCorriente,
      capital: fila.capital,
      excedente: fila.excedente,
    },
    saldoCapitalDespues: { valor: fila.saldoCapitalDespuesValor, moneda: "GTQ" as const },
    estadoCredito: fila.estadoCredito,
    tramoMora: fila.tramoMora,
    diasAtraso: Number(fila.diasAtraso),
    reproducido,
  };
}

export function registrarRutasPagos(router: Router): void {
  router.registrar("POST", "/creditos/:creditoId/pagos", async (req, res, params) => {
    const credito = buscarCreditoOFallar(params.creditoId);

    const claveCruda = req.headers["idempotency-key"];
    const clave = validarConEsquema(IdempotencyKey, Array.isArray(claveCruda) ? claveCruda[0] : claveCruda);

    const cuerpo = validarConEsquema(RegistrarPagoRequest, await leerCuerpoJson(req));

    const existente = tablaPagos.buscar((f) => f.creditoId === credito.creditoId && f.idempotencyKey === clave);
    if (existente) {
      const mismoContenido =
        existente.montoValor === cuerpo.monto.valor &&
        existente.fechaPago === cuerpo.fechaPago &&
        existente.medio === cuerpo.medio &&
        (existente.referencia || "") === (cuerpo.referencia ?? "");
      if (!mismoContenido) {
        throw new ErrorHttp(
          409,
          "clave-idempotencia-reutilizada",
          "Clave de idempotencia reutilizada con otro contenido",
          `La clave '${clave}' se usó antes con datos distintos para el crédito '${credito.creditoId}'.`,
        );
      }
      enviarJson(res, 200, pagoAJson(existente, true));
      return;
    }

    if (!ESTADOS_ADMITEN_PAGO.has(credito.estado)) {
      throw new ErrorHttp(
        422,
        "estado-no-admite-pago",
        "El crédito no admite pagos en su estado actual",
        `El crédito '${credito.creditoId}' está en estado '${credito.estado}' y no puede recibir pagos.`,
      );
    }

    const pendientes = tablaCuotas.filtrar((f) => f.creditoId === credito.creditoId && f.estado !== "pagada");
    const cuotasMutables = pendientes.map((f) => ({
      numero: Number(f.numero),
      vencimiento: f.vencimiento,
      capitalPendiente: aCentavos(f.capitalPendienteValor),
      interesPendiente: aCentavos(f.interesPendienteValor),
    }));

    const resultado = aplicarPago(cuotasMutables, aCentavos(cuerpo.monto.valor), cuerpo.fechaPago, Number(credito.tasaAprobadaAnual));

    for (const actualizada of resultado.cuotasActualizadas) {
      tablaCuotas.actualizar((f) => f.creditoId === credito.creditoId && Number(f.numero) === actualizada.numero, {
        capitalPendienteValor: desdeCentavos(actualizada.capitalPendiente),
        interesPendienteValor: desdeCentavos(actualizada.interesPendiente),
        estado: actualizada.pagada ? "pagada" : "pendiente",
      });
    }

    const cuotasTrasPago = tablaCuotas.filtrar((f) => f.creditoId === credito.creditoId);
    const saldoCapitalCent = Math.max(0, cuotasTrasPago.reduce((suma, f) => suma + aCentavos(f.capitalPendienteValor), 0));
    const aunPendientes = cuotasTrasPago.filter((f) => f.estado !== "pagada");
    const diasAtraso = calcularDiasAtraso(aunPendientes, cuerpo.fechaPago);
    const tramoMora = clasificarTramo(diasAtraso);
    const estadoCredito = saldoCapitalCent <= 0 ? "cancelado" : diasAtraso > 0 ? "en_mora" : "vigente";

    tablaCreditos.actualizar((f) => f.creditoId === credito.creditoId, {
      saldoCapitalValor: desdeCentavos(saldoCapitalCent),
      estado: estadoCredito,
      diasAtraso: String(diasAtraso),
      tramoMora,
      ultimaReferencia: cuerpo.fechaPago > credito.ultimaReferencia ? cuerpo.fechaPago : credito.ultimaReferencia,
    });

    const pagoId = siguienteId("pagos", "PG", 6);
    const filaPago: FilaPago = {
      pagoId,
      creditoId: credito.creditoId,
      recibidoEn: instanteGuatemala(),
      montoValor: cuerpo.monto.valor,
      fechaPago: cuerpo.fechaPago,
      medio: cuerpo.medio,
      referencia: cuerpo.referencia ?? "",
      gastos: desdeCentavos(resultado.gastos),
      interesMoratorio: desdeCentavos(resultado.interesMoratorio),
      interesCorriente: desdeCentavos(resultado.interesCorriente),
      capital: desdeCentavos(resultado.capital),
      excedente: desdeCentavos(resultado.excedente),
      saldoCapitalDespuesValor: desdeCentavos(saldoCapitalCent),
      estadoCredito,
      tramoMora,
      diasAtraso: String(diasAtraso),
      idempotencyKey: clave,
    };
    tablaPagos.agregar(filaPago);

    enviarJson(res, 201, pagoAJson(filaPago, false), { Location: `/creditos/${credito.creditoId}/pagos/${pagoId}` });
  });

  router.registrar("GET", "/creditos/:creditoId/pagos", (req, res, params, query) => {
    const credito = buscarCreditoOFallar(params.creditoId);
    const limite = query.has("limite") ? Number(query.get("limite")) : 50;
    const pagos = tablaPagos.filtrar((f) => f.creditoId === credito.creditoId).slice(0, limite);
    enviarJson(res, 200, { creditoId: credito.creditoId, pagos: pagos.map((f) => pagoAJson(f, false)) });
  });
}
