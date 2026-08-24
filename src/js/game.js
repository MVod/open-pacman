// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames

// Perfil por tipo de fantasma: velocidad (fraccion limpia) y frame de salida.
const GHOST_KINDS = {
  chaser: { speed: 0.125, releaseFrame: 0   }, // agresivo, igual que Pac-Man
  ambush: { speed: 0.1,   releaseFrame: 30  },
  flank:  { speed: 0.1,   releaseFrame: 60  },
  shy:    { speed: 0.1,   releaseFrame: 90  },
};

// Celda de salida de la pen: corredor abierto justo encima de la jaula.
// Al liberarse, cada fantasma se teletransporta aqui y juega en el mapa.
const GHOST_EXIT = { x: 13, y: 11, dir: 'left' };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => {
      const profile = GHOST_KINDS[ g.kind ];
      return {
        x: g.x,
        y: g.y,
        dir: 'up',
        speed: profile.speed,
        kind: g.kind,
        color: g.color,
        releaseFrame: profile.releaseFrame,
        released: false,
      };
    } ),
  };
}

// Un fantasma se mueve solo cuando el frame supera su releaseFrame.
function ghostReleased( game, g ) {
  return game.frame > g.releaseFrame;
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro si es pared (1) o puerta de la pen (3):
// bloquea a Pac-Man y a todos los fantasmas (ninguno reingresa a la pen).
function isWall( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  return v === 1 || v === 3;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Codigo greedy: elige la direccion que acerca al objeto (tx,ty).
function greedyToward( choices, g, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function clampCell( v, max ) {
  return Math.max( 0, Math.min( max, Math.round( v ) ) );
}

// Objeto de emboscada: 4 celdas por delante de Pac-Man en su dir,
// clamped a los bordes del laberinto.
function ambushTarget( game ) {
  const p = game.pacman;
  const d = DIRS[ p.dir ];
  const W = game.grid[ 0 ].length;
  const H = game.grid.length;
  return {
    x: clampCell( p.x + d.x * 4, W - 1 ),
    y: clampCell( p.y + d.y * 4, H - 1 ),
  };
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  if ( g.kind === 'chaser' ) {
    // Codicio greedy directo hacia Pac-Man.
    g.dir = greedyToward( choices, g, px, py );
  } else if ( g.kind === 'ambush' ) {
    // Apunta a 4 celdas por delante de Pac-Man; no se queda pegado.
    const t = ambushTarget( game );
    g.dir = greedyToward( choices, g, t.x, t.y );
  } else if ( g.kind === 'flank' ) {
    // Simetria respecto al eje central vertical (entre cols 13 y 14).
    const W = grid[ 0 ].length;
    const tx = Math.round( ( W - 1 ) - px );
    g.dir = greedyToward( choices, g, tx, py );
  } else if ( g.kind === 'shy' ) {
    // Cercano: persigue; lejos: deambula.
    const dist = Math.abs( g.x - p.x ) + Math.abs( g.y - p.y );
    if ( dist <= 5 ) {
      g.dir = greedyToward( choices, g, px, py );
    } else {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    // Read-arma el countdown desde el frame actual.
    g.releaseFrame = game.frame + GHOST_KINDS[ g.kind ].releaseFrame;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    // Al vencerse el countdown, sale de la pen por teletransporte a GHOST_EXIT.
    if ( !g.released && game.frame > g.releaseFrame ) {
      g.x = GHOST_EXIT.x;
      g.y = GHOST_EXIT.y;
      g.dir = GHOST_EXIT.dir;
      g.released = true;
    }
    if ( g.released ) moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( !g.released ) continue;
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
