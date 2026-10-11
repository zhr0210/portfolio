export const rotorControllers = ['右前桨叶自转', '右后桨叶自转', '左前桨叶自转', '左后桨叶自转'];

/** Play the authored acceleration, then continue at its terminal angular
 * speed. Its 33⅓ turns cannot be looped by resetting a quaternion clip. */
export function rotorPhase(timeline, seconds) {
  const { samples, fps } = timeline;
  const span = samples.length - 1;
  const frames = Math.max(0, seconds) * fps;
  if (frames >= span)
    return samples[span] - samples[0] + (frames - span) * (samples[span] - samples[span - 1]);
  const frame = frames;
  const index = Math.min(span - 1, Math.floor(frame));
  const fraction = frame - index;
  return samples[index] + (samples[index + 1] - samples[index]) * fraction - samples[0];
}

/** Drive the user's four controls, preserving their hierarchy and pivots.
 * Scroll flight and hover are applied to an outer group by drone-layer. */
export function createDroneRig(THREE, source) {
  const delta = new THREE.Quaternion();
  const rotors = rotorControllers.map((name) => {
    const pivot = source.getObjectByName(name);
    const timeline = pivot?.userData.portfolioRotor;
    if (
      !timeline ||
      !Array.isArray(timeline.samples) ||
      timeline.samples.length < 2 ||
      !(timeline.fps > 0) ||
      !timeline.samples.every(Number.isFinite) ||
      !Array.isArray(timeline.axis) ||
      timeline.axis.length !== 3 ||
      !timeline.axis.every(Number.isFinite)
    )
      throw new Error(`Authored drone controller ${name} is missing or invalid`);
    const axis = new THREE.Vector3().fromArray(timeline.axis);
    if (Math.abs(axis.length() - 1) > 1e-6)
      throw new Error(`Authored drone axis ${name} is invalid`);
    return { pivot, timeline, axis, rest: pivot.quaternion.clone() };
  });
  return {
    rotors,
    sample(seconds) {
      for (const rotor of rotors) {
        delta.setFromAxisAngle(rotor.axis, rotorPhase(rotor.timeline, seconds));
        rotor.pivot.quaternion.copy(rotor.rest).multiply(delta);
      }
      source.updateWorldMatrix(true, true);
    },
  };
}
