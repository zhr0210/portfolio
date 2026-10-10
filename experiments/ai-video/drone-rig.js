/** The upper locking plate and collar turn with the hub and pins. The lower
 * motor housing stays fixed. Center the shaft on the actual plate geometry,
 * because exported motor origins are slightly offset from that center. */
export function createDroneRig(THREE, source) {
  source.updateMatrixWorld(true);
  const rotors = ['桨叶1', '桨叶2', '桨叶3', '桨叶4'].map((name, index) => {
    const blade = source.getObjectByName(name);
    if (!blade?.parent) throw new Error(`Drone propeller group ${name} is missing`);
    const parent = blade.parent;
    const suffixes = [
      ['03', '04', '05', '07', '08', '09', '10'],
      ['03', '04', '05', '06', '08', '09', '10'],
      ['02', '04', '05', '06', '08', '09', '10'],
      ['02', '04', '05', '06', '08', '09', '10'],
    ][index];
    const parts = suffixes.map((suffix) => {
      const part = blade.getObjectByName(`${name}_${suffix}`);
      if (!part) throw new Error(`Drone rotating part ${name}_${suffix} is missing`);
      return part;
    });
    const plate = blade.getObjectByName(`${name}_${index === 0 ? '10' : '04'}`);
    // The exported propeller subtree has its own 7–8 degree tilt. The motor
    // parent's -Z is NOT the shaft: use the plate normal in parent space.
    const axis = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(plate.getWorldQuaternion(new THREE.Quaternion()))
      .applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert())
      .normalize();
    const center = new THREE.Box3().setFromObject(plate).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.name = `ReelRotor${index + 1}`;
    pivot.position.copy(parent.worldToLocal(center));
    parent.add(pivot);
    pivot.updateWorldMatrix(true, false);
    for (const part of parts) pivot.attach(part);
    return { pivot, blade, plate, parts, axis, direction: [1, 1, -1, -1][index] };
  });
  return {
    rotors,
    sample(angle) {
      for (const rotor of rotors)
        rotor.pivot.quaternion.setFromAxisAngle(rotor.axis, angle * rotor.direction);
      source.updateWorldMatrix(true, true);
    },
  };
}
