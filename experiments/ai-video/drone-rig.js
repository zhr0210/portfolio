/** Keep the original asset bytes intact; fit the complete upper assembly to
 * the motor cap at runtime. The motor mounts/housings remain fixed. */
function axialRange(THREE, mesh, axis) {
  const positions = mesh.geometry.attributes.position;
  const point = new THREE.Vector3();
  let top = -Infinity,
    bottom = Infinity;
  for (let i = 0; i < positions.count; i++) {
    const value = point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).dot(axis);
    top = Math.max(top, value);
    bottom = Math.min(bottom, value);
  }
  return { top, bottom };
}

export function createDroneRig(
  THREE,
  source,
  { hubSeatClearance = 0.00035, hubDeckCompression = 0.4 } = {},
) {
  source.updateMatrixWorld(true);
  const rotors = ['桨叶1', '桨叶2', '桨叶3', '桨叶4'].map((name, index) => {
    const blade = source.getObjectByName(name);
    if (!blade?.parent) throw new Error(`Drone propeller group ${name} is missing`);
    const parent = blade.parent;
    // The shaft mesh is an ANCESTOR of the motor, outside the propeller
    // subtree. Separate its drawable geometry from its carrier transform
    // before attaching it; rotating/reseating the ancestor would move the arm.
    const shaft = source.getObjectByName(`${name}_${index === 0 ? '06' : '07'}`);
    if (!shaft?.isMesh || !shaft.children.includes(parent))
      throw new Error(`Drone shaft carrier ${name} is missing`);
    const carrier = new THREE.Group();
    carrier.copy(shaft, false);
    carrier.name = `${shaft.name}Mount`;
    shaft.parent.add(carrier);
    for (const child of [...shaft.children]) carrier.add(child);
    carrier.add(shaft);
    shaft.position.set(0, 0, 0);
    shaft.quaternion.identity();
    shaft.scale.set(1, 1, 1);
    source.updateWorldMatrix(true, true);
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
    parts.push(shaft);
    const cap = blade.getObjectByName(`${name}_${index < 2 ? '02' : '03'}`);
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
    source.updateWorldMatrix(true, true);
    const worldAxis = axis
      .clone()
      .applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()));
    // A display fitting, distinct from preserving the authored zero pose:
    // seat the lower hub rim just above the motor cap. Move the WHOLE upper
    // assembly, including the extracted shaft, to prevent a protruding pin.
    const seatingOffset = Math.max(
      0,
      axialRange(THREE, plate, worldAxis).top -
        axialRange(THREE, cap, worldAxis).top -
        hubSeatClearance,
    );
    const seatedCenter = pivot
      .getWorldPosition(new THREE.Vector3())
      .addScaledVector(worldAxis, -seatingOffset);
    pivot.position.copy(parent.worldToLocal(seatedCenter));
    source.updateWorldMatrix(true, true);
    // The authored sandwich hub exposes long blade pins above the lower disk.
    // Compact that upper deck as a unit, keeping blade shape/UVs unchanged.
    const upperSuffixes =
      index === 0 ? ['03', '04', '05', '07', '08'] : ['05', '06', '08', '09', '10'];
    const upperParts = parts.filter(
      (p) => p === shaft || upperSuffixes.some((s) => p.name === `${name}_${s}`),
    );
    const pin = source.getObjectByName(`${name}_${index === 0 ? '03' : '05'}`);
    const range = axialRange(THREE, pin, worldAxis);
    const deckOffset = (range.top - range.bottom) * hubDeckCompression;
    for (const part of upperParts) {
      const position = part
        .getWorldPosition(new THREE.Vector3())
        .addScaledVector(worldAxis, -deckOffset);
      part.position.copy(pivot.worldToLocal(position));
    }
    source.updateWorldMatrix(true, true);
    return {
      pivot,
      blade,
      plate,
      cap,
      shaft,
      parts,
      upperParts,
      axis,
      seatingOffset,
      deckOffset,
      direction: [1, 1, -1, -1][index],
    };
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
