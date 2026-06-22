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
let ctx = null; // 2D only if needed for previews
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
  { id: 0, name: 'Flux GT', maxSpeed: 520, accel: 280, turnRate: 3.2, grip: 5.4, length: 44, width: 18 },
  { id: 1, name: 'Scarlet GT', maxSpeed: 580, accel: 250, turnRate: 2.6, grip: 4.3, length: 46, width: 17 },
  { id: 2, name: 'Classic Turbo', maxSpeed: 540, accel: 270, turnRate: 3.5, grip: 5.9, length: 40, width: 19 },
  { id: 3, name: 'Venom GT', maxSpeed: 560, accel: 300, turnRate: 2.8, grip: 4.9, length: 45, width: 16 },
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

    // Lateral (cornering) simulation + high speed slip
    const speedFactor = Math.max(0.4, Math.min(1, Math.abs(newSpeed) / 120));
    const slipFactor = Math.max(0, (Math.abs(newSpeed) - 200) / 300) * Math.abs(actualSteer) * 0.6;
    const gripFactor = stats.grip / 5;

    // Apply some slip at high speed turns (more realistic drift)
    if (slipFactor > 0.05) {
      const slipX = -dirY * slipFactor * 15 * dt;
      const slipY = dirX * slipFactor * 15 * dt;
      this.x += slipX;
      this.y += slipY;
      newSpeed *= (1 - slipFactor * 0.4); // slow a bit on slip
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

    // Shadow for 3D pop
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-len/2 + 3, -wid/2 + 2, len, wid);

    // Main body - base
    ctx.fillStyle = color;
    ctx.fillRect(-len/2, -wid/2, len, wid);

    // 3D shading: darker bottom/right for depth
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len/2, -wid/2 + wid*0.5, len, wid*0.5);

    // Lighter top for highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(-len/2, -wid/2, len, wid*0.3);

    if (this.modelId === 0) { // Flux GT - DeLorean style: boxy, doors
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 4, -wid/2 + 3, len-8, wid-6);
      // Door lines for boxy look
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(-len/2 + 6, -wid/2 + 4, 10, wid-8);
      ctx.rect(-len/2 + 18, -wid/2 + 4, 10, wid-8);
      ctx.stroke();
      // Rear window box
      ctx.fillRect(-len/2 + 2, -wid/2 + 5, 8, wid-10);
    } else if (this.modelId === 1) { // Scarlet GT - Testarossa: long wedge
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 5, -wid/2 + 2, len-12, wid-4);
      // Side strakes
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(-len/2 + 10 + s*6, -wid/2 + 2);
        ctx.lineTo(-len/2 + 18 + s*6, wid/2 - 2);
        ctx.stroke();
      }
      // Sharp front
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.moveTo(len/2 - 2, -wid/2);
      ctx.lineTo(len/2 + 6, 0);
      ctx.lineTo(len/2 - 2, wid/2);
      ctx.fill();
    } else if (this.modelId === 2) { // Classic Turbo - Porsche 911 style
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 6, -wid/2 + 3, len-10, wid-6);
      // Rear spoiler line
      ctx.fillStyle = '#111';
      ctx.fillRect(-len/2 + 2, -wid/2 + 2, 8, 4);
      ctx.fillRect(-len/2 + 2, wid/2 - 6, 8, 4);
      // Classic rounded roof
      ctx.beginPath();
      ctx.ellipse(-2, 0, 10, wid/2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else { // Venom GT - Viper: long aggressive
      ctx.fillStyle = '#222';
      ctx.fillRect(-len/2 + 4, -wid/2 + 2, len-8, wid-4);
      // Long hood
      ctx.fillStyle = '#111';
      ctx.fillRect(-len/2 + 10, -wid/2 + 3, len*0.45, wid-6);
      // Side vents
      ctx.fillRect(len/2 - 12, -wid/2 + 3, 4, 2);
      ctx.fillRect(len/2 - 12, wid/2 - 5, 4, 2);
    }

    // Windshield / windows - 3D inset
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-len/2 + 8, -wid/2 + 3.5, len * 0.32, wid - 7);

    // Headlights (distinct per model)
    ctx.fillStyle = '#ffeb3b';
    if (this.modelId === 1) { // pop-up style for Testarossa
      ctx.fillRect(len/2 - 3, -wid/2 + 1, 4, 2);
      ctx.fillRect(len/2 - 3, wid/2 - 3, 4, 2);
    } else {
      ctx.fillRect(len/2 - 5, -wid/2 + 2, 4, 3);
      ctx.fillRect(len/2 - 5, wid/2 - 5, 4, 3);
    }

    // Wheels - 3D with rims
    ctx.fillStyle = '#111';
    const wheelW = 7;
    const wheelH = 3.5;
    const off = len * 0.28;
    // Left wheels
    ctx.fillRect(-off, -wid/2 - 2, wheelW, wheelH);
    ctx.fillRect(off - wheelW + 1, -wid/2 - 2, wheelW, wheelH);
    // Right wheels
    ctx.fillRect(-off, wid/2 - wheelH + 2, wheelW, wheelH);
    ctx.fillRect(off - wheelW + 1, wid/2 - wheelH + 2, wheelW, wheelH);

    // Wheel highlights for 3D
    ctx.fillStyle = '#444';
    ctx.fillRect(-off + 1, -wid/2 - 1, wheelW - 2, 1);
    ctx.fillRect(off - wheelW + 2, -wid/2 - 1, wheelW - 2, 1);

    ctx.restore();
  }
}

let camera = { x: 0, y: 0, vx: 0, vy: 0 };
let lastTime = 0;

// Three.js 3D vars
let threeScene, threeCamera, threeRenderer, threeCars = [], threeTrack;
let is3DMode = false;

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

  setupHTMLMenu();

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  requestAnimationFrame(gameLoop);
}

function setupHTMLMenu() {
  // Car buttons
  const carDiv = document.getElementById('car-buttons');
  carDiv.innerHTML = '';
  CAR_MODELS.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = m.name;
    b.onclick = () => { selectedCarIndex = i; updatePreviews(); };
    if (i === selectedCarIndex) b.style.border = '2px solid #22f1ff';
    carDiv.appendChild(b);
  });

  // Color buttons
  const colDiv = document.getElementById('color-buttons');
  colDiv.innerHTML = '';
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.style.background = c;
    b.style.width = '30px';
    b.style.height = '30px';
    b.onclick = () => { selectedColorIndex = i; updatePreviews(); };
    colDiv.appendChild(b);
  });

  // Track buttons
  const trDiv = document.getElementById('track-buttons');
  trDiv.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button');
    b.textContent = (i+1) + '. ' + t.name;
    b.style.fontSize = '10px';
    b.onclick = () => { selectedTrackIndex = i; updatePreviews(); };
    trDiv.appendChild(b);
  });

  document.getElementById('start-button').onclick = () => {
    document.getElementById('menu').style.display = 'none';
    startRace();
  };

  updatePreviews();
}

function updatePreviews() {
  // Simple 2D previews for menu
  const carCan = document.getElementById('car-preview');
  const carCtx = carCan.getContext('2d');
  carCtx.fillStyle = '#222';
  carCtx.fillRect(0,0,120,80);
  carCtx.fillStyle = COLORS[selectedColorIndex];
  carCtx.fillRect(20,25,80,30);
  carCtx.fillStyle = '#111';
  carCtx.fillRect(30,30,30,20);

  const trCan = document.getElementById('track-preview');
  const trCtx = trCan.getContext('2d');
  trCtx.fillStyle = '#2e7d32';
  trCtx.fillRect(0,0,120,80);
  const tp = TRACKS[selectedTrackIndex].points;
  if (tp.length) {
    trCtx.strokeStyle = '#555';
    trCtx.lineWidth = 4;
    trCtx.beginPath();
    const sx = (tp[0].x % 200) / 2;
    const sy = (tp[0].y % 150) / 2;
    trCtx.moveTo(sx, sy);
    for (let p of tp) {
      trCtx.lineTo((p.x % 200)/2 , (p.y % 150)/2 );
    }
    trCtx.closePath();
    trCtx.stroke();
  }
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
  document.getElementById('menu').style.display = 'none';

  currentTrack = TRACKS[trackIndex];
  const points = currentTrack.points;

  // Calculate starting direction from track
  const p0 = points[0];
  const p1 = points[1];
  const startAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

  // Starting grid - player in pole, staggered behind
  const gridSpacing = 28;
  const laneOffset = 16;
  const startX = p0.x - Math.cos(startAngle) * 35;
  const startY = p0.y - Math.sin(startAngle) * 35;

  // Player (pole position)
  playerCar = new Car(startX, startY, startAngle, playerColor, selectedModel, true);

  // AI in grid formation (2x2-ish behind)
  aiCars = [];
  const aiPositions = [
    {ox: -gridSpacing, oy: -laneOffset},   // inside
    {ox: -gridSpacing * 2, oy: laneOffset}, // outside
    {ox: -gridSpacing * 3, oy: -laneOffset * 0.7}
  ];
  for (let i = 0; i < 3; i++) {
    const modelId = (selectedModel + i + 1) % 4;
    const col = COLORS[(i + 3) % COLORS.length];
    const pos = aiPositions[i];
    const ax = startX + Math.cos(startAngle) * pos.ox - Math.sin(startAngle) * pos.oy;
    const ay = startY + Math.sin(startAngle) * pos.ox + Math.cos(startAngle) * pos.oy;
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

  // Initialize 3D rendering
  init3D();
  update3DObjects();

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

  if (is3DMode) {
    update3DObjects();
  }
}

function draw() {
  if (is3DMode || gameState === 'menu' || !ctx) return;

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

  // Starting grid squares painted on track
  ctx.fillStyle = '#666';
  const gridSize = 22;
  const gridRows = 2;
  const gridCols = 3;
  const gridStartX = mx - 30;
  const gridStartY = my - 30;
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const gx = gridStartX - c * (gridSize + 4) + (r % 2) * (gridSize / 2);
      const gy = gridStartY + r * (gridSize + 2);
      ctx.fillRect(gx - gridSize/2, gy - gridSize/2, gridSize, gridSize);
      ctx.strokeStyle = '#444';
      ctx.strokeRect(gx - gridSize/2, gy - gridSize/2, gridSize, gridSize);
    }
  }
}

// ============ 3D RENDERING WITH THREE.JS ============

function init3D() {
  if (is3DMode) return;
  is3DMode = true;
  const canvas = document.getElementById('game');
  threeRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  threeRenderer.setSize(WIDTH, HEIGHT);
  threeRenderer.setPixelRatio(window.devicePixelRatio);

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x2e7d32);

  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  threeScene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(0, 200, 100);
  threeScene.add(directional);

  threeCamera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 1, 10000);
  threeCamera.position.set(0, 250, 0);
  threeCamera.lookAt(0, 0, 0);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 4000),
    new THREE.MeshLambertMaterial({ color: 0x2e7d32 })
  );
  ground.rotation.x = -Math.PI / 2;
  threeScene.add(ground);

  create3DTrack();
  create3DCars();
}

function create3DTrack() {
  if (threeTrack) threeScene.remove(threeTrack);
  const points = currentTrack.points;
  if (!points || points.length < 2) return;

  const pathPoints = points.map(p => new THREE.Vector3(p.x, 0.5, p.y));
  const curve = new THREE.CatmullRomCurve3(pathPoints, true);
  const tubeGeo = new THREE.TubeGeometry(curve, 80, 55, 6, true);
  const tubeMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  threeTrack = new THREE.Mesh(tubeGeo, tubeMat);
  threeScene.add(threeTrack);

  // Center line
  const lineGeo = new THREE.TubeGeometry(curve, 80, 4, 4, true);
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xffeb3b });
  const line = new THREE.Mesh(lineGeo, lineMat);
  threeScene.add(line);
}

function create3DCars() {
  threeCars = [];
  // Player
  const pMesh = createCarMesh3D(selectedModel, playerColor);
  threeScene.add(pMesh);
  threeCars[0] = pMesh;

  for (let i = 0; i < aiCars.length; i++) {
    const aMesh = createCarMesh3D(aiCars[i].modelId, aiCars[i].color);
    threeScene.add(aMesh);
    threeCars[i+1] = aMesh;
  }
}

function createCarMesh3D(modelId, color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color: color, shininess: 50 });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1a, shininess: 20 });
  const lightMat = new THREE.MeshPhongMaterial({ color: 0xffeb3b });

  let body, cabin;
  if (modelId === 0) { // Flux - boxy DeLorean
    body = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 4.5), bodyMat);
    cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 3), darkMat);
    cabin.position.set(-0.5, 2.5, 0);
  } else if (modelId === 1) { // Scarlet - Testarossa
    body = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 3.8), bodyMat);
    cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 2.5), darkMat);
    cabin.position.set(1, 2, 0);
  } else if (modelId === 2) { // Classic Turbo - 911
    body = new THREE.Mesh(new THREE.BoxGeometry(8, 2.8, 4.2), bodyMat);
    cabin = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 3), darkMat);
    cabin.position.set(-0.5, 2.5, 0);
  } else { // Venom - Viper
    body = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 3.5), bodyMat);
    cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 2.5), darkMat);
    cabin.position.set(2, 1.5, 0);
  }
  group.add(body);
  if (cabin) group.add(cabin);

  // Wheels
  const wheelMat = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 0.8, 12);
  const wheelPos = [[-3, 1.2, -2.2], [-3, 1.2, 2.2], [3, 1.2, -2.2], [3, 1.2, 2.2]];
  wheelPos.forEach(pos => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(pos[0], pos[1], pos[2]);
    group.add(w);
  });

  group.scale.set(3.5, 3.5, 3.5);
  return group;
}

function update3DObjects() {
  if (!is3DMode || !threeCars.length) return;

  // Player
  const p = playerCar;
  threeCars[0].position.set(p.x, 2, p.y);
  threeCars[0].rotation.y = -p.angle;

  // AI
  for (let i = 0; i < aiCars.length; i++) {
    const a = aiCars[i];
    const m = threeCars[i+1];
    m.position.set(a.x, 2, a.y);
    m.rotation.y = -a.angle;
  }
}

function render3D() {
  if (!is3DMode) return;

  // Follow camera
  const look = playerCar.speed * 0.3;
  const targetX = playerCar.x + Math.cos(playerCar.angle) * look;
  const targetZ = playerCar.y + Math.sin(playerCar.angle) * look;
  threeCamera.position.x = targetX;
  threeCamera.position.z = targetZ + 180; // behind and high
  threeCamera.lookAt(targetX, 5, targetZ);

  threeRenderer.render(threeScene, threeCamera);
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
    if (is3DMode) {
      render3D();
    }
  } else if (gameState === 'results') {
    if (is3DMode) {
      render3D();
    }
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