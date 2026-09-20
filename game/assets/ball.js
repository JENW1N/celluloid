/**
 * A 40 mm three-star ball: a white sphere with one orange equatorial band and a cyan dot at each
 * pole, so any spin axis reads on screen. Rotating the inner group about its own origin spins
 * the ball about its centre.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, name: 'plaster' });
  const R = 0.02;
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), mat(0xf2f2ee)));
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R + 0.0004, 24, 2, 0, Math.PI * 2, Math.PI / 2 - 0.15, 0.3), mat(0xff7a30)));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R + 0.0004, 12, 3, 0, Math.PI * 2, 0, 0.32), mat(0x4fe3ff));
  g.add(cap);
  const cap2 = cap.clone(); cap2.rotation.x = Math.PI; g.add(cap2);
  for (const o of g.children) o.position.y += R;   // rest on the ground
  g.userData.ball = { radius: R };
  return g;
}
