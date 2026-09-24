# Informe de pruebas end-to-end del SGMC

**Sistema de Gestión de Microcrédito · Crédito Vecino, S. A.**
Ejecutado el 25 de septiembre de 2026 · 12 flujos · 57 peticiones HTTP

> Este informe documenta el ejercicio del **servidor local de pruebas**, que queda fuera del
> alcance del Proyecto 2 (§5: *"queda fuera de esta entrega: backend, servidor HTTP, API
> implementada"*). No sustituye a `npm test`, que es lo que valida el núcleo. Su valor es otro:
> demuestra que el núcleo evolucionado se comporta igual cuando se lo ejercita de punta a punta, y
> produce **cifras reales** para el prototipo de E3, que no puede inventarlas.

---

## 1. Cómo se hizo

### Montaje

```bash
# 1. Estado limpio: los CSV se truncan a sus encabezados
for f in data/*.csv; do head -1 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done

# 2. Servidor local (node:http, persistencia en CSV, sin framework)
npm run server        # http://127.0.0.1:4000

# 3. Banco de flujos
node pruebas/e2e/flujos.mjs
```

El guion está versionado en `pruebas/e2e/flujos.mjs`. Usa `fetch` nativo de Node 22, sin
dependencias. Cada llamada registra método, ruta, cuerpo enviado, código HTTP y respuesta completa;
al terminar vuelca todo a `registro.json` y resume los códigos obtenidos.

### Criterio de diseño de los flujos

No se buscó el camino feliz. De los 12 flujos, **5 verifican que el sistema rechaza lo que debe
rechazar**: un pago sobre un crédito no desembolsado, una clave de idempotencia reutilizada con
otro contenido, un monto enviado como número JSON, una consulta de cartera sin fecha de corte y un
cierre con fecha futura. Un banco de pruebas que solo recorre el camino feliz no prueba nada.

### Una restricción que condicionó el diseño

La fecha real de ejecución es el **25 de septiembre de 2026**, y la política escalonada rige desde
el 1 de octubre de 2026. Para poder ejercitar las dos políticas a la vez hubo que otorgar el
crédito escalonado con fecha de desembolso futura y registrar sus pagos con fechas futuras también.
El servidor lo permite —las fechas de negocio las envía el cliente, nunca el reloj del servidor—
pero los cierres sí validan contra el día de hoy. Eso obligó a separar los flujos de mora (fechas
futuras) de los de cartera y cierre (fechas pasadas), con créditos distintos. Ver el hallazgo H-3.

### Cómo se aisló la comparación de políticas

Comparar la política plana con la escalonada exige que **la única diferencia sea la política**. Con
un plan de 12 cuotas es imposible: al llegar a los 45 días de atraso de una cuota, la siguiente ya
venció también y aporta su propia mora.

La solución fue usar créditos de **3 cuotas**, pagar puntualmente las dos primeras y dejar vencer
solo la última. Al ser la última, no hay ninguna cuota posterior que contamine el cálculo: la mora
observada es atribuible a un único capital y un único plazo de atraso.

---

## 2. Los doce flujos

| # | Flujo | Verifica | Resultado |
|---|---|---|---|
| 1 | Originación completa | cliente → solicitud → aprobación → desembolso → plan | ✅ 201 · plan de 12 cuotas correcto |
| 2 | Rechazo de solicitud | el comité rechaza; el crédito no nace | ✅ 200 · estado `rechazado` |
| 3 | Pago puntual | cuota exacta en su fecha, sin mora | ✅ 201 · moratorio Q0.00 |
| 4 | Mora con política **plana** | crédito otorgado el 15-ago-2026 | ✅ 201 · mora **Q102.97** |
| 5 | Mora con política **escalonada** | crédito otorgado el 10-oct-2026 | ✅ 201 · mora **Q85.81** |
| 6 | Reintento sin señal | misma `Idempotency-Key`, 3 veces | ✅ 201 → 200 → 200, `reproducido: true` |
| 7 | Clave reutilizada con otro monto | debe rechazarse | ✅ **409** `clave-idempotencia-reutilizada` |
| 8 | Pago de más | el excedente adelanta capital | ✅ 201 · excedente Q3,995.38 |
| 9 | Pago sobre crédito no desembolsado | estado `aprobado` no admite pagos | ✅ **422** `estado-no-admite-pago` |
| 10 | Validación del contrato | monto numérico, clave no-UUID, crédito inexistente | ✅ 400, 400, 404 |
| 11 | Tres créditos impagos | cada uno en un tramo distinto al corte | ✅ 201 × 3 |
| 12 | Cartera y cierre diario | corte, reejecución y fecha futura | ✅ 200 / 201 → 200 / 422 |

**Distribución de códigos HTTP:** `201` ×32 · `200` ×18 · `400` ×3 · `422` ×2 · `409` ×1 · `404` ×1.

Todos los errores respondieron `application/problem+json` conforme a la RFC 9457, con `type`,
`title`, `status`, `detail`, `instance` y `traceId`.

---

## 3. Resultados que el prototipo puede usar

### Plan de amortización — caso de referencia (Q10,000.00 · 36 % · 12 cuotas)

| Cuota | Vencimiento | Cuota | Interés | Amortización | Saldo final |
|---|---|---|---|---|---|
| 1 | 2026-11-10 | Q1,004.62 | Q300.00 | Q704.62 | Q9,295.38 |
| 2 | 2026-12-10 | Q1,004.62 | Q278.86 | Q725.76 | Q8,569.62 |
| 3 | 2027-01-10 | Q1,004.62 | Q257.09 | Q747.53 | Q7,822.09 |
| … | | | | | |
| 11 | 2027-09-10 | Q1,004.62 | Q57.67 | Q946.95 | Q975.37 |
| **12** | 2027-10-10 | **Q1,004.63** | Q29.26 | Q975.37 | **Q0.00** |

La cuota 12 es un centavo mayor: es el ajuste de cuadre que lleva el saldo a cero exacto en vez de
arrastrar el redondeo por las once cuotas anteriores.

### Desglose de un pago — pantalla "Registro de pago"

Pago de Q2,000.00 sobre una cuota de Q3,432.34 con 45 días de atraso:

```
gastos              Q     0.00
interés moratorio   Q   102.97
interés corriente   Q   102.97
capital             Q 1,794.06
excedente           Q     0.00
                    ───────────
saldo después       Q 1,638.28     estado: en_mora     tramo: mora_2
```

### CP-03 en vivo — dos políticas, el mismo día, el mismo sistema

Dos créditos idénticos (Q10,000.00 · 36 % · 3 cuotas), misma cuota final de capital Q3,432.34,
mismos 45 días de atraso. Lo único distinto es la fecha de otorgamiento:

| Crédito | Otorgado | Política | Moratorio |
|---|---|---|---|
| C-002 | 2026-08-15 | Plana 24 % — `POL-2024-01` | **Q102.97** |
| C-003 | 2026-10-10 | Escalonada — `POL-2026-10` | **Q85.81** |

La escalonada cobra **16.7 % menos** en un atraso moderado. Es exactamente el efecto que buscaba el
Acta 09-2026 al distinguir el descuido del deterioro, y la misma proporción que los oráculos
Q21.77 / Q18.14 del enunciado sobre otro capital.

Verificación aritmética:

```
plana       343 234 × (0.24/360) × 45                      = 10 297.02 → Q102.97
escalonada  343 234 × 0.000500000 × 30  =  5 148.51
          + 343 234 × 0.000666667 × 15  =  3 432.34
                                           ─────────
                                            8 580.85 → Q 85.81
```

Redondeo una sola vez al cerrar la cuota, no por tramo.

### Idempotencia — pantalla "Registro de pago sin señal"

Tres envíos idénticos con la misma `Idempotency-Key`:

| Intento | HTTP | `pagoId` | `reproducido` | Saldo después |
|---|---|---|---|---|
| 1.º | **201** | PG-000008 | `false` | Q8,569.62 |
| 2.º | **200** | PG-000008 | `true` | Q8,569.62 |
| 3.º | **200** | PG-000008 | `true` | Q8,569.62 |

Un solo `pagoId`, un solo cargo. El cuarto envío, con la misma clave pero monto Q500.00, devolvió
**409**: la clave no es un permiso para sobrescribir, es la huella de una operación concreta.

---

## 4. Hallazgos

### H-1 · La cartera en riesgo del adaptador incluye Mora 1 — severidad alta

`GET /cartera-riesgo?fechaCorte=2026-09-25` devolvió:

```json
"saldoEnRiesgo": { "valor": "26000.00" },
"porTramo": [
  { "tramo": "mora_1",  "creditos": 1, "saldoCapital": "6000.00"  },
  { "tramo": "mora_2",  "creditos": 1, "saldoCapital": "8000.00"  },
  { "tramo": "vencido", "creditos": 1, "saldoCapital": "12000.00" }
]
```

Según §7.8, la cartera en riesgo son **solo los de más de 30 días, más los reestructurados**. El
crédito en Mora 1 (5 días de atraso, Q6,000.00) **no debería contar**. El valor correcto es
**Q20,000.00**, no Q26,000.00: el indicador está sobreestimado en un 30 %.

**Causa:** el adaptador sigue consumiendo `src/dominio/cartera.ts`, del Proyecto 1, que define el
riesgo como *"todo tramo distinto de ninguno"*. El núcleo evolucionado ya lo hace bien en
`src/dominio/cartera-por-tramo.ts` —CP-04.3, con su oráculo de 7.00 % verificado en
`tests/cartera-por-tramo.test.ts`— pero **el adaptador no se recableó**.

No es una regresión: es exactamente el hueco que CP-04.3 documenta, visible de punta a punta.
Recablear el adaptador está fuera del alcance de E6, que es código de dominio; queda declarado
aquí y en el informe de impacto (§4.4).

### H-2 · `porcentajeEnRiesgo` viaja como fracción, no como porcentaje

La respuesta trae `"porcentajeEnRiesgo": 0.7858`. Un campo llamado *porcentaje* que vale `0.7858`
cuando el porcentaje es 78.58 % es una ambigüedad de las que cuestan caro: el que lo pinte en el
tablero tiene 50 % de probabilidades de mostrar "0.79 %" donde debía decir "78.58 %".

El §7.8 advierte justamente sobre esto en el tablero gerencial. Conviene decidir una representación
—fracción o porcentaje— y que el nombre del campo la diga.

### H-3 · Validación asimétrica de fechas entre pagos y cierres

`POST /cierres/diarios` con `fechaCorte: "2027-12-31"` devolvió **422** — correcto, no se puede
cerrar un día que no ha ocurrido. Pero `POST /creditos/{id}/pagos` aceptó sin objeción una
`fechaPago` de **2027-02-10**, más de un año en el futuro.

La asimetría es real: la fecha del pago la envía el cliente por diseño —el asesor cobra el jueves
en campo y sincroniza el sábado— pero eso justifica fechas **pasadas**, no futuras. Un pago
fechado en el futuro produce días de atraso negativos y mora subestimada.

El núcleo está protegido: `calcularInteresMoratorio()` trata cualquier atraso ≤ 0 como cero, y hay
una prueba que lo fija. La brecha es de validación en el borde, no de cálculo.

### H-4 · Lo que funcionó y conviene dejar por escrito

- **DPI duplicado rechazado.** Una segunda alta con la misma identificación devolvió 422
  `identificacion-duplicada` señalando el `clienteId` que ya la tenía. Se descubrió por accidente,
  al ejecutar el banco de pruebas dos veces sin limpiar los datos.
- **El cierre es idempotente.** Segunda ejecución del mismo día: 200 con `reproducido: true` y
  `generadoEn` **idéntico** al de la primera. Las cifras quedan congeladas, no se recalculan.
- **Ningún endpoint decide una fecha de negocio.** Todas las fechas viajan en la petición.
- **El dinero nunca viaja como número.** `{"valor": 1004.62}` fue rechazado con 400 y el error
  apuntó al campo exacto: `monto.valor`.

---

## 5. Conclusión

Los doce flujos se ejecutaron sin una sola falla inesperada. Los 57 códigos HTTP corresponden todos
a lo que el contrato define, incluidos los seis casos de error, que devolvieron `problem+json` con
el tipo de problema correcto.

El núcleo evolucionado se comporta de punta a punta como lo describen sus pruebas unitarias: las
dos políticas moratorias coexisten resueltas por fecha de otorgamiento, la prelación respeta su
orden, el excedente se adelanta a capital y la clave de idempotencia impide el doble cobro.

Los tres hallazgos abiertos están **todos en el borde HTTP**, no en el dominio. El más importante,
H-1, es la manifestación visible de una brecha que el informe de impacto ya declara: el núcleo se
evolucionó y el adaptador quedó atrás. Para el Proyecto Final, donde la interfaz sí se implementa,
recablear `GET /cartera-riesgo` a `calcularDesgloseCartera()` debería ser el primer pendiente —el
tablero gerencial depende de ese número, y hoy está sobreestimado en un 30 %.

---

## Anexo · Reproducir este informe

```bash
for f in data/*.csv; do head -1 "$f" > "$f.tmp" && mv "$f.tmp" "$f"; done
npm run server &
node pruebas/e2e/flujos.mjs
```

El guion es determinista salvo por las claves de idempotencia (UUID v4) y los sellos de tiempo de
auditoría. El registro completo de las 57 peticiones queda en `registro.json`.
