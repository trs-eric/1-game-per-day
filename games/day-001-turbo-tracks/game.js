/**
 * Turbo Tracks - Top-down racer with realistic driving physics
 * Day 001 of 1 Game Per Day
 * 
 * Features:
 * - Camera follows player car
 * - Somewhat realistic top-down car physics (longitudinal/lateral forces)
 * - 7 unique large scrolling tracks
 * - 3 lap races
 * - 4 car models with distinct handling
 * - Player car color selection
 */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const WIDTH = 800;
const HEIGHT = 600;

let gameState = 'menu'; // menu | racing | results
let playerCar = null;
let aiCars = [];
let currentTrack = null;
let trackIndex = 0;
let selectedModel = 0;
let playerColor = '#e11d48';
let startTime = 0;
let raceFinished = false;
let results = [];

// Menu selection state (for in-canvas arcade UI)
let menuMouse = { x: 0, y: 0, down: false };
let selectedCarIndex = 0;
let selectedColorIndex = 0;
let selectedTrackIndex = 0;

// Audio
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let skidNoise = null;
let skidGain = null;

const keys = {};

// Car models (renamed to avoid trademarks)
const CAR_MODELS = [
  { id: 0, name: 'Flux GT', maxSpeed: 340, accel: 175, turnRate: 2.1, grip: 5.4 },
  { id: 1, name: 'Scarlet GT', maxSpeed: 380, accel: 155, turnRate: 1.75, grip: 4.3 },
  { id: 2, name: 'Classic Turbo', maxSpeed: 355, accel: 165, turnRate: 2.4, grip: 5.9 },
  { id: 3, name: 'Venom GT', maxSpeed: 365, accel: 190, turnRate: 1.85, grip: 4.9 },
];

const COLORS = [
  '#e11d48', '#1d4ed8', '#166534', '#854d0e',
  '#581c87', '#0f766e', '#b45309', '#334155'
];

// 7 tracks - large closed loops
const TRACKS = [
  { name: 'Desert Oval', points: generateOval(1200, 950, 720, 480, 22) },
  { name: 'Chicane Run', points: generateChicaneTrack(1100, 1000, 680, 440) },
  { name: 'Long Haul', points: generateLongTrack(1300, 1100, 850, 520) },
  { name: 'S-Bend Circuit', points: generateSBend(1150, 980, 700, 460) },
  { name: 'Hairpin Hell', points: generateHairpin(1250, 1050, 760, 500) },
  { name: 'Big Bend', points: generateBigBend(1080, 920, 650, 430) },
  { name: 'Final Stretch', points: generateFinalTrack(1220, 1020, 740, 490) }
];

function generateOval(cx, cy, rx, ry, segs) {
  const pts = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function generateChicaneTrack(cx, cy, rx, ry) {
  const pts = generateOval(cx, cy, rx, ry, 20);
  // Add chicane by offsetting a few points
  pts[5].x -= 90; pts[5].y -= 40;
  pts[6].x -= 70; pts[6].y += 30;
  pts[7].x -= 50;
  pts[13].x += 80; pts[13].y -= 25;
  return pts;
}

function generateLongTrack(cx, cy, rx, ry) {
  const pts = [];
  const segs = 26;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let r = (i % 4 < 2) ? rx : ry * 0.7;
    pts.push({
      x: cx + Math.cos(a) * r + (i === 8 || i === 20 ? 120 : 0),
      y: cy + Math.sin(a) * ry * (0.9 + Math.sin(i) * 0.1)
    });
  }
  return pts;
}

function generateSBend(cx, cy, rx, ry) {
  const pts = generateOval(cx, cy, rx, ry, 18);
  pts[3].y -= 110; pts[4].y -= 90;
  pts[5].y -= 40;
  pts[10].y += 100; pts[11].y += 80;
  pts[12].y += 30;
  return pts;
}

function generateHairpin(cx, cy, rx, ry) {
  const pts = [];
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    let a = (i / segs) * Math.PI * 2;
    let r = rx;
    if (i > 4 && i < 10) r = ry * 0.55; // tight hairpin
    pts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * ry
    });
  }
  return pts;
}

function generateBigBend(cx, cy, rx, ry) {
  const pts = generateOval(cx, cy, rx, ry, 16);
  pts[2].x += 140; pts[3].x += 90;
  pts[8].y += 130; pts[9].y += 70;
  return pts;
}

function generateFinalTrack(cx, cy, rx, ry) {
  const pts = [];
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let xx = cx + Math.cos(a) * rx;
    let yy = cy + Math.sin(a) * ry;
    if (i % 5 === 2) xx += 60;
    pts.push({ x: xx, y: yy });
  }
  return pts;
}

function getMinDistanceToTrack(x, y, points) {
  let minDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const d = pointToSegmentDist(x, y, p1.x, p1.y, p2.x, p2.y);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

class Car {
  constructor(x, y, angle, color, modelId, isPlayer) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.color = color;
    this.modelId = modelId;
    this.isPlayer = isPlayer;
    this.laps = 0;
    this.currentWaypoint = 0;
    this.prevX = x;
    this.prevY = y;
    this.finishTime = 0;
  }

  getStats() {
    return CAR_MODELS[this.modelId];
  }

  update(dt, throttle, brake, steerInput, points, isAI = false) {
    const stats = this.getStats();
    let actualThrottle = throttle;
    let actualBrake = brake;
    let actualSteer = steerInput;

    if (isAI) {
      // Simple AI path following
      const wp = points[this.currentWaypoint];
      const dx = wp.x - this.x;
      const dy = wp.y - this.y;
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      actualSteer = Math.max(-1, Math.min(1, diff * 2.2));
      actualThrottle = 0.82 + (Math.sin(Date.now() / 900 + this.modelId) * 0.08);
      actualBrake = 0;
    }

    // Physics - somewhat realistic top-down model
    const dirX = Math.cos(this.angle);
    const dirY = Math.sin(this.angle);

    // Forward velocity component
    const forward = this.speed;

    // Apply longitudinal forces
    let accel = actualThrottle * stats.accel;
    if (actualBrake > 0.05) accel = -actualBrake * stats.accel * 1.6;

    let newSpeed = forward + accel * dt;
    newSpeed *= 0.985; // rolling resistance + aero drag

    // Lateral (cornering) simulation
    const lateral = 0; // simplified - we apply through steering only
    const gripFactor = stats.grip / 5;

    // Update angle (steering)
    const speedFactor = Math.max(0.4, Math.min(1, Math.abs(newSpeed) / 120));
    this.angle += actualSteer * stats.turnRate * speedFactor * dt * (newSpeed > 0 ? 1 : 0.4);

    // Clamp speed
    const maxSp = stats.maxSpeed;
    if (newSpeed > maxSp) newSpeed = maxSp;
    if (newSpeed < -45) newSpeed = -45;

    this.speed = newSpeed;

    // Move
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Track surface check
    const dist = getMinDistanceToTrack(this.x, this.y, points);
    const ROAD_HALF = 58;
    if (dist > ROAD_HALF) {
      this.speed *= 0.91;
      if (dist > ROAD_HALF + 25) this.speed *= 0.75;
    }

    // Waypoint & lap counting
    const wp = points[this.currentWaypoint];
    if (Math.hypot(wp.x - this.x, wp.y - this.y) < 85) {
      this.currentWaypoint = (this.currentWaypoint + 1) % points.length;
      if (this.currentWaypoint === 0) {
        this.laps++;
        if (this.isPlayer) {
          playLapSound();
        }
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.save();
    ctx.translate(this.x - camX, this.y - camY);
    ctx.rotate(this.angle);

    const stats = this.getStats();
    const len = 42 + (stats.maxSpeed - 270) * 0.1;
    const wid = 19;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len/2 + 3, -wid/2 + 2, len, wid);

    // Body
    ctx.fillStyle = this.color;
    ctx.fillRect(-len/2, -wid/2, len, wid);

    // Windows
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-len/2 + 8, -wid/2 + 3, len - 16, wid - 6);

    // Headlights / details
    ctx.fillStyle = '#facc15';
    ctx.fillRect(len/2 - 5, -wid/2 + 3, 3, 4);
    ctx.fillRect(len/2 - 5, wid/2 - 7, 3, 4);

    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-len/2 + 5, -wid/2 - 3, 7, 3);
    ctx.fillRect(-len/2 + 5, wid/2 , 7, 3);
    ctx.fillRect(len/2 - 12, -wid/2 - 3, 7, 3);
    ctx.fillRect(len/2 - 12, wid/2 , 7, 3);

    ctx.restore();
  }
}

let camera = { x: 0, y: 0, vx: 0, vy: 0 };
let lastTime = 0;

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (gameState === 'menu') {
    // Car selection
    const carStartY = 195;
    for (let i = 0; i < CAR_MODELS.length; i++) {
      const y = carStartY + i * 38;
      if (mx > 60 && mx < 280 && my > y && my < y + 32) {
        selectedCarIndex = i;
        return;
      }
    }

    // Color selection
    for (let i = 0; i < COLORS.length; i++) {
      const x = 320 + (i % 4) * 38;
      const y = 195 + Math.floor(i / 4) * 38;
      if (mx > x && mx < x + 32 && my > y && my < y + 32) {
        selectedColorIndex = i;
        return;
      }
    }

    // Track selection
    for (let i = 0; i < TRACKS.length; i++) {
      const y = 195 + i * 32;
      if (mx > 500 && mx < 740 && my > y && my < y + 28) {
        selectedTrackIndex = i;
        return;
      }
    }

    // Start button
    const startX = WIDTH/2 - 120;
    const startY = 520;
    if (mx > startX && mx < startX + 240 && my > startY && my < startY + 50) {
      startRace();
    }
    return;
  }

  if (gameState === 'results') {
    const btnY = HEIGHT - 130;

    // Race again
    if (mx > WIDTH/2 - 180 && mx < WIDTH/2 - 20 && my > btnY && my < btnY + 42) {
      startRace();
      return;
    }

    // Change setup (back to menu)
    if (mx > WIDTH/2 + 20 && mx < WIDTH/2 + 180 && my > btnY && my < btnY + 42) {
      gameState = 'menu';
      return;
    }
  }
}

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Engine tone (low osc + slight modulation)
    engineOsc = audioCtx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;

    const engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 600;

    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0.0;

    const engineVol = audioCtx.createGain();
    engineVol.gain.value = 0.25;

    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(engineVol);
    engineVol.connect(audioCtx.destination);

    engineOsc.start();

    // Skid noise
    skidNoise = audioCtx.createBufferSource();
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    skidNoise.buffer = buffer;
    skidNoise.loop = true;

    const skidFilter = audioCtx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 800;
    skidFilter.Q.value = 2;

    skidGain = audioCtx.createGain();
    skidGain.gain.value = 0;

    const skidVol = audioCtx.createGain();
    skidVol.gain.value = 0.15;

    skidNoise.connect(skidFilter);
    skidFilter.connect(skidGain);
    skidGain.connect(skidVol);
    skidVol.connect(audioCtx.destination);

    skidNoise.start();
  } catch (e) {
    console.warn('Audio not available');
  }
}

function updateAudio() {
  if (!audioCtx || !playerCar) return;

  // Engine sound
  if (engineGain && engineOsc) {
    const speedNorm = Math.abs(playerCar.speed) / 380;
    engineOsc.frequency.value = 35 + speedNorm * 65;
    engineGain.gain.value = 0.15 + speedNorm * 0.35;
  }

  // Skid sound when off road or drifting
  if (skidGain) {
    const dist = getMinDistanceToTrack(playerCar.x, playerCar.y, currentTrack.points);
    const isSkidding = dist > 55 || (Math.abs(playerCar.speed) > 80 && Math.abs(steerInputFromKeys()) > 0.3);
    const target = isSkidding ? 0.6 : 0;
    skidGain.gain.value = skidGain.gain.value * 0.7 + target * 0.3;
  }
}

function steerInputFromKeys() {
  let s = 0;
  if (keys['arrowleft'] || keys['a']) s -= 1;
  if (keys['arrowright'] || keys['d']) s += 1;
  return s;
}

function playLapSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.3;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    setTimeout(() => {
      gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      setTimeout(() => osc.stop(), 500);
    }, 80);
  } catch(e){}
}

function stopAudio() {
  if (engineGain) engineGain.gain.value = 0;
  if (skidGain) skidGain.gain.value = 0;
}

function init() {
  selectedCarIndex = 0;
  selectedColorIndex = 0;
  selectedTrackIndex = 0;

  // Canvas-based arcade menu
  canvas.addEventListener('mousedown', handleCanvasClick);
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    menuMouse.x = e.clientX - rect.left;
    menuMouse.y = e.clientY - rect.top;
  });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  requestAnimationFrame(gameLoop);
}

// Arcade-style in-canvas menu
function drawMenu() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Title
  ctx.fillStyle = '#22f1ff';
  ctx.font = 'bold 42px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TURBO TRACKS', WIDTH/2, 80);

  ctx.fillStyle = '#fff';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText('80s Retro Racer • Top-Down', WIDTH/2, 115);

  // Car selection
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CHOOSE CAR', 60, 170);

  const carStartY = 195;
  CAR_MODELS.forEach((model, i) => {
    const y = carStartY + i * 38;
    const isSelected = i === selectedCarIndex;

    // Box
    ctx.fillStyle = isSelected ? '#22f1ff' : '#1f1f1f';
    ctx.fillRect(60, y, 220, 32);
    ctx.strokeStyle = isSelected ? '#fff' : '#444';
    ctx.strokeRect(60, y, 220, 32);

    ctx.fillStyle = isSelected ? '#000' : '#fff';
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText(model.name, 72, y + 21);
  });

  // Color selection
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('COLOR', 320, 170);

  COLORS.forEach((col, i) => {
    const x = 320 + (i % 4) * 38;
    const y = 195 + Math.floor(i / 4) * 38;
    const isSelected = i === selectedColorIndex;

    ctx.fillStyle = col;
    ctx.fillRect(x, y, 32, 32);
    if (isSelected) {
      ctx.strokeStyle = '#22f1ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 32, 32);
      ctx.lineWidth = 1;
    }
  });

  // Track selection
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('TRACKS', 500, 170);

  TRACKS.forEach((track, i) => {
    const y = 195 + i * 32;
    const isSelected = i === selectedTrackIndex;

    ctx.fillStyle = isSelected ? '#22f1ff' : '#1f1f1f';
    ctx.fillRect(500, y, 240, 28);
    ctx.strokeStyle = isSelected ? '#fff' : '#444';
    ctx.strokeRect(500, y, 240, 28);

    ctx.fillStyle = isSelected ? '#000' : '#fff';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`${i+1}. ${track.name}`, 510, y + 19);
  });

  // Preview car
  const previewX = WIDTH/2;
  const previewY = 420;
  ctx.save();
  ctx.translate(previewX, previewY);
  ctx.scale(2, 2);
  ctx.rotate(0.3);
  ctx.fillStyle = COLORS[selectedColorIndex];
  ctx.fillRect(-21, -9, 42, 18);
  ctx.fillStyle = '#222';
  ctx.fillRect(-13, -5, 20, 10);
  ctx.fillStyle = '#111';
  ctx.fillRect(-18, -10, 6, 4);
  ctx.fillRect(-18, 6, 6, 4);
  ctx.fillRect(10, -10, 6, 4);
  ctx.fillRect(10, 6, 6, 4);
  ctx.restore();

  // Start button
  const startX = WIDTH/2 - 120;
  const startY = 520;
  const startW = 240;
  const startH = 50;

  const hover = menuMouse.x > startX && menuMouse.x < startX+startW && menuMouse.y > startY && menuMouse.y < startY+startH;

  ctx.fillStyle = hover ? '#fff' : '#22f1ff';
  ctx.fillRect(startX, startY, startW, startH);
  ctx.fillStyle = hover ? '#000' : '#000';
  ctx.font = 'bold 20px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START RACE', startX + startW/2, startY + 33);

  ctx.textAlign = 'left';
}

function startRace() {
  // Use canvas menu selections
  selectedModel = selectedCarIndex;
  playerColor = COLORS[selectedColorIndex];
  trackIndex = selectedTrackIndex;

  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  currentTrack = TRACKS[trackIndex];

  // Start position
  const start = currentTrack.points[0];
  playerCar = new Car(start.x + 15, start.y - 25, 0.02, playerColor, selectedModel, true);

  // AI cars
  aiCars = [];
  for (let i = 0; i < 3; i++) {
    const modelId = (selectedModel + i + 1) % 4;
    const col = COLORS[(i + 3) % COLORS.length];
    const offset = (i + 1) * 19;
    const ai = new Car(start.x + 15, start.y + 18 + offset, 0.02, col, modelId, false);
    aiCars.push(ai);
  }

  // Reset state
  playerCar.laps = 0;
  aiCars.forEach(c => c.laps = 0);
  startTime = performance.now();
  raceFinished = false;
  results = [];

  camera.x = playerCar.x - 400;
  camera.y = playerCar.y - 300;
  camera.vx = 0;
  camera.vy = 0;

  gameState = 'racing';
  lastTime = performance.now();

  // Start sounds
  initAudio();
}

function update(dt) {
  if (gameState !== 'racing' || raceFinished) return;

  // Player input
  let throttle = 0;
  let brake = 0;
  let steer = 0;

  if (keys['arrowup'] || keys['w']) throttle = 1;
  if (keys['arrowdown'] || keys['s']) brake = 1;
  if (keys['arrowleft'] || keys['a']) steer = -1;
  if (keys['arrowright'] || keys['d']) steer = 1;

  playerCar.update(dt, throttle, brake, steer, currentTrack.points);

  // AI
  aiCars.forEach(ai => {
    ai.update(dt, 0, 0, 0, currentTrack.points, true);
  });

  // High-quality camera smoothing using damped spring (frame-rate independent)
  const look = playerCar.speed * 0.32;
  const targetX = playerCar.x - WIDTH / 2 + Math.cos(playerCar.angle) * look;
  const targetY = playerCar.y - HEIGHT / 2 + Math.sin(playerCar.angle) * look;

  const spring = 12;
  const damping = 0.75;

  camera.vx += (targetX - camera.x) * spring * dt - camera.vx * damping * dt;
  camera.vy += (targetY - camera.y) * spring * dt - camera.vy * damping * dt;

  camera.x += camera.vx * dt;
  camera.y += camera.vy * dt;

  // Check race end
  if (playerCar.laps >= 3 && !raceFinished) {
    endRace();
  }
}

function draw() {
  if (gameState === 'menu') {
    drawMenu();
    return;
  }

  // Grass background
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const camX = camera.x;
  const camY = camera.y;

  // Draw track
  drawTrack(currentTrack.points, camX, camY);

  // Draw AI cars
  aiCars.forEach(car => car.draw(ctx, camX, camY));

  // Draw player
  if (playerCar) playerCar.draw(ctx, camX, camY);

  // HUD
  if (gameState === 'racing') {
    drawHUD();
  }

  if (gameState === 'results') {
    drawResults();
  }
}

function drawTrack(points, camX, camY) {
  const roadWidth = 118;

  // Asphalt
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = roadWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x - camX, points[i].y - camY);
  }
  ctx.closePath();
  ctx.stroke();

  // Edge lines
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x - camX, points[i].y - camY);
  }
  ctx.closePath();
  ctx.stroke();

  // Center dashed line
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  ctx.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x - camX, points[i].y - camY);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish line
  const p0 = points[0];
  const p1 = points[1];
  const mx = (p0.x + p1.x) / 2 - camX;
  const my = (p0.y + p1.y) / 2 - camY;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(mx - 35, my - 35);
  ctx.lineTo(mx + 35, my + 35);
  ctx.stroke();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(12, 12, 200, 70);

  ctx.fillStyle = '#22f1ff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(`LAP ${Math.min(playerCar.laps + 1, 3)}/3`, 20, 28);

  const elapsed = (performance.now() - startTime) / 1000;
  const mins = Math.floor(elapsed / 60);
  const secs = (elapsed % 60).toFixed(2).padStart(4, '0');
  ctx.fillText(`TIME  ${mins}:${secs}`, 20, 46);

  ctx.fillStyle = '#fff';
  ctx.fillText(`SPEED ${Math.round(Math.abs(playerCar.speed))}`, 20, 64);
}

function endRace() {
  if (raceFinished) return;
  raceFinished = true;

  // Record times
  const playerTime = (performance.now() - startTime) / 1000;

  results = [{ name: 'YOU', time: playerTime, isPlayer: true }];

  aiCars.forEach((ai, i) => {
    // Simulate AI finish time (slightly randomized based on model)
    const base = playerTime + (0.8 + i * 0.6) + (Math.random() - 0.5) * 1.8;
    results.push({
      name: CAR_MODELS[ai.modelId].name,
      time: Math.max(playerTime - 1.5, base),
      isPlayer: false
    });
  });

  // Sort
  results.sort((a, b) => a.time - b.time);

  gameState = 'results';
  stopAudio();
}

function drawResults() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(120, 80, WIDTH - 240, HEIGHT - 160);

  ctx.strokeStyle = '#22f1ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(120, 80, WIDTH - 240, HEIGHT - 160);

  ctx.fillStyle = '#22f1ff';
  ctx.font = 'bold 32px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RACE COMPLETE', WIDTH/2, 130);

  ctx.fillStyle = '#fff';
  ctx.font = '16px Inter, sans-serif';
  ctx.fillText(`3 Laps • ${currentTrack.name}`, WIDTH/2, 160);

  // Results list
  ctx.textAlign = 'left';
  let y = 210;
  results.forEach((r, i) => {
    const t = r.time;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(4, '0');
    const timeStr = `${m}:${s}`;
    const text = `${i+1}. ${r.name}`;
    ctx.fillStyle = r.isPlayer ? '#22f1ff' : '#fff';
    ctx.fillText(text, 160, y);
    ctx.fillText(timeStr, 520, y);
    y += 32;
  });

  // Buttons
  ctx.textAlign = 'center';
  const btnY = HEIGHT - 130;

  // Restart
  ctx.fillStyle = '#22f1ff';
  ctx.fillRect(WIDTH/2 - 180, btnY, 160, 42);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('RACE AGAIN', WIDTH/2 - 100, btnY + 27);

  // Back to menu
  ctx.fillStyle = '#333';
  ctx.fillRect(WIDTH/2 + 20, btnY, 160, 42);
  ctx.fillStyle = '#fff';
  ctx.fillText('CHANGE SETUP', WIDTH/2 + 100, btnY + 27);
}



function gameLoop(timestamp = performance.now()) {
  if (gameState === 'racing') {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.08);
    lastTime = timestamp;

    update(dt);
    updateAudio();
    draw();
  } else if (gameState === 'menu') {
    drawMenu();
  } else if (gameState === 'results') {
    draw();
  }

  requestAnimationFrame(gameLoop);
}

function handleKeyDown(e) {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'r' || e.key === 'R') {
    if (gameState === 'racing') {
      // reset current race
      startRace();
    }
  }
}

function handleKeyUp(e) {
  keys[e.key.toLowerCase()] = false;
}

function setupMenu() {
  // Car models
  const carContainer = document.getElementById('car-select');
  carContainer.innerHTML = '';
  CAR_MODELS.forEach((model, idx) => {
    const btn = document.createElement('button');
    btn.textContent = model.name;
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '0.85rem';
    if (idx === selectedModel) btn.style.border = '2px solid #22f1ff';
    btn.onclick = () => {
      selectedModel = idx;
      setupMenu();
    };
    carContainer.appendChild(btn);
  });

  // Colors
  const colorContainer = document.getElementById('color-select');
  colorContainer.innerHTML = '';
  COLORS.forEach(col => {
    const swatch = document.createElement('div');
    swatch.style.width = '26px';
    swatch.style.height = '26px';
    swatch.style.backgroundColor = col;
    swatch.style.borderRadius = '4px';
    swatch.style.border = col === playerColor ? '3px solid #22f1ff' : '2px solid #555';
    swatch.style.cursor = 'pointer';
    swatch.onclick = () => {
      playerColor = col;
      setupMenu();
    };
    colorContainer.appendChild(swatch);
  });

  // Tracks
  const trackContainer = document.getElementById('track-select');
  trackContainer.innerHTML = '';
  TRACKS.forEach((track, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${idx + 1}. ${track.name}`;
    btn.style.fontSize = '0.75rem';
    btn.style.padding = '4px 8px';
    if (idx === trackIndex) btn.style.border = '2px solid #22f1ff';
    btn.onclick = () => {
      trackIndex = idx;
      setupMenu();
    };
    trackContainer.appendChild(btn);
  });

  document.getElementById('start-btn').onclick = startRace;
}

// Boot
init();