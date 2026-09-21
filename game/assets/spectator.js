/**
 * A seated spectator as a silhouette: a capsule torso leaning back a touch and a head. No
 * legs, no arms, no face, few segments. The crowd is two hundred of these and should read as
 * a crowd, not as people. The base (y = 0) is the seat, so place it on the plank; the game
 * recolours the torso per instance.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, name: 'fabric' });
  const body = mat(0x2e3a5c), skin = mat(0xd8c0a0);
  const add = (geo, m, x, y, z, rx = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.x = rx; g.add(mesh); return mesh; };
  add(new THREE.CapsuleGeometry(0.15, 0.22, 3, 10), body, 0, 0.26, 0, -0.12);   // torso
  add(new THREE.SphereGeometry(0.1, 12, 8), skin, 0, 0.6, -0.02);              // head
  g.userData.spectator = { seat: { y: 0, z: 0 } };
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
