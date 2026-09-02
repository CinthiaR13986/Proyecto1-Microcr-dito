import { CarteraEnRiesgoQuery } from "../contratos/cartera.ts";
import { tablaCreditos } from "../db/creditos.ts";
import { tablaCuotas } from "../db/cuotas.ts";
import { calcularCartera } from "../dominio/cartera.ts";
import { calcularDiasAtraso, clasificarTramo } from "../dominio/mora.ts";
import { aCentavos, desdeCentavos } from "../util/dinero.ts";
import { hoyGuatemala } from "../util/fechas.ts";
import { enviarJson, ErrorHttp, validarConEsquema, Router } from "./comun.ts";

const PUESTA_EN_MARCHA = "2025-01-01";

export function registrarRutasCartera(router: Router): void {
  router.registrar("GET", "/cartera-riesgo", (req, res, params, query) => {
    const crudo: Record<string, unknown> = {};
    if (query.has("fechaCorte")) crudo.fechaCorte = query.get("fechaCorte");
    if (query.has("incluirReestructurados")) crudo.incluirReestructurados = query.get("incluirReestructurados") === "true";
    const consulta = validarConEsquema(CarteraEnRiesgoQuery, crudo);

    if (consulta.fechaCorte > hoyGuatemala() || consulta.fechaCorte < PUESTA_EN_MARCHA) {
      throw new ErrorHttp(
        422,
        "fecha-fuera-de-rango",
        "Fecha de corte fuera del rango permitido",
        "La fecha de corte no puede ser posterior a la fecha del día ni anterior a la puesta en marcha del Sistema (01/01/2025).",
      );
    }

    const creditos = tablaCreditos.todas().map((credito) => {
      const pendientes = tablaCuotas.filtrar((c) => c.creditoId === credito.creditoId && c.estado !== "pagada");
      return {
        creditoId: credito.creditoId,
        estado: credito.estado,
        saldoCapitalCent: aCentavos(credito.saldoCapitalValor),
        tramo: clasificarTramo(calcularDiasAtraso(pendientes, consulta.fechaCorte)),
      };
    });

    const agregado = calcularCartera(creditos, consulta.incluirReestructurados ?? true);
    const porcentaje = agregado.carteraActivaCent > 0 ? agregado.saldoEnRiesgoCent / agregado.carteraActivaCent : 0;

    enviarJson(res, 200, {
      fechaCorte: consulta.fechaCorte,
      carteraActiva: { valor: desdeCentavos(agregado.carteraActivaCent), moneda: "GTQ" as const },
      saldoEnRiesgo: { valor: desdeCentavos(agregado.saldoEnRiesgoCent), moneda: "GTQ" as const },
      porcentajeEnRiesgo: Math.round(porcentaje * 10_000) / 10_000,
      dadoPorIncobrableEnElPeriodo: { valor: "0.00", moneda: "GTQ" as const },
      porTramo: agregado.porTramo.map((t) => ({
        tramo: t.tramo,
        creditos: t.creditos,
        saldoCapital: { valor: desdeCentavos(t.saldoCapitalCent), moneda: "GTQ" as const },
      })),
    });
  });
}
