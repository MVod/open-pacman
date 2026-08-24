# SPEC 02 — Salida de la pen: los fantasmas aparecen en el mapa al liberarse

> **Estado:** Borrador
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-25
> **Objetivo:** Al liberarse por countdown, cada fantasma se teletransporta de la pen a la celda (13,11) y juega en el mapa, eliminando el bug de quedarse atrapados en la jaula.

## Alcance

**Dentro:**

- Constante `GHOST_EXIT = { x: 13, y: 11, dir: 'left' }` en `game.js` (corredor abierto justo encima de la pen).
- Campo `released: false` por fantasma; en el primer frame con countdown vencido, `update()` lo coloca en `GHOST_EXIT` antes de moverlo.
- Puerta de la pen (tile 3) pasa a bloquear a **todos** los actores (cambia una condición en `isWall`), de modo que ningún fantasma pueda reingresar a la pen después de salir.
- `resetPositions()` devuelve los fantasmas a la pen y desarma `released`, para que el ciclo repita tras cada pérdida de vida.
- Actualización de la línea de AGENTS.md que documenta la puerta ("bloquea solo a Pac-Man").

**Fuera de alcance (para specs futuras):**

- Modos frightened/reverse y power pellets.
- Celdas de salida distintas por fantasma.
- IA de "salida de pen" (pathfinding hacia la puerta).
- Dificultad progresiva, multiplayer.

## Modelo de datos

```js
// game.js — nueva constante junto a GHOST_KINDS:
const GHOST_EXIT = { x: 13, y: 11, dir: 'left' };
```

```js
// game.js — cada fantasma recibe un nuevo campo:
{ x, y, dir: 'up', speed, kind, color, releaseFrame, released: false }
```

Convenciones:

- `released` es el único nuevo estado: `true` desde el teletransporte hasta la siguiente `resetPositions()`.
- Tile 3 (puerta pen) ya no admite el actor `ghost`; `isWall()` deja de necesitar el parámetro `actor`.
- El interior de la pen (filas 13–15, cols 11–16) queda completamente sellado fuera del teletransporte.
- No cambia: velocidades, countdown 0/30/60/90, read-armado, IA por `kind`, colisiones.

## Plan de implementación

1. `game.js`: `isWall()` — tile 3 bloquea a todos; se elimina el parámetro `actor` de `isWall` y de las dos llamadas en `canMove`. Prueba manual: la partida carga igual; los congelados siguen quietos en la pen.
2. `game.js`: constante `GHOST_EXIT` y campo `released: false` en `createGame()`. Prueba manual: sin cambios visibles (campo aún no se usa).
3. `game.js`: en `update()`, para cada fantasma con `!g.released && game.frame > g.releaseFrame`: fija `x, y, dir` a `GHOST_EXIT` y marca `g.released = true` antes de `moveGhost`. El bucle de colisión pasa a saltar los `!g.released`. Prueba manual: el rojo aparece en (13,11) en el frame 1 y se mueve en el mapa; cian/rosa/naranjo salen ahí en ~30/60/90f; ninguno se queda en la pen ni reingresa.
4. `game.js`: `resetPositions()` restaura `released = false`. Prueba manual: perder una vida → los 4 vuelven a verse en la pen, el countdown se read-arma y al liberarse salen de nuevo desde (13,11).
5. `AGENTS.md`: corregir la línea de la puerta pen: "bloquea a todos los actores".

## Criterios de aceptación

- [ ] Al iniciar (frame 1) el rojo aparece en (13,11), el corredor encima de la pen, y se mueve por el mapa.
- [ ] El cian sale ~frame 30, el rosa ~60 y el naranja ~90, todos desde (13,11).
- [ ] Ningún fantasma permanece dentro de la pen (filas 13–15, cols 11–16) más de 1 frame tras su liberación, incluido el mismo frame de salida (sin reingreso por la puerta).
- [ ] Al perder una vida, los 4 vuelven a la pen (visibles durante el countdown) y salen de nuevo a (13,11) al vencerse su countdown.
- [ ] Fuera de la pen la IA es idéntica a SPEC 01: el rojo persigue, el cian apunta por delante, el rosa por simetría, el naranja persigue/correra según distancia.
- [ ] Velocidades (0.125/0.1), countdown 0/30/60/90 y read-armado tras pérdida de vida intactos.
- [ ] Solo colisionan los fantasmas liberados.
- [ ] Se gana (todos los dots) y se pierde (0 vidas) igual que antes; sin errores en consola.

## Decisiones

- **Sí:** celda única de salida (13,11), `dir:'left'`. Es la vista clásica y el escalonado 0/30/60/90 ya separa en el tiempo a los 4.
- **No:** celda de salida individual por fantasma. Más código sin beneficio jugable.
- **No:** IA de "salir de la pen" (pathfinding a la puerta). La greedy es local y reintroduce la trampa; el teletransporte es determinista y ~6 líneas.
- **Sí:** campo `released` explícito en vez de detectar "está dentro de la pen". Estado explícito es más simple que heurística geométrica.
- **Sí:** la puerta (tile 3) bloquea desde ahora a fantasmas. Verificado: con la puerta abierta el chaser en (13,11) reingresa en su primera decisión (abajo=11 < izquierda/arriba=13) y se retrampa. La pen no cumple otra función en las reglas actuales.
- **No:** dejar la puerta transitable y forzar el primer movimiento del fantasma. Frágil: depende de empates de distancia y de la heurística greedy.
- **No:** tocar countdown, velocidades, IA ni colisiones (decisión confirmada del usuario).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Olvidar desarmar `released` en `resetPositions()` → fantasmas volven a la pen y nunca salen. | Paso 4 con prueba manual explícita; criterio de aceptación de pérdida de vida. |
| Los 4 apilados en (13,11) en el momento de salir. | Sale uno a la vez (0/30/60/90f), igual que hoy; sin apilamiento simultáneo. |
| Que el cambio de `isWall` afecte a algo que sí necesitaba la puerta. | La pen solo la usan fantasmas congelados (no se mueven) y Pac-Man (bloqueado ya); no hay ningún otro flujo. Revisión de la única llamada al trazar el plan. |

## Lo que **no** entra en esta spec

- Modos frightened/reverse y power pellets.
- Celdas de salida distintas por fantasma.
- IA de "salida de pen" (pathfinding a la puerta).
- Dificultad progresiva y multiplayer.

Cada una de esas, si llega, tiene su propia spec.
