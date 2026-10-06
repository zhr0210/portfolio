// The portable preview injects an asset map. Vite deployments use public/ paths.
function asset(path) {
  return (
    window.__PORTFOLIO_ASSETS__?.[path] ||
    (path.startsWith('/') ? import.meta.env.BASE_URL + path.slice(1) : path)
  );
}
export { asset };
