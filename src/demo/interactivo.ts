/**

 * Permite que cualquier usuario  ingrese SUS PROPIOS datos y vea los resultados del nucleo en vivo:
 *   1) Plan de amortizacion con el capital/tasa/plazo que el escriba.
 *   2) Simulacion de mora con la cuota y los dias que se elija
 *   3) Aplicacion de un pago con la prelacion normativa.
 *
 * Ejecucion: npm run interactivo
 */
import { createInterface } from 'node:readline/promises';

import { Dinero } from '../dominio/dinero';
import { MetodoFrances, PlanAmortizacion } from '../dominio/plan-amortizacion';
import { calcularInteresMoratorio, clasificarTramo, POLITICA_REFERENCIA } from '../dominio/calculadora-mora';
import { aplicarPago } from '../dominio/prelacion-pago';

const q = (d: Dinero): string => d.aNumero().toFixed(2);

const rl = createInterface({ input: process.stdin, output: process.stdout });

/** Pide un numero; acepta coma o punto; si el dato es inválido usa el defecto. */
async function pedirNumero(
  pregunta: string,
  porDefecto: number,
  minimo = Number.NEGATIVE_INFINITY,
): Promise<number> {
  const texto = await rl.question(`${pregunta} [${porDefecto}]: `);
  if (texto.trim() === '') return porDefecto;
  const valor = Number(texto.trim().replace(',', '.'));
  if (!Number.isFinite(valor) || valor < minimo) {
    console.log('  Valor no válido: se usa el valor por defecto.');
    return porDefecto;
  }
  return valor;
}

async function main(): Promise<void> {
  console.log('=== Credito Vecino, S.A. — consola interactiva del nucleo (E4) ===\n');

  // ── Entrada de datos del usuario ─────────────────────────
  const capital = await pedirNumero('Capital del credito (Q)', 10000, 0.01);
  const tna = await pedirNumero('TNA nominal anual (%)', 36, 0);
  const numeroCuotas = Math.floor(await pedirNumero('Numero de cuotas', 12, 1));

  // ── 1) Plan de amortizacion con esos datos ───────────────
  const plan = PlanAmortizacion.generar({
    capital: Dinero.de(capital),
    tasaMensual: tna / 12 / 100,
    numeroCuotas,
    metodo: MetodoFrances,
  });
  console.log(`\nPLAN · i = ${(tna / 12).toFixed(2)}% mensual · ${numeroCuotas} cuotas`);
  console.log(' N | saldoInicial |   cuota | interes | amortiza | saldoFinal');
  for (const c of plan.cuotas) {
    console.log(
      `${String(c.numero).padStart(2)} | ${q(c.saldoInicial).padStart(10)} | ${q(c.cuota).padStart(7)} | ` +
      `${q(c.interes).padStart(7)} | ${q(c.amortizacion).padStart(8)} | ${q(c.saldoFinal).padStart(8)}`,
    );
  }
  console.log(
    `Totales: pagado ${q(plan.totalPagado)} · interes ${q(plan.totalInteres)} · capital ${q(plan.totalAmortizacion)}`,
  );

  // ── 2) Simulacion de mora con la cuota y dias que el elija ──
  const numeroVencida = Math.floor(await pedirNumero('\nCuota vencida a simular (N°)', 2, 1));
  const dias = Math.floor(await pedirNumero('Dias de atraso', 15, 0));
  const cuotaVencida = plan.cuotas[Math.min(numeroVencida, numeroCuotas) - 1]!;

  console.log(`\nMORA · cuota ${cuotaVencida.numero} · capital en mora ${q(cuotaVencida.amortizacion)} · ${dias} dias`);
  console.log(`Tramo (clasificacion derivada, reversible): ${clasificarTramo(dias)}`);
  const moratorio = calcularInteresMoratorio(cuotaVencida.amortizacion, dias, POLITICA_REFERENCIA);
  console.log(`Interes moratorio (solo sobre capital, sin anatocismo): ${q(moratorio)}`);

  // ── 3) Aplicacion de un pago con prelacion ───────────────
  const totalAdeudado = moratorio.sumar(cuotaVencida.interes).sumar(cuotaVencida.amortizacion);
  console.log(`Total adeudado de la cuota vencida: ${q(totalAdeudado)}`);
  const pago = await pedirNumero('Monto del pago a aplicar (Q)', totalAdeudado.aNumero(), 0);

  const r = aplicarPago(Dinero.de(pago), {
    gastos: Dinero.cero(),
    interesMoratorio: moratorio,
    interesCorriente: cuotaVencida.interes,
    capital: cuotaVencida.amortizacion,
  });
  console.log('\nAPLICACIoN DEL PAGO (prelacion normativa 6.6):');
  console.log(`  1 gastos    : ${q(r.aplicados.gastos)}`);
  console.log(`  2 moratorio : ${q(r.aplicados.interesMoratorio)}`);
  console.log(`  3 corriente : ${q(r.aplicados.interesCorriente)}`);
  console.log(`  4 capital   : ${q(r.aplicados.capital)}`);
  console.log(
    `Cuota saldada: ${r.cuotaSaldada ? 'Si' : 'NO'} · capital pendiente: ${q(r.capitalPendiente)} · excedente: ${q(r.excedente)} → ${r.destinoExcedente}`,
  );

  rl.close();
  console.log('\nFin de la simulacion.');
}

void main();