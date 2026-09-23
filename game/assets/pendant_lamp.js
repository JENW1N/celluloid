/**
 * A club pendant lamp: a deep green enamel cone shade with a white reflector inside, a warm
 * glowing bulb at its mouth, a cap and a cord up to the ceiling. Base at y = 0 (the bottom of
 * the bulb), centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const enamel = new THREE.MeshStandardMaterial({ color: 0x1f4d3a, roughness: 0.45, metalness: 0.3, name: 'metal', side: THREE.FrontSide });
  const inner = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.6, name: 'metal', side: THREE.BackSide });
  const bulb = new THREE.MeshStandardMaterial({ color: 0xffe9c4, emissive: 0xffd08a, roughness: 0.3, name: 'tile' });
  const ink = new THREE.MeshStandardMaterial({ color: 0x141620, roughness: 0.8, name: 'metal' });
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  add(new THREE.SphereGeometry(0.07, 16, 12), bulb, 0, 0.07, 0);
  add(new THREE.CylinderGeometry(0.06, 0.26, 0.2, 20, 1, true), enamel, 0, 0.22, 0);
  add(new THREE.CylinderGeometry(0.058, 0.255, 0.198, 20, 1, true), inner, 0, 0.22, 0);
  add(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 16), enamel, 0, 0.345, 0);
  add(new THREE.CylinderGeometry(0.005, 0.005, 0.85, 12), ink, 0, 0.795, 0);
  // a rolled cream rim at the mouth and a brass band under the cap, so the shade reads from
  // every side in any light
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.5, name: 'metal' });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.7, name: 'metal' });
  const rim = add(new THREE.TorusGeometry(0.26, 0.012, 8, 24), cream, 0, 0.12, 0); rim.rotation.x = Math.PI / 2;
  const band = add(new THREE.TorusGeometry(0.075, 0.01, 8, 16), brass, 0, 0.318, 0); band.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.012, 0.018, 0.05, 12), brass, 0, 0.395, 0);
  return g;
}
