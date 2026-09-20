/**
 * Referee's folding chair: 0.45 wide, 0.85 high, 0.5 deep. Two U-shaped steel tube frames that
 * cross under the seat and are riveted where they meet: the front legs run up to become the
 * backrest uprights, the rear legs run up to carry the seat's front edge. An X brace between the
 * rear legs, a lumbar bar between the uprights, a steel seat pan with an ink cushion and a
 * curved ink backrest. The sitter faces +Z. Base at y = 0, centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const steel = mat(0x8a8f99, 'metal', 0.55, 0.6);
  const ink = mat(0x141620, 'fabric', 0.85);
  const box = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  // A cylinder laid between two points: the quaternion takes the cylinder's +Y onto the
  // segment, so there is no rotation sign to get wrong.
  const UP = new THREE.Vector3(0, 1, 0);
  const tube = (a, b, r, m, seg = 12) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const dir = to.clone().sub(from), len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    g.add(mesh); return mesh;
  };

  const R = 0.011;                       // 22 mm tube
  const XA = 0.215, XB = 0.19;           // rear frame outside the front frame
  // front frame B: front feet up to the backrest top. rear frame A: rear feet up to the seat front.
  const B0 = [XB, R, 0.12], B1 = [XB, 0.85 - R, -0.22];
  const A0 = [XA, R, -0.24 + R], A1 = [XA, 0.425, 0.23];
  const zOn = (p0, p1, y) => p0[2] + (p1[2] - p0[2]) * (y - p0[1]) / (p1[1] - p0[1]);

  for (const s of [-1, 1]) {
    tube([s * B0[0], B0[1], B0[2]], [s * B1[0], B1[1], B1[2]], R, steel);
    tube([s * A0[0], A0[1], A0[2]], [s * A1[0], A1[1], A1[2]], R, steel);
  }
  // the U bends: floor bars, the seat-front bar and the backrest-top bar, run out to the tubes' outer faces
  tube([-XB - R, R, B0[2]], [XB + R, R, B0[2]], R, steel);
  tube([-XA - R, R, A0[2]], [XA + R, R, A0[2]], R, steel);
  tube([-XA - R, 0.418, A1[2]], [XA + R, 0.418, A1[2]], R, steel);
  tube([-XB - R, B1[1], B1[2]], [XB + R, B1[1], B1[2]], R, steel);
  // lumbar bar between the uprights, below the backrest
  const zl = zOn(B0, B1, 0.58);
  tube([-XB, 0.58, zl], [XB, 0.58, zl], 0.008, steel);
  // X brace between the rear legs, lying in the plane of that frame
  const y1 = 0.10, y2 = 0.36, za = zOn(A0, A1, y1), zb = zOn(A0, A1, y2);
  tube([-XA, y1, za], [XA, y2, zb], 0.008, steel);
  tube([XA, y1, za], [-XA, y2, zb], 0.008, steel);
  // rivets where the two frames cross
  const mA = (A1[2] - A0[2]) / (A1[1] - A0[1]), mB = (B1[2] - B0[2]) / (B1[1] - B0[1]);
  const yc = R + (B0[2] - A0[2]) / (mA - mB), zc = zOn(B0, B1, yc);
  for (const s of [-1, 1]) {
    const riv = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.05, 12), steel);
    riv.position.set(s * (XA + XB) / 2, yc, zc); riv.rotation.z = Math.PI / 2; g.add(riv);
  }

  // seat: steel pan on the rear frame's front bar, ink cushion on top
  box(0.43, 0.012, 0.40, steel, 0, 0.429, 0.05);
  box(0.40, 0.035, 0.38, ink, 0, 0.4525, 0.055);

  // backrest: an annular sector extruded along the uprights, so it curves around the sitter.
  // Drawn in the XY plane and extruded along local Z; rotation.x = -PI/2 stands the extrusion up,
  // and the extra tilt lays it along the uprights (top toward -Z).
  const Rm = 0.585, half = 0.2 / Rm;
  const shape = new THREE.Shape();
  shape.absarc(0, -Rm, Rm + 0.015, Math.PI / 2 - half, Math.PI / 2 + half, false);
  shape.absarc(0, -Rm, Rm - 0.015, Math.PI / 2 + half, Math.PI / 2 - half, true);
  const tilt = Math.atan2(B0[2] - B1[2], B1[1] - B0[1]);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false, curveSegments: 8 }), ink);
  back.position.set(0, 0.655, zOn(B0, B1, 0.655));
  back.rotation.x = -Math.PI / 2 - tilt;
  g.add(back);

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
