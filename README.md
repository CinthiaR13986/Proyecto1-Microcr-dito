# SGMC — Sistema de Gestión de Microcrédito · Crédito Vecino, S. A.

Repositorio del proyecto integrador de **Análisis de Sistemas II (037)** — Universidad Mariano Gálvez de Guatemala.

Es el **mismo sistema y el mismo repositorio** del Proyecto 1 (regla de incrementalidad, enunciado del P2 §1). El Proyecto 2 no reescribe nada: evoluciona el núcleo y mide cuánto costó esa evolución.

| | |
|---|---|
| **Entrega** | Proyecto 2 — UX/UI, movilidad y evolución del núcleo · 10 puntos |
| **Fecha límite** | viernes 25 de septiembre de 2026, por Canvas |
| **Línea base del P1** | tag `entrega-p1` → commit `c3cdd74` |
| **Stack del núcleo** | TypeScript (strict) + Vitest · sin servidor, sin base de datos, sin UI |

---

## 1. Estado actual del repositorio

Lo que **ya existe** (heredado del Proyecto 1, sin modificar):

```
src/
├── contratos/          # Esquemas Zod = única fuente de verdad del contrato de API
│   ├── comunes.ts      #   Dinero, FechaISO, IdempotencyKey, ProblemDetails, EstadoCredito, TramoMora
│   ├── clientes.ts · solicitudes.ts · creditos.ts · pagos.ts · cierres.ts · cartera.ts
├── dominio/            # ◄── EL NÚCLEO. Es lo único que el Proyecto 2 puede tocar.
│   ├── amortizacion.ts #   Plan francés, ajuste de cuadre en la última cuota
│   ├── pagos.ts        #   Prelación: gastos → moratorio → corriente → capital
│   ├── mora.ts         #   clasificarTramo() + calcularDiasAtraso()
│   └── cartera.ts      #   Agregados de cartera activa / en riesgo / por tramo
├── db/                 # Persistencia CSV del servidor local de pruebas (fuera de alcance)
├── servidor/           # Servidor node:http local de pruebas (fuera de alcance)
├── util/               # dinero.ts (centavos enteros) · fechas.ts (UTC) · csv.ts
├── openapi.ts · generar.ts · validar.ts
tests/
└── regresion-p1.test.ts   # 21 pruebas que fijan los oráculos del P1 ✅
docs/
├── adr/ADR-001…003.md
├── FLUJOS-DE-EJEMPLO.md
└── (PDF del enunciado del P2 y de la propuesta del P1, como referencia)
```

Comandos:

```bash
npm install
npm test          # Vitest — el núcleo, sin servidor ni base de datos
npm run typecheck # TypeScript en modo strict
npm run generar   # Zod → openapi.json + openapi.yaml
npm run server    # servidor local de pruebas (NO forma parte de la entrega)
```

### Diagnóstico honesto del núcleo heredado

Tres hallazgos que condicionan todo el trabajo de E6 y que van **tal cual** al informe de impacto:

| # | Hallazgo | Consecuencia |
|---|---|---|
| H-1 | `dominio/pagos.ts` recibe la tasa moratoria como un `number` suelto, no como una política. No hay interfaz, ni versión, ni vigencia. | El ADR-003 declaró Strategy + políticas versionadas, pero el código **no lo implementa** para la mora. Absorber CP-01 exige crear la abstracción que faltaba. |
| H-2 | `servidor/pagos.ts:82` pasa `tasaAprobadaAnual` (36 % ordinaria) como tasa **moratoria**, cuando la política del P1 era 24 %. | El adaptador confunde dos tasas distintas. El núcleo sí acepta el parámetro correcto — la prueba de los Q7.26 pasa cuando se le inyecta 0.24. Es un bug de cableado, no de dominio. |
| H-3 | `aplicarPago()` devuelve `gastos: 0` como literal. | El primer eslabón de la prelación nunca se ejercitó (es exactamente lo que el enunciado señala en §7.5). CP-02 lo cierra. |

El enunciado califica **el diagnóstico, no el resultado** (§8.3): reportar esto con su diff vale más que declarar cero cambios sin evidencia.

---

## 2. Lo que falta — hoja de ruta

### E6 · Evolución del núcleo (lo único que se programa) — 2.0 pts

Archivos **nuevos** a crear en `src/dominio/`:

```
src/dominio/
├── politica-mora/
│   ├── politica-mora.ts         # ✅ Puerto: interfaz PoliticaMoratoria (inyectada, nunca importada por nombre)
│   ├── politica-plana.ts        # ✅ 24 % plano — la del P1, se conserva viva
│   ├── politica-escalonada.ts   # ✅ NUEVA: tramos recorridos (§7.2 y §7.3)
│   ├── politica-retroactiva.ts  # ✅ NUEVA: solo para la prueba de Liskov (NO es regla del sistema)
│   └── catalogo-politicas.ts    # ✅ Resuelve la política por fecha de otorgamiento (CP-03)
├── clasificacion-tramo.ts       # ✅ Specification: días de atraso → tramo
├── gasto-gestion-cobro.ts       # ✅ CP-02, Q25.00 idempotente por cuota vencida
├── maquina-estados.ts           # ✅ CP-04.1, transiciones con guardas
├── devengo-interes.ts           # ✅ CP-04.2, suspensión del devengo e interés en suspenso
├── cartera-por-tramo.ts         # ✅ CP-04.3, desglose del tablero
├── estados.ts                   # ✅ EstadoCredito en el lenguaje del dominio
└── calculadora-mora.ts          # ✅ El motor. A partir de aquí NO debe volver a cambiar
```

Cambios de requisito a implementar:

- ✅ **CP-01 · Política escalonada.** Cada tramo con su TNA: Mora 1 = 18 %, Mora 2 = 24 %, Mora 3 = 30 %, Vencido = 36 %, Incobrable = no devenga. Base Actual/360.
- ✅ **CP-01b · Tramos recorridos, no tramo actual.** 45 días = 30 días en Mora 1 + 15 en Mora 2. Se redondea **una sola vez** al cerrar la cuota, jamás tramo por tramo (redondear por tramo: −0.5 pts).
- ✅ **CP-02 · Gasto de gestión de cobro.** Q25.00 fijos por cuota vencida, generado **una sola vez** al llegar a 31 días. Reejecutar el cierre no lo duplica.
- ✅ **CP-03 · Coexistencia de políticas.** Créditos otorgados antes del 1-oct-2026 → plana 24 %. Desde esa fecha → escalonada. Ambas conviven en el mismo cierre, resueltas por despacho polimórfico (no por `switch`).
- ✅ **CP-04.1** · Transición `en_mora → cancelado` (guarda: saldo Q0.00 exacto y sin cuotas vencidas).
- ✅ **CP-04.2** · Suspensión del devengo a los 91 días: lo no reconocido se acumula en `interesEnSuspenso` (cuenta de orden, nunca ingreso) y se reconoce al regularizar.
- ✅ **CP-04.3** · Desglose de cartera en riesgo **por tramo** desde el núcleo (el tablero lo consume, no lo recalcula).

Pruebas en `tests/` — **126 en verde**:

| Archivo | Pruebas | Qué cubre |
|---|---|---|
| `regresion-p1.test.ts` | 21 | Los oráculos del P1 congelados. **No se modifica nunca.** |
| `politica-mora.test.ts` | 28 | M-1 a M-4, CP-03, invariantes de §7.9 |
| `contrato-politica.test.ts` | 30 | Liskov: la misma batería × 3 políticas |
| `gasto-gestion-cobro.test.ts` | 14 | CP-02 e idempotencia, caso M-5 |
| `estados-y-devengo.test.ts` | 16 | CP-04.1 y CP-04.2 |
| `cartera-por-tramo.test.ts` | 17 | CP-04.3, oráculo de §7.8 |

Documentos:

- ✅ `docs/informe-impacto-solid.md` — Anexo D: métricas con `git diff --stat`, los cinco principios con evidencia, GRASP, puntos de fricción, salida de `npm test`, conclusión.
- ✅ `docs/adr/ADR-004-politica-mora-escalonada.md`.

### Oráculos obligatorios (Anexo E — no se negocian)

Base Actual/360 · capital en mora Q725.76 · interés corriente Q278.86.

| Caso | Escenario | Resultado |
|---|---|---|
| M-1 | 15 días, escalonada | **Q5.44** |
| M-2 | 45 días, escalonada | **Q18.14** (no Q18.15) |
| M-3 | 100 días, escalonada | **Q50.80** |
| M-4 | 120 días, escalonada | **Q65.32** |
| M-5 | Total adeudado cuota 2 a 45 días, con gasto | **Q1,047.76** ✅ |
| CP-03 | 45 días, plana 24 % | **Q21.77** ✅ ya fijado |
| P1 | 15 días, plana 24 % | **Q7.26** ✅ ya fijado |
| §7.8 | Cartera en riesgo | **7.00 %** = 3.00 + 2.25 + 1.00 + 0.75 |
| §7.8 | Cartera en mora | **21.75 %** — indicador **distinto**, jamás rotular igual |

### E1–E5, E7 · Lo que no se programa

| Entregable | Qué falta | Peso |
|---|---|---|
| ⬜ **E1** Investigación de usuario | 2–3 personas fundamentadas (asesor, cliente, gerencia) + journey map + 4 momentos críticos, incluido *cuándo descubre el cliente que subió de tramo*. | 1.5 pts |
| ⬜ **E2** Arquitectura de información | Mapa de navegación, tabla pantalla ↔ caso de uso completa, wireframes de baja fidelidad **antes** del alta fidelidad. | — |
| ⬜ **E3** Prototipo Figma navegable | 7 pantallas + 3 flujos clicables. Cifras **reales del núcleo**, no inventadas (−0.5 pts). | 2.5 pts |
| ⬜ **E4** Decisión móvil/web | Nativa vs híbrida vs PWA, argumentada. Estrategia sin conexión anclada a la **clave de idempotencia** y al **puerto Reloj** del P1. | 1.5 pts |
| ⬜ **E5** Nielsen + WCAG 2.2 AA | ≥8 hallazgos con severidad, evaluación independiente de los 4, auditoría de los 6 criterios A/AA nuevos + 3.3.4, ≥5 correcciones antes/después. | 2.5 pts |
| ⬜ **E7** Documento y repositorio | PDF `P2_UXUI_NoDeGrupo.pdf` consolidando E1–E6, enlaces abiertos, reparto de trabajo, declaración de uso de IA. | — |

Pantallas obligatorias de E3: solicitud de crédito · detalle del crédito · registro de pago · plan de amortización · **detalle de la mora** (desglose por tramos recorridos del caso M-3) · tablero gerencial · cierre diario/mensual.

**E6 se termina antes que E3**: el tablero y la pantalla de mora muestran cifras que salen del núcleo evolucionado. Si E6 llega al final, el prototipo se diseña con números inventados — y eso está penalizado.

---

## 3. Reglas que no se pueden romper

- **Prohibido en el núcleo:** servidor HTTP, base de datos, UI, autenticación, RAG, MCP. Importar `express` o `pg` **se penaliza**. PostgreSQL y Fastify entran hasta el Proyecto Final.
- **Prohibido leer el reloj del sistema dentro del núcleo.** La fecha de corte es un parámetro (puerto Reloj). Con mora escalonada importa más que nunca: el tramo depende de la fecha.
- **Prohibido `any`.** `"strict": true` obligatorio en `tsconfig.json`.
- **Prohibido reescribir las pruebas del P1 para que pasen.** Si `regresion-p1.test.ts` se pone rojo, se arregla el núcleo. Alterar el historial para simular un impacto menor es falta de integridad académica (§15).
- `npm install && npm test` debe correr en limpio.

## 4. Cómo se mide el éxito de E6 (§8.1)

| Métrica | Objetivo | Resultado |
|---|---|---|
| Archivos del núcleo **creados** | alto es bueno | **12** |
| Archivos del núcleo **modificados** | ≤ 2 | **1** ✅ |
| ¿Se modificó el motor de cálculo de mora? | No | **Sí, una vez: para extraerlo** |
| Pruebas del P1 que dejaron de pasar | 0 | **0** ✅ |
| Pruebas del P1 reescritas | 0 | **0 valores**, 1 punto de llamada |
| Líneas netas añadidas a `src/dominio/` | 60–120 orientativo | **+853/−8** (423 de código) |

Se reproduce con:

```bash
git diff --stat entrega-p1..HEAD -- src/dominio/
```

## 5. Historial de commits

| Commit | Contenido |
|---|---|
| `c3cdd74` · tag `entrega-p1` | Línea base: la entrega del Proyecto 1, sin modificar |
| `662b4a8` | Infraestructura de pruebas + red de regresión de los oráculos del P1 |
| `bb1aec4` | CP-01 + CP-03: política de mora como Strategy inyectada |
| `358d993` | Informe de impacto SOLID + ADR-004 |
| `79bd559` | CP-02 + CP-04: gasto de gestión, estados, devengo y cartera por tramo |

Medición final del núcleo — **12 archivos creados, 1 modificado** (`dominio/pagos.ts`: deja de calcular la mora y cobra los gastos como primer eslabón). Las 21 pruebas del P1 siguen pasando; se adaptó **un** punto de llamada, sin tocar un solo valor esperado.

Dos defectos que encontró la batería de Liskov y que se corrigieron en el diseño, no en la prueba:

1. La política retroactiva "alcanzaba" el tramo incobrable a los 121 días y hacía **desaparecer** todo el moratorio ya causado — rompía la monotonía. Ahora el tramo alcanzado se topa en el último día devengable.
2. Que un crédito incobrable deje de devengar estaba codificado como una tasa 0 **en la tabla de cada política**. La primera política que lo olvidara seguiría cobrándole a un crédito ya dado de baja. Se movió al motor, que lo aplica como regla del Sistema.

> El `.gitignore` del P1 excluía `src/dominio/` porque el entregable E5 era solo el contrato de API. Se versiona desde la línea base: sin él en el historial, `git diff --stat sobre src/dominio/` mostraría cada archivo evolucionado como archivo nuevo y la métrica de "archivos modificados" sería falsa.

## 6. Uso de herramientas de IA

Conforme al §15 del enunciado, el equipo declara en el documento final el uso de herramientas de IA como apoyo. Las decisiones de diseño, su justificación y la capacidad de explicar cualquier línea del núcleo son responsabilidad del equipo.

## 7. Entrega final

Fecha de entrega: viernes 25 de septiembre de 2026. Todas las metricas de E6 verdes. Los siete entregables (E1-E7) consolidados en `P2_UXUI_NoDeGrupo.pdf`.
