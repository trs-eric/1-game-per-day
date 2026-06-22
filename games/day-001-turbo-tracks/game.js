/**
 * Grand Turbo Racing - Top down racer with realistic driving physics
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

// Timing
let lapStartTime = 0;
let currentLapTime = 0;
let bestLapTime = Infinity;
let totalRaceTime = 0;

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
  { id: 0, name: 'Flux GT', maxSpeed: 1040, accel: 560, turnRate: 3.2, grip: 5.4, length: 44, width: 18 },
  { id: 1, name: 'Scarlet GT', maxSpeed: 1160, accel: 500, turnRate: 2.6, grip: 4.3, length: 46, width: 17 },
  { id: 2, name: 'Classic Turbo', maxSpeed: 1080, accel: 540, turnRate: 3.5, grip: 5.9, length: 40, width: 19 },
  { id: 3, name: 'Venom GT', maxSpeed: 1120, accel: 600, turnRate: 2.8, grip: 4.9, length: 45, width: 16 },
];

const COLORS = [
  '#e11d48', '#1d4ed8', '#166534', '#854d0e',
  '#581c87', '#0f766e', '#b45309', '#334155'
];

// 7 varied tracks - more distinct layouts
const TRACKS = [
  { name: 'Desert Oval', points: generateOval(1200, 950, 750, 500, 20) },  // classic big oval
  { name: 'Chicane Run', points: generateChicaneTrack(1100, 1000, 700, 450) }, // tight chicanes
  { name: 'Long Haul', points: generateLongTrack(1300, 1100, 900, 550) }, // long straights + turns
  { name: 'S-Bend Circuit', points: generateSBend(1150, 980, 720, 480) }, // multiple S curves
  { name: 'Hairpin Hell', points: generateTightHairpins(1250, 1050, 650, 420) }, // sharp hairpins
  { name: 'Big Bend', points: generateBigBend(1080, 920, 680, 460) }, // wide sweeping + twist
  { name: 'Final Stretch', points: generateComplexLoop(1220, 1020, 780, 510) }  // mixed complex
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
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let r = rx;
    if (i > 5 && i < 10 || i > 17 && i < 22) r *= 0.6; // straights with bends
    pts.push({
      x: cx + Math.cos(a) * r + (i === 6 || i === 18 ? 150 : 0),
      y: cy + Math.sin(a) * ry * 0.85
    });
  }
  return pts;
}

function generateSBend(cx, cy, rx, ry) {
  const pts = generateOval(cx, cy, rx, ry, 20);
  // Multiple S curves
  pts[2].x -= 80; pts[3].x -= 120; pts[4].x -= 60;
  pts[6].y += 90;
  pts[9].x += 100; pts[10].x += 130; pts[11].x += 70;
  pts[13].y -= 100;
  pts[16].x -= 90; pts[17].x -= 110;
  return pts;
}

function generateTightHairpins(cx, cy, rx, ry) {
  const pts = [];
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    let a = (i / segs) * Math.PI * 2;
    let r = rx * (0.7 + Math.sin(i * 1.5) * 0.3);
    if (i % 7 === 3) r *= 0.4; // tight hairpins
    pts.push({
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * ry
    });
  }
  return pts;
}

function generateBigBend(cx, cy, rx, ry) {
  const pts = generateOval(cx, cy, rx, ry, 18);
  // Wide sweep + twist
  pts[1].x += 180; pts[2].x += 220; pts[3].x += 150;
  pts[5].y -= 80;
  pts[10].x -= 130; pts[11].x -= 180; pts[12].x -= 100;
  pts[14].y += 90;
  return pts;
}

function generateComplexLoop(cx, cy, rx, ry) {
  const pts = [];
  const segs = 30;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let r = rx * (0.85 + Math.cos(i * 1.2) * 0.25);
    if (i > 10 && i < 16) r *= 0.5; // chicane section
    pts.push({
      x: cx + Math.cos(a) * r + Math.sin(i) * 40,
      y: cy + Math.sin(a) * ry * 0.9 + Math.cos(i * 1.5) * 35
    });
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

    // Lateral (cornering) simulation + high speed slip
    const speedFactor = Math.max(0.4, Math.min(1, Math.abs(newSpeed) / 120));
    const slipFactor = Math.max(0, (Math.abs(newSpeed) - 80) / 150) * Math.abs(actualSteer) * 1.5;

    // Apply slip at high speed turns - positional skid only, no hard speed drop
    if (slipFactor > 0.05) {
      const slipX = -dirY * slipFactor * 40 * dt;
      const slipY = dirX * slipFactor * 40 * dt;
      this.x += slipX;
      this.y += slipY;
      // Minimal speed loss, mostly just slide
      newSpeed *= (1 - slipFactor * 0.15);
      // Add rotational skid for more slide
      this.angle += actualSteer * 0.03 * (newSpeed / 150) * dt;
    }

    // Update angle (steering)
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
          const lapTime = (performance.now() - lapStartTime) / 1000;
          if (lapTime < bestLapTime) bestLapTime = lapTime;
          lapStartTime = performance.now();
        }
      }
    }
  }

  draw(ctx, camX, camY) {
    ctx.save();
    ctx.translate(this.x - camX, this.y - camY);
    ctx.rotate(this.angle);

    const stats = this.getStats();
    const len = stats.length || 42;
    const wid = stats.width || 18;
    const color = this.color;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-len/2 + 2, -wid/2 + 1, len + 2, wid + 2);

    if (this.modelId === 0) { // Flux GT - DeLorean: boxy with curves hint
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.rect(-len/2, -wid/2, len, wid);
      ctx.fill();
      // Rounded corners for realism
      ctx.beginPath();
      ctx.moveTo(-len/2 + 3, -wid/2);
      ctx.lineTo(len/2 - 3, -wid/2);
      ctx.quadraticCurveTo(len/2, -wid/2 + 2, len/2, -wid/2 + 5);
      ctx.lineTo(len/2, wid/2 - 5);
      ctx.quadraticCurveTo(len/2, wid/2 - 2, len/2 - 3, wid/2);
      ctx.lineTo(-len/2 + 3, wid/2);
      ctx.quadraticCurveTo(-len/2, wid/2 - 2, -len/2, wid/2 - 5);
      ctx.lineTo(-len/2, -wid/2 + 5);
      ctx.quadraticCurveTo(-len/2, -wid/2 + 2, -len/2 + 3, -wid/2);
      ctx.fill();
      // Doors
      ctx.fillStyle = '#333';
      ctx.fillRect(-len/2 + 5, -wid/2 + 2, 12, wid - 4);
      ctx.fillRect(-len/2 + 20, -wid/2 + 2, 12, wid - 4);
      // Headlights realistic
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(len/2 - 8, -wid/2 + 2, 5, 3);
      ctx.fillRect(len/2 - 8, wid/2 - 5, 5, 3);
    } else if (this.modelId === 1) { // Scarlet GT - Testarossa: long low wedge with curves
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-len/2, -wid/2 + 2);
      ctx.lineTo(len/2 - 10, -wid/2);
      ctx.quadraticCurveTo(len/2, -wid/2 + 1, len/2, 0);
      ctx.quadraticCurveTo(len/2, wid/2 - 1, len/2 - 10, wid/2);
      ctx.lineTo(-len/2, wid/2 - 2);
      ctx.quadraticCurveTo(-len/2 + 5, wid/2 - 2, -len/2, wid/2 - 5);
      ctx.lineTo(-len/2, -wid/2 + 5);
      ctx.quadraticCurveTo(-len/2 + 5, -wid/2 + 2, -len/2, -wid/2 + 2);
      ctx.fill();
      // Side vents
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 15, -wid/2 + 1, 8, 3);
      ctx.fillRect(-len/2 + 15, wid/2 - 4, 8, 3);
      // Headlights
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.ellipse(len/2 - 5, -wid/2 + 3, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(len/2 - 5, wid/2 - 3, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.modelId === 2) { // Classic Turbo - Porsche 911: curved body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-len/2 + 5, -wid/2);
      ctx.quadraticCurveTo(len/2 - 5, -wid/2 - 2, len/2, -wid/2 + 3);
      ctx.quadraticCurveTo(len/2 + 2, 0, len/2, wid/2 - 3);
      ctx.quadraticCurveTo(len/2 - 5, wid/2 + 2, -len/2 + 5, wid/2);
      ctx.quadraticCurveTo(-len/2 - 2, 0, -len/2 + 5, -wid/2);
      ctx.fill();
      // Spoiler
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 2, -wid/2 - 1, 6, 2);
      ctx.fillRect(-len/2 + 2, wid/2 - 1, 6, 2);
      // Headlights
      ctx.fillStyle = '#ffeb3b';
      ctx.fillRect(len/2 - 6, -wid/2 + 2, 4, 3);
      ctx.fillRect(len/2 - 6, wid/2 - 5, 4, 3);
    } else { // Venom GT - Viper: long curved aggressive
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-len/2, -wid/2 + 1);
      ctx.quadraticCurveTo(len/2 - 5, -wid/2, len/2 + 5, 0);
      ctx.quadraticCurveTo(len/2 - 5, wid/2, -len/2, wid/2 - 1);
      ctx.closePath();
      ctx.fill();
      // Long hood curve
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(-len/2 + 5, -wid/2 + 2);
      ctx.quadraticCurveTo(len/2 - 8, -wid/2 + 1, len/2, 0);
      ctx.quadraticCurveTo(len/2 - 8, wid/2 - 1, -len/2 + 5, wid/2 - 2);
      ctx.fill();
      // Side exhausts
      ctx.fillStyle = '#444';
      ctx.fillRect(len/2 - 15, -wid/2 + 3, 10, 2);
      ctx.fillRect(len/2 - 15, wid/2 - 5, 10, 2);
      // Headlights
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.ellipse(len/2 - 2, -wid/2 + 2, 2.5, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(len/2 - 2, wid/2 - 2, 2.5, 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Windows - curved for realism
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(-len/2 + 10, 0, len * 0.18, wid * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wheels with more realism
    ctx.fillStyle = '#111';
    const off = len * 0.28;
    ctx.fillRect(-off - 1, -wid/2 - 3, 8, 4);
    ctx.fillRect(off - 7, -wid/2 - 3, 8, 4);
    ctx.fillRect(-off - 1, wid/2 - 1, 8, 4);
    ctx.fillRect(off - 7, wid/2 - 1, 8, 4);
    // Rims for 3D
    ctx.fillStyle = '#666';
    ctx.fillRect(-off, -wid/2 - 2, 4, 2);
    ctx.fillRect(off - 6, -wid/2 - 2, 4, 2);

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
  if (!audioCtx || !playerCar || gameState !== 'racing' || raceFinished) {
    stopAudio();
    return;
  }

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
  if (engineGain) {
    engineGain.gain.linearRampToValueAtTime(0.001, audioCtx ? audioCtx.currentTime + 0.3 : 0);
  }
  if (skidGain) {
    skidGain.gain.value = 0;
  }
  // Also ramp engine osc freq down
  if (engineOsc && audioCtx) {
    engineOsc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.4);
  }
}

function playCheer() {
  if (!audioCtx) return;
  try {
    // Simulate crowd cheer with multiple short noise bursts and tones
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.8, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < data.length; j++) {
          data[j] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 800 + i * 50;
        filter.Q.value = 1;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.15;

        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.4;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        masterGain.connect(audioCtx.destination);

        noise.start();
        setTimeout(() => {
          gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
          setTimeout(() => noise.stop(), 700);
        }, 50);
      }, i * 120);
    }

    // Add some high tones for excitement
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1200 + i * 200;

        const gain = audioCtx.createGain();
        gain.gain.value = 0.2;

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        setTimeout(() => {
          gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
          setTimeout(() => osc.stop(), 600);
        }, 100);
      }, i * 180);
    }
  } catch(e){}
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
  ctx.fillText('GRAND TURBO RACING', WIDTH/2, 80);

  ctx.fillStyle = '#fff';
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText('RACE TO THE FINISH', WIDTH/2, 115);

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

  // Track preview (small scaled version of selected track)
  const tpX = 500;
  const tpY = 195 + 8 * 32 + 5;
  const tpW = 240;
  const tpH = 70;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(tpX, tpY, tpW, tpH);
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(tpX+1, tpY+1, tpW-2, tpH-2);

  const tpoints = TRACKS[selectedTrackIndex].points;
  if (tpoints && tpoints.length > 1) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (let p of tpoints) {
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
      miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
    }
    const scale = Math.min((tpW - 8) / (maxx - minx), (tpH - 8) / (maxy - miny));
    const offx = tpX + 4 - minx * scale;
    const offy = tpY + 4 - miny * scale;
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(offx + tpoints[0].x * scale, offy + tpoints[0].y * scale);
    for (let p of tpoints) {
      ctx.lineTo(offx + p.x * scale, offy + p.y * scale);
    }
    ctx.closePath();
    ctx.stroke();
    // road width hint
    ctx.strokeStyle = '#777';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Preview car (changes with selected model and color) - matches in-game 3D style
  const previewX = WIDTH/2;
  const previewY = 420;
  ctx.save();
  ctx.translate(previewX, previewY);
  ctx.scale(2.2, 2.2);
  ctx.rotate(0.25);
  const pm = CAR_MODELS[selectedCarIndex];
  const pLen = pm.length || 42;
  const pWid = pm.width || 18;
  const pColor = COLORS[selectedColorIndex];

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-pLen/2 + 2, -pWid/2 + 1, pLen, pWid);
  ctx.fillStyle = pColor;
  ctx.fillRect(-pLen/2, -pWid/2, pLen, pWid);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-pLen/2, -pWid/2 + pWid*0.55, pLen, pWid*0.45);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-pLen/2, -pWid/2, pLen, pWid*0.25);

  ctx.fillStyle = '#222';
  if (selectedCarIndex === 0) ctx.fillRect(-pLen/2 + 4, -pWid/2 + 2, pLen-8, pWid-4);
  else if (selectedCarIndex === 1) ctx.fillRect(-pLen/2 + 6, -pWid/2 + 2, pLen-14, pWid-4);
  else ctx.fillRect(-pLen/2 + 5, -pWid/2 + 2, pLen-9, pWid-4);

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-pLen/2 + 6, -pWid/2 + 3, pLen*0.3, pWid-6);
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(pLen/2 - 4, -pWid/2 + 2, 2, 2);
  ctx.fillRect(pLen/2 - 4, pWid/2 - 4, 2, 2);

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-pLen*0.28, -pWid/2 - 2, 5, 2);
  ctx.fillRect(pLen*0.18, -pWid/2 - 2, 5, 2);
  ctx.fillRect(-pLen*0.28, pWid/2, 5, 2);
  ctx.fillRect(pLen*0.18, pWid/2, 5, 2);
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
  const points = currentTrack.points;

  // Calculate starting direction from track
  const p0 = points[0];
  const p1 = points[1];
  const startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  // Redesigned starting grid: neat, spaced, on track, correct direction
  // Use larger spacing based on car size (~50 units)
  const carLength = 50;
  const spacing = carLength + 15;  // front to back
  const laneSep = 35;              // side to side

  // Start positions: behind the line p0, in direction opposite to track
  const backDirX = -Math.cos(startAngle);
  const backDirY = -Math.sin(startAngle);
  const sideDirX = -Math.sin(startAngle);  // perp
  const sideDirY = Math.cos(startAngle);

  // Player at front, lane 0
  const playerX = p0.x + backDirX * 10 + sideDirX * (laneSep / 2);
  const playerY = p0.y + backDirY * 10 + sideDirY * (laneSep / 2);
  playerCar = new Car(playerX, playerY, startAngle, playerColor, selectedModel, true);

  // AI cars: staggered grid, 2 lanes, rows behind
  aiCars = [];
  const positions = [
    {row: 1, lane: -1},  // row1, lane right
    {row: 2, lane: 1},   // row2, lane left
    {row: 3, lane: -1}   // row3, lane right
  ];
  for (let i = 0; i < 3; i++) {
    const pos = positions[i];
    const modelId = (selectedModel + i + 1) % 4;
    const col = COLORS[(i + 3) % COLORS.length];
    const ax = p0.x + backDirX * (10 + pos.row * spacing) + sideDirX * (pos.lane * laneSep);
    const ay = p0.y + backDirY * (10 + pos.row * spacing) + sideDirY * (pos.lane * laneSep);
    const ai = new Car(ax, ay, startAngle, col, modelId, false);
    aiCars.push(ai);
  }

  // Reset state
  playerCar.laps = 0;
  aiCars.forEach(c => c.laps = 0);
  startTime = performance.now();
  lapStartTime = startTime;
  currentLapTime = 0;
  bestLapTime = Infinity;
  totalRaceTime = 0;
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

  // Car-to-car collision (simple push apart)
  const allCars = [playerCar, ...aiCars];
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const c1 = allCars[i];
      const c2 = allCars[j];
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = 25;
      if (dist > 0 && dist < minDist) {
        const push = (minDist - dist) / 2;
        const px = dx / dist * push;
        const py = dy / dist * push;
        c1.x -= px;
        c1.y -= py;
        c2.x += px;
        c2.y += py;
        // Slight speed reduction on collision
        c1.speed *= 0.8;
        c2.speed *= 0.8;
      }
    }
  }

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

  // Grass / background detail (generated look)
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = '#256d2b';
  for (let i = 0; i < 60; i++) {
    const gx = ((i * 37) % (WIDTH + 100)) - 50;
    const gy = ((i * 53) % (HEIGHT + 80)) - 40;
    ctx.fillRect(gx, gy, 3, 1);
  }

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

  // Curbs / edges (generated look)
  ctx.strokeStyle = '#cc3333';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x - camX, points[i].y - camY);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Center line (better dashes)
  ctx.strokeStyle = '#ffeb3b';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.moveTo(points[0].x - camX, points[0].y - camY);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x - camX, points[i].y - camY);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Start/finish line (thicker, checkered feel)
  const p0 = points[0];
  const p1 = points[1];
  const mx = (p0.x + p1.x) / 2 - camX;
  const my = (p0.y + p1.y) / 2 - camY;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(mx - 42, my - 42);
  ctx.lineTo(mx + 42, my + 42);
  ctx.stroke();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(mx - 42, my - 42);
  ctx.lineTo(mx + 42, my + 42);
  ctx.stroke();

  // Starting grid squares painted on track (neat grid at start positions)
  ctx.fillStyle = '#444';
  ctx.strokeStyle = '#222';
  const gridSize = 28;
  const startDirX = p1.x - p0.x;
  const startDirY = p1.y - p0.y;
  const sLen = Math.hypot(startDirX, startDirY) || 1;
  const sdx = startDirX / sLen;
  const sdy = startDirY / sLen;
  const pdx = -sdy;  // perp
  const pdy = sdx;

  // Grid positions relative to p0, behind the line
  const gridOffsets = [
    {rx: 0, ry: 0}, {rx: 0, ry: -1}, 
    {rx: -1, ry: 0.5}, {rx: -1, ry: -1.5},
    {rx: -2, ry: 0}, {rx: -2, ry: -1},
    {rx: -3, ry: 0.5}, {rx: -3, ry: -1.5}
  ];
  for (let off of gridOffsets) {
    const gx = p0.x + sdx * (off.rx * 45 - 20) + pdx * (off.ry * 32);
    const gy = p0.y + sdy * (off.rx * 45 - 20) + pdy * (off.ry * 32);
    ctx.fillRect(gx - gridSize/2 - camX, gy - gridSize/2 - camY, gridSize, gridSize);
    ctx.strokeRect(gx - gridSize/2 - camX, gy - gridSize/2 - camY, gridSize, gridSize);
  }
}

function drawHUD() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(12, 12, 230, 85);

  ctx.fillStyle = '#22f1ff';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText(`LAP ${Math.min(playerCar.laps + 1, 3)}/3`, 18, 26);

  // Current lap time
  currentLapTime = (performance.now() - lapStartTime) / 1000;
  let cM = Math.floor(currentLapTime / 60);
  let cS = currentLapTime % 60;
  ctx.fillText(`LAP  ${cM}:${cS.toFixed(2).padStart(4,'0')}`, 18, 42);

  // Best lap
  if (bestLapTime < Infinity) {
    let bM = Math.floor(bestLapTime / 60);
    let bS = bestLapTime % 60;
    ctx.fillStyle = '#a5d6a7';
    ctx.fillText(`BEST ${bM}:${bS.toFixed(2).padStart(4,'0')}`, 18, 58);
  }

  // Total race time
  totalRaceTime = (performance.now() - startTime) / 1000;
  let tM = Math.floor(totalRaceTime / 60);
  let tS = totalRaceTime % 60;
  ctx.fillStyle = '#fff';
  ctx.fillText(`RACE ${tM}:${tS.toFixed(2).padStart(4,'0')}`, 18, 74);

  ctx.fillText(`SPEED ${Math.round(Math.abs(playerCar.speed))}`, 18, 90);
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
  playCheer();
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

  // Results list + times
  ctx.textAlign = 'left';
  let y = 200;
  results.forEach((r, i) => {
    const t = r.time;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(4, '0');
    const timeStr = `${m}:${s}`;
    const text = `${i+1}. ${r.name}`;
    ctx.fillStyle = r.isPlayer ? '#22f1ff' : '#fff';
    ctx.fillText(text, 150, y);
    ctx.fillText(timeStr, 420, y);
    if (r.isPlayer && bestLapTime < Infinity) {
      const blM = Math.floor(bestLapTime / 60);
      const blS = bestLapTime % 60;
      ctx.fillStyle = '#a5d6a7';
      ctx.fillText(`Best Lap: ${blM}:${blS.toFixed(2).padStart(4,'0')}`, 150, y + 18);
    }
    y += 38;
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