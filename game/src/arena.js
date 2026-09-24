/**
 * The venues, assembled from the asset modules. Everything that never moves and repeats is
 * instanced per material bucket (barriers, bleachers, walls, props, the crowd), so a hall is a
 * few dozen draw calls. One kit dresses four halls: a school gym in daylight, a community hall
 * under strip lights, a wooden-floored club under low lamps, and the arena. applyVenue recolours
 * every material by the asset colour it came from, shows the stands and props that hall has,
 * sets the crowd's fill and relights it. Two moods ride on top, set each frame by the game:
 * ink focus draws the hall in pencil on paper during a long rally, and match point closes the
 * light down onto the table. The crowd bobs with excitement and jumps on a point.
 */
import * as THREE from 'three';
import { ASSET } from '../assetlib.js?v=202609240115';
import { toonify, toonMaterial, hullGeometry, outlineMaterial, inkify } from './toon.js?v=202609240115';
import { FlipBoard } from './flipboard.js?v=202609240115';
import { TABLE, PALETTE, clamp } from './consts.js?v=202609240115';

export const ASSET_NAMES = ['court_floor', 'table', 'net', 'paddle', 'ball', 'score_display', 'barrier', 'bleacher_block', 'spectator', 'floodlight_truss', 'arena_wall_section', 'umpire_table', 'referee_chair', 'flip_scoreboard', 'ball_bucket', 'towel_box', 'basketball_hoop', 'gym_window', 'wall_pad', 'bunting', 'strip_light', 'pendant_lamp'];
export const ASSET_LIST = ASSET_NAMES.map((n) => `./assets/${n}.js`);

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const placement = (x, y, z, ry = 0) => { _e.set(0, ry, 0); return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s); };
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const PAPER = new THREE.Color(0xefeadc);

/**
 * The four halls. colors maps, per asset, a colour the asset was built with to the colour it
 * wears here (anything unlisted keeps its own); show names the stands and props present; crowd
 * is the fraction of each block of seats filled; light is the rig at rest, before any mood.
 */
export const VENUES = {
  gym: {
    name: 'SCHOOL GYM',
    colors: {
      court_floor: { 0xa8383a: 0xe0b27a, 0x6f2a2c: 0xcf9e66, 0xf2f2ee: 0x2e5e9e },
      barrier: { 0x1e2a48: 0x2e5e9e },
      bleacher_block: { 0x1e2a48: 0x6f7a86, 0x6f2a2c: 0x2e5e9e },
      arena_wall_section: { 0x1e2a48: 0xe6dfcf, 0x6f2a2c: 0x2e5e9e, 0x4fe3ff: 0xf2b134, 0xff7a30: 0x2e5e9e, 0xf2f2ee: 0xf4f1e8, 0x141620: 0x9aa0a8 },
      umpire_table: { 0x2456a8: 0x2e5e9e },
    },
    show: ['standsSide', 'hoops', 'windows', 'pads'],
    crowd: { side: 0.32, far: 0, near: 0, chairs: 0 },
    light: { key: 1.0, keyColor: 0xfff4e2, keyPos: [9, 8.5, 1.5], hemi: 1.45, sky: 0xcfe6ff, ground: 0xa07a50, rim: 0.12, rimColor: 0xffffff, spot: 8, spotColor: 0xfff6e8, spotAngle: Math.PI / 4.5, lamp: 2, fog: 0xdfe8ef, fogNear: 16, fogFar: 55, dome: [0xe6eef6, 0xd3dde6, 0xc9b08a], cones: 0, dust: 0.34, dustColor: 0xfff4d8 },
  },
  hall: {
    name: 'COMMUNITY HALL',
    colors: {
      court_floor: { 0xa8383a: 0x86a07c, 0x6f2a2c: 0x6b8766, 0xf2f2ee: 0xece6d4 },
      barrier: { 0x1e2a48: 0x3a5a78 },
      arena_wall_section: { 0x1e2a48: 0xd8cdb0, 0x6f2a2c: 0x5f7f5c, 0x4fe3ff: 0xd94a4a, 0xff7a30: 0xf2b134, 0xf2f2ee: 0xefe9da, 0x141620: 0x9a9380 },
      umpire_table: { 0x2456a8: 0x8a3b3b },
    },
    show: ['chairs', 'bunting', 'strips'],
    crowd: { side: 0, far: 0, near: 0, chairs: 0.75 },
    light: { key: 0.8, keyColor: 0xf4fbff, keyPos: [1.5, 9, 1.2], hemi: 0.8, sky: 0xf2f7ff, ground: 0x8a8f7a, rim: 0.08, rimColor: 0xffffff, spot: 10, spotColor: 0xeef6ff, spotAngle: Math.PI / 4, lamp: 3, fog: 0xa8a18c, fogNear: 14, fogFar: 46, dome: [0xd3ccb9, 0xbdb5a0, 0x8f8973], cones: 0, dust: 0.1, dustColor: 0xffffff },
  },
  club: {
    name: 'THE CLUB',
    colors: {
      court_floor: { 0xa8383a: 0x946443, 0x6f2a2c: 0x6c4830, 0xf2f2ee: 0xd9c3a0 },
      barrier: { 0x1e2a48: 0x1f4d3a },
      bleacher_block: { 0x1e2a48: 0x2b3a2f, 0x6f2a2c: 0x5a3a24 },
      arena_wall_section: { 0x1e2a48: 0x2e2620, 0x6f2a2c: 0x4a3222, 0x4fe3ff: 0x2f7a55, 0xff7a30: 0xd9a441, 0xf2f2ee: 0xe8dcc0 },
      umpire_table: { 0x2456a8: 0x1f5a3f },
    },
    show: ['standsFar', 'clubTables', 'pendants', 'display'],
    crowd: { side: 0, far: 0.4, near: 0, chairs: 0 },
    light: { key: 0.42, keyColor: 0xffd9a8, keyPos: [2.6, 7.5, 3.2], hemi: 0.2, sky: 0x7f8aa0, ground: 0x4a3020, rim: 0.08, rimColor: 0xffc890, spot: 36, spotColor: 0xffd29a, spotAngle: Math.PI / 8.5, lamp: 6, fog: 0x140f0b, fogNear: 7, fogFar: 27, dome: [0x0a0806, 0x1c140e, 0x24170e], cones: 0.55, dust: 0.16, dustColor: 0xffd8a8 },
  },
  arena: {
    name: 'THE ARENA',
    colors: {},
    show: ['standsSide', 'standsFar', 'standsNear', 'trusses', 'display'],
    crowd: { side: 0.6, far: 0.6, near: 0.6, chairs: 0 },
    light: { key: 0.6, keyColor: 0xfff1dc, keyPos: [2.6, 7.5, 3.2], hemi: 0.16, sky: 0x8fb4d8, ground: 0x5a2a2a, rim: 0.14, rimColor: 0x4fe3ff, spot: 40, spotColor: 0xffe2b8, spotAngle: Math.PI / 8, lamp: 7, fog: 0x0b0e1a, fogNear: 7, fogFar: 30, dome: [0x05070f, 0x151d38, 0x261620], cones: 1, dust: 0.22, dustColor: 0xffe0b0 },
  },
};

/**
 * Turn a loaded (merged) asset into one InstancedMesh per material bucket at the transforms
 * given, plus an instanced outline hull. colorFor(i, mesh) may return a Color per instance.
 */
export function instanceAsset(scene, inst, transforms, { outline = 0, colorFor = null, shadows = true } = {}) {
  inst.updateMatrixWorld(true);
  const meshes = [];
  inst.traverse((o) => { if (o.isMesh && !o.userData.hull) meshes.push(o); });
  const made = [];
  for (const mesh of meshes) {
    const mat = toonMaterial(mesh.material);
    const im = new THREE.InstancedMesh(mesh.geometry, mat, transforms.length);
    im.castShadow = shadows; im.receiveShadow = shadows;
    let hull = null;
    if (outline > 0) { hull = new THREE.InstancedMesh(hullGeometry(mesh.geometry), outlineMaterial(outline), transforms.length); hull.userData.hull = true; }
    for (let i = 0; i < transforms.length; i++) {
      _m.multiplyMatrices(transforms[i], mesh.matrixWorld);
      im.setMatrixAt(i, _m);
      if (hull) hull.setMatrixAt(i, _m);
      if (colorFor) { const c = colorFor(i, mesh); if (c) im.setColorAt(i, c); }
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    if (hull) { hull.instanceMatrix.needsUpdate = true; scene.add(hull); }
    made.push({ im, hull, local: mesh.matrixWorld.clone() });
  }
  return made;
}

function makeRubberTexture() {
  // the extruded ellipse's UVs are its shape coordinates in metres; repeat/offset map the
  // 0.071 x 0.0735 topsheet onto the canvas
  const S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, S, S);
  const hi = x.createRadialGradient(S * 0.36, S * 0.3, 0, S * 0.36, S * 0.3, S * 0.36);
  hi.addColorStop(0, 'rgba(255,255,255,0.72)'); hi.addColorStop(0.45, 'rgba(255,255,255,0.22)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hi; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(0,0,0,0.09)';
  for (let j = 3; j < S; j += 6) for (let i = 3 + ((j / 6) % 2) * 3; i < S; i += 6) { x.beginPath(); x.arc(i, j, 1.1, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / (2 * 0.075), 1 / (2 * 0.0785)); t.offset.set(0.5, 0.5);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeNetTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 64);
  x.fillStyle = '#ffffff';
  for (let i = 0; i <= 128; i += 8) x.fillRect(i - 1, 0, 2, 64);
  for (let j = 0; j <= 64; j += 8) x.fillRect(0, j - 1, 128, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7.5, 1.15);
  t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Visible beams from the lamps to the table, and dust drifting through them. */
function makeAtmosphere(scene) {
  const beams = [];
  for (const [x, z] of [[-2.2, -2.4], [2.2, 2.4], [-2.2, 2.4], [2.2, -2.4]]) {
    const from = new THREE.Vector3(x, 6.3, z), to = new THREE.Vector3(0, 0.8, 0);
    const len = from.distanceTo(to);
    const geo = new THREE.ConeGeometry(1.5, len, 20, 1, true);
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const y = geo.attributes.position.getY(i) / len + 0.5;      // 1 at the apex (the lamp), 0 at the base
      const b = 0.028 * Math.pow(y, 1.4);
      col[i * 3] = b; col[i * 3 + 1] = b * 0.9; col[i * 3 + 2] = b * 0.7;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide, fog: false }));
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
    m.renderOrder = 2;
    scene.add(m); beams.push(m);
  }
  const coneMats = beams.map((b) => b.material);
  const N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 7; pos[i * 3 + 1] = 0.3 + Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; seed[i] = Math.random() * 100; }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe0b0, size: 0.018, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  dust.renderOrder = 2;
  scene.add(dust);
  let t = 0;
  return {
    beams, coneMats, dustMat: dust.material,
    update(dt) {
      t += dt;
      const a = dg.attributes.position.array;
      for (let i = 0; i < N; i++) {
        a[i * 3 + 1] -= 0.05 * dt;
        a[i * 3] += Math.sin(t * 0.7 + seed[i]) * 0.02 * dt;
        if (a[i * 3 + 1] < 0.3) a[i * 3 + 1] = 6.3;
      }
      dg.attributes.position.needsUpdate = true;
    },
  };
}

function makeDome(scene) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(48, 24, 12), new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x05070f) }, mid: { value: new THREE.Color(0x151d38) }, bottom: { value: new THREE.Color(0x261620) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float y = normalize(vP).y; vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, y)) : mix(mid, bottom, smoothstep(0.0, -0.4, y)); gl_FragColor = vec4(c, 1.0); }',
    side: THREE.BackSide, depthWrite: false,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false;
  scene.add(dome);
  return dome.material.uniforms;
}

function setupLights(scene, phone) {
  scene.fog = new THREE.Fog(0x0b0e1a, 7, 30);
  // two warm pools on the table from the trusses
  const spots = [];
  for (const [x, z] of [[-2.2, -2.4], [2.2, 2.4]]) {
    const sp = new THREE.SpotLight(0xffe2b8, 40, 16, Math.PI / 8, 0.5, 2);
    sp.position.set(x, 6.3, z); sp.target.position.set(0, 0.76, 0);
    scene.add(sp); scene.add(sp.target); spots.push(sp);
  }
  const key = new THREE.DirectionalLight(0xfff1dc, 0.6);
  key.position.set(2.6, 7.5, 3.2);
  key.target.position.set(0, 0.5, -0.4);
  scene.add(key); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  const c = key.shadow.camera;
  c.left = -5.5; c.right = 5.5; c.top = 6; c.bottom = -6; c.near = 1; c.far = 22;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight(0x8fb4d8, 0x5a2a2a, 0.16);
  scene.add(hemi);
  const rim = new THREE.DirectionalLight(0x4fe3ff, 0.14);
  rim.position.set(-3, 3, -6);
  scene.add(rim);
  return { key, hemi, rim, spots };
}

export async function buildArena(scene, { phone = false } = {}) {
  const out = { banners: [], lenses: [], groups: {} };
  const domeU = makeDome(scene);
  out.lights = setupLights(scene, phone);
  out.atmosphere = makeAtmosphere(scene);
  // every recolourable material, with the asset and the colour it came from
  const dress = [];
  const regRoot = (asset, root) => root.traverse((o) => { if (!o.isMesh || o.userData.hull) return; for (const m of [].concat(o.material)) if (m && m.userData && m.userData.toon) dress.push({ asset, mat: m, src: m.userData.srcColor }); });
  const regParts = (asset, parts) => { for (const pt of parts) dress.push({ asset, mat: pt.im.material, src: pt.im.material.userData.srcColor }); };
  const group = (name, objs) => { (out.groups[name] = out.groups[name] || []).push(...objs); };
  const partsObjs = (parts) => parts.flatMap((pt) => (pt.hull ? [pt.im, pt.hull] : [pt.im]));

  const floor = toonify(await ASSET('./assets/court_floor.js'));
  floor.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  floor.position.y = -0.037;                      // the slab's walking surface is y = 0
  scene.add(floor);
  regRoot('court_floor', floor);
  out.table = toonify(await ASSET('./assets/table.js'), { outline: 0.006 });
  scene.add(out.table);
  out.net = toonify(await ASSET('./assets/net.js', { keepHierarchy: true }), { outline: 0.0025 });
  if (out.net.userData.cloth) {
    // a net is holes: a grid drawn into a canvas at load time, cut out with alphaTest, so the
    // ball and the far side show through and the cloth still deforms
    const m = out.net.userData.cloth.material.clone();
    m.map = makeNetTexture(); m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide;
    m.color.setHex(0x0f1626); m.needsUpdate = true;
    out.net.userData.cloth.material = m;
    out.net.userData.cloth.castShadow = false;
  }
  out.net.position.set(0, TABLE.H - (out.net.userData.net ? out.net.userData.net.surfaceY : 0), 0);
  scene.add(out.net);
  out.paddles = [];
  const rubber = makeRubberTexture();
  for (let i = 0; i < 2; i++) {
    const p = toonify(await ASSET('./assets/paddle.js', { keepHierarchy: true }), { outline: 0.0028 });
    p.traverse((o) => {
      if (!o.isMesh || o.userData.hull) return;
      o.material = o.material.clone();
      // the topsheets get a surface: a painted highlight, a darker rim, pimple grain
      const hex = o.material.userData.srcColor;
      if (hex === 0xc8202b || hex === 0x1a1a1f) { o.material.map = rubber; o.material.needsUpdate = true; }
    });
    out.paddles.push(p);
  }
  out.ball = toonify(await ASSET('./assets/ball.js'), { outline: 0.0022 });

  // surrounds
  const barrier = await ASSET('./assets/barrier.js');
  const bT = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) bT.push(placement(sx * 3.7, 0, -4.66 + i * 2.33, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
  for (let i = -1; i <= 1; i++) { bT.push(placement(i * 2.35, 0, -6.2, 0)); bT.push(placement(i * 2.35, 0, 6.2, Math.PI)); }
  regParts('barrier', instanceAsset(scene, barrier, bT, { outline: 0.004 }));

  // grandstands and the crowd
  const bleacher = await ASSET('./assets/bleacher_block.js');
  const stands = { side: [], far: [], near: [] };
  for (const z of [-4.6, 0, 4.6]) { stands.side.push(placement(7.8, 0, z, -Math.PI / 2)); stands.side.push(placement(-7.8, 0, z, Math.PI / 2)); }
  // both ends have a stand: the camera never turns round in play, but a cut may
  for (const x of [-4.6, 0, 4.6]) { stands.far.push(placement(x, 0, -8.6, 0)); stands.near.push(placement(x, 0, 8.6, Math.PI)); }
  for (const [grp, name] of [['side', 'standsSide'], ['far', 'standsFar'], ['near', 'standsNear']]) {
    const parts = instanceAsset(scene, bleacher, stands[grp], { outline: 0, shadows: false });
    regParts('bleacher_block', parts); group(name, partsObjs(parts));
  }
  // the hall's folding chairs, a row down each side behind the surrounds
  const chair = await ASSET('./assets/referee_chair.js');
  const chairT = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) chairT.push(placement(sx * 4.7, 0, -4.4 + i * 0.8, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
  const chairParts = instanceAsset(scene, chair, chairT, { outline: 0.003, shadows: false });
  regParts('referee_chair', chairParts); group('chairs', partsObjs(chairParts));
  const spectator = await ASSET('./assets/spectator.js');
  const seats = [];
  const seatLocal = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  for (const grp of ['side', 'far', 'near']) for (const bm of stands[grp]) for (let r = 0; r < 5; r++) for (let k = 0; k < 8; k++) {
    _e.set(0, (Math.random() - 0.5) * 0.35, 0);
    // on the plank: row r's seat is 0.45 up and 0.8 back per row
    seatLocal.compose(_p.set(-1.75 + 0.5 * k + (Math.random() - 0.5) * 0.06, 0.4 * r + 0.45, 1.39 - 0.8 * r), _q.setFromEuler(_e), _s);
    seats.push({ m: tmp.multiplyMatrices(bm, seatLocal).clone(), phase: Math.random() * Math.PI * 2, rate: 1.6 + Math.random() * 1.2, jump: Math.random(), grp, r: Math.random() });
  }
  for (const cm of chairT) {
    _e.set(0, (Math.random() - 0.5) * 0.3, 0);
    seatLocal.compose(_p.set(0, 0.44, -0.03), _q.setFromEuler(_e), _s);
    seats.push({ m: tmp.multiplyMatrices(cm, seatLocal).clone(), phase: Math.random() * Math.PI * 2, rate: 1.6 + Math.random() * 1.2, jump: Math.random(), grp: 'chairs', r: Math.random() });
  }
  const crowdColors = PALETTE.crowdVariety.map((c) => new THREE.Color(c));
  const bodyHex = PALETTE.crowd[0];
  const crowdParts = instanceAsset(scene, spectator, seats.map((s) => s.m), {
    outline: 0, shadows: false,
    colorFor: (i, mesh) => (mesh.material.userData.srcColor === bodyHex || (mesh.material.color && mesh.material.color.getHex() === bodyHex)) ? crowdColors[Math.floor(Math.random() * crowdColors.length)] : null,
  });
  let active = [];
  out.crowd = {
    excite: 0, cheer: 0, t: 0, hush: 0,
    /** Which seats are taken: fill is the fraction of each group filled. */
    setFill(fill) {
      active = [];
      for (let i = 0; i < seats.length; i++) {
        if (seats[i].r < (fill[seats[i].grp] || 0)) active.push(i);
        else for (const part of crowdParts) part.im.setMatrixAt(i, ZERO_M);
      }
      for (const i of active) for (const part of crowdParts) { _m.multiplyMatrices(seats[i].m, part.local); part.im.setMatrixAt(i, _m); }
      for (const part of crowdParts) part.im.instanceMatrix.needsUpdate = true;
    },
    update(dt, excitement, cheer) {
      this.t += dt;
      // hushed, the crowd goes still: a long rally in pencil, or match point
      const ex = excitement * (1 - this.hush);
      this.excite += (ex - this.excite) * (1 - Math.exp(-2 * dt));
      this.cheer = Math.max(0, this.cheer - dt * 0.6);
      if (cheer > this.cheer) this.cheer = cheer;
      const amp = (0.006 + 0.028 * this.excite) * (1 - 0.8 * this.hush);
      const ch = this.cheer;
      for (const i of active) {
        const s = seats[i];
        const wave = Math.sin(this.t * (2 + 4 * this.excite) * s.rate + s.phase);
        // a point: everyone bounces gently, out of step, and settles
        const bob = amp * (0.5 + 0.5 * wave) + ch * ch * 0.05 * Math.abs(Math.sin(this.t * 11 + s.phase * 0.5));
        for (const part of crowdParts) {
          _m.multiplyMatrices(s.m, part.local);
          _m.elements[13] += bob;
          part.im.setMatrixAt(i, _m);
        }
      }
      for (const part of crowdParts) part.im.instanceMatrix.needsUpdate = true;
    },
  };

  // walls and light trusses
  const wall = await ASSET('./assets/arena_wall_section.js');
  const wT = [];
  for (const x of [-8, 0, 8]) { wT.push(placement(x, 0, -12.5, 0)); wT.push(placement(x, 0, 12.5, Math.PI)); }
  for (const z of [-8, 0, 8]) { wT.push(placement(12.2, 0, z, -Math.PI / 2)); wT.push(placement(-12.2, 0, z, Math.PI / 2)); }
  const wallParts = instanceAsset(scene, wall, wT, { outline: 0, shadows: false });
  regParts('arena_wall_section', wallParts);
  for (const part of wallParts) {
    const hex = part.im.material.userData.srcColor;
    if (hex === PALETTE.cyan || hex === PALETTE.orange) { part.im.material.emissive.setHex(hex); part.im.material.emissiveIntensity = 0.15; out.banners.push(part.im.material); }
  }
  const truss = await ASSET('./assets/floodlight_truss.js');
  group('trusses', partsObjs(instanceAsset(scene, truss, [placement(0, 6.4, -2.6, 0), placement(0, 6.4, 2.6, 0)], { outline: 0, shadows: false })));

  // courtside furniture
  const setPiece = async (name, x, y, z, ry, outline) => { const o = toonify(await ASSET(`./assets/${name}.js`), { outline }); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
  // the umpire's station sits close enough to the table to be on screen at 16:10 and wider
  regRoot('umpire_table', await setPiece('umpire_table', 2.35, 0, -0.25, -Math.PI / 2, 0.004));
  regRoot('referee_chair', await setPiece('referee_chair', 2.87, 0, -0.25, -Math.PI / 2, 0.003));
  // the umpire's flip scoreboard, turned toward the camera so the cards read
  const flipInst = toonify(await ASSET('./assets/flip_scoreboard.js', { keepHierarchy: true }), { outline: 0.0022 });
  flipInst.position.set(2.3, TABLE.H + 0.001, 0.0); flipInst.rotation.y = -0.85; flipInst.scale.setScalar(0.92);
  scene.add(flipInst);
  out.flip = new FlipBoard(flipInst);
  // a small lamp on the umpire's cards, so the score reads in the dark beyond the pools
  const lamp = new THREE.SpotLight(0xfff4e0, 7, 6, Math.PI / 11, 0.75, 1.5);
  lamp.position.set(2.85, 2.4, 0.95); lamp.target.position.copy(flipInst.position).add(new THREE.Vector3(0, 0.12, 0));
  scene.add(lamp); scene.add(lamp.target);
  out.flipLamp = lamp;
  await setPiece('ball_bucket', 2.45, 0, -2.3, 0.4, 0.003);
  await setPiece('towel_box', 2.45, 0, 2.05, 0.2, 0.003);
  await setPiece('towel_box', -2.45, 0, -2.05, -0.3, 0.003);

  // the score, lit in segments: a big unit over the far stand, a small one on the umpire's table
  const PATTERNS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const litL = toonMaterial(new THREE.MeshStandardMaterial({ color: 0x4fe3ff, name: 'plaster' })); litL.emissive.setHex(0x4fe3ff); litL.emissiveIntensity = 0.9;
  const litR = toonMaterial(new THREE.MeshStandardMaterial({ color: 0xff7a30, name: 'plaster' })); litR.emissive.setHex(0xff7a30); litR.emissiveIntensity = 0.9;
  const displays = [];
  const makeDisplay = async (x, y, z, ry, scale) => {
    const d = toonify(await ASSET('./assets/score_display.js', { keepHierarchy: true }), { outline: 0.004 });
    d.position.set(x, y, z); d.rotation.y = ry; d.scale.setScalar(scale);
    scene.add(d); group('display', [d]);
    if (d.userData.segments) { displays.push(d.userData.segments); for (const k of Object.keys(d.userData.segments)) { const m = d.userData.segments[k]; m.userData.dark = m.material; } }
  };
  await makeDisplay(0, 4.6, -11.6, 0, 2.2);
  out.setScore = (a, b) => {
    const show = (segs, key, value, lit, blankLeading) => {
      const tens = Math.floor(value / 10) % 10, ones = value % 10;
      const pat1 = blankLeading && tens === 0 ? '' : PATTERNS[tens], pat0 = PATTERNS[ones];
      for (const s of 'abcdefg') {
        const m1 = segs[key + '1' + s], m0 = segs[key + '0' + s];
        if (m1) { const on = pat1.includes(s); m1.visible = true; m1.material = on ? lit : m1.userData.dark; }
        if (m0) { const on = pat0.includes(s); m0.visible = true; m0.material = on ? lit : m0.userData.dark; }
      }
    };
    for (const segs of displays) {
      show(segs, 'l', a, litL, true); show(segs, 'r', b, litR, true);
      if (segs.colon0) segs.colon0.material = litL; if (segs.colon1) segs.colon1.material = litR;
    }
    if (out.flip) out.flip.set(a, b);
  };
  out.setScore(0, 0);
  out.setLevel = (lvl) => { const k = 0.15 + 0.9 * clamp(lvl, 0, 1); for (const m of out.banners) m.emissiveIntensity = k; };

  // ---- the gym: goals on the end walls, tall windows down the sides, pads along the ends
  const inst = async (name, transforms, outline, grp) => group(grp, partsObjs(instanceAsset(scene, await ASSET(`./assets/${name}.js`), transforms, { outline, shadows: false })));
  await inst('basketball_hoop', [placement(0, 2.63, -12.35 + 0.8455, 0), placement(0, 2.63, 12.35 - 0.8455, Math.PI)], 0.004, 'hoops');
  const winT = [];
  for (const z of [-9, -6, -3, 0, 3, 6, 9]) { winT.push(placement(11.9445, 1.35, z, -Math.PI / 2)); winT.push(placement(-11.9445, 1.35, z, Math.PI / 2)); }
  await inst('gym_window', winT, 0.003, 'windows');
  const padT = [];
  for (let i = 0; i < 19; i++) { const x = -10.8 + i * 1.2; padT.push(placement(x, 0, -12.295, 0)); padT.push(placement(x, 0, 12.295, Math.PI)); }
  await inst('wall_pad', padT, 0.003, 'pads');
  // ---- the hall: bunting strung across in scallops, strip lights in rows
  const buntT = [];
  for (const [row, z] of [-6, -2.5, 1, 4.5].entries()) for (let i = 0; i < 6; i++) buntT.push(placement(-5 + i * 2, 3.7 + (row % 2) * 0.12, z + (i % 2) * 0.08, 0));
  await inst('bunting', buntT, 0, 'bunting');
  const stripT = [];
  for (const x of [-3.2, 0, 3.2]) for (const z of [-6, -3, 0, 3]) stripT.push(placement(x, 4.6, z, Math.PI / 2));
  await inst('strip_light', stripT, 0, 'strips');
  // ---- the club: two more tables beyond the surrounds, each under a pair of low lamps
  for (const sx of [-1, 1]) {
    const t2 = toonify(await ASSET('./assets/table.js'), { outline: 0.006 });
    t2.traverse((o) => { if (o.isMesh && !o.userData.hull) o.material = o.material.clone(); });
    t2.position.set(sx * 5.1, 0, -4.3); scene.add(t2);
    const n2 = toonify(await ASSET('./assets/net.js', { keepHierarchy: true }), { outline: 0.0025 });
    n2.traverse((o) => { if (o.isMesh && !o.userData.hull) o.material = o.material.clone(); });
    if (n2.userData.cloth) { const m = n2.userData.cloth.material; m.map = makeNetTexture(); m.alphaTest = 0.5; m.transparent = false; m.side = THREE.DoubleSide; m.color.setHex(0x0f1626); m.needsUpdate = true; }
    n2.position.set(sx * 5.1, TABLE.H - (n2.userData.net ? n2.userData.net.surfaceY : 0), -4.3); scene.add(n2);
    group('clubTables', [t2, n2]);
  }
  await inst('pendant_lamp', [placement(-5.1, 1.78, -4.9), placement(-5.1, 1.78, -3.7), placement(5.1, 1.78, -4.9), placement(5.1, 1.78, -3.7)], 0.0025, 'pendants');

  // ---- ink focus reaches everything in the hall except the table and the net; the blades and
  // the ball join the scene later and never take it
  const focus = new Set();
  for (const root of [out.table, out.net]) root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) focus.add(m); });
  scene.traverse((o) => { if (!o.isMesh || o.userData.hull) return; for (const m of [].concat(o.material)) if (m && m.isMeshToonMaterial && !focus.has(m)) inkify(m); });

  // ---- a hall is chosen, then moods ride on it every frame
  const L = out.lights, A = out.atmosphere;
  const fogBase = new THREE.Color(), domeBase = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  let base = VENUES.arena.light;
  out.venue = 'arena';
  out.applyVenue = (key) => {
    const v = VENUES[key] || VENUES.arena;
    out.venue = VENUES[key] ? key : 'arena'; base = v.light;
    for (const d of dress) {
      const map = v.colors[d.asset];
      d.mat.color.setHex(map && map[d.src] !== undefined ? map[d.src] : d.src);
    }
    for (const b of out.banners) b.emissive.copy(b.color);
    for (const [name, objs] of Object.entries(out.groups)) { const on = v.show.includes(name); for (const o of objs) o.visible = on; }
    out.crowd.setFill(v.crowd);
    L.key.color.setHex(base.keyColor); L.key.position.set(base.keyPos[0], base.keyPos[1], base.keyPos[2]);
    L.hemi.color.setHex(base.sky); L.hemi.groundColor.setHex(base.ground);
    L.rim.color.setHex(base.rimColor);
    for (const sp of L.spots) sp.color.setHex(base.spotColor);
    fogBase.setHex(base.fog);
    base.dome.forEach((h, i) => domeBase[i].setHex(h));
    A.dustMat.color.setHex(base.dustColor);
    out.mood(0, 0);
  };
  /** ink: 0..1, the hall in pencil. cinema: 0..1, match point closing the light onto the table. */
  out.mood = (ink, cinema) => {
    const c = cinema;
    L.key.intensity = base.key * (1 - 0.6 * c);
    L.hemi.intensity = base.hemi * (1 - 0.75 * c) + 0.5 * ink;
    L.rim.intensity = base.rim * (1 - 0.5 * c);
    // at match point every hall gets its pool of light: brighter, narrower
    const spot = base.spot + (Math.max(base.spot, 44) - base.spot) * c;
    const ang = base.spotAngle + (Math.PI / 9 - base.spotAngle) * c;
    for (const sp of L.spots) { sp.intensity = spot; sp.angle = ang; }
    if (out.flipLamp) out.flipLamp.intensity = base.lamp;
    scene.fog.color.copy(fogBase).lerp(PAPER, ink).multiplyScalar(1 - 0.6 * c * (1 - ink));
    scene.fog.near = base.fogNear * (1 - 0.5 * c);
    scene.fog.far = base.fogFar * (1 - 0.4 * c) + 30 * ink;
    const dk = 1 - 0.6 * c * (1 - ink);
    domeU.top.value.copy(domeBase[0]).lerp(PAPER, ink).multiplyScalar(dk);
    domeU.mid.value.copy(domeBase[1]).lerp(PAPER, ink).multiplyScalar(dk);
    domeU.bottom.value.copy(domeBase[2]).lerp(PAPER, ink).multiplyScalar(dk);
    const cones = (base.cones + (Math.max(base.cones, 0.5) - base.cones) * c) * (1 - ink);
    for (const b of A.beams) b.visible = cones > 0.01;
    for (const m of A.coneMats) m.opacity = cones;
    A.dustMat.opacity = base.dust * (1 - ink);
  };
  out.applyVenue('arena');
  return out;
}
