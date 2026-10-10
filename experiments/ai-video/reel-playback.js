/** A centered film keeps playing through its exit, until another film centers
 * or the outgoing film has physically left the viewport. No scroll-time pause. */
export function selectPlaybackScene(candidates, active = true) {
  if (!active) return null;
  let selected = null;
  for (const candidate of candidates)
    if (candidate.visible && candidate.centered && candidate.ready) selected = candidate.scene;
  return selected;
}
