/**
 * Keep the authored XYZ spin and close its endpoint before repeating it.
 * Vertical travel and gimbal tracks stay on the separate finite timeline.
 * THREE is supplied by the lazy renderer so importing this helper loads no WebGL code.
 */
export function createRotationLoopClip(
  THREE,
  sourceClip,
  controlNames,
  start,
  end,
  returnDuration = 0.75,
) {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end <= start ||
    end > sourceClip.duration ||
    !Number.isFinite(returnDuration) ||
    returnDuration <= 0
  )
    throw new Error('Device rotation needs a valid authored range and positive return duration');

  const controls = new Set(controlNames.map(THREE.PropertyBinding.sanitizeNodeName));
  const selected = sourceClip.tracks.filter((track) => {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    return binding.propertyName === 'quaternion' && controls.has(binding.nodeName);
  });
  if (!selected.length) throw new Error('The device asset has no requested XYZ rotation tracks');
  for (const name of controls)
    if (
      !selected.some((track) => THREE.PropertyBinding.parseTrackName(track.name).nodeName === name)
    )
      throw new Error(`The device asset is missing the XYZ rotation track: ${name}`);

  const authoredDuration = end - start;
  const duration = authoredDuration + returnDuration;
  const tracks = selected.map((source) => {
    if (source.getValueSize() !== 4)
      throw new Error(`The device XYZ rotation track needs quaternion keyframes: ${source.name}`);
    const keyTimes = new Set([start, end]);
    for (const time of source.times) if (time > start && time < end) keyTimes.add(time);
    const sourceTimes = [...keyTimes].sort((a, b) => a - b);
    const times = sourceTimes.map((time) => time - start);
    const values = [];
    const interpolant = source.createInterpolant();
    const first = new THREE.Quaternion().fromArray(interpolant.evaluate(start)).normalize();
    const last = new THREE.Quaternion();
    const sampled = new THREE.Quaternion();
    for (const time of sourceTimes) {
      sampled.fromArray(interpolant.evaluate(time)).normalize();
      // Equivalent q/-q values must not make an interpolation take a long path.
      if (values.length && last.dot(sampled) < 0)
        sampled.set(-sampled.x, -sampled.y, -sampled.z, -sampled.w);
      sampled.toArray(values, values.length);
      last.copy(sampled);
    }
    const endpoint = last.clone();
    for (let index = 1; index <= 12; index++) {
      const progress = index / 12;
      const eased = progress * progress * (3 - 2 * progress);
      times.push(authoredDuration + returnDuration * progress);
      sampled.copy(endpoint).slerp(first, eased).normalize();
      // Store the identical first components at the seam, including sign.
      if (index === 12) sampled.copy(first);
      sampled.toArray(values, values.length);
    }
    return new THREE.QuaternionKeyframeTrack(source.name, times, values, THREE.InterpolateLinear);
  });
  return new THREE.AnimationClip(`${sourceClip.name}:XYZLoop`, duration, tracks);
}
