import test from 'node:test';
import assert from 'node:assert/strict';
import { screenToField, fieldToScreen } from '../src/features/gallery/projection.mjs';
import { siteConfig } from '../src/config/site.ts';

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [844, 390],
]) {
  for (const pressed of [false, true]) {
    test(`Lens hit testing stays aligned with rendering: ${width}×${height}, pressed=${pressed}`, () => {
      const lens = {
        width,
        height,
        norm: width < 768 ? Math.max(width, height * 0.72) : Math.min(width, height),
        tile: width < 768 ? width / 2.23 : Math.max(width / 5.65, height / 3.28),
        curve: siteConfig.gallery.curve + (pressed ? siteConfig.gallery.pressCurve : 0),
        core: siteConfig.gallery.lensCore,
        horizontal: siteConfig.gallery.lensHorizontal,
        tilt: { x: 0.65, y: -0.37 },
        actualPan: { x: -32.15, y: 40.48 },
      };
      for (let i = 0; i <= 10; i++)
        for (let j = 0; j <= 10; j++) {
          const x = (width * i) / 10,
            y = (height * j) / 10;
          const field = screenToField(x, y, lens);
          const point = fieldToScreen(field.x, field.y, lens);
          assert.ok(
            Math.abs(point.x - x) < 0.001 && Math.abs(point.y - y) < 0.001,
            `Hit misses at ${x},${y}`,
          );
        }
    });
  }
}
test('The optical centre is stable with zero tilt', () => {
  const lens = {
    width: 1000,
    height: 800,
    norm: 800,
    tile: 260,
    curve: 2.55,
    tilt: { x: 0, y: 0 },
    actualPan: { x: 6.15, y: 4.48 },
    core: 0.26,
    horizontal: 0.87,
  };
  assert.deepEqual(screenToField(500, 400, lens), lens.actualPan);
});
