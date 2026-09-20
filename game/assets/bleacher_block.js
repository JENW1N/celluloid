/**
 * Grandstand block: 4.0 wide, five rows at 0.40 rise x 0.80 run (2.0 high, 4.0 deep), seats
 * facing +Z with the rows climbing toward -Z. Navy tread slabs on court-red-dark risers with a
 * white nose trim, a wood seat plank at the back of each tread, a low navy board behind the top
 * row. The steps are carried on three square-tube steel trusses: a top chord under the treads'
 * back corners, a bottom chord on the ground, a post at every tread corner and Warren diagonals
 * between them, tied across by steel joists under each tread and X-braces plus two rails across
 * the back, so the back and underside read as structure rather than a box. A steel angle traces
 * the step profile on each side. Lowest points are the bottom chords and posts on y = 0.
 * userData.bleacher.seats lists, per row, where a spectator's feet and seat go.
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
  const Y = new THREE.Vector3(0, 1, 0);
  const bar = (w, d, a, b, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
    g.add(mesh); return mesh;
  };

  const W = 4.0, ROWS = 5, RISE = 0.4, RUN = 0.8, TREAD = 0.06, RISER = 0.04, PLANK = 0.05;
  const FRONT = ROWS * RUN / 2;
  const SIDE = W / 2 - 0.05;
  const planks = [];

  for (let i = 0; i < ROWS; i++) {
    const top = RISE * (i + 1), zf = FRONT - RUN * i, zb = zf - RUN;
    add(new THREE.BoxGeometry(W, TREAD, RUN), navy, 0, top - TREAD / 2, zf - RUN / 2);
    add(new THREE.BoxGeometry(W, RISE, RISER), redDark, 0, top - RISE / 2, zf - RISER / 2);
    add(new THREE.BoxGeometry(W, 0.04, 0.03), white, 0, top - 0.02, zf + 0.005);
    planks.push(add(new THREE.BoxGeometry(W - 0.1, PLANK, 0.35), wood, 0, top + PLANK / 2, zb + 0.20));
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.04, 0.04, RUN), steel, s * W / 2, top - 0.02, zf - RUN / 2);
      add(new THREE.BoxGeometry(0.04, RISE, 0.04), steel, s * W / 2, top - RISE / 2, zf - 0.02);
    }
    // steel joist under the back edge of each tread, spanning the three trusses
    add(new THREE.BoxGeometry(W - 0.1, 0.05, 0.05), steel, 0, top - TREAD - 0.025, zb + 0.03);
  }
  add(new THREE.BoxGeometry(W - 0.1, 0.12, 0.04), navy, 0, ROWS * RISE + 0.06, -FRONT + 0.02);

  // trusses: top chord along the line through the treads' back-bottom corners
  const n = new THREE.Vector3(0, RUN, RISE).normalize();
  const yTop = (z) => (RISE - TREAD) + (FRONT - RUN - z) * (RISE / RUN);
  const CH = 0.08, zA = 1.55, zB = -1.93;
  const yBot = (z) => yTop(z + CH * n.z) - CH * n.y;
  const nodes = [1.2, 0.4, -0.4, -1.2, -1.95];
  for (const x of [-SIDE, 0, SIDE]) {
    bar(0.06, CH, [x, yTop(zA) - CH / 2 * n.y, zA - CH / 2 * n.z], [x, yTop(zB) - CH / 2 * n.y, zB - CH / 2 * n.z], steel);
    bar(0.06, 0.05, [x, 0.025, 1.55], [x, 0.025, -2.0], steel);                          // bottom chord on the ground
    for (const z of nodes) bar(0.05, 0.05, [x, 0, z], [x, yBot(z) + 0.02, z], steel);      // posts
    for (let k = 0; k < nodes.length - 1; k++) {                                            // Warren diagonals
      const z0 = nodes[k], z1 = nodes[k + 1];
      if (k % 2 === 0) bar(0.04, 0.04, [x, 0.05, z0], [x, yBot(z1) - 0.02, z1], steel);
      else bar(0.04, 0.04, [x, yBot(z0) - 0.02, z0], [x, 0.05, z1], steel);
    }
  }
  // X-braces and two rails across the back
  for (const [xa, xb] of [[-SIDE, 0], [0, SIDE]]) {
    bar(0.04, 0.04, [xa, 0.10, -1.95], [xb, 1.60, -1.95], steel);
    bar(0.04, 0.04, [xa, 1.60, -1.95], [xb, 0.10, -1.95], steel);
  }
  for (const y of [0.55, 1.35]) bar(0.05, 0.05, [-SIDE, y, -1.95], [SIDE, y, -1.95], steel);

  recentre(THREE, g);
  // Where spectators go, in the recentred frame: feet on the tread below, seat on the plank top,
  // z at the plank's centre. A spectator module's own userData.seat says where its seat sits
  // relative to its origin.
  g.userData.bleacher = {
    width: W, rows: ROWS, rise: RISE, run: RUN, plank: PLANK, seatDepth: 0.35,
    seats: planks.map((p, i) => ({
      row: i, feetY: +(p.position.y - PLANK / 2 - RISE).toFixed(3), seatY: +(p.position.y + PLANK / 2).toFixed(3),
      z: +p.position.z.toFixed(3), xMin: -(W / 2 - 0.3), xMax: W / 2 - 0.3,
    })),
  };
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
