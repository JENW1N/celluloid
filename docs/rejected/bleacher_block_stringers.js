/**
 * Grandstand block: 4.0 wide, five rows at 0.40 rise x 0.80 run (2.0 high, 4.0 deep), seats
 * facing +Z with the rows climbing toward -Z. Navy tread slabs on court-red-dark risers with a
 * white nose trim, wood seat planks at the back of each tread, a low navy board behind the top
 * row. Under the steps: three navy stringer beams on round steel legs with ground sills, X-braces
 * across the back and along the sides, and a steel angle tracing the step profile on each side,
 * so the back and underside read as structure rather than a box. Legs and sills sit on y = 0.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const navy = mat(0x1e2a48, 'plaster', 0.85);
  const redDark = mat(0x6f2a2c, 'plaster', 0.85);
  const wood = mat(0xd7a56e, 'timber', 0.65);
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const steel = mat(0x8a8f99, 'metal', 0.45, 0.6);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  // a member from point a to point b, oriented by quaternion so no rotation sign can go wrong
  const Y = new THREE.Vector3(0, 1, 0);
  const member = (geoFn, a, b, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const mesh = new THREE.Mesh(geoFn(len), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, d.normalize());
    g.add(mesh); return mesh;
  };
  const bar = (w, d, a, b, m) => member((len) => new THREE.BoxGeometry(w, len, d), a, b, m);
  const tube = (r, a, b, m) => member((len) => new THREE.CylinderGeometry(r, r, len, 12), a, b, m);

  const W = 4.0, ROWS = 5, RISE = 0.4, RUN = 0.8, TREAD = 0.06, RISER = 0.04, PLANK = 0.05;
  const FRONT = ROWS * RUN / 2;                       // z of the lowest riser, +2.0
  const SIDE = W / 2 - 0.05;                          // x of the side stringers

  // the steps
  for (let i = 0; i < ROWS; i++) {
    const top = RISE * (i + 1), zf = FRONT - RUN * i, zb = zf - RUN;
    add(new THREE.BoxGeometry(W, TREAD, RUN), navy, 0, top - TREAD / 2, zf - RUN / 2);       // tread slab
    add(new THREE.BoxGeometry(W, RISE, RISER), redDark, 0, top - RISE / 2, zf - RISER / 2);  // riser, standing on the tread below
    add(new THREE.BoxGeometry(W, 0.04, 0.03), white, 0, top - 0.02, zf + 0.005);              // white nose trim, 2 cm proud
    add(new THREE.BoxGeometry(W - 0.1, PLANK, 0.35), wood, 0, top + PLANK / 2, zb + 0.20);    // seat plank against the next riser
    // steel angle along the step edge on each side, 2 cm proud of the tread ends
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.04, 0.04, RUN), steel, s * W / 2, top - 0.02, zf - RUN / 2);
      add(new THREE.BoxGeometry(0.04, RISE, 0.04), steel, s * W / 2, top - RISE / 2, zf - 0.02);
    }
  }
  add(new THREE.BoxGeometry(W - 0.1, 0.12, 0.04), navy, 0, ROWS * RISE + 0.06, -FRONT + 0.02);   // board behind the top row

  // three navy stringer beams whose top face runs through the treads' back-bottom corners, so
  // they stay under the slabs everywhere: y = (RISE - TREAD) + (z of the first corner - z) * slope
  const n = new THREE.Vector3(0, RUN, RISE).normalize();      // unit normal of the slope, up and forward
  const yTop = (z) => (RISE - TREAD) + (FRONT - RUN - z) * (RISE / RUN);
  const SH = 0.16, SW = 0.10, zA = 1.55, zB = -1.93;
  const yBot = (z) => yTop(z + SH * n.z) - SH * n.y;         // the underside, directly below a z
  for (const x of [-SIDE, 0, SIDE]) {
    bar(SW, SH, [x, yTop(zA) - SH / 2 * n.y, zA - SH / 2 * n.z], [x, yTop(zB) - SH / 2 * n.y, zB - SH / 2 * n.z], navy);
    // round steel legs up into the beam, on a ground sill
    for (const z of [0.4, -0.4, -1.2, -1.95]) tube(0.035, [x, 0, z], [x, yBot(z) + 0.02, z], steel);
    bar(0.06, 0.04, [x, 0.02, 0.45], [x, 0.02, -2.0], steel);
  }
  // X-braces across the back between the back legs, with a rail through their centres
  for (const [xa, xb] of [[-SIDE, 0], [0, SIDE]]) {
    bar(0.04, 0.04, [xa, 0.10, -1.95], [xb, 1.60, -1.95], steel);
    bar(0.04, 0.04, [xa, 1.60, -1.95], [xb, 0.10, -1.95], steel);
  }
  bar(0.05, 0.05, [-SIDE, 0.85, -1.95], [SIDE, 0.85, -1.95], steel);
  // braces along each side under the stringer, between the legs
  for (const x of [-SIDE, SIDE]) {
    bar(0.04, 0.04, [x, 0.06, 0.4], [x, 0.90, -0.4], steel);
    bar(0.04, 0.04, [x, 0.06, -0.4], [x, 1.30, -1.2], steel);
    bar(0.04, 0.04, [x, 0.90, -0.4], [x, 0.06, -1.2], steel);
    bar(0.04, 0.04, [x, 0.06, -1.2], [x, 1.68, -1.95], steel);
    bar(0.04, 0.04, [x, 1.30, -1.2], [x, 0.06, -1.95], steel);
  }

  g.userData.bleacher = { width: W, rows: ROWS, rise: RISE, run: RUN, plank: PLANK, seatDepth: 0.35 };
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
