"use strict";Object.defineProperty(exports, "__esModule", {value: true});// The portable preview injects an asset map. Vite deployments use public/ paths.
 function asset(path) {
  return window.__PORTFOLIO_ASSETS__?.[path] || (path.startsWith("/") ? "."+path : path);
} exports.asset = asset;
