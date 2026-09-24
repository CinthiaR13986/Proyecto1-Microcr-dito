/** Banco de pruebas end-to-end del SGMC. Ejecuta 12 flujos contra el servidor local. */

const API = "http://127.0.0.1:4000";
const registro = [];
let flujoActual = "";

function seccion(titulo) {
  flujoActual = titulo;
  console.log(`\n${"=".repeat(78)}\n${titulo}\n${"=".repeat(78)}`);
}

async function llamar(metodo, ruta, { body, headers = {}, nota = "" } = {}) {
  const opciones = { method: metodo, headers: { ...headers } };
  if (body !== undefined) {
    opciones.headers["Content-Type"] = "application/json";
    opciones.body = JSON.stringify(body);
  }
  const res = await fetch(API + ruta, opciones);
  const texto = await res.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = texto;
  }
  registro.push({ flujo: flujoActual, metodo, ruta, status: res.status, peticion: body, respuesta: json, nota });
  console.log(`\n${metodo} ${ruta}  →  ${res.status}${nota ? `   (${nota})` : ""}`);
  if (body) console.log(`  ← ${JSON.stringify(body)}`);
  console.log(`  → ${JSON.stringify(json)}`);
  return { status: res.status, json };
}

const uuid = () => crypto.randomUUID();

/** Alta de cliente → solicitud → aprobación → desembolso. Devuelve el creditoId. */
async function originar({ nombre, dpi, monto, plazo, tasa, fechaDesembolso }) {
  const cli = await llamar("POST", "/clientes", {
    body: {
      nombre,
      identificacion: dpi,
      contacto: { telefono: "+502 5555-0000", email: `${dpi.replace(/ /g, "")}@correo.gt` },
    },
  });
  const sol = await llamar("POST", "/solicitudes", {
    body: {
      clienteId: cli.json.clienteId,
      montoSolicitado: { valor: monto, moneda: "GTQ" },
      plazoMeses: plazo,
      proposito: "Capital de trabajo",
    },
  });
  const apr = await llamar("POST", `/solicitudes/${sol.json.solicitudId}/aprobacion`, {
    body: { tasaAprobadaAnual: tasa, comentario: "Aprobado" },
  });
  await llamar("POST", `/creditos/${apr.json.creditoId}/desembolsos`, {
    body: { fechaDesembolso, cuentaDestino: "CTA-00981245" },
    nota: `otorgado el ${fechaDesembolso}`,
  });
  return apr.json.creditoId;
}

const pagar = (creditoId, monto, fechaPago, clave = uuid(), extra = {}) =>
  llamar("POST", `/creditos/${creditoId}/pagos`, {
    headers: { "Idempotency-Key": clave },
    body: { monto: { valor: monto, moneda: "GTQ" }, fechaPago, medio: "efectivo", referencia: "BOL-0001", ...extra },
  });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 1 · Originación completa y plan de amortización
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 1 · Originación completa: de cliente a crédito vigente");
const C_REF = await originar({
  nombre: "Ana Gabriela Perez Lopez",
  dpi: "2547 78912 0101",
  monto: "10000.00",
  plazo: 12,
  tasa: 0.36,
  fechaDesembolso: "2026-10-10",
});
const plan = await llamar("GET", `/creditos/${C_REF}/plan-amortizacion`, { nota: "caso de referencia del P1" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 2 · Rechazo de solicitud
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 2 · El comité rechaza una solicitud");
const cli2 = await llamar("POST", "/clientes", {
  body: {
    nombre: "Mario Estuardo Cux Batz",
    identificacion: "1122 33445 0102",
    contacto: { telefono: "+502 5555-0002", email: "mario.cux@correo.gt" },
  },
});
const sol2 = await llamar("POST", "/solicitudes", {
  body: {
    clienteId: cli2.json.clienteId,
    montoSolicitado: { valor: "24000.00", moneda: "GTQ" },
    plazoMeses: 24,
    proposito: "Ampliacion de local",
  },
});
await llamar("POST", `/solicitudes/${sol2.json.solicitudId}/rechazo`, {
  body: { motivo: "capacidad_de_pago", comentario: "Ingresos no soportan la cuota" },
});
await llamar("GET", `/solicitudes/${sol2.json.solicitudId}`, { nota: "queda en rechazado" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 3 · Pago puntual, sin mora
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 3 · Pago puntual en la fecha de vencimiento (sin mora)");
await pagar(C_REF, "1004.62", "2026-11-10");

// ───────────────────────────────────────────────────────────────────────────
// FLUJOS 4 y 5 · CP-03: coexistencia de políticas
// Dos créditos idénticos (Q10,000, 3 cuotas, 36 %), uno otorgado antes del
// 1-oct-2026 y otro después. Se pagan las dos primeras cuotas puntualmente y
// se deja vencer SOLO la última 45 días: así la mora es atribuible a una sola
// cuota y las dos políticas son comparables.
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 4 · Crédito otorgado el 15-ago-2026 → política PLANA del 24 %");
const C_PLANA = await originar({
  nombre: "Rosa Elena Xico Tzoc",
  dpi: "3344 55667 0103",
  monto: "10000.00",
  plazo: 3,
  tasa: 0.36,
  fechaDesembolso: "2026-08-15",
});
const planPlana = await llamar("GET", `/creditos/${C_PLANA}/plan-amortizacion`);
const cuotasPlana = planPlana.json.cuotas ?? planPlana.json;
await pagar(C_PLANA, cuotasPlana[0].cuota.valor, "2026-09-15", uuid());
await pagar(C_PLANA, cuotasPlana[1].cuota.valor, "2026-10-15", uuid());
await llamar("GET", `/creditos/${C_PLANA}`, { nota: "solo queda la cuota 3, vence 2026-11-15" });
const moraPlana = await pagar(C_PLANA, "2000.00", "2026-12-30", uuid());

seccion("FLUJO 5 · Crédito otorgado el 10-oct-2026 → política ESCALONADA");
const C_ESC = await originar({
  nombre: "Julio Cesar Ramirez Coc",
  dpi: "5566 77889 0104",
  monto: "10000.00",
  plazo: 3,
  tasa: 0.36,
  fechaDesembolso: "2026-10-10",
});
const planEsc = await llamar("GET", `/creditos/${C_ESC}/plan-amortizacion`);
const cuotasEsc = planEsc.json.cuotas ?? planEsc.json;
await pagar(C_ESC, cuotasEsc[0].cuota.valor, "2026-11-10", uuid());
await pagar(C_ESC, cuotasEsc[1].cuota.valor, "2026-12-10", uuid());
const moraEsc = await pagar(C_ESC, "2000.00", "2027-02-24", uuid());

console.log(`\n>>> CP-03 · misma cuota, mismos 45 días de atraso:`);
console.log(`    PLANA 24 %   → mora Q${moraPlana.json.aplicacion?.interesMoratorio}`);
console.log(`    ESCALONADA   → mora Q${moraEsc.json.aplicacion?.interesMoratorio}`);

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 6 · Idempotencia: el asesor sin señal reintenta
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 6 · Trabajo sin conexión: reintento con la misma Idempotency-Key");
const claveReintento = uuid();
await pagar(C_REF, "1004.62", "2026-12-10", claveReintento, { referencia: "BOL-9001" });
await pagar(C_REF, "1004.62", "2026-12-10", claveReintento, { referencia: "BOL-9001" });
await pagar(C_REF, "1004.62", "2026-12-10", claveReintento, { referencia: "BOL-9001" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 7 · Clave reutilizada con otro contenido
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 7 · La misma clave con OTRO monto debe ser rechazada");
await pagar(C_REF, "500.00", "2026-12-10", claveReintento, { referencia: "BOL-9001" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 8 · Pago de más: el excedente adelanta capital
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 8 · Pago de más: el excedente se adelanta a capital");
await pagar(C_REF, "5000.00", "2027-01-10");
await llamar("GET", `/creditos/${C_REF}`, { nota: "saldo tras el adelanto" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 9 · Pago sobre un crédito no desembolsado
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 9 · No se puede pagar un crédito que no ha sido desembolsado");
const cli9 = await llamar("POST", "/clientes", {
  body: {
    nombre: "Silvia Marleny Hernandez",
    identificacion: "7788 99001 0105",
    contacto: { telefono: "+502 5555-0005", email: "silvia.h@correo.gt" },
  },
});
const sol9 = await llamar("POST", "/solicitudes", {
  body: {
    clienteId: cli9.json.clienteId,
    montoSolicitado: { valor: "5000.00", moneda: "GTQ" },
    plazoMeses: 6,
    proposito: "Compra de inventario",
  },
});
const apr9 = await llamar("POST", `/solicitudes/${sol9.json.solicitudId}/aprobacion`, {
  body: { tasaAprobadaAnual: 0.36, comentario: "Aprobado, pendiente de desembolso" },
});
await pagar(apr9.json.creditoId, "500.00", "2026-11-01");

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 10 · Validación del contrato
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 10 · Validación: el dinero nunca viaja como número JSON");
await llamar("POST", `/creditos/${C_REF}/pagos`, {
  headers: { "Idempotency-Key": uuid() },
  body: { monto: { valor: 1004.62, moneda: "GTQ" }, fechaPago: "2027-02-10", medio: "efectivo" },
  nota: "monto como number, no como cadena decimal",
});
await llamar("POST", `/creditos/${C_REF}/pagos`, {
  headers: { "Idempotency-Key": "no-es-un-uuid" },
  body: { monto: { valor: "100.00", moneda: "GTQ" }, fechaPago: "2027-02-10", medio: "efectivo" },
  nota: "clave de idempotencia mal formada",
});
await llamar("GET", "/creditos/C-999", { nota: "crédito inexistente" });

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 11 · Cartera con créditos en distintos tramos de mora
// El corte no puede ser posterior al día de hoy, así que estos créditos se
// otorgan en el pasado y se dejan sin pagar para que a la fecha de corte
// caigan en tramos distintos.
// ───────────────────────────────────────────────────────────────────────────
const FECHA_CORTE = "2026-09-25";
seccion("FLUJO 11 · Tres créditos impagos, cada uno en un tramo distinto");
await originar({
  nombre: "Delfina Lopez Mucia",
  dpi: "1010 20203 0106",
  monto: "6000.00",
  plazo: 6,
  tasa: 0.36,
  fechaDesembolso: "2026-08-20",
}); // cuota 1 vence 2026-09-20 → 5 días → mora_1
await originar({
  nombre: "Byron Alexander Sical",
  dpi: "2020 30304 0107",
  monto: "8000.00",
  plazo: 6,
  tasa: 0.36,
  fechaDesembolso: "2026-07-05",
}); // cuota 1 vence 2026-08-05 → 51 días → mora_2
await originar({
  nombre: "Catarina Chum Ixcoy",
  dpi: "3030 40405 0108",
  monto: "12000.00",
  plazo: 6,
  tasa: 0.36,
  fechaDesembolso: "2026-05-10",
}); // cuota 1 vence 2026-06-10 → 107 días → vencido

// ───────────────────────────────────────────────────────────────────────────
// FLUJO 12 · Cartera en riesgo y cierre diario
// ───────────────────────────────────────────────────────────────────────────
seccion("FLUJO 12 · Cartera en riesgo y cierre diario idempotente");
await llamar("GET", "/cartera-riesgo", { nota: "sin fechaCorte: debe fallar" });
await llamar("GET", `/cartera-riesgo?fechaCorte=${FECHA_CORTE}`, { nota: "desglose por tramo" });
await llamar("POST", "/cierres/diarios", { body: { fechaCorte: FECHA_CORTE }, nota: "primera ejecución" });
await llamar("POST", "/cierres/diarios", { body: { fechaCorte: FECHA_CORTE }, nota: "segunda ejecución: reproducido" });
await llamar("POST", "/cierres/diarios", {
  body: { fechaCorte: "2027-12-31" },
  nota: "corte en el futuro: debe fallar",
});

// ───────────────────────────────────────────────────────────────────────────
seccion("RESUMEN");
const porStatus = {};
for (const r of registro) porStatus[r.status] = (porStatus[r.status] ?? 0) + 1;
console.log(`Peticiones ejecutadas: ${registro.length}`);
console.log(`Por código HTTP: ${JSON.stringify(porStatus)}`);

const { writeFileSync } = await import("node:fs");
writeFileSync(new URL("./registro.json", import.meta.url), JSON.stringify(registro, null, 2));
console.log("Registro completo en registro.json");
