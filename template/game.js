/**
 * TEMPLATE GAME
 * Replace this entire file with your game code.
 * 
 * Tips:
 * - Keep it under ~150-300 lines for "1 game per day" vibe.
 * - Use the canvas context for all drawing.
 * - Handle keyboard + mouse + touch.
 * - Make it fun within the first 10 seconds.
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let gameState = {
  running: false,
  paused: false,
  score: 0,
  lastTime: 0
};

// --- INPUT ---
const keys = {};
const mouse = { x: 0, y: 0, down: false };

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    if (gameState.running) togglePause();
    else startGame();
  }
  if (e.key.toLowerCase() === 'r') resetGame();
});

window.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

canvas.addEventListener('mousedown', () => mouse.down = true);
canvas.addEventListener('mouseup', () => mouse.down = false);

// Touch support (basic)
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.touches[0].clientX - rect.left;
  mouse.y = e.touches[0].clientY - rect.top;
  mouse.down = true;
  if (!gameState.running) startGame();
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.touches[0].clientX - rect.left;
  mouse.y = e.touches[0].clientY - rect.top;
});
canvas.addEventListener('touchend', () => mouse.down = false);

// --- GAME OBJECTS ---
let player = { x: 100, y: 250, size: 24 };

function resetGameObjects() {
  player = { x: 100, y: 250, size: 24 };
  gameState.score = 0;
  updateUI();
}

// --- GAME LOOP ---
function gameLoop(timestamp = 0) {
  if (!gameState.running || gameState.paused) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const delta = timestamp - gameState.lastTime;
  gameState.lastTime = timestamp;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

function update(delta) {
  const speed = 0.25;

  // Simple player movement (WASD + arrows)
  if (keys['arrowleft'] || keys['a']) player.x -= speed * delta;
  if (keys['arrowright'] || keys['d']) player.x += speed * delta;
  if (keys['arrowup'] || keys['w']) player.y -= speed * delta;
  if (keys['arrowdown'] || keys['s']) player.y += speed * delta;

  // Follow mouse when held
  if (mouse.down) {
    player.x += (mouse.x - player.x) * 0.1;
    player.y += (mouse.y - player.y) * 0.1;
  }

  // Keep inside canvas
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));

  // === YOUR GAME LOGIC HERE ===
  // Example: increase score over time
  gameState.score += delta * 0.005;
  updateUI();
}

function draw() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid background
  ctx.strokeStyle = '#1f1f1f';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Player
  ctx.fillStyle = '#22f1ff';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
  ctx.fill();

  // Simple "target" example
  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(canvas.width - 180, canvas.height / 2 - 20, 40, 40);

  // Instructions
  ctx.fillStyle = '#666';
  ctx.font = '14px Inter, system-ui, sans-serif';
  ctx.fillText('Move with WASD or drag mouse', 30, canvas.height - 30);
}

// --- CONTROLS ---
function updateUI() {
  document.getElementById('score').textContent = `Score: ${Math.floor(gameState.score)}`;
  document.getElementById('status').textContent = gameState.paused ? 'PAUSED' : (gameState.running ? 'PLAYING' : 'READY');
}

function startGame() {
  if (!gameState.running) {
    resetGameObjects();
    gameState.running = true;
    gameState.paused = false;
    gameState.lastTime = performance.now();
  } else {
    gameState.paused = false;
  }
  updateUI();
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (gameState.running) {
    gameState.paused = !gameState.paused;
    if (!gameState.paused) {
      gameState.lastTime = performance.now();
      requestAnimationFrame(gameLoop);
    }
    updateUI();
  }
}

function togglePause() {
  pauseGame();
}

function resetGame() {
  gameState.running = false;
  gameState.paused = false;
  resetGameObjects();
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  updateUI();
}

// Initial draw
function init() {
  resetGameObjects();
  draw();
  updateUI();
  
  // Optional: auto-start hint
  setTimeout(() => {
    if (!gameState.running) {
      document.getElementById('status').textContent = 'Press Start or Space';
    }
  }, 1200);
}

init();
