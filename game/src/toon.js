/**
 * The cel look, applied at load time over assets that stay on the recipe contract.
 *
 * Every MeshStandardMaterial an asset built becomes a MeshToonMaterial sharing one three-step
 * gradient, and each mesh that asks for it gets an inverted-hull outline: a copy of its geometry
 * with position-merged smooth normals, pushed out along those normals in view space and drawn
 * back-face only, so the ink line is the same thickness on a box corner as on a sphere.
 */
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

let gradient = null;
export function getGradient() {
  if (gradient) return gradient;
  const steps = [0.24, 0.6, 1.0];                       // the unlit step is deep: beyond the pools the hall falls away
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((s, i) => { const v = Math.round(s * 255); data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255; });
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter; gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false; gradient.needsUpdate = true;
  return gradient;
}

const OUTLINE_VS = `
uniform float width;
void main() {
  vec4 pos = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    pos = instanceMatrix * pos;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 mv = modelViewMatrix * pos;
  vec3 nv = normalize(normalMatrix * n);
  mv.xyz += nv * width;
  gl_Position = projectionMatrix * mv;
}`;
const OUTLINE_FS = `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`;
const outlineMats = new Map();
export function outlineMaterial(width, color = 0x0e1018) {
  const key = `${width}:${color}`;
  if (!outlineMats.has(key)) {
    outlineMats.set(key, new THREE.ShaderMaterial({
      uniforms: { width: { value: width }, color: { value: new THREE.Color(color) } },
      vertexShader: OUTLINE_VS, fragmentShader: OUTLINE_FS, side: THREE.BackSide,
    }));
  }
  return outlineMats.get(key);
}

const toonCache = new Map();
export function toonMaterial(src) {
  if (!src) return src;
  if (src.userData && src.userData.toon) return src;
  let m = toonCache.get(src.uuid);
  if (m) return m;
  m = new THREE.MeshToonMaterial({
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    gradientMap: getGradient(),
    emissive: src.emissive ? src.emissive.clone() : new THREE.Color(0x000000),
    transparent: !!src.transparent, opacity: src.opacity === undefined ? 1 : src.opacity,
    side: src.side === undefined ? THREE.FrontSide : src.side,
  });
  m.name = src.name || ''; m.userData.toon = true; m.userData.srcColor = m.color.getHex();
  toonCache.set(src.uuid, m);
  return m;
}

/** Smooth-normal copy of a geometry, for the hull. */
export function hullGeometry(geo) {
  let g = geo.clone();
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g.deleteAttribute('color');
  try { g = BufferGeometryUtils.mergeVertices(g, 1e-4); } catch (e) { /* keep g */ }
  g.computeVertexNormals();
  return g;
}

/** Convert every material under root and add outlines of the given view-space width. */
export function toonify(root, { outline = 0 } = {}) {
  const hulls = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.hull) return;
    if (Array.isArray(o.material)) o.material = o.material.map(toonMaterial);
    else o.material = toonMaterial(o.material);
    if (outline > 0 && !o.isInstancedMesh) hulls.push(o);
  });
  for (const o of hulls) {
    const hull = new THREE.Mesh(hullGeometry(o.geometry), outlineMaterial(outline));
    hull.userData.hull = true; hull.frustumCulled = o.frustumCulled;
    o.add(hull);
  }
  return root;
}
