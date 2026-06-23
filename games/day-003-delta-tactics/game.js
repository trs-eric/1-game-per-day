/**
 * DELTA TACTICS - Day 003
 * Turn-based tactics on 25x25 grid (250x250 units scaled).
 * 4 units (Alpha, Beta, Gamma, Delta) act in order.
 * Each turn: MOVE (up to 10 spaces, 8-dir) or SHOOT.
 * Obstacles: buildings, trees, cliffs.
 * Goal: get a unit to the guarded building.
 * No enemy AI yet.
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const MAP_SIZE = 25;
const TILE_SIZE = 24; // 600x600 map area
const MAP_OFFSET_X = 0;
const MAP_OFFSET_Y = 0;

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

let gameState = 'ready'; // ready, playing, win
let currentUnit = 0;
let actionMode = null; // null, 'move', 'shoot'
let highlights = [];
let units = [];
let enemies = [];
let blocked = [];
let goal = { x: 22, y: 12 };

let mouse = { x: 0, y: 0 };

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('click', handleClick);

function initMap() {
  blocked = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(false));

  // Buildings (large blocked areas guarding the goal)
  for (let bx = 18; bx < 25; bx++) {
    for (let by = 8; by < 16; by++) {
      if (bx < MAP_SIZE && by < MAP_SIZE) blocked[by][bx] = true;
    }
  }
  // Another building
  for (let bx = 5; bx < 9; bx++) {
    for (let by = 4; by < 8; by++) {
      blocked[by][bx] = true;
    }
  }

  // Trees (scattered obstacles)
  const treePositions = [
    [2, 3], [3, 15], [6, 9], [8, 20], [11, 5], [14, 17],
    [17, 3], [19, 19], [1, 22], [23, 6], [12, 12]
  ];
  treePositions.forEach(([x, y]) => {
    if (x < MAP_SIZE && y < MAP_SIZE) blocked[y][x] = true;
  });

  // Cliffs (wall-like barriers)
  for (let i = 0; i < 10; i++) {
    blocked[14][6 + i] = true;
  }
  for (let i = 0; i < 7; i++) {
    blocked[20][15 + i] = true;
  }
}

function initUnits() {
  units = [
    { id: 'alpha', name: 'Alpha', x: 3, y: 8, color: '#4fc3f7' },
    { id: 'beta', name: 'Beta', x: 3, y: 11, color: '#81c784' },
    { id: 'gamma', name: 'Gamma', x: 3, y: 14, color: '#ffb74d' },
    { id: 'delta', name: 'Delta', x: 3, y: 17, color: '#e57373' }
  ];

  enemies = [
    { x: 19, y: 9 },
    { x: 20, y: 11 },
    { x: 19, y: 13 },
    { x: 21, y: 10 },
    { x: 20, y: 14 }
  ];
}

function isBlocked(x, y) {
  if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return true;
  return blocked[y][x];
}

function isOccupied(x, y, ignoreUnit = null) {
  for (let u of units) {
    if (u === ignoreUnit) continue;
    if (u.x === x && u.y === y) return true;
  }
  for (let e of enemies) {
    if (e.x === x && e.y === y) return true;
  }
  return false;
}

function chebyshev(x1, y1, x2, y2) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

function hasLOS(x1, y1, x2, y2) {
  if (x1 === x2 && y1 === y2) return true;
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const ix = Math.round(x1 + (x2 - x1) * t);
    const iy = Math.round(y1 + (y2 - y1) * t);
    if (ix === x1 && iy === y1) continue;
    if (ix === x2 && iy === y2) break;
    if (isBlocked(ix, iy)) return false;
  }
  return true;
}

function getReachable(sx, sy, maxDist = 10) {
  const queue = [{ x: sx, y: sy, d: 0 }];
  const visited = new Set([`${sx},${sy}`]);
  const result = [];

  while (queue.length > 0) {
    const { x, y, d } = queue.shift();
    if (d > 0 && d <= maxDist) {
      result.push({ x, y });
    }
    if (d >= maxDist) continue;

    for (let [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
      if (isBlocked(nx, ny)) continue;
      if (isOccupied(nx, ny)) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ x: nx, y: ny, d: d + 1 });
      }
    }
  }
  return result;
}

function getShootTargets(unit) {
  const range = 12;
  return enemies.filter(e => {
    const dist = chebyshev(unit.x, unit.y, e.x, e.y);
    return dist <= range && hasLOS(unit.x, unit.y, e.x, e.y);
  });
}

function nextUnit() {
  currentUnit = (currentUnit + 1) % units.length;
  actionMode = null;
  highlights = [];
  updateUI();
}

function checkWin() {
  for (let u of units) {
    if (u.x === goal.x && u.y === goal.y) {
      gameState = 'win';
      return true;
    }
    // inside building area
    if (u.x >= 20 && u.x <= 23 && u.y >= 10 && u.y <= 13) {
      gameState = 'win';
      return true;
    }
  }
  return false;
}

function handleClick(e) {
  if (gameState !== 'playing') {
    if (gameState === 'win' || gameState === 'ready') {
      resetGame();
    }
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const unit = units[currentUnit];

  // Check UI buttons on right side
  if (mx > 610) {
    if (my > 80 && my < 120) {
      // MOVE button
      if (actionMode !== 'move') {
        actionMode = 'move';
        highlights = getReachable(unit.x, unit.y, 10);
      } else {
        actionMode = null;
        highlights = [];
      }
      return;
    }
    if (my > 130 && my < 170) {
      // SHOOT button
      if (actionMode !== 'shoot') {
        actionMode = 'shoot';
        highlights = getShootTargets(unit).map(e => ({ x: e.x, y: e.y }));
      } else {
        actionMode = null;
        highlights = [];
      }
      return;
    }
    return;
  }

  // Map click
  const gx = Math.floor((mx - MAP_OFFSET_X) / TILE_SIZE);
  const gy = Math.floor((my - MAP_OFFSET_Y) / TILE_SIZE);

  if (gx < 0 || gx >= MAP_SIZE || gy < 0 || gy >= MAP_SIZE) return;

  if (actionMode === 'move') {
    const reachable = highlights;
    const target = reachable.find(t => t.x === gx && t.y === gy);
    if (target) {
      unit.x = gx;
      unit.y = gy;
      actionMode = null;
      highlights = [];
      if (!checkWin()) {
        nextUnit();
      }
    }
  } else if (actionMode === 'shoot') {
    const target = enemies.find(e => e.x === gx && e.y === gy);
    if (target) {
      const dist = chebyshev(unit.x, unit.y, target.x, target.y);
      if (dist <= 12 && hasLOS(unit.x, unit.y, target.x, target.y)) {
        // Shoot success - remove enemy for basics
        enemies = enemies.filter(e => e !== target);
        actionMode = null;
        highlights = [];
        if (!checkWin()) {
          nextUnit();
        }
      }
    }
  } else {
    // Click on unit to reselect? but order fixed for now
    // Or just info
  }
}

function resetGameObjects() {
  initMap();
  initUnits();
  currentUnit = 0;
  actionMode = null;
  highlights = [];
  gameState = 'playing';
  updateUI();
}

function updateUI() {
  const statusEl = document.getElementById('status');
  const unitEl = document.getElementById('current-unit');
  if (!statusEl || !unitEl) return;

  if (gameState === 'win') {
    statusEl.textContent = 'VICTORY!';
    unitEl.textContent = 'Mission Complete';
  } else if (gameState === 'playing') {
    const u = units[currentUnit];
    unitEl.textContent = `Unit: ${u.name}`;
    let msg = actionMode ? `Select ${actionMode} target` : 'Choose MOVE or SHOOT';
    statusEl.textContent = msg;
  } else {
    unitEl.textContent = 'Unit: -';
    statusEl.textContent = 'Press Start';
  }
}

function draw() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw map area background (250x250 units / 25x25 grid)
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(MAP_OFFSET_X, MAP_OFFSET_Y, MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE);

  // Draw tiles
  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const px = MAP_OFFSET_X + x * TILE_SIZE;
      const py = MAP_OFFSET_Y + y * TILE_SIZE;

      if (blocked[y][x]) {
        // Different obstacle types
        if ((x >= 18 && x < 25 && y >= 8 && y < 16) || (x >= 5 && x < 9 && y >= 4 && y < 8)) {
          ctx.fillStyle = '#5d4037'; // building
        } else if ([2,3,6,8,11,14,17,19,1,23,12].includes(x) && [3,15,9,20,5,17,3,19,22,6,12].includes(y)) {
          ctx.fillStyle = '#2e7d32'; // tree
        } else {
          ctx.fillStyle = '#455a64'; // cliff/wall
        }
      } else {
        ctx.fillStyle = '#263238'; // ground
      }
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // subtle grid
      ctx.strokeStyle = '#1a2a1a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE, TILE_SIZE);
    }
  }

  // Goal building highlight
  const gx = MAP_OFFSET_X + goal.x * TILE_SIZE;
  const gy = MAP_OFFSET_Y + goal.y * TILE_SIZE;
  ctx.fillStyle = 'rgba(255, 193, 7, 0.4)';
  ctx.fillRect(gx, gy, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = '#ffc107';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx + 2, gy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText('GOAL', gx + 2, gy + 14);

  // Draw highlights
  if (highlights.length > 0) {
    ctx.fillStyle = actionMode === 'move' 
      ? 'rgba(76, 175, 80, 0.35)' 
      : 'rgba(244, 67, 54, 0.35)';
    for (let h of highlights) {
      ctx.fillRect(
        MAP_OFFSET_X + h.x * TILE_SIZE,
        MAP_OFFSET_Y + h.y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  // Draw enemies
  ctx.fillStyle = '#c62828';
  for (let e of enemies) {
    const ex = MAP_OFFSET_X + e.x * TILE_SIZE + TILE_SIZE / 2;
    const ey = MAP_OFFSET_Y + e.y * TILE_SIZE + TILE_SIZE / 2;
    ctx.beginPath();
    ctx.arc(ex, ey, TILE_SIZE / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('E', ex - 3, ey + 3);
    ctx.fillStyle = '#c62828';
  }

  // Draw units
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const ux = MAP_OFFSET_X + u.x * TILE_SIZE + TILE_SIZE / 2;
    const uy = MAP_OFFSET_Y + u.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.arc(ux, uy, TILE_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // label
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(u.name[0], ux - 4, uy + 4);

    // current highlight
    if (i === currentUnit) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ux, uy, TILE_SIZE / 2 + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // Right side UI panel
  ctx.fillStyle = '#111';
  ctx.fillRect(600, 0, 200, 600);

  ctx.fillStyle = '#22f1ff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('DELTA TACTICS', 610, 25);

  const cur = units[currentUnit];
  ctx.fillStyle = cur.color;
  ctx.fillText(`TURN: ${cur.name}`, 610, 50);

  // Action buttons
  const btnY = 80;
  ctx.fillStyle = actionMode === 'move' ? '#4caf50' : '#22f1ff';
  ctx.fillRect(610, btnY, 170, 35);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('MOVE (max 10)', 625, btnY + 22);

  ctx.fillStyle = actionMode === 'shoot' ? '#f44336' : '#ff9800';
  ctx.fillRect(610, btnY + 45, 170, 35);
  ctx.fillStyle = '#000';
  ctx.fillText('SHOOT (range 12)', 620, btnY + 67);

  // Info
  ctx.fillStyle = '#aaa';
  ctx.font = '11px monospace';
  ctx.fillText('Enemies: ' + enemies.length, 610, 160);
  ctx.fillText('Click button then', 610, 180);
  ctx.fillText('click on map', 610, 195);

  if (gameState === 'win') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4caf50';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('VICTORY!', 280, 280);
    ctx.font = '16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('You reached the guarded building!', 220, 320);
    ctx.fillText('Click to restart', 300, 360);
  }

  if (gameState === 'ready') {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('Click START or map to begin', 250, 300);
  }
}

function update(delta) {
  // Turn based - no continuous update needed beyond UI
  // Could add subtle anims here later
}

function gameLoop(timestamp = 0) {
  if (gameState === 'ready') {
    draw();
    requestAnimationFrame(gameLoop);
    return;
  }
  draw();
  requestAnimationFrame(gameLoop);
}

function startGame() {
  if (gameState === 'ready' || gameState === 'win') {
    resetGameObjects();
    gameState = 'playing';
  }
  updateUI();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  gameState = 'ready';
  currentUnit = 0;
  actionMode = null;
  highlights = [];
  resetGameObjects();
  draw();
  updateUI();
}

function init() {
  resetGameObjects();
  draw();
  updateUI();
}

init();
