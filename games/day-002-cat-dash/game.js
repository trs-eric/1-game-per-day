/**
 * CAT DASH - Day 002
 * Fast pixel-art infinite platformer / runner.
 * Controls: Left/Right move, Space jump, Ctrl stops + charges super jump.
 * Reach the glowing goal platform to advance each level. Quick action!
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const WIDTH = 800;
const HEIGHT = 600;

// Game state
let gameState = {
  running: false,
  paused: false,
  score: 0,
  lastTime: 0,
  state: 'ready' // ready, playing, dead
};

let level = 1;
let distance = 0;
let camX = 0;
let charge = 0;
let wasCtrl = false;
let nextGoalX = 0;
let levelStartX = 60;

// --- INPUT ---
const keys = {};
let spacePressed = false;
let prevSpace = false;

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    spacePressed = true;
    if (!gameState.running) startGame();
  }
  if (k === 'r') {
    if (gameState.state === 'dead') respawnLevel();
    else resetGame();
  }
  if (k === 'control') {
    // handled in update
  }
});

window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  if (e.key === ' ' || e.key === 'Spacebar') spacePressed = false;
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  // mouse not heavily used but keep
});
canvas.addEventListener('mousedown', () => { if (!gameState.running) startGame(); });

// --- PLAYER & WORLD ---
let player = {
  x: 90,
  y: 310,
  vx: 0,
  vy: 0,
  w: 22,
  h: 18,
  facing: 1,
  anim: 0,
  onGround: false
};

let platforms = [];
let particles = [];

// Physics (tuned for quick responsive action)
const GRAV = 0.82;
const MAX_VY = 13;
const MOVE_ACC = 0.72;
const AIR_ACC = 0.38;
const FRICTION = 0.78;
const MAX_VX = 5.8;
const NORMAL_JUMP = -11.4;
const MAX_SUPER = 10.2;

function resetGameObjects() {
  player.x = 90;
  player.y = 310;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.anim = 0;
  player.onGround = false;
  camX = 0;
  level = 1;
  distance = 0;
  charge = 0;
  wasCtrl = false;
  nextGoalX = 0;
  levelStartX = 60;
  gameState.score = 0;
  gameState.state = 'ready';
  platforms = [];
  particles = [];

  // Starting platforms (mix horizontal + vertical)
  addPlatform(20, 345, 145, 14);
  addPlatform(195, 310, 68, 13);
  addPlatform(295, 275, 52, 12);
  addPlatform(370, 330, 95, 14);
  addPlatform(490, 290, 28, 58); // tall vertical platform
  addPlatform(560, 315, 75, 13);

  placeNewGoal();
  generateAhead();
  updateUI();
}

function addPlatform(x, y, w, h, goal = false) {
  platforms.push({ x, y, w, h, goal });
}

function placeNewGoal() {
  const advance = 820 + (level - 1) * 55 + Math.random() * 160;
  const gx = player.x + advance;
  let gy = 195 + Math.random() * 195;
  gy = Math.max(155, Math.min(400, gy));
  addPlatform(gx, gy, 95, 15, true);
  nextGoalX = gx + 47;
}

function generateAhead() {
  let maxNeeded = camX + WIDTH + 820;
  let rightmost = platforms.length ? Math.max(...platforms.map(p => p.x + p.w)) : 140;

  while (rightmost < maxNeeded) {
    const gap = 58 + Math.random() * (72 + level * 3.5);
    const px = rightmost + gap;

    // wavy height bias + variance (higher difficulty later)
    let base = 325 + Math.sin(px * 0.0047) * 28;
    let py = base + (Math.random() - 0.5) * (105 + level * 7);
    py = Math.max(145, Math.min(425, py));

    let isTall = Math.random() < 0.31;
    let pw = isTall ? (18 + Math.random() * 16) : (55 + Math.random() * 88);
    let ph = isTall ? (38 + Math.random() * 68) : 13;

    addPlatform(px, py, pw, ph, false);
    rightmost = px + pw;
  }
}

function spawnParticles(x, y, count, color = '#a67c52') {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3.2,
      vy: Math.random() * -2.4 - 0.6,
      life: 14 + Math.random() * 13,
      color
    });
  }
}

// --- COLLISION & PHYSICS ---
function collide(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w ||
           a.y + a.h < b.y || a.y > b.y + b.h);
}

function resolveCollisions() {
  player.onGround = false;

  const p = { x: player.x, y: player.y, w: player.w, h: player.h };

  // X first (walls / vertical platforms)
  player.x += player.vx;
  for (let plat of platforms) {
    if (collide(player, plat)) {
      if (player.vx > 0) {
        player.x = plat.x - player.w - 0.1;
      } else if (player.vx < 0) {
        player.x = plat.x + plat.w + 0.1;
      }
      player.vx = 0;
    }
  }

  // Y second (tops + bottoms)
  player.y += player.vy;
  for (let plat of platforms) {
    if (collide(player, plat)) {
      if (player.vy >= 0) {
        // landing on top
        player.y = plat.y - player.h;
        player.vy = 0;
        player.onGround = true;
        if (Math.abs(player.vy) < 0.1 && Math.random() < 0.6) {
          spawnParticles(player.x + player.w * 0.3, player.y + player.h, 2, '#6b4423');
        }
        // goal handled in post-collision scan (see update)
      } else {
        // hit head
        player.y = plat.y + plat.h + 0.1;
        player.vy = Math.min(0.6, player.vy * -0.2);
      }
    }
  }
}

function completeLevel(goalPlat) {
  // remove the goal platform
  platforms = platforms.filter(p => p !== goalPlat);

  levelStartX = player.x;
  level++;
  gameState.score += 85 + level * 22;
  distance = Math.max(distance, player.x - 60);

  // celebration particles
  spawnParticles(goalPlat.x + 30, goalPlat.y - 6, 9, '#fff3b0');
  spawnParticles(goalPlat.x + 65, goalPlat.y - 4, 7, '#f9c74f');

  placeNewGoal();
  generateAhead();

  updateUI();
}

// --- UPDATE ---
function update(dt) {
  if (gameState.state !== 'playing') return;

  const frameScale = dt / 16;

  // --- INPUT MOVEMENT ---
  let left = keys['arrowleft'] || keys['a'];
  let right = keys['arrowright'] || keys['d'];
  let ctrlHeld = keys['control'];

  // charge super or stop
  if (ctrlHeld) {
    player.vx *= 0.38;
    charge = Math.min(1, charge + 0.0021 * dt);
  } else {
    // normal move
    let acc = player.onGround ? MOVE_ACC : AIR_ACC;
    if (left) {
      player.vx -= acc * frameScale;
      player.facing = -1;
    }
    if (right) {
      player.vx += acc * frameScale;
      player.facing = 1;
    }
  }

  // Apply friction / drag
  if (player.onGround) {
    player.vx *= Math.pow(FRICTION, frameScale);
  } else {
    player.vx *= 0.965;
  }
  player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, player.vx));

  // Normal jump (edge triggered)
  if (spacePressed && !prevSpace && player.onGround) {
    player.vy = NORMAL_JUMP;
    player.onGround = false;
    spawnParticles(player.x + 4, player.y + player.h + 1, 5, '#c9b28a');
  }
  prevSpace = spacePressed;

  // Super jump on ctrl release
  if (!ctrlHeld && wasCtrl && charge > 0.04) {
    const boost = NORMAL_JUMP - (charge * MAX_SUPER);
    player.vy = boost;
    player.vx += player.facing * (1.6 + charge * 2.3);
    player.onGround = false;
    spawnParticles(player.x + player.w / 2, player.y + player.h, 7 + Math.floor(charge * 6), '#ffeb3b');
    spawnParticles(player.x + player.w / 2, player.y + player.h + 2, 4, '#f4a261');
    charge = 0;
  }
  wasCtrl = ctrlHeld;

  if (!ctrlHeld && charge > 0) charge = Math.max(0, charge - 0.004 * dt);

  // Gravity
  player.vy += GRAV * frameScale;
  if (player.vy > MAX_VY) player.vy = MAX_VY;

  // Collisions
  resolveCollisions();

  // Post-collision goal check (safe)
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    if (p.goal && player.onGround && collide(player, p)) {
      completeLevel(p);
      break;
    }
  }

  // Keep on reasonable height floor for first platforms
  if (player.y > HEIGHT + 40) {
    die();
    return;
  }

  // Prevent going too far behind
  if (player.x < camX + 12) {
    player.x = camX + 12;
    player.vx = Math.max(0, player.vx);
  }

  // Animation
  player.anim += (Math.abs(player.vx) > 0.8 ? 0.19 : 0.06) * frameScale;
  if (!player.onGround) player.anim += 0.04 * frameScale;

  // Camera follow (forward bias, quick action)
  const targetCam = player.x - 255;
  camX = camX * 0.65 + targetCam * 0.35;
  if (camX < 0) camX = 0;

  // Generate + cull
  generateAhead();
  platforms = platforms.filter(p => p.x + p.w > camX - 70);

  // Distance + score
  distance = Math.max(distance, player.x - 60);
  gameState.score = (level - 1) * 95 + Math.floor(distance / 11);

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const pr = particles[i];
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.vy += 0.18;
    pr.life -= 1;
    if (pr.life <= 0) particles.splice(i, 1);
  }

  updateUI();
}

function die() {
  gameState.state = 'dead';
  gameState.running = false;
  spawnParticles(player.x + 6, player.y + 8, 11, '#ff6b6b');
  updateUI();
}

function respawnLevel() {
  // Respawn at start of current level section
  player.x = levelStartX + 30;
  player.y = 280;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  camX = Math.max(0, player.x - 200);
  charge = 0;
  gameState.state = 'playing';
  gameState.running = true;
  gameState.lastTime = performance.now();
  // cull far ahead a bit but keep recent platforms
  platforms = platforms.filter(p => p.x < player.x + 1400);
  updateUI();
  requestAnimationFrame(gameLoop);
}

// --- DRAW ---
function drawPixelCat(sx, sy, facing, anim, onGround, charging) {
  const s = 2.0; // pixel scale
  ctx.save();
  ctx.translate(Math.floor(sx), Math.floor(sy));
  if (facing < 0) ctx.scale(-1, 1);

  const crouch = charging ? 2.5 : 0;
  const bob = onGround ? Math.sin(anim * 1.6) * 0.8 : 0;

  // Tail (chunky pixel)
  ctx.fillStyle = '#c75b39';
  const tailWag = Math.sin(anim * 1.3) * (onGround ? 3.2 : 1.6);
  ctx.fillRect(-3 * s, 3 * s + crouch, 5 * s, 2 * s);
  ctx.fillRect(-8 * s + tailWag * 0.5, 4 * s + crouch + bob * 0.3, 6 * s, 2 * s);

  // Body
  ctx.fillStyle = '#f4a261';
  ctx.fillRect(-2 * s, 1 * s + crouch, 12 * s, 7 * s);
  ctx.fillStyle = '#ffe8d6';
  ctx.fillRect(0, 4 * s + crouch, 8 * s, 4 * s);

  // Stripes
  ctx.fillStyle = '#e76f51';
  ctx.fillRect(3 * s, 2 * s + crouch, 2 * s, 1 * s);
  ctx.fillRect(7 * s, 3 * s + crouch, 2 * s, 1 * s);

  // Head
  ctx.fillStyle = '#f4a261';
  ctx.fillRect(8 * s, -3 * s + crouch * 0.6, 8 * s, 8 * s);

  // Ears
  ctx.fillRect(8 * s, -5 * s + crouch * 0.6, 2 * s, 2 * s);
  ctx.fillRect(14 * s, -5 * s + crouch * 0.6, 2 * s, 2 * s);
  ctx.fillStyle = '#f28482';
  ctx.fillRect(8.4 * s, -4.2 * s + crouch * 0.6, 0.9 * s, 0.9 * s);
  ctx.fillRect(14.6 * s, -4.2 * s + crouch * 0.6, 0.9 * s, 0.9 * s);

  // Eyes
  ctx.fillStyle = '#222222';
  const eyeShift = charging ? 0.5 : 0;
  ctx.fillRect(10.5 * s, 1 * s + eyeShift + crouch * 0.4, 1.2 * s, 1.6 * s);
  ctx.fillRect(14 * s, 1 * s + eyeShift + crouch * 0.4, 1.2 * s, 1.6 * s);

  // Nose + mouth
  ctx.fillStyle = '#c75b39';
  ctx.fillRect(16 * s, 3 * s + crouch * 0.3, 1.2 * s, 1 * s);

  // Legs (pixel style animation)
  ctx.fillStyle = '#d97706';
  if (onGround && !charging) {
    const leg1 = Math.sin(anim * 2.1) * 1.8;
    const leg2 = Math.sin(anim * 2.1 + 1.8) * 1.8;
    ctx.fillRect(0 * s, 7 * s + crouch, 2.5 * s, 4.5 * s + leg1);
    ctx.fillRect(6 * s, 7 * s + crouch, 2.5 * s, 4.5 * s + leg2);
  } else {
    // tucked or together
    ctx.fillRect(1 * s, 7 * s + crouch + 1, 2.5 * s, 3.5 * s);
    ctx.fillRect(5 * s, 7 * s + crouch + 1, 2.5 * s, 3.5 * s);
  }

  // Ear tips highlight
  ctx.fillStyle = '#ffe8d6';
  ctx.fillRect(8 * s, -4.6 * s + crouch * 0.6, 0.7 * s, 0.6 * s);

  ctx.restore();
}

function drawPlatform(p) {
  const sx = Math.floor(p.x - camX);
  const sy = Math.floor(p.y);

  if (p.goal) {
    // Glowing goal platform
    ctx.fillStyle = '#f9c74f';
    ctx.fillRect(sx, sy, p.w, p.h);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(sx, sy, p.w, 5);

    // Flag pole
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + p.w / 2 - 1, sy - 22, 3, 23);

    // Flag
    ctx.fillStyle = '#ff4d6d';
    ctx.fillRect(sx + p.w / 2 + 2, sy - 21, 15, 9);

    // Extra highlight pulse
    const pulse = Math.sin(Date.now() / 160) * 1.8 + 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - pulse, sy - pulse, p.w + pulse * 2, p.h + pulse * 1.6);
    ctx.lineWidth = 1;
  } else {
    // Normal platform (horizontal wide or vertical tall)
    const isVertical = p.h > 22;
    ctx.fillStyle = isVertical ? '#5c4033' : '#6b4423';
    ctx.fillRect(sx, sy, p.w, p.h);

    // Top surface
    ctx.fillStyle = isVertical ? '#7a5c48' : '#8fbc5e';
    ctx.fillRect(sx, sy, p.w, 4);

    // Side detail for tall
    if (isVertical) {
      ctx.fillStyle = '#8d5524';
      ctx.fillRect(sx + 3, sy + 8, 4, p.h - 14);
    }
  }
}

function draw() {
  // Background
  ctx.fillStyle = '#0f1f33';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Parallax distant "pixels" / stars / hints
  ctx.fillStyle = '#ffffff15';
  for (let i = 0; i < 18; i++) {
    const px = ((i * 71 + camX * 0.08) % (WIDTH + 80)) - 20;
    const py = 38 + ((i * 31) % 110);
    ctx.fillRect(px, py, 2, 2);
  }

  // Very distant horizontal lines for depth
  ctx.fillStyle = '#1e3a5f';
  for (let yy = 120; yy < 520; yy += 78) {
    ctx.fillRect(0, yy, WIDTH, 26);
  }

  // Platforms
  for (let p of platforms) {
    drawPlatform(p);
  }

  // Player (pixel cat)
  const sx = player.x - camX;
  const sy = player.y;
  drawPixelCat(sx, sy, player.facing, player.anim, player.onGround, charge > 0.05);

  // Particles
  for (let pr of particles) {
    ctx.fillStyle = pr.color;
    const alpha = Math.max(0.2, pr.life / 18);
    ctx.globalAlpha = alpha;
    ctx.fillRect(Math.floor(pr.x - camX), Math.floor(pr.y), 2.5, 2.5);
  }
  ctx.globalAlpha = 1;

  // Charge meter
  if (charge > 0.03) {
    const barX = sx - 13;
    const barY = sy - 21;
    ctx.fillStyle = '#222';
    ctx.fillRect(barX, barY, 27, 4);
    ctx.fillStyle = charge > 0.75 ? '#ffeb3b' : '#ff9f1c';
    ctx.fillRect(barX, barY, 27 * charge, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(barX, barY, 27 * charge, 1);
  }

  // HUD (canvas)
  ctx.fillStyle = '#e0f0ff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('LEVEL ' + level, 18, 26);
  ctx.fillText('SCORE ' + Math.floor(gameState.score), 135, 26);

  if (gameState.state === 'dead') {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('FELL OFF!', WIDTH / 2 - 75, HEIGHT / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Press R to retry level', WIDTH / 2 - 85, HEIGHT / 2 + 26);
  }

  // Tiny controls reminder (bottom)
  if (gameState.state === 'playing') {
    ctx.fillStyle = '#556677';
    ctx.font = '10px monospace';
    ctx.fillText('SPACE jump  •  CTRL charge super  •  R reset', 18, HEIGHT - 14);
  }
}

// --- UI / LOOP ---
function updateUI() {
  const lvlEl = document.getElementById('level');
  const scoreEl = document.getElementById('score');
  const statusEl = document.getElementById('status');

  if (lvlEl) lvlEl.textContent = `Level: ${level}`;
  if (scoreEl) scoreEl.textContent = `Score: ${Math.floor(gameState.score)}`;

  if (!statusEl) return;
  if (gameState.state === 'dead') {
    statusEl.textContent = 'FELL!';
  } else if (gameState.paused) {
    statusEl.textContent = 'PAUSED';
  } else if (gameState.running) {
    statusEl.textContent = 'RUN!';
  } else {
    statusEl.textContent = 'Press Start or SPACE';
  }
}

function gameLoop(timestamp = 0) {
  if (!gameState.running || gameState.paused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const delta = Math.min(50, timestamp - gameState.lastTime || 16);
  gameState.lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  if (gameState.state === 'ready' || !gameState.running) {
    resetGameObjects();
    gameState.running = true;
    gameState.paused = false;
    gameState.state = 'playing';
    gameState.lastTime = performance.now();
    levelStartX = player.x;
  } else if (gameState.state === 'playing') {
    gameState.paused = false;
  }
  updateUI();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  gameState.running = false;
  gameState.paused = false;
  gameState.state = 'ready';
  resetGameObjects();
  ctx.fillStyle = '#0f1f33';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  draw();
  updateUI();
}

function init() {
  resetGameObjects();
  draw();
  updateUI();

  // Hint
  setTimeout(() => {
    if (!gameState.running) {
      const s = document.getElementById('status');
      if (s) s.textContent = 'Press Start or SPACE to begin';
    }
  }, 900);
}

init();
