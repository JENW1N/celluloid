/**
 * A seated spectator as a silhouette: a capsule torso leaning back a touch, a lap, shins to the
 * floor, a head. No arms, no face, few segments. The crowd is two hundred of these and should
 * read as a crowd, not as people. Feet on y = 0, seat at 0.45 so it sits on a 0.40 step with its
 * 0.05 plank; the game recolours the body per instance.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, name: 'fabric' });
  const body = mat(0x2e3a5c), skin = mat(0xd8c0a0);
  const add = (geo, m, x, y, z, rx = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.x = rx; g.add(mesh); return mesh; };
  const seat = 0.45;
  add(new THREE.CapsuleGeometry(0.15, 0.22, 3, 10), body, 0, seat + 0.26, -0.16, -0.14);   // torso
  add(new THREE.BoxGeometry(0.32, 0.13, 0.32), body, 0, seat + 0.065, 0.0);                // thighs
  add(new THREE.BoxGeometry(0.28, seat - 0.02, 0.11), body, 0, (seat - 0.02) / 2, 0.15);    // shins
  add(new THREE.SphereGeometry(0.1, 12, 8), skin, 0, seat + 0.52 + 0.07, -0.18);            // head
  g.userData.spectator = { seat: { y: seat, z: -0.155 } };
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
