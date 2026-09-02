import { DesembolsarCreditoRequest } from "../contratos/creditos.ts";
import { tablaCreditos, type FilaCredito } from "../db/creditos.ts";
import { tablaCuotas, type FilaCuota } from "../db/cuotas.ts";
import { generarPlanFrances } from "../dominio/amortizacion.ts";
import { aCentavos, desdeCentavos } from "../util/dinero.ts";
import { enviarJson, ErrorHttp, leerCuerpoJson, validarConEsquema, Router } from "./comun.ts";

export function buscarCreditoOFallar(creditoId: string): FilaCredito {
  const fila = tablaCreditos.buscar((f) => f.creditoId === creditoId);
  if (!fila) {
    throw new ErrorHttp(404, "credito-no-encontrado", "El crédito no existe", `No existe ningún crédito con el identificador '${creditoId}'.`);
  }
  return fila;
}

function creditoAJson(fila: FilaCredito) {
  return {
    creditoId: fila.creditoId,
    clienteId: fila.clienteId,
    solicitudId: fila.solicitudId,
    estado: fila.estado,
    tramoMora: fila.tramoMora,
    diasAtraso: Number(fila.diasAtraso),
    montoOriginal: { valor: fila.montoOriginalValor, moneda: "GTQ" as const },
    saldoCapital: { valor: fila.saldoCapitalValor, moneda: "GTQ" as const },
    tasaAprobadaAnual: Number(fila.tasaAprobadaAnual),
    plazoMeses: Number(fila.plazoMeses),
    ...(fila.fechaDesembolso ? { fechaDesembolso: fila.fechaDesembolso } : {}),
    creadoEn: fila.creadoEn,
  };
}

export function registrarRutasCreditos(router: Router): void {
  router.registrar("GET", "/creditos/:creditoId", (req, res, params) => {
    enviarJson(res, 200, creditoAJson(buscarCreditoOFallar(params.creditoId)));
  });

  router.registrar("POST", "/creditos/:creditoId/desembolsos", async (req, res, params) => {
    const cuerpo = validarConEsquema(DesembolsarCreditoRequest, await leerCuerpoJson(req));
    const credito = buscarCreditoOFallar(params.creditoId);
    if (credito.estado !== "aprobado") {
      throw new ErrorHttp(
        409,
        "estado-no-admite-desembolso",
        "El crédito no admite desembolso en su estado actual",
        `El crédito '${credito.creditoId}' ya se encuentra en estado '${credito.estado}'.`,
      );
    }

    const plan = generarPlanFrances(
      aCentavos(credito.montoOriginalValor),
      Number(credito.tasaAprobadaAnual),
      Number(credito.plazoMeses),
      cuerpo.fechaDesembolso,
    );

    for (const cuota of plan) {
      const filaCuota: FilaCuota = {
        creditoId: credito.creditoId,
        numero: String(cuota.numero),
        vencimiento: cuota.vencimiento,
        saldoInicialValor: desdeCentavos(cuota.saldoInicial),
        cuotaValor: desdeCentavos(cuota.cuota),
        interesValor: desdeCentavos(cuota.interes),
        amortizacionValor: desdeCentavos(cuota.amortizacion),
        saldoFinalValor: desdeCentavos(cuota.saldoFinal),
        capitalPendienteValor: desdeCentavos(cuota.amortizacion),
        interesPendienteValor: desdeCentavos(cuota.interes),
        estado: "pendiente",
      };
      tablaCuotas.agregar(filaCuota);
    }

    tablaCreditos.actualizar((f) => f.creditoId === credito.creditoId, {
      estado: "vigente",
      fechaDesembolso: cuerpo.fechaDesembolso,
      ultimaReferencia: cuerpo.fechaDesembolso,
    });

    enviarJson(res, 201, creditoAJson(buscarCreditoOFallar(credito.creditoId)));
  });

  router.registrar("GET", "/creditos/:creditoId/plan-amortizacion", (req, res, params) => {
    const credito = buscarCreditoOFallar(params.creditoId);
    if (!credito.fechaDesembolso) {
      throw new ErrorHttp(
        422,
        "credito-sin-plan",
        "El crédito no tiene plan de amortización",
        `El crédito '${credito.creditoId}' está en estado '${credito.estado}': aún no fue desembolsado.`,
      );
    }

    const cuotas = tablaCuotas.filtrar((f) => f.creditoId === credito.creditoId).sort((a, b) => Number(a.numero) - Number(b.numero));
    const referencia = credito.ultimaReferencia || credito.fechaDesembolso;

    enviarJson(res, 200, {
      creditoId: credito.creditoId,
      capital: { valor: credito.montoOriginalValor, moneda: "GTQ" as const },
      tasaMensual: Number(credito.tasaAprobadaAnual) / 12,
      numeroCuotas: cuotas.length,
      cuotas: cuotas.map((c) => {
        const pagada = aCentavos(c.capitalPendienteValor) < 1 && aCentavos(c.interesPendienteValor) < 1;
        const estado = pagada ? "pagada" : c.vencimiento < referencia ? "vencida" : "pendiente";
        return {
          numero: Number(c.numero),
          vencimiento: c.vencimiento,
          saldoInicial: { valor: c.saldoInicialValor, moneda: "GTQ" as const },
          cuota: { valor: c.cuotaValor, moneda: "GTQ" as const },
          interes: { valor: c.interesValor, moneda: "GTQ" as const },
          amortizacion: { valor: c.amortizacionValor, moneda: "GTQ" as const },
          saldoFinal: { valor: c.saldoFinalValor, moneda: "GTQ" as const },
          estado,
        };
      }),
    });
  });
}
