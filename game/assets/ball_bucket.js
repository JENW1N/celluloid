/**
 * Ball bucket: a rubber-red tapered bucket 0.30 across the rim and 0.30 tall, open at the top
 * (double-sided wall, a bottom disc), a steel rim ring, a steel wire bail folded down and lying
 * against the front (+Z) side on two ear pivots, and 24 line-white 40 mm balls: a packed layer
 * just under the rim with five more nested on top and showing above it. Base at y = 0, centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name, ...extra });
  const red = mat(0xc81e2e, 'plaster', 0.6, 0, { side: THREE.DoubleSide });
  const steel = mat(0x8a8f99, 'metal', 0.55, 0.6);
  const white = mat(0xf2f2ee, 'plaster', 0.6, 0, { side: THREE.DoubleSide });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };

  const RT = 0.144, RB = 0.105, WH = 0.296;          // rim radius, base radius, wall height
  const rAt = (y) => RB + (RT - RB) * y / WH;        // wall radius at a height
  add(new THREE.CylinderGeometry(RT, RB, WH, 16, 1, true), red, 0, WH / 2, 0);
  add(new THREE.CircleGeometry(RB - 0.002, 16), red, 0, 0.004, 0, -Math.PI / 2);
  add(new THREE.TorusGeometry(RT + 0.001, 0.007, 6, 16), steel, 0, WH, 0, Math.PI / 2);

  // bail: a half torus whose ends sit in the ears; rotation.x = PI/2 + a lays its bulge toward
  // +Z and drops it a degrees below horizontal so it rests on the flare of the wall
  const earY = WH - 0.012, bailR = 0.157, dropA = THREE.MathUtils.degToRad(27);
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 8), steel, s * 0.15, earY, 0, 0, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(bailR, 0.004, 5, 14, Math.PI), steel, 0, earY, 0, Math.PI / 2 + dropA);

  // balls: a hex layer with its tops just under the rim, five more nested on top and standing proud
  const br = 0.02, layerY = 0.268;
  add(new THREE.CircleGeometry(rAt(layerY - 0.006) - 0.002, 16), white, 0, layerY - 0.006, 0, -Math.PI / 2);
  const ball = (x, y, z, hs) => add(new THREE.SphereGeometry(br, 12, hs), white, x, y, z);
  const pts = [[0, 0]];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; pts.push([0.047 * Math.cos(a), 0.047 * Math.sin(a)]); }
  for (let i = 0; i < 12; i++) { const a = (i + 0.5) * Math.PI / 6; pts.push([0.097 * Math.cos(a), 0.097 * Math.sin(a)]); }
  pts.forEach(([x, z]) => ball(x, layerY, z, 4));
  for (let i = 0; i < 5; i++) {
    const a = i * 2 * Math.PI / 5 + 0.3, rr = i === 0 ? 0 : 0.072;
    ball(rr * Math.cos(a), layerY + 0.029, rr * Math.sin(a), 6);
  }

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
