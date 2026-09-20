/**
 * A seated stylised spectator, 1.05 m high, 0.45 wide, 0.63 deep, no face. Capsule torso and
 * sphere head, cylinder legs bent at the knee with the knees toward +Z and the feet on y = 0,
 * arms down and forward with mitt hands resting on the knees, ink shoes. The seat underside is
 * 0.45 above the feet, one 0.40 bleacher step plus its 0.05 plank, so place it with the feet on
 * the tread below the plank it sits on. Torso, arms and legs share one material so a crowd can
 * be recoloured per figure (crowd A here). Cheap on purpose: it is copied two hundred times.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const body = mat(0x3b4a7a, 'fabric', 0.85);
  const skin = mat(0xe6c9a8, 'plaster', 0.7);
  const shoe = mat(0x141620, 'fabric', 0.85);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  // a capped cylinder from point a to point b, oriented with a quaternion so no rotation sign
  // can fling a limb the wrong way
  const Y = new THREE.Vector3(0, 1, 0);
  const limb = (r, a, b, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, d.normalize());
    g.add(mesh); return mesh;
  };

  const SEAT = 0.45, HIP = SEAT + 0.075, KNEE_Z = 0.36;
  const torso = add(new THREE.CapsuleGeometry(0.16, 0.10, 2, 12), body, 0, SEAT + 0.21, 0);   // torso, seat to shoulders
  add(new THREE.SphereGeometry(0.12, 16, 8), skin, 0, 0.93, 0);                   // head, top at 1.05
  for (const s of [-1, 1]) {
    const x = s * 0.085;
    limb(0.075, [x, HIP, -0.06], [x, HIP, KNEE_Z], body);                 // thigh, forward to the knee
    limb(0.06, [x, HIP, KNEE_Z - 0.03], [x, 0.03, KNEE_Z - 0.03], body);  // shin, down into the shoe
    add(new THREE.BoxGeometry(0.10, 0.06, 0.22), shoe, x, 0.03, KNEE_Z);   // shoe on the ground
    const sx = s * 0.14, ex = s * 0.18, hx = s * 0.10;
    limb(0.045, [sx, 0.78, 0.0], [ex, 0.58, 0.08], body);                 // upper arm, out and down
    limb(0.04, [ex, 0.58, 0.08], [hx, 0.62, 0.30], body);                 // forearm, forward to the knee
    add(new THREE.BoxGeometry(0.07, 0.045, 0.09), skin, hx, 0.625, 0.33); // hand resting on the knee
  }

  recentre(THREE, g);
  // The seat underside and where it is in the recentred frame, so a level can put the bum on a
  // plank and the feet on the tread below it.
  g.userData.seat = { y: SEAT, z: +torso.position.z.toFixed(3), width: 0.45 };
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
