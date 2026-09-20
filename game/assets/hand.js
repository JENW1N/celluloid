/**
 * The player's racket hand: a fist with the thumb up the back of the grip, a wrist, a white
 * cuff and a navy sleeve running down the forearm. The grip passes through the fist along Y;
 * userData.hand.gripY is how far above the base (the elbow end, y = 0) the fist sits. No
 * fingers to count, no face: it is a cel-shaded glove that says the racket is held.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, name });
  const skin = mat(0xe6b892, 'fabric', 0.75);
  const sleeve = mat(0x1e2a48, 'fabric', 0.9);
  const cuff = mat(0xf2f2ee, 'fabric', 0.8);
  const stripe = mat(0x4fe3ff, 'fabric', 0.8);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  const L = 0.30;
  add(new THREE.CylinderGeometry(0.036, 0.046, L, 14), sleeve, 0, L / 2, 0);
  add(new THREE.CylinderGeometry(0.0475, 0.0475, 0.028, 14), cuff, 0, L - 0.014, 0);
  add(new THREE.CylinderGeometry(0.048, 0.048, 0.006, 14), stripe, 0, L - 0.032, 0);
  add(new THREE.CylinderGeometry(0.033, 0.036, 0.05, 12), skin, 0, L + 0.02, 0);
  const fist = add(new THREE.SphereGeometry(0.047, 14, 10), skin, 0, L + 0.075, 0.004);
  fist.scale.set(1, 0.88, 0.92);
  add(new THREE.BoxGeometry(0.064, 0.05, 0.03), skin, 0, L + 0.07, 0.045);                // curled fingers
  add(new THREE.CapsuleGeometry(0.013, 0.045, 3, 8), skin, -0.028, L + 0.11, -0.012, 0.35, 0, 0.25);   // thumb up the back
  g.userData.hand = { gripY: L + 0.075 };
  // centre on x/z without moving the base: the thumb sits behind the grip's axis
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  for (const o of g.children) { o.position.x -= c.x; o.position.z -= c.z; }
  return g;
}
