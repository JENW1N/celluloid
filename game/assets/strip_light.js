/**
 * A fluorescent strip fixture for the community hall: a long white steel housing with end
 * caps, a glowing diffuser underneath, hung on two thin rods from small ceiling canopies.
 * Base at y = 0 (the underside of the diffuser), centred, long axis along X.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xe4e4e0, roughness: 0.5, metalness: 0.3, name: 'metal' });
  const ink = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.4, metalness: 0.6, name: 'metal' });
  const glow = new THREE.MeshStandardMaterial({ color: 0xf4fbff, emissive: 0xeef8ff, roughness: 0.3, name: 'tile' });
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  add(new THREE.BoxGeometry(1.42, 0.02, 0.16), glow, 0, 0.01, 0);
  add(new THREE.BoxGeometry(1.5, 0.06, 0.22), steel, 0, 0.05, 0);
  for (const sx of [-0.745, 0.745]) add(new THREE.BoxGeometry(0.02, 0.07, 0.23), ink, sx, 0.045, 0);
  for (const sx of [-0.6, 0.6]) {
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 12), ink, sx, 0.33, 0);
    add(new THREE.BoxGeometry(0.08, 0.02, 0.08), steel, sx, 0.59, 0);
  }
  return g;
}
