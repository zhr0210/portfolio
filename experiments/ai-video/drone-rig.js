/** Source groups include fixed motor housings. Spin only the blades, hub and
 * pins around the motor's authored local -Z shaft; preserve the zero pose. */
export function createDroneRig(THREE, source) {
  source.updateMatrixWorld(true);
  const rotors = ['桨叶1', '桨叶2', '桨叶3', '桨叶4'].map((name, index) => {
    const blade = source.getObjectByName(name);
    if (!blade?.parent) throw new Error(`Drone propeller group ${name} is missing`);
    const parent = blade.parent;
    const suffixes = index === 0 ? ['03', '04', '05', '07', '08'] : ['05', '06', '08', '09', '10'];
    const parts = suffixes.map((suffix) => {
      const part = blade.getObjectByName(`${name}_${suffix}`);
      if (!part) throw new Error(`Drone rotating part ${name}_${suffix} is missing`);
      return part;
    });
    const axis = new THREE.Vector3(0, 0, -1);
    const pivot = new THREE.Group();
    pivot.name = `ReelRotor${index + 1}`;
    parent.add(pivot);
    pivot.updateWorldMatrix(true, false);
    for (const part of parts) pivot.attach(part);
    return { pivot, blade, parts, axis, direction: [1, 1, -1, -1][index] };
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
