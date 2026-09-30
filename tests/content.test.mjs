import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { projects, frames } from '../src/data/projects.js';
import { siteConfig } from '../src/config/site.ts';

test('Every artwork, cover and panorama frame exists in the deployable assets', () => {
  const paths = new Set(
    [...projects.flatMap((p) => [p.image, p.cover]), ...frames.map((f) => f.src)].filter(Boolean),
  );
  for (const path of paths)
    assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `Missing artwork: ${path}`);
  assert.equal(new Set(projects.map((p) => p.id)).size, projects.length);
  frames.forEach((f, i) => {
    assert.equal(f.id, i, 'GPU atlas IDs must be contiguous');
    assert.ok(
      projects.some((p) => p.id === f.projectId),
      `Unknown project ${f.projectId}`,
    );
  });
});
test('Gallery parameters stay finite and inside the renderer texture layout', () => {
  for (const [key, value] of Object.entries(siteConfig.gallery)) {
    if (typeof value === 'number')
      assert.ok(Number.isFinite(value) && value > 0, `${key} must be positive`);
  }
  assert.ok(frames.length <= 8 * 4, 'The atlas has 32 slots');
  assert.ok(siteConfig.gallery.mobileAtlasTile <= siteConfig.gallery.desktopAtlasTile);
});
