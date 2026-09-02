import { GenerarCierreDiarioRequest, GenerarCierreMensualRequest } from "../contratos/cierres.ts";
import { tablaCierres, type FilaCierre } from "../db/cierres.ts";
import { tablaCreditos } from "../db/creditos.ts";
import { tablaCuotas } from "../db/cuotas.ts";
import { calcularCartera } from "../dominio/cartera.ts";
import { calcularDiasAtraso, clasificarTramo } from "../dominio/mora.ts";
import { aCentavos, desdeCentavos } from "../util/dinero.ts";
import { finDeMes, hoyGuatemala, instanteGuatemala } from "../util/fechas.ts";
import { enviarJson, ErrorHttp, leerCuerpoJson, validarConEsquema, Router } from "./comun.ts";

function creditosConTramo(fechaCorte: string) {
  return tablaCreditos.todas().map((credito) => {
    const pendientes = tablaCuotas.filtrar((c) => c.creditoId === credito.creditoId && c.estado !== "pagada");
    return {
      creditoId: credito.creditoId,
      estado: credito.estado,
      saldoCapitalCent: aCentavos(credito.saldoCapitalValor),
      tramo: clasificarTramo(calcularDiasAtraso(pendientes, fechaCorte)),
    };
  });
}

/** No hay endpoint en este contrato para marcar un crédito como incobrable: siempre Q0.00. */
function generarCierre(tipo: "diario" | "mensual", fechaCorte: string, cierreId: string): FilaCierre {
  const agregado = calcularCartera(creditosConTramo(fechaCorte), true);
  return {
    cierreId,
    tipo,
    fechaCorte,
    carteraActivaValor: desdeCentavos(agregado.carteraActivaCent),
    saldoEnRiesgoValor: desdeCentavos(agregado.saldoEnRiesgoCent),
    dadoPorIncobrableValor: "0.00",
    generadoEn: instanteGuatemala(),
  };
}

function cierreAJson(fila: FilaCierre, reproducido: boolean) {
  return {
    cierreId: fila.cierreId,
    tipo: fila.tipo,
    fechaCorte: fila.fechaCorte,
    carteraActiva: { valor: fila.carteraActivaValor, moneda: "GTQ" as const },
    saldoEnRiesgo: { valor: fila.saldoEnRiesgoValor, moneda: "GTQ" as const },
    dadoPorIncobrableEnElPeriodo: { valor: fila.dadoPorIncobrableValor, moneda: "GTQ" as const },
    generadoEn: fila.generadoEn,
    reproducido,
  };
}

export function registrarRutasCierres(router: Router): void {
  router.registrar("POST", "/cierres/diarios", async (req, res) => {
    const cuerpo = validarConEsquema(GenerarCierreDiarioRequest, await leerCuerpoJson(req));
    if (cuerpo.fechaCorte > hoyGuatemala()) {
      throw new ErrorHttp(422, "fecha-fuera-de-rango", "Fecha de corte fuera del rango permitido", "La fecha de corte no puede ser posterior a la fecha del día.");
    }

    const cierreId = `CI-${cuerpo.fechaCorte}-D`;
    const existente = tablaCierres.buscar((f) => f.cierreId === cierreId);
    if (existente) {
      enviarJson(res, 200, cierreAJson(existente, true));
      return;
    }
    const fila = generarCierre("diario", cuerpo.fechaCorte, cierreId);
    tablaCierres.agregar(fila);
    enviarJson(res, 201, cierreAJson(fila, false));
  });

  router.registrar("POST", "/cierres/mensuales", async (req, res) => {
    const cuerpo = validarConEsquema(GenerarCierreMensualRequest, await leerCuerpoJson(req));
    const fechaCorte = finDeMes(cuerpo.mesCorte);
    if (fechaCorte > hoyGuatemala()) {
      throw new ErrorHttp(422, "mes-fuera-de-rango", "Mes de corte fuera del rango permitido", `El mes de corte '${cuerpo.mesCorte}' aún no ha concluido.`);
    }

    const cierreId = `CI-${cuerpo.mesCorte}-M`;
    const existente = tablaCierres.buscar((f) => f.cierreId === cierreId);
    if (existente) {
      enviarJson(res, 200, cierreAJson(existente, true));
      return;
    }
    const fila = generarCierre("mensual", fechaCorte, cierreId);
    tablaCierres.agregar(fila);
    enviarJson(res, 201, cierreAJson(fila, false));
  });
}
