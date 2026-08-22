# SPEC 01 — Cuatro fantasmas IA diferenciadas

> **Estado:** Borrador
> **Depende de:** — (base del proyecto; no depende de otra spec)
> **Fecha:** 2026-08-23
> **Objetivo:** Cuatro fantasmas, cada uno con su propia IA, y uno (el agresivo) persigue a Pac-Man de forma directa.

## Alcance

**Dentro:**

- Cuatro fantasmas en `GHOST_STARTS`, cada uno con un `kind` y un comportamiento propio: `chaser` (agresivo), `ambush`, `flank`, `shy`.
- Velocidad individual: el `chaser` a 0.125 (igual que Pac-Man), los otros a 0.1.
- Countdown escalonado en la pen: rojo 0f, cian 30f, rosa 60f, naranja 90f; read-armed en cada pérdida de vida.
- Reglas de decisión concretas por `kind` (objetivo y heurística definidas en los datos).

**Fuera de alcance (para specs futuras):**

- Modo fantasmal (frightened/reverse).
- Power pellets.
- Dificultad progresiva por nivel.
- Multiplayer.

## Modelo de datos

```js
// maze.js — GHOST_STARTS pasa a:
const GHOST_STARTS = [
  { x: 12, y: 14, kind: 'chaser', color: 'red',    releaseFrame: 0   }, // rojo, agresivo
  { x: 13, y: 14, kind: 'ambush', color: 'cyan',   releaseFrame: 30  }, // cian, emboscada
  { x: 14, y: 14, kind: 'flank',  color: 'pink',   releaseFrame: 60  }, // rosa, flanqueo
  { x: 15, y: 14, kind: 'shy',    color: 'orange', releaseFrame: 90  }, // naranja, cobarde
];
```

```js
// game.js — cada fantasma recibe velocidad por kind
const GHOST_KINDS = {
  chaser: { speed: 0.125, releaseFrame: 0   },
  ambush: { speed: 0.1,   releaseFrame: 30  },
  flank:  { speed: 0.1,   releaseFrame: 60  },
  shy:    { speed: 0.1,   releaseFrame: 90  },
};
```

Convenciones:

- Las velocidades siguen siendo fracciones limpias; `aligned()` y el giro en celda entera no se rompen (ver AGENTS.md).
- `releaseFrame` es el frame de juego (contador global de `main.js`) a partir del cual el fantasma se mueve; hasta entonces queda congelado en la pen.
- Solo colisionan con Pac-Man los fantasmas ya liberados (un fantasma congelado no cuenta como colisión).
- El frame llega a `update()` sin cambiar su firma (`game.frame` lo inyecta `main.js` antes de llamar a `update`).

## Plan de implementación

1. `maze.js`: `GHOST_STARTS` pasa a 4 entradas con `kind`, `color`, `releaseFrame`. Prueba manual: servir `src/` y verificar que se cargan 4 fantasmas visibles en la pen.
2. `game.js`: nuevo mapa `GHOST_KINDS`; `createGame()` asigna `speed` y `releaseFrame` por fantagma en lugar del `GHOST_SPEED` único. Prueba manual: al iniciar partida, el rojo sale en el frame 1 y los otros tres se quedan en la pen.
3. `game.js`: en `update()`, un fantasma con `releaseFrame` aún no superado no se mueve (se salta `moveGhost` y no cuenta colisiones). Prueba manual: salida escalonada de los 4.
4. `game.js`: `decideGhost()` decide por `kind`:
   - `chaser`: codicio greedy hacia la celda redondeada de Pac-Man (actualidad).
   - `ambush`: objetivo = posición de Pac-Man + 4 celdas en su `dir`; si el objetivo cae fuera del laberinto, se clampa a los bordes.
   - `flank`: objetivo = `(27 - x_p, y_p)` (simetría respecto al eje central del laberinto, que es simétrico).
   - `shy`: distancia Manhattan a Pac-Man ≤ 5 → codicio greedy como `chaser`; la distancia mayor → deambula aleatorio.
   
   Prueba manual: ver el comportamiento de cada fantasma en vivo; ninguno debe rebotar ni reventar en un callejón.
5. `game.js`: `resetPositions()` restaura el escalonado de `releaseFrame` (offset del frame actual) para que el countdown se read-arma tras cada pérdida de vida.
6. `main.js`: inyectar `game.frame = frame` antes de llamar `update(game)`. Prueba manual: perder una vida y ver el countdown reiniciado; colisiones solo con fantasmas liberados.

## Criterios de aceptación

- [x] Al iniciar la partida hay 4 fantasmas, con 4 colores distintos (rojo, cian, rosa, naranja).
- [x] El rojo sale de la pen en el primer frame jugable.
- [x] El cian sale ~frame 30, el rosa ~frame 60, el naranja ~frame 90.
- [x] El rojo persigue a Pac-Man de forma directa (codicio greedy).
- [x] El cian apunta a 4 celdas por delante de Pac-Man y no se queda pegado a Pac-Man.
- [x] El rosa apunta al punto simétrico respecto al eje central.
- [x] El naranja persigue cuando Pac-Man está a distancia ≤ 5 y deambula cuando está más lejos.
- [x] Al perder una vida, los 4 vuelven a la pen y el countdown se read-arma (naranja sale último).
- [x] No hay colisión con un fantasma congelado en la pen.
- [x] Ningún fantasma se revierte salvo en un callejón (salvaguard de `decideGhost()` se mantiene).
- [x] Se puede ganar la partida (comiendo todos los dots) y perderla (quedando 0 vidas), igual que antes.

## Decisiones

- **Sí:** 4 tipos diferenciados (`chaser`, `ambush`, `flank`, `shy`). La petición pide comportamientos distintos, no solo más velocidad.
- **No:** 2 cazadores + 2 aleatorios. La diferenciación es menor y pierde la esencia "clásica 4".
- **Sí:** el `chaser` a 0.125 (igual que Pac-Man). "Persecución agresiva" debe leerse en velocidad, no solo en IA.
- **No:** todos a 0.1. Pierde agresividad; más justo pero no es lo pedido.
- **Sí:** countdown escalonado 0/30/60/90f. Salida escalonada clásica; evita que los 4 salgan al unísono y se apilen sobre Pac-Man.
- **No:** salida uniforme (todos a la vez). Más caótico y poco jugable.
- **Sí:** codicio greedy (sin BFS) para el agresivo. Determinista, simple, sin riesgo de colapso de performance.
- **No:** BFS por celdas. Sobresimplifica y añade ~60 líneas de superficie de error.
- **Sí:** simetría central para el `flank`. El laberinto es simétrico y el objetivo no queda tras Pac-Man.
- **No:** columna fija por encima. Menos dinámico, predecible.
- **Sí:** umbral 5 para el `shy`. Da tiempo de fuga sin inutilizar al fantasma.
- **No:** modo frightened / power pellets. Otra spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Que las velocidades fraccionarias rompan `aligned()` con 0.125 en fantasmas. | 0.125 = 1/8, ya usado por Pac-Man; `aligned()` con tolerancia 1e-3 lo cubre; prueba manual al paso 2. |
| Countdown mal read-armado tras pérdida de vida → fantasmas "atrapados" en la pen. | `resetPositions()` restaura el offset desde `game.frame` actual; prueba manual al paso 5. |
| 4 fantasmas al unísono sobre Pac-Man en la apertura (pérdida de vida injusta). | El escalonado ya lo evita; el `shy` a 90f y su IA lo mitigan aún más. |

## Lo que **no** entra en esta spec

- Modo fantasmal (frightened/reverse).
- Power pellets.
- Dificultad progresiva por nivel.
- Multiplayer.

Cada una de esas, si llega, tiene su propia spec.
