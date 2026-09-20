/**
 * Umpire's table: 1.2 x 0.6 m, 0.76 high. Wood top 0.04 thick with a line-white trim strip along
 * the front and side top edges, a table-blue pleated cloth skirt hanging to 2 cm off the floor on
 * the front and both sides (a zigzag of angled panels, 5 cm deep, so the pleats shade and outline), and a
 * square-tube steel frame that shows at the open back: four legs, a stretcher, an apron rail and
 * an X brace. The side skirts stop short of the back so the rear legs read from the sides too.
 * Base at y = 0, centred, front is +Z.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const wood = mat(0xd7a56e, 'timber', 0.7);
  const cloth = mat(0x2456a8, 'fabric', 0.9);
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const steel = mat(0x8a8f99, 'metal', 0.55, 0.6);
  const box = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const W = 1.2, D = 0.6, H = 0.76, T = 0.04;

  // top slab, and the white trim strip standing 1 cm proud of its front and side edges
  box(W, T, D, wood, 0, H - T / 2, 0);
  box(W + 0.02, 0.035, 0.01, white, 0, H - 0.0175, D / 2 + 0.005);
  for (const s of [-1, 1]) box(0.01, 0.035, D, white, s * (W / 2 + 0.005), H - 0.0175, 0);

  // cloth skirt: a zigzag polyline of thin panels, 4 cm deep pleats, hung under the slab's
  // overhang from 2 cm above the floor. rotation.y = atan2(-dz, dx) lays a box's +X along (dx, dz).
  const skirtTop = H - T, skirtBot = 0.02, sh = skirtTop - skirtBot, sy = (skirtTop + skirtBot) / 2;
  const seg = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0;
    box(Math.hypot(dx, dz) + 0.004, sh, 0.008, cloth, (x0 + x1) / 2, sy, (z0 + z1) / 2, 0, Math.atan2(-dz, dx), 0);
  };
  const OUT = 0.29, IN = 0.24, SX = W / 2 - 0.02, SIN = SX - 0.05;
  const nf = 6;
  for (let i = 0; i < nf; i++) {
    const x0 = -SX + (i / nf) * 2 * SX, x1 = -SX + ((i + 1) / nf) * 2 * SX;
    seg(x0, i % 2 ? IN : OUT, x1, i % 2 ? OUT : IN);
  }
  const ns = 3, zEnd = -0.20;
  for (const s of [-1, 1]) for (let i = 0; i < ns; i++) {
    const z0 = OUT + (i / ns) * (zEnd - OUT), z1 = OUT + ((i + 1) / ns) * (zEnd - OUT);
    seg(s * (i % 2 ? SIN : SX), z0, s * (i % 2 ? SX : SIN), z1);
  }

  // square-tube steel frame, open at the back: legs, rear stretcher, apron rail, X brace
  const leg = 0.03, legH = H - T;
  for (const s of [-1, 1]) {
    box(leg, legH, leg, steel, s * 0.55, legH / 2, -0.27);
    box(leg, legH, leg, steel, s * 0.55, legH / 2, 0.21);
  }
  box(1.10, leg, leg, steel, 0, 0.12, -0.27);
  box(1.10, 0.05, leg, steel, 0, legH - 0.025, -0.27);
  // rotation.z = atan2(dy, dx) maps the box's +X onto (dx, dy, 0)
  const bx = 1.10, by = 0.49, bl = Math.hypot(bx, by), ba = Math.atan2(by, bx);
  box(bl, 0.02, 0.02, steel, 0, 0.145 + by / 2, -0.27, 0, 0, ba);
  box(bl, 0.02, 0.02, steel, 0, 0.145 + by / 2, -0.27, 0, 0, -ba);

  recentre(THREE, g);
  return g;
}

function recentre(THREE, g) {
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
}
