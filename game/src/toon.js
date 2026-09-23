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

/**
 * Ink focus. One uniform, eased by the game from 0 to 1, draws every background material in
 * pencil on paper: the colour a fragment would have becomes a tone, bright tones go to paper,
 * dark ones to graphite, and the shade takes screen-space hatching in two directions. The table,
 * the net, the ball and the blades are never inkified, so they keep their colour.
 */
export const INK = { value: 0 };
export const INK_PX = { value: 1 };
const INK_GLSL = `
  if (uInk > 0.001) {
    vec3 inkC = gl_FragColor.rgb;
    float tone = clamp(dot(inkC, vec3(0.299, 0.587, 0.114)) * 2.6, 0.0, 1.0);
    vec3 paper = vec3(0.94, 0.92, 0.86), lead = vec3(0.25, 0.26, 0.31);
    vec3 pencil = mix(lead, paper, smoothstep(0.0, 0.42, tone));
    float s = 7.0 * uInkPx;
    float h1 = 1.0 - step(0.16, fract((gl_FragCoord.x + gl_FragCoord.y) / s));
    float h2 = 1.0 - step(0.16, fract((gl_FragCoord.x - gl_FragCoord.y) / s));
    pencil = mix(pencil, lead, h1 * (1.0 - smoothstep(0.34, 0.62, tone)) * 0.72);
    pencil = mix(pencil, lead, h2 * (1.0 - smoothstep(0.14, 0.34, tone)) * 0.72);
    gl_FragColor.rgb = mix(inkC, pencil, uInk);
  }
`;
export function inkify(m) {
  if (!m || !m.userData || m.userData.ink) return;
  m.userData.ink = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uInk = INK; sh.uniforms.uInkPx = INK_PX;
    sh.fragmentShader = 'uniform float uInk;\nuniform float uInkPx;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>' + INK_GLSL);
  };
  m.customProgramCacheKey = () => 'ink';
  m.needsUpdate = true;
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
