/**
 * The venue, assembled from the asset modules. Everything that never moves and repeats is
 * instanced per material bucket (barriers, bleachers, walls, trusses, the crowd) so the whole
 * arena is a few dozen draw calls. The crowd bobs with excitement and jumps on a point.
 */
import * as THREE from 'three';
import { ASSET } from '../assetlib.js';
import { toonify, toonMaterial, hullGeometry, outlineMaterial } from './toon.js';
import { TABLE, PALETTE, clamp } from './consts.js';

export const ASSET_NAMES = ['court_floor', 'table', 'net', 'paddle', 'ball', 'barrier', 'bleacher_block', 'spectator', 'floodlight_truss', 'arena_wall_section', 'umpire_table', 'referee_chair', 'scoreboard_flip', 'ball_bucket', 'towel_box'];
export const ASSET_LIST = ASSET_NAMES.map((n) => `./assets/${n}.js`);

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const placement = (x, y, z, ry = 0) => { _e.set(0, ry, 0); return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s); };

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
  const rim = x.createRadialGradient(S * 0.5, S * 0.5, S * 0.1, S * 0.5, S * 0.5, S * 0.52);
  rim.addColorStop(0, '#f6f6f6'); rim.addColorStop(0.7, '#dcdcdc'); rim.addColorStop(1, '#8a8a8a');
  x.fillStyle = rim; x.fillRect(0, 0, S, S);
  const hi = x.createRadialGradient(S * 0.36, S * 0.3, 0, S * 0.36, S * 0.3, S * 0.36);
  hi.addColorStop(0, 'rgba(255,255,255,0.72)'); hi.addColorStop(0.45, 'rgba(255,255,255,0.22)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = hi; x.fillRect(0, 0, S, S);
  x.fillStyle = 'rgba(0,0,0,0.16)';
  for (let j = 3; j < S; j += 6) for (let i = 3 + ((j / 6) % 2) * 3; i < S; i += 6) { x.beginPath(); x.arc(i, j, 1.1, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / (2 * 0.0715), 1 / (2 * 0.075)); t.offset.set(0.5, 0.5);
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
  const N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 7; pos[i * 3 + 1] = 0.3 + Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 8; seed[i] = Math.random() * 100; }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe0b0, size: 0.018, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  dust.renderOrder = 2;
  scene.add(dust);
  let t = 0;
  return {
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
  return dome;
}

function setupLights(scene, phone) {
  scene.fog = new THREE.Fog(0x0b0e1a, 9, 34);
  // two warm pools on the table from the trusses
  for (const [x, z] of [[-2.2, -2.4], [2.2, 2.4]]) {
    const sp = new THREE.SpotLight(0xffe2b8, 34, 16, Math.PI / 7, 0.6, 2);
    sp.position.set(x, 6.3, z); sp.target.position.set(0, 0.76, 0);
    scene.add(sp); scene.add(sp.target);
  }
  const key = new THREE.DirectionalLight(0xfff1dc, 1.45);
  key.position.set(2.6, 7.5, 3.2);
  key.target.position.set(0, 0.5, -0.4);
  scene.add(key); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  const c = key.shadow.camera;
  c.left = -5.5; c.right = 5.5; c.top = 6; c.bottom = -6; c.near = 1; c.far = 22;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight(0x8fb4d8, 0x5a2a2a, 0.42);
  scene.add(hemi);
  const rim = new THREE.DirectionalLight(0x4fe3ff, 0.25);
  rim.position.set(-3, 3, -6);
  scene.add(rim);
  return { key, hemi, rim };
}

export async function buildArena(scene, { phone = false } = {}) {
  const out = { banners: [], lenses: [] };
  makeDome(scene);
  out.lights = setupLights(scene, phone);
  out.atmosphere = makeAtmosphere(scene);

  const floor = toonify(await ASSET('./assets/court_floor.js'));
  floor.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  floor.position.y = -0.037;                      // the slab's walking surface is y = 0
  scene.add(floor);
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
  for (let i = -1; i <= 1; i++) bT.push(placement(i * 2.35, 0, -6.2, 0));
  instanceAsset(scene, barrier, bT, { outline: 0.004 });

  // grandstands and the crowd
  const bleacher = await ASSET('./assets/bleacher_block.js');
  const blocks = [];
  for (const z of [-4.6, 0, 4.6]) { blocks.push(placement(7.8, 0, z, -Math.PI / 2)); blocks.push(placement(-7.8, 0, z, Math.PI / 2)); }
  for (const x of [-4.6, 0, 4.6]) blocks.push(placement(x, 0, -8.6, 0));
  instanceAsset(scene, bleacher, blocks, { outline: 0, shadows: false });
  const spectator = await ASSET('./assets/spectator.js');
  const seats = [];
  const seatLocal = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  for (const bm of blocks) for (let r = 0; r < 5; r++) for (let k = 0; k < 8; k++) {
    if (Math.random() > 0.6) continue;
    _e.set(0, (Math.random() - 0.5) * 0.35, 0);
    // on the plank: row r's seat is 0.45 up and 0.8 back per row
    seatLocal.compose(_p.set(-1.75 + 0.5 * k + (Math.random() - 0.5) * 0.06, 0.4 * r + 0.45, 1.39 - 0.8 * r), _q.setFromEuler(_e), _s);
    seats.push({ m: tmp.multiplyMatrices(bm, seatLocal).clone(), phase: Math.random() * Math.PI * 2, rate: 1.6 + Math.random() * 1.2, jump: Math.random() });
  }
  const crowdColors = PALETTE.crowdVariety.map((c) => new THREE.Color(c));
  const bodyHex = PALETTE.crowd[0];
  const crowdParts = instanceAsset(scene, spectator, seats.map((s) => s.m), {
    outline: 0, shadows: false,
    colorFor: (i, mesh) => (mesh.material.userData.srcColor === bodyHex || (mesh.material.color && mesh.material.color.getHex() === bodyHex)) ? crowdColors[Math.floor(Math.random() * crowdColors.length)] : null,
  });
  out.crowd = {
    excite: 0, cheer: 0, t: 0,
    update(dt, excitement, cheer) {
      this.t += dt;
      this.excite += (excitement - this.excite) * (1 - Math.exp(-2 * dt));
      this.cheer = Math.max(0, this.cheer - dt * 0.6);
      if (cheer > this.cheer) this.cheer = cheer;
      const amp = 0.006 + 0.028 * this.excite;
      const ch = this.cheer;
      for (let i = 0; i < seats.length; i++) {
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
  for (const x of [-8, 0, 8]) wT.push(placement(x, 0, -12.5, 0));
  for (const z of [-8, 0, 8]) { wT.push(placement(12.2, 0, z, -Math.PI / 2)); wT.push(placement(-12.2, 0, z, Math.PI / 2)); }
  const wallParts = instanceAsset(scene, wall, wT, { outline: 0, shadows: false });
  for (const part of wallParts) {
    const hex = part.im.material.userData.srcColor;
    if (hex === PALETTE.cyan || hex === PALETTE.orange) { part.im.material.emissive.setHex(hex); part.im.material.emissiveIntensity = 0.15; out.banners.push(part.im.material); }
  }
  const truss = await ASSET('./assets/floodlight_truss.js');
  instanceAsset(scene, truss, [placement(0, 6.4, -2.6, 0), placement(0, 6.4, 2.6, 0)], { outline: 0, shadows: false });

  // courtside furniture
  const setPiece = async (name, x, y, z, ry, outline) => { const o = toonify(await ASSET(`./assets/${name}.js`), { outline }); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
  await setPiece('umpire_table', 3.1, 0, 0.5, -Math.PI / 2, 0.004);
  await setPiece('referee_chair', 3.62, 0, 0.5, -Math.PI / 2, 0.003);
  await setPiece('scoreboard_flip', 3.1, TABLE.H, 0.5, -Math.PI / 2, 0.002);
  await setPiece('ball_bucket', 2.45, 0, -2.3, 0.4, 0.003);
  await setPiece('towel_box', 2.45, 0, 2.05, 0.2, 0.003);
  await setPiece('towel_box', -2.45, 0, -2.05, -0.3, 0.003);

  out.setLevel = (lvl) => { const k = 0.15 + 0.9 * clamp(lvl, 0, 1); for (const m of out.banners) m.emissiveIntensity = k; };
  return out;
}
