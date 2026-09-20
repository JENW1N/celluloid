/**
 * The player's racket hand, and only the hand: a fist with curled fingers in front and the
 * thumb up the back of the grip. The grip passes through the fist along Y; userData.hand.gripY
 * is how far above the base (y = 0, the bottom of the fist) the grip's centre sits. No arm.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe6b892, roughness: 0.75, metalness: 0, name: 'fabric' });
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, skin); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  const fist = add(new THREE.SphereGeometry(0.047, 14, 10), 0, 0.046, 0.004);
  fist.scale.set(1, 0.95, 0.92);
  add(new THREE.BoxGeometry(0.064, 0.05, 0.03), 0, 0.042, 0.045);                            // curled fingers
  add(new THREE.CapsuleGeometry(0.013, 0.045, 3, 8), -0.028, 0.08, -0.012, 0.35, 0, 0.25);    // thumb up the back
  g.userData.hand = { gripY: 0.046 };
  const box = new THREE.Box3(), v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse((n) => { const p = n.isMesh && n.geometry.attributes.position; if (!p) return; for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(n.matrixWorld)); });
  const c = box.getCenter(new THREE.Vector3());
  for (const o of g.children) { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; }
  g.userData.hand.gripY -= box.min.y;
  return g;
}
