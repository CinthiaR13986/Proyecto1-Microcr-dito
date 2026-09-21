# ADR-004: Política de mora escalonada como Strategy inyectada y versionada

**Estado:** Aceptada · 2026-09
**Contexto normativo:** Acta 09-2026 del Comité de Crédito de Crédito Vecino, S. A.
**Sustituye parcialmente a:** [ADR-003](ADR-003-politicas-versionadas.md), que declaró el patrón
pero no llegó a implementarse para la mora.

## Contexto

El Comité resolvió sustituir la tasa moratoria única del 24 % nominal anual por una escala por
tramo de atraso, vigente desde el 1 de octubre de 2026, **sin alterar los créditos ya otorgados**,
que conservan la política vigente a su fecha de otorgamiento.

El código del Proyecto 1 no podía absorberlo. El interés moratorio se calculaba dentro de
`aplicarPago()` con una tasa anual recibida como `number`:

```ts
const moraCuota = Math.round((cuota.capitalPendiente * tasaAnual * diasAtrasoCuota) / 360);
```

Ese número no tenía versión, ni fecha de vigencia, ni autor. Dos créditos con políticas distintas
no podían convivir, y la tasa del tramo no era expresable en absoluto.

## Decisión

**1. La política moratoria es un puerto, y llega inyectada.**

```ts
export interface PoliticaMoratoria {
  readonly version: VersionPolitica;   // id, vigenteDesde, autor, motivo
  tasaDiaria(tramo: TramoAtraso, diasAtrasoTotal: number): number;
}
```

El motor recibe la política como parámetro. No la construye, no la importa por nombre concreto y no
conoce el catálogo.

**2. Tres responsabilidades, tres piezas.**

| Pieza | Responsabilidad |
|---|---|
| `clasificacion-tramo.ts` | En qué tramo cae cada día de atraso (Specification) |
| `politica-mora/*.ts` | Cuánto cuesta un día de ese tramo (Strategy) |
| `calculadora-mora.ts` | Recorrer los tramos, sumar y redondear una vez (motor) |

**3. Se cobran los tramos recorridos, no el tramo actual.**

Una cuota con 45 días de atraso no pasó 45 días en Mora 2: pasó 30 en Mora 1 y 15 en Mora 2. Cada
día se cobra a la tasa del tramo al que pertenece.

**4. El redondeo ocurre una sola vez, al cerrar la cuota.**

Redondear tramo por tramo daría Q18.15 donde corresponde Q18.14. Un centavo por cuota vencida, por
miles de cuotas al mes, es un descuadre contable real. Los importes por tramo se exponen **sin
redondear** para que el desglose sea auditable.

**5. Las tasas son datos de una versión de política, no constantes del código.**

Las cinco cifras viven en `TASAS_ESCALONADAS_2026`, dentro de la política. Cambiar el 30 % de
Mora 3 no obliga a leer ni recompilar el motor.

**6. Los invariantes del Sistema viven en el motor, no en cada política.**

Que una cuota al día y un crédito incobrable no devenguen es una regla del Sistema —baja contable,
salida de la cartera— idéntica bajo cualquier política. Si cada implementación tuviera que
recordar poner su tasa en cero, la primera que lo olvidara le cobraría a un crédito ya dado de baja.

**7. La política se resuelve por fecha de otorgamiento, con despacho polimórfico.**

`resolverPoliticaMoratoria(fechaOtorgamiento)` busca en un catálogo ordenado por vigencia. No hay
`switch` sobre tipo de política. La fecha es un parámetro, nunca el reloj del sistema.

## Alternativas descartadas

**Política retroactiva** — aplicar la tasa del tramo alcanzado a todos los días recorridos. Cobraría
Q72.58 donde la escalonada cobra Q50.80, y castigaría con efecto retroactivo un atraso que ya
ocurrió bajo otras condiciones. Se implementa en `politica-retroactiva.ts` **únicamente** como
contraste para la prueba de sustituibilidad; no se registra en el catálogo de políticas vigentes.

**Un `if` sobre la fecha dentro del cálculo** — concentra la decisión en un punto que crece con cada
política nueva y hace imposible probar una política aislada.

**Recalcular los créditos antiguos con la escala nueva** — lo prohíbe el Acta y rompería la
trazabilidad del historial de mora ya comunicado al cliente.

## Consecuencias

**A favor**

- Agregar la política de 2027 es añadir una entrada al catálogo: cero cambios en el motor.
- Las dos políticas conviven en el mismo cierre. Verificado: Q21.77 y Q18.14 para la misma cuota y
  los mismos 45 días.
- Las pruebas del Proyecto 1 siguen pasando sin modificar un solo valor esperado.
- El desglose por tramos habilita la pantalla "Detalle de la mora" del prototipo: cuánto se cobró
  en cada tramo, a qué tasa y por cuántos días.

**En contra**

- El puerto arrastra un parámetro, `diasAtrasoTotal`, que dos de las tres implementaciones ignoran.
  Existe para que la retroactiva sea intercambiable. La alternativa —que cada política implementara
  su propia suma— habría duplicado la lógica del motor tres veces.
- Conviven transitoriamente dos clasificadores de tramo: `mora.ts` (del P1, sin tramo incobrable,
  todavía consumido por cartera y cierres) y `clasificacion-tramo.ts`. La consolidación corresponde
  a CP-04.3.

## Verificación

`tests/politica-mora.test.ts` reproduce M-1 a M-4 y CP-03. `tests/contrato-politica.test.ts` corre
la misma batería de invariantes contra las tres implementaciones. `tests/regresion-p1.test.ts`
mantiene en verde los oráculos del Proyecto 1.
