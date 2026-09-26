# Informe de impacto SOLID — Proyecto 2

**Sistema de Gestión de Microcrédito · Crédito Vecino, S. A.**
Análisis de Sistemas II (037) · Universidad Mariano Gálvez de Guatemala
Entregable E6 · Cambio de requisito: política de mora escalonada

> Este informe mide cuánto costó absorber un cambio de requisito no previsto. No afirma que el
> diseño del Proyecto 1 fuera correcto: reporta lo que el repositorio demuestra, incluido lo que
> el Proyecto 1 había declarado y no había implementado.

---

## 1. Punto de partida

| Hito | Referencia |
|---|---|
| Línea base del **Proyecto 1** | `87a621431766dd9d2ca15812407f6baf1b219e8c` — *docs: nota de línea base P1 en README* |
| Último commit de código del **núcleo** | `29a7378` — *CP-04.3 cartera-por-tramo desde el núcleo* |
| Commit de cierre del **Proyecto 2** | `dd1f133e42e0be19ee590fa178348ccbc433f28c` |

Toda la medición de este informe se reproduce con:

```bash
git diff --stat 87a6214..HEAD -- src/dominio/
```

### Nota sobre la línea base

El repositorio del Proyecto 2 se construyó importando la entrega del Proyecto 1 y commiteándola
antes de tocar nada. El commit `87a6214` es el último del estado P1: a partir de ahí, todo lo que
aparece en el diff es trabajo del Proyecto 2.

El núcleo (`src/dominio/`) está versionado **desde la línea base** —`amortizacion.ts`, `cartera.ts`,
`mora.ts` y `pagos.ts` ya están en `87a6214`— y eso es lo que hace real la métrica de archivos
modificados. Si el núcleo hubiera entrado al repositorio junto con los cambios del P2, cada archivo
evolucionado aparecería en el diff como archivo *nuevo* y la métrica habría dado cero por un
artefacto del control de versiones, no por calidad del diseño.

### Nota sobre las pruebas del Proyecto 1

**El Proyecto 1 se entregó sin pruebas automatizadas.** Sus oráculos —la cuota de Q1,004.62, el
ajuste de Q1,004.63, los Q7.26 de mora a 15 días— vivían en el documento de arquitectura, no en el
repositorio.

Por eso el primer commit del Proyecto 2 no evoluciona nada: `3eb06c0` (**7 de septiembre**) escribe
`tests/regresion-p1.test.ts`, 21 pruebas que fijan esos oráculos **contra el núcleo del P1 sin
modificar**, y las deja en verde. El primer cambio del núcleo es `1c32d25`, del **8 de septiembre**.

El orden importa y es verificable en el historial: una suite de regresión escrita después del
cambio no prueba nada, porque se escribe mirando el resultado que ya salió.

```bash
git log --date=short --format="%ad %h %s" 87a6214..HEAD --no-merges | sort | head -3
# 2026-09-07 3eb06c0 test: red de regresion con los 21 oraculos del P1 + infra Vitest
# 2026-09-08 049fab7 feat(dominio): politica plana 24% (equivalencia con el motor del P1)
# 2026-09-08 1c32d25 feat(dominio): interfaz PoliticaMoratoria (puerto, se inyecta)
```

---

## 2. Métricas del cambio

| Métrica | Resultado | Objetivo |
|---|---|---|
| Archivos del núcleo **creados** | **12** | neutro o bueno |
| Archivos del núcleo **modificados** | **1** — `src/dominio/pagos.ts` | ≤ 2 ✅ |
| ¿Se modificó el motor de cálculo de mora? | **Sí, una vez: para extraerlo.** Ver §4 | No |
| Pruebas del P1 que dejaron de pasar | **0** | 0 ✅ |
| Pruebas del P1 que hubo que reescribir | **0 valores esperados** · 1 punto de llamada adaptado | 0 ⚠️ |
| Líneas netas añadidas al núcleo | **+853 / −8** (423 de código, 342 de documentación, 88 en blanco) | 60–120 orientativo |

### `git diff --stat 87a6214..HEAD -- src/dominio/`

```
 src/dominio/calculadora-mora.ts                   |  81 +++++++++++
 src/dominio/cartera-por-tramo.ts                  | 112 +++++++++++++++
 src/dominio/clasificacion-tramo.ts                |  96 +++++++++++++
 src/dominio/devengo-interes.ts                    |  65 +++++++++
 src/dominio/estados.ts                            |  30 ++++
 src/dominio/gasto-gestion-cobro.ts                |  57 ++++++++
 src/dominio/maquina-estados.ts                    | 167 ++++++++++++++++++++++
 src/dominio/pagos.ts                              |  37 +++--
 src/dominio/politica-mora/catalogo-politicas.ts   |  39 +++++
 src/dominio/politica-mora/politica-escalonada.ts  |  54 +++++++
 src/dominio/politica-mora/politica-mora.ts        |  52 +++++++
 src/dominio/politica-mora/politica-plana.ts       |  33 +++++
 src/dominio/politica-mora/politica-retroactiva.ts |  38 +++++
 13 files changed, 853 insertions(+), 8 deletions(-)
```

**Un solo archivo del Proyecto 1 modificado, con cuatro cambios de requisito absorbidos.** Los 12
restantes son archivos nuevos. Esa proporción es la métrica que importa: la funcionalidad nueva
vivió en archivos nuevos.

Sobre el volumen: 423 líneas de código y 342 de comentarios que documentan reglas de negocio. El
enunciado orienta a 60–120 líneas nuevas para *el cambio de política*; esa parte —la política
escalonada— son 33 líneas. Las otras 390 son CP-02, CP-04.1, CP-04.2 y CP-04.3, que el mismo
enunciado pide además de CP-01. El desglose por archivo del `--stat` de arriba permite verificarlo.

### Sobre la única prueba adaptada

`aplicarPago()` recibía la tasa moratoria como `number`; ahora recibe la política inyectada. Eso
cambió **cómo** se le pasa la tasa al núcleo, no **cuánto** cobra:

```diff
- const resultado = aplicarPago([cuotaDosVencida()], 101_188, "2026-09-06", 0.24);
+ const resultado = aplicarPago([cuotaDosVencida()], 101_188, "2026-09-06", POLITICA_MORATORIA_P1);
  expect(desdeCentavos(resultado.interesMoratorio)).toBe("7.26");   // ← intacto
```

Ningún valor esperado se tocó. Los Q7.26 y los Q21.77 siguen siendo exactamente los del Proyecto 1.
Se declara aquí, y no se presenta como "cero pruebas reescritas", porque el enunciado pide
justificar cada caso.

---

## 3. Los cinco principios, uno por uno

### S — Responsabilidad única

> *¿Quién decide en qué tramo está una cuota, y quién decide cuánto cuesta ese tramo? ¿Son la misma clase?*

**No son la misma pieza, y cada una se prueba por separado.**

| Pieza | Archivo | Única pregunta que responde |
|---|---|---|
| Specification | `src/dominio/clasificacion-tramo.ts` | ¿En qué tramo cae este día de atraso? |
| Strategy | `src/dominio/politica-mora/politica-escalonada.ts` | ¿Cuánto cuesta un día de ese tramo? |
| Motor | `src/dominio/calculadora-mora.ts` | Recorrer, sumar y redondear una vez |

La clasificación no conoce ninguna tasa. La tabla de tasas no sabe clasificar ni sumar. Evidencia
directa: `clasificacion-tramo.ts` no importa nada del directorio `politica-mora/`, y
`politica-escalonada.ts` son 33 líneas de código sin un solo bucle.

El mismo criterio se aplicó a los cambios de CP-04: `maquina-estados.ts` decide transiciones y no
calcula saldos —los recibe en un contexto—; `devengo-interes.ts` decide a qué cuenta va el interés
y no lo calcula; `cartera-por-tramo.ts` agrega y no clasifica, porque reutiliza
`clasificarTramoDeAtraso()`.

Caso aparte es `gasto-gestion-cobro.ts`, donde la responsabilidad única produjo la solución al
problema de idempotencia. El gasto **no se modela como un evento que se dispara y acumula**, sino
como una cantidad derivada del atraso: *a una cuota con 31 días o más le corresponde exactamente un
gasto*. Reejecutar el cierre recalcula el mismo número en vez de sumar otro, así que la
idempotencia deja de ser una precaución que alguien puede olvidar y pasa a ser estructural. Hay una
prueba que corre 120 cierres consecutivos y verifica que el acumulado sigue siendo Q25.00.

### O — Abierto/cerrado

> *¿Pudo agregar la política escalonada sin abrir el motor de cálculo?*

**Sí, con un matiz que hay que declarar: en el Proyecto 1 no existía un motor separado que abrir.**

El cálculo de mora vivía incrustado dentro de `aplicarPago()`, en una sola línea:

```ts
const moraCuota = diasAtrasoCuota > 0
  ? Math.round((cuota.capitalPendiente * tasaAnual * diasAtrasoCuota) / 360)
  : 0;
```

Ese `tasaAnual` suelto es el motor del P1. Para admitir tramos hubo que extraerlo a
`calculadora-mora.ts`. **Esa extracción es el costo real del cambio**, y es el único archivo del
P1 que se modificó.

Lo que sí se puede verificar hoy es que el motor quedó cerrado a modificación:

```bash
$ grep -nE "0\.(18|24|30|36)|/ *360" src/dominio/calculadora-mora.ts
  (ninguna coincidencia: el motor no contiene tasas)

$ grep -nE "switch|instanceof" src/dominio/calculadora-mora.ts
  (ninguna coincidencia)

$ grep -n "^import" src/dominio/calculadora-mora.ts
  import { devengaMoratorio, tramosRecorridos, type TramoAtraso } from "./clasificacion-tramo.ts";
  import type { PoliticaMoratoria } from "./politica-mora/politica-mora.ts";
```

La **tercera** política (`politica-retroactiva.ts`) entró sin tocar una línea del motor, y es la
más distinta de las tres. Cambiar el 30 % de Mora 3 mañana es editar una tabla de datos en
`politica-escalonada.ts`; el motor no se recompila ni se lee.

### L — Sustitución de Liskov

> *¿Puede intercambiar la política plana, la escalonada y la retroactiva sin que ninguna rompa los invariantes del motor?*

`tests/contrato-politica.test.ts` ejecuta **una sola batería de 10 pruebas contra las tres
implementaciones** (30 pruebas en total), mediante `describe.each`. Invariantes verificados:
monotonía, tope de capital, redondeo único, pureza, proporcionalidad al capital, congelamiento en
la incobrabilidad y respuesta a todos los tramos sin lanzar "no soportado".

**La batería encontró dos defectos reales. Se corrigieron en el diseño, no en la prueba:**

1. **La política retroactiva hacía desaparecer el moratorio ya causado.** Al llegar a 121 días
   "alcanzaba" el tramo incobrable, cuya tasa es 0, y aplicaba ese 0 a los 120 días anteriores: el
   moratorio caía de Q87.09 a Q0.00. Violaba el invariante de monotonía del §7.9. *Corrección:* el
   tramo alcanzado se topa en el último día devengable (`tramoDevengableAlcanzado()`).

2. **Que un crédito incobrable deje de devengar estaba codificado en la tabla de cada política.**
   Cada implementación tenía que acordarse de poner su tasa en cero; la primera que lo olvidara
   seguiría cobrándole a un crédito ya dado de baja contable, en silencio. *Corrección:* se movió
   al motor como regla del Sistema (`devengaMoratorio()` en `clasificacion-tramo.ts`).

El segundo hallazgo es el más valioso del ejercicio: era un invariante que el puerto **delegaba en
la buena voluntad de cada implementación**. Una prueba de contrato es exactamente lo que lo
detecta.

### I — Segregación de interfaces

> *¿El puerto de política de mora expone solo lo que el motor necesita, o arrastra métodos que ninguna implementación usa?*

El puerto completo, en `src/dominio/politica-mora/politica-mora.ts`:

```ts
export interface PoliticaMoratoria {
  readonly version: VersionPolitica;
  tasaDiaria(tramo: TramoAtraso, diasAtrasoTotal: number): number;
}
```

Un miembro de datos y un método. **Ninguna de las tres implementaciones lanza "no soportado"**, y
hay una prueba que lo verifica recorriendo todos los tramos de la escala contra las tres.

El segundo parámetro, `diasAtrasoTotal`, merece declaración honesta: la plana y la escalonada lo
ignoran. Existe porque la retroactiva lo necesita —su tasa depende del tramo alcanzado, no del
tramo del día—. Es el precio de que las tres sean intercambiables; la alternativa era que cada
política implementara su propia suma, lo que habría duplicado la lógica del motor tres veces.

### D — Inversión de dependencias

> *¿El motor depende de la abstracción de política, o de una implementación concreta?*

El motor importa `PoliticaMoratoria` con `import type`, que TypeScript **borra en compilación**: en
tiempo de ejecución `calculadora-mora.ts` no tiene ninguna referencia a ningún módulo de política.
No construye políticas, no las importa por nombre concreto y no conoce el catálogo.

La política entra como tercer parámetro de `calcularInteresMoratorio()` y atraviesa
`aplicarPago()` sin que ninguno de los dos sepa cuál es. Quien decide es el adaptador:

```ts
// src/servidor/pagos.ts
const politicaMoratoria = resolverPoliticaMoratoria(credito.fechaDesembolso);
```

---

## 4. Puntos de fricción

### 4.1 El Proyecto 1 declaró Strategy y no lo implementó

El **ADR-003** del Proyecto 1 dice, textualmente, que las variaciones de comportamiento "se
resuelven mediante el patrón **Strategy**, sin condicionales dispersos en el dominio", y que un
cambio de tasa moratoria "no altera retrospectivamente los créditos otorgados bajo una política
anterior".

El código no lo implementaba para la mora. La tasa era un `number` que el caso de uso pasaba hasta
el cálculo, sin versión, sin vigencia y sin autor. **No había forma de que dos créditos con
políticas distintas coexistieran**, que es justo lo que exige CP-03.

Esta es la brecha entre el documento y el repositorio que el Proyecto 2 estaba diseñado para
revelar. El archivo que hubo que abrir —`pagos.ts`— se abrió por esta causa.

**La brecha es más amplia que la mora.** Al auditar las rutas que citan los documentos del
Proyecto 1 aparecieron dos archivos que **no están presentes en esta rama**:

| Documento del P1 | Archivo que cita | Estado en esta rama |
|---|---|---|
| `adr/ADR-001.md` · `docs/diseno-e3.md` | `puertos.ts` — puertos `Reloj`, `RepositorioCreditos`, `GeneradorIds` | ausente |
| `docs/diseno-e3.md` (evidencia de SRP) | `prelacion-pago.ts` | ausente; la prelación vive dentro de `pagos.ts` |

**Importante, para no sacar la conclusión equivocada:** ambos archivos **sí existen** en la rama
`main` del repositorio del equipo, con el puerto `Reloj` declarado como interfaz. Lo que hay aquí no
es un diseño que se prometió y no se construyó, sino **dos linajes distintos del mismo proyecto**:
esta rama se reconstruyó desde la entrega del P1 y no incorporó esos archivos.

La conclusión válida es más modesta que la inicial: en esta rama, el puerto Reloj está realizado
como invariante —ninguna función de `src/dominio/` lee el reloj del sistema, y la fecha de negocio
siempre entra como parámetro— y no como interfaz declarada. El resultado observable es el mismo; la
forma, no.

**Los documentos del P1 se dejan como están, a propósito.** Reescribirlos para que coincidan con el
código de esta rama sería revisar retroactivamente un entregable ya calificado. La discrepancia
queda declarada aquí, que es donde corresponde.

### 4.2 El motor no existía como pieza propia

Consecuencia de lo anterior: no había `calculadora-mora.ts` que dejar intacto. El cálculo eran tres
líneas dentro del bucle de prelación. El rediseño aplicado fue extraerlo, dejando `aplicarPago()`
con una sola responsabilidad —repartir el dinero en el orden de prelación— y sin conocer ninguna
tasa.

Diff completo del único archivo del P1 modificado:

```diff
-  tasaAnual: number,
+  politicaMoratoria: PoliticaMoratoria,
 ): ResultadoAplicacion {
...
-    const moraCuota = diasAtrasoCuota > 0
-      ? Math.round((cuota.capitalPendiente * tasaAnual * diasAtrasoCuota) / 360) : 0;
+    const moraCuota = calcularInteresMoratorio(
+      cuota.capitalPendiente, diasAtrasoCuota, politicaMoratoria).interesMoratorioCent;
```

### 4.3 Un defecto de cableado fuera del núcleo

`src/servidor/pagos.ts` pasaba `credito.tasaAprobadaAnual` —el **36 % de la tasa ordinaria**— como
si fuera la tasa moratoria, cuando la política del Proyecto 1 era del 24 %. Dos tasas distintas
confundidas en el adaptador: el núcleo aceptaba el parámetro correcto, pero nadie se lo daba.

El defecto sobrevivió a la entrega del Proyecto 1 porque **no había pruebas**. Quedó corregido al
resolver la política por fecha de desembolso. Es un archivo de adaptador, fuera de `src/dominio/`,
y por eso no cuenta en la métrica del núcleo.

### 4.4 Duplicación transitoria reconocida

`src/dominio/mora.ts` (del P1) y `src/dominio/clasificacion-tramo.ts` (nuevo) clasifican tramos por
separado. El nuevo añade el tramo `incobrable` y los rangos explícitos; el viejo se conserva
**intacto a propósito**, porque `cartera.ts` y los cierres del adaptador todavía lo consumen y
`regresion-p1.test.ts` fija su comportamiento.

Consolidarlos habría significado abrir un segundo archivo del P1 —y posiblemente un tercero— a
cambio de ninguna capacidad nueva. Se prefirió dejar la duplicación documentada aquí antes que
inflar la métrica de archivos modificados por una limpieza que el cambio de requisito no exigía.
Es deuda técnica declarada, no un descuido.

### 4.5 Una decisión que evitó fricción: los umbrales se derivan, no se escriben

CP-02 se genera "a los 31 días" y CP-04.2 suspende el devengo "a los 91". Ninguno de los dos
números está escrito a mano:

```ts
export const DIAS_ATRASO_PARA_GENERAR =
  ESCALA_TRAMOS.find((r) => r.tramo === "mora_2")!.diaInicial;    // 31

export const PRIMER_DIA_SIN_DEVENGO =
  ESCALA_TRAMOS.find((r) => r.tramo === "vencido")!.diaInicial;   // 91
```

El 31 es "el primer día de Mora 2" y el 91 es "el primer día de Vencido", que es exactamente como
los define el enunciado. Si el comité mueve un tramo mañana, las dos reglas se mueven con él y no
queda ningún número huérfano contradiciendo la escala.

---

## 5. Resultado de las pruebas

```
$ npm test

 RUN  v5.0.1

 ✓ tests/regresion-p1.test.ts        (21 pruebas)   la suite del P1, intacta
 ✓ tests/politica-mora.test.ts       (28 pruebas)   M-1 a M-4, CP-03, invariantes §7.9
 ✓ tests/contrato-politica.test.ts   (30 pruebas)   Liskov: 10 × 3 implementaciones
 ✓ tests/gasto-gestion-cobro.test.ts (14 pruebas)   CP-02 y caso M-5
 ✓ tests/estados-y-devengo.test.ts   (16 pruebas)   CP-04.1 y CP-04.2
 ✓ tests/cartera-por-tramo.test.ts   (17 pruebas)   CP-04.3, oráculo §7.8

 Test Files  6 passed (6)
      Tests  126 passed (126)
```

| Verificación exigida por E6 | Estado |
|---|---|
| M-1 · 15 días, escalonada = **Q5.44** | ✅ |
| M-2 · 45 días, escalonada = **Q18.14** | ✅ |
| M-3 · 100 días, escalonada = **Q50.80** | ✅ |
| M-4 · 120 días, escalonada = **Q65.32** | ✅ |
| M-5 · total adeudado con gasto = **Q1,047.76** | ✅ |
| CP-03 · Q21.77 plana vs Q18.14 escalonada, misma cuota, mismos 45 días | ✅ |
| Suite del P1 intacta (Q7.26 y plan de 12 cuotas) | ✅ |
| Batería de contrato contra las tres políticas (Liskov) | ✅ |
| Redondeo una sola vez — prueba de que tramo por tramo daría Q18.15 | ✅ |
| Frontera: moratorio(121) ≤ moratorio(120) | ✅ |
| Transición `en_mora → cancelado`; imposible pagar un crédito `solicitado` | ✅ |
| Suspensión del devengo: corte al día 90 vs al día 100 | ✅ |
| Cartera por tramo: 3.00 + 2.25 + 1.00 + 0.75 = **7.00 %** | ✅ |
| `tsc --noEmit` en modo `strict`, sin `any` en el núcleo | ✅ |

Los oráculos no se copiaron del enunciado: el capital en mora de Q725.76 y el interés corriente de
Q278.86 los produce `generarPlanFrances()` dentro de la propia prueba.

### Invariantes del §7.9 — los ocho

| Invariante | Estado |
|---|---|
| Monotonía creciente respecto de los días de atraso | ✅ |
| Escalonada ≤ retroactiva para todo d | ✅ |
| Moratorio acumulado ≤ capital en mora | ✅ |
| 1 ≤ d ≤ 30: escalonada ≡ plana al 18 % | ✅ |
| Crédito anterior a oct-2026 devuelve los valores del P1 (Q7.26) | ✅ |
| Gasto de gestión a lo sumo una vez por cuota vencida | ✅ |
| Porcentajes por tramo suman el total sin error de redondeo | ✅ |
| Incobrable deja de generar moratorio y sale de la cartera activa | ✅ |

### Estado de los cambios de requisito

| | Estado |
|---|---|
| **CP-01** · Política escalonada por tramos recorridos | ✅ |
| **CP-02** · Gasto de gestión de cobro Q25.00 idempotente | ✅ |
| **CP-03** · Coexistencia de políticas por fecha de otorgamiento | ✅ |
| **CP-04.1** · Transición `en_mora → cancelado` | ✅ |
| **CP-04.2** · Suspensión del devengo a los 91 días | ✅ |
| **CP-04.3** · Desglose de cartera en riesgo por tramo | ✅ |

---

## 6. GRASP

### Experto en información

> *¿Quién conoce los días de atraso? Esa es la pieza que debe calcular el tramo.*

`calcularDiasAtraso()` conoce los vencimientos; `clasificarTramoDeAtraso()` convierte esos días en
tramo. Ambas viven en el dominio. **Ni el tablero ni el caso de uso clasifican nada**: el adaptador
HTTP llama `clasificarTramo(calcularDiasAtraso(...))` y publica el resultado.

El enunciado lo refuerza en CP-04.3: el desglose por tramo debe salir del núcleo, no recalcularse
en la interfaz. La parte del tablero está pendiente.

### Polimorfismo

La elección de política se resuelve por **despacho polimórfico**. `resolverPoliticaMoratoria()`
filtra un arreglo por fecha de vigencia y devuelve un `PoliticaMoratoria`; quien lo recibe llama
`tasaDiaria()` sin saber cuál implementación tiene en la mano.

No hay ningún `switch` sobre tipo de política en el repositorio — verificable con `grep`. Agregar la
política de 2027 es añadir una entrada al arreglo `CATALOGO_POLITICAS_MORATORIAS`, sin tocar el
punto de decisión.

### Bajo acoplamiento / alta cohesión

La medición es el `git diff --stat` de §2: **7 archivos nuevos y 1 modificado**. El cambio se
concentró en archivos nuevos, que es la señal de bajo acoplamiento. Las dependencias del núcleo
apuntan todas hacia adentro y hacia abstracciones: `calculadora-mora.ts` no importa ninguna
implementación concreta, y su única dependencia de política es un tipo que desaparece al compilar.

### Creador

`crearPoliticaPlana()`, `crearPoliticaEscalonada()` y `crearPoliticaRetroactiva()` son fábricas que
reciben la tabla de tasas como dato. Quien crea la política es quien tiene los datos de la versión
institucional; el motor nunca crea una.

---

## 7. Conclusión

**Grado de cumplimiento real de SOLID en el diseño del Proyecto 1: parcial, y desigual entre el
documento y el código.**

Lo que estaba bien y sostuvo el cambio:

- El núcleo ya era **puro**: sin servidor, sin base de datos, sin reloj del sistema. Todas las
  fechas de negocio entraban como parámetro. Con mora escalonada, donde el tramo depende de la
  fecha, esa decisión del P1 fue la que evitó tener que rediseñar.
- El dinero ya viajaba en **centavos enteros**, así que el redondeo único del §7.3 fue una decisión
  de una línea y no una cacería de errores de punto flotante.
- El **tramo ya era una clasificación derivada**, nunca un estado persistido. Agregar `incobrable`
  a la escala no obligó a migrar datos ni a tocar la máquina de estados.

Lo que no estaba y costó:

- El ADR-003 **declaraba Strategy para las políticas financieras, pero el código no lo
  implementaba** para la mora. La tasa era un número suelto sin versión ni vigencia. Absorber CP-03
  exigió construir la abstracción que el documento daba por existente.
- **No había pruebas automatizadas.** Eso permitió que un defecto —el adaptador pasando la tasa
  ordinaria como moratoria— sobreviviera a la entrega sin que nadie lo notara.

### Qué se haría distinto hoy

1. **Escribir la prueba de contrato junto con el puerto, no después.** Los dos defectos de Liskov
   de §3 existían en la primera versión de las políticas y ninguna prueba de caso los habría
   encontrado: solo aparecieron al correr la misma batería contra las tres implementaciones.

2. **No dar por implementado lo que solo está en un ADR.** Un ADR describe una intención. La
   verificación tiene que ser ejecutable: si el ADR-003 hubiera venido con una prueba que exigiera
   dos políticas coexistiendo, el hueco se habría visto en el Proyecto 1.

3. **Poner los invariantes del dominio en el motor, no en las implementaciones.** Un invariante que
   depende de que cada nueva implementación lo recuerde no es un invariante: es una convención, y
   se rompe sola con el tiempo.
