/** The supplied unfolded asset has four complete propeller groups. Reparent
 * only these groups to pivots at their motor axes, preserving the initial pose. */
export function createDroneRig(THREE, source) {
  source.updateMatrixWorld(true);
  const rotors = ['桨叶1', '桨叶2', '桨叶3', '桨叶4'].map((name, index) => {
    const blade = source.getObjectByName(name);
    if (!blade?.parent) throw new Error(`Drone propeller group ${name} is missing`);
    const parent = blade.parent;
    const center = parent.getWorldPosition(new THREE.Vector3());
    const box = new THREE.Box3().setFromObject(blade);
    center.y = box.getCenter(new THREE.Vector3()).y;
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(
      parent.getWorldQuaternion(new THREE.Quaternion()).normalize().invert(),
    );
    const pivot = new THREE.Group();
    pivot.name = `ReelRotor${index + 1}`;
    pivot.position.copy(parent.worldToLocal(center));
    parent.add(pivot);
    pivot.updateWorldMatrix(true, false);
    pivot.attach(blade);
    return { pivot, blade, axis, direction: [1, 1, -1, -1][index] };
  });
  return {
    rotors,
    sample(angle) {
      for (const rotor of rotors)
        rotor.pivot.quaternion.setFromAxisAngle(rotor.axis, angle * rotor.direction);
      source.updateMatrixWorld(true);
    },
  };
}
