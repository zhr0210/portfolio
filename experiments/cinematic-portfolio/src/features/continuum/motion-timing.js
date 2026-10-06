/** Editorial animatic: 26 seconds at 24 fps. Scroll remains user-controlled on the site. */
const FPS = 24,
  DURATION = 26,
  FRAMES = FPS * DURATION;
const KEYS = [
  [0, 0.13],
  [36, 0.17],
  [80, 0.205],
  [128, 0.295],
  [166, 0.335],
  [226, 0.455],
  [256, 0.466],
  [320, 0.57],
  [374, 0.64],
  [430, 0.77],
  [495, 0.824],
  [572, 0.95],
  [623, 0.98],
];
const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function frameState(frame) {
  let p = KEYS[KEYS.length - 1][1];
  for (let i = 1; i < KEYS.length; i++)
    if (frame <= KEYS[i][0]) {
      const a = KEYS[i - 1],
        b = KEYS[i],
        t = ease(Math.max(0, Math.min(1, (frame - a[0]) / (b[0] - a[0]))));
      p = a[1] + (b[1] - a[1]) * t;
      break;
    }
  const crop = p > 0.38 && p < 0.478 ? 0.5 + 0.18 * Math.sin(((p - 0.38) / 0.098) * Math.PI) : 0.5;
  return {
    progress: p,
    crop,
    record: 0,
    small: false,
    film: true,
  };
}
export { FPS, DURATION, FRAMES, KEYS, frameState };
