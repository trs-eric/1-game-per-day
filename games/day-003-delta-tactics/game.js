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

// Three.js 3D setup (using CDN for no-build)
let scene, camera, renderer;
let groundMesh;
let unitMeshes = {}; // keyed by unit.id
let enemyMeshes = [];
let highlightMeshes = [];
let treeMeshes = [];
let buildingMeshes = [];

const MAP_SIZE = 25;
const TILE_SIZE = 1; // world units (scaled for 3D)
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

let gameState = 'ready';
let currentUnit = 0;
let actionMode = null;
let highlights = [];
let units = [];
let enemies = [];
let blocked = [];
let goal = { x: 22, y: 12 };

let mouse = { x: 0, y: 0 };
let isDragging = false;
let prevMouse = { x: 0, y: 0 };
let yaw = Math.PI / 4;
let pitch = 0.8;
const camDist = 18;

canvas.addEventListener('mousedown', e => { isDragging = true; prevMouse = {x: e.clientX, y: e.clientY}; });
canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  if (isDragging && camera) {
    const dx = (e.clientX - prevMouse.x) * 0.005;
    const dy = (e.clientY - prevMouse.y) * 0.005;
    yaw -= dx;
    pitch = Math.max(0.3, Math.min(1.5, pitch + dy));
    updateCamera();
    prevMouse = {x: e.clientX, y: e.clientY};
  }
});
canvas.addEventListener('click', handleClick);
canvas.addEventListener('contextmenu', e => e.preventDefault()); // prevent menu on drag

// --- 3D ENGINE SETUP ---
function initThree() {
  // Use the existing canvas
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(800, 600);
  renderer.setClearColor(0x0a0a0f);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  updateCamera();

  // Lights
  const ambient = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Ground with procedural terrain
  createProceduralGround();

  // Add some procedural elements
  createProceduralEnvironment();
}

function updateCamera() {
  const cx = 0, cy = 3, cz = 0; // center
  camera.position.x = cx + Math.cos(yaw) * Math.cos(pitch) * camDist;
  camera.position.z = cz + Math.sin(yaw) * Math.cos(pitch) * camDist;
  camera.position.y = cy + Math.sin(pitch) * camDist * 0.8;
  camera.lookAt(cx, cy + 1, cz);
}

function gridToWorld(gx, gy) {
  return {
    x: (gx - MAP_SIZE / 2) * TILE_SIZE,
    z: (gy - MAP_SIZE / 2) * TILE_SIZE
  };
}

function createProceduralGround() {
  const geo = new THREE.PlaneGeometry(MAP_SIZE * TILE_SIZE, MAP_SIZE * TILE_SIZE, MAP_SIZE - 1, MAP_SIZE - 1);
  const verts = geo.attributes.position;
  const colors = [];
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i);
    const z = verts.getZ(i);  // plane is xz
    // Simple procedural height (hills + variation)
    let h = Math.sin(x * 0.8) * 0.4 + Math.cos(z * 1.1) * 0.3;
    h += (Math.random() - 0.5) * 0.15; // noise
    verts.setY(i, h);
    // Greenish ground color variation
    const g = 0.4 + (h + 0.5) * 0.3;
    colors.push(0.15, g, 0.1);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false });
  groundMesh = new THREE.Mesh(geo, mat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.1;
  scene.add(groundMesh);
}

function createProceduralEnvironment() {
  // Clear previous
  treeMeshes.forEach(m => scene.remove(m));
  buildingMeshes.forEach(m => scene.remove(m));
  treeMeshes = [];
  buildingMeshes = [];

  // Procedural trees on non-blocked tiles (scattered)
  const treePos = [[2,3],[3,15],[6,9],[8,20],[11,5],[14,17],[17,3],[19,19],[1,22],[23,6],[12,12]];
  treePos.forEach(([gx, gy]) => {
    if (!blocked[gy][gx]) {
      const tree = createTree();
      const w = gridToWorld(gx, gy);
      tree.position.set(w.x, 0, w.z);
      tree.scale.setScalar(0.7 + Math.random() * 0.4);
      scene.add(tree);
      treeMeshes.push(tree);
    }
  });

  // Procedural buildings (simple prefab-like)
  // Main guarded building
  const b1 = createBuilding(5);
  const w1 = gridToWorld(21, 11);
  b1.position.set(w1.x, 0, w1.z);
  scene.add(b1);
  buildingMeshes.push(b1);

  // Other building
  const b2 = createBuilding(3);
  const w2 = gridToWorld(6, 5);
  b2.position.set(w2.x, 0, w2.z);
  scene.add(b2);
  buildingMeshes.push(b2);
}

function createTree() {
  const g = new THREE.Group();
  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 1.2, 5),
    new THREE.MeshLambertMaterial({ color: 0x5c4033 })
  );
  trunk.position.y = 0.6;
  g.add(trunk);
  // Foliage layers (procedural)
  for (let i = 0; i < 3; i++) {
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(0.9 - i*0.15, 1.1, 6),
      new THREE.MeshLambertMaterial({ color: 0x228b22 + i * 0x001100 })
    );
    leaves.position.y = 1.0 + i * 0.7;
    g.add(leaves);
  }
  return g;
}

function createBuilding(size = 4) {
  const g = new THREE.Group();
  const matWall = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
  const matRoof = new THREE.MeshLambertMaterial({ color: 0x8d5524 });
  // Main body
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, 3, size * 0.7), matWall);
  body.position.y = 1.5;
  g.add(body);
  // Roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.6, 2, 4), matRoof);
  roof.position.y = 4.2;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  // Windows (small boxes)
  for (let i = -1; i <= 1; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.1), new THREE.MeshLambertMaterial({color: 0x333333}));
    win.position.set(i * 1.2, 1.8, size * 0.4);
    g.add(win);
  }
  return g;
}

function createCharacterPrefab(color, isEnemy = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isEnemy ? 0xaa3333 : color });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdbac });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 4);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(-0.2, 0.35, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  g.add(legR);

  // Body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 5), bodyMat);
  body.position.y = 1.0;
  g.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), skinMat);
  head.position.y = 1.65;
  g.add(head);

  // Arms (for "prefab" feel)
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 4), bodyMat);
  arm.position.set(-0.4, 1.1, 0);
  arm.rotation.z = 0.3;
  g.add(arm);
  const armR = arm.clone();
  armR.position.x = 0.4;
  armR.rotation.z = -0.3;
  g.add(armR);

  // Simple gun for character
  if (!isEnemy) {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.5), new THREE.MeshLambertMaterial({color: 0x222222}));
    gun.position.set(0.35, 1.0, 0.3);
    g.add(gun);
  }

  return g;
}

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

  // Canvas right area (600+) can be used for info; use HTML buttons for actions (see index.html)

  // Map click via raycast (3D)
  if (!groundMesh || gameState !== 'playing') return;
  const ndcX = (mx / canvas.width) * 2 - 1;
  const ndcY = -(my / canvas.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
  const intersects = raycaster.intersectObject(groundMesh, false);
  if (intersects.length === 0) return;

  const point = intersects[0].point;
  const gx = Math.round(point.x / TILE_SIZE + MAP_SIZE / 2);
  const gy = Math.round(point.z / TILE_SIZE + MAP_SIZE / 2);

  if (gx < 0 || gx >= MAP_SIZE || gy < 0 || gy >= MAP_SIZE) return;

  if (actionMode === 'move') {
    const reachable = highlights;
    const target = reachable.find(t => t.x === gx && t.y === gy);
    if (target) {
      unit.x = gx;
      unit.y = gy;
      update3DPositions();
      actionMode = null;
      highlights = [];
      updateHighlights();
      if (!checkWin()) {
        nextUnit();
      }
    }
  } else if (actionMode === 'shoot') {
    const target = enemies.find(e => e.x === gx && e.y === gy);
    if (target) {
      const dist = chebyshev(unit.x, unit.y, target.x, target.y);
      if (dist <= 12 && hasLOS(unit.x, unit.y, target.x, target.y)) {
        // Shoot - remove
        const idx = enemies.indexOf(target);
        if (idx >= 0) {
          scene.remove(enemyMeshes[idx]);
          enemyMeshes.splice(idx, 1);
          enemies.splice(idx, 1);
        }
        actionMode = null;
        highlights = [];
        updateHighlights();
        if (!checkWin()) {
          nextUnit();
        }
      }
    }
  }
}

function resetGameObjects() {
  initMap();
  initUnits();

  if (!scene) {
    initThree();
  }

  // Clear 3D scene of dynamic objects
  Object.values(unitMeshes).forEach(m => scene.remove(m));
  enemyMeshes.forEach(m => scene.remove(m));
  highlightMeshes.forEach(m => scene.remove(m));
  treeMeshes.forEach(m => scene.remove(m));
  buildingMeshes.forEach(m => scene.remove(m));
  unitMeshes = {};
  enemyMeshes = [];
  highlightMeshes = [];
  treeMeshes = [];
  buildingMeshes = [];

  currentUnit = 0;
  actionMode = null;
  highlights = [];
  gameState = 'playing';

  createProceduralEnvironment();
  // Create unit prefabs (procedural "prefabricated" style models using basic geometries)
  units.forEach(u => {
    const mesh = createCharacterPrefab(u.color);
    const w = gridToWorld(u.x, u.y);
    mesh.position.set(w.x, 0, w.z);
    scene.add(mesh);
    unitMeshes[u.id] = mesh;
  });

  // Enemy meshes (simple red prefabs)
  enemies.forEach((e) => {
    const mesh = createCharacterPrefab(0x992222, true);
    const w = gridToWorld(e.x, e.y);
    mesh.position.set(w.x, 0, w.z);
    mesh.scale.setScalar(0.9);
    scene.add(mesh);
    enemyMeshes.push(mesh);
  });

  updateUI();
  update3DPositions();
  updateHighlights();
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

function update3DPositions() {
  units.forEach(u => {
    if (unitMeshes[u.id]) {
      const w = gridToWorld(u.x, u.y);
      unitMeshes[u.id].position.set(w.x, 0, w.z);
    }
  });
  // Update enemy positions if moved (not yet)
  enemyMeshes.forEach((mesh, i) => {
    if (enemies[i]) {
      const w = gridToWorld(enemies[i].x, enemies[i].y);
      mesh.position.set(w.x, 0, w.z);
    }
  });
}

function updateHighlights() {
  // Remove old highlight meshes
  highlightMeshes.forEach(m => scene.remove(m));
  highlightMeshes = [];

  if (!highlights.length || !actionMode) return;

  const color = actionMode === 'move' ? 0x4caf50 : 0xf44336;
  const mat = new THREE.MeshLambertMaterial({ 
    color, 
    transparent: true, 
    opacity: 0.4,
    side: THREE.DoubleSide 
  });

  highlights.forEach(h => {
    const w = gridToWorld(h.x, h.y);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 0.9, TILE_SIZE * 0.9),
      mat
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(w.x, 0.05, w.z);
    scene.add(plane);
    highlightMeshes.push(plane);
  });
}

function draw() {
  if (!renderer || !scene) return;
  renderer.render(scene, camera);
}

function update(delta) {
  // Turn-based; no per-frame physics needed. 3D updates happen on actions.
}

function gameLoop(timestamp = 0) {
  if (gameState === 'ready') {
    draw();
    requestAnimationFrame(gameLoop);
    return;
  }
  // Update any subtle 3D (e.g. future anims)
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(gameLoop);
}

function startGame() {
  if (gameState === 'ready' || gameState === 'win') {
    resetGameObjects();
    gameState = 'playing';
  }
  if (!renderer) initThree();
  updateUI();
  updateHighlights();
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
  initThree();
  resetGameObjects();
  draw();
  updateUI();
}

init();
