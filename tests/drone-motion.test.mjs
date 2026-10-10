import test from 'node:test';
import assert from 'node:assert/strict';
import { createDroneMotion, springStep } from '../experiments/ai-video/drone-motion.js';
import { reelConfig } from '../experiments/ai-video/video-reel.config.js';

const config = reelConfig.drone;
const calm = { ...config, hover: { ...config.hover, horizontal: 0, vertical: 0, tilt: 0, yaw: 0 } };

test('Upward and downward steps accelerate, overshoot about 10%, and settle symmetrically', () => {
  for (const sign of [-1, 1]) {
    const motion = createDroneMotion(calm);
    motion.reset(0);
    motion.setTarget(sign * 0.04, sign * 0.04);
    const samples = Array.from({ length: 120 }, () => motion.step(1 / 120));
    assert.ok(Math.abs(samples[1].velocity) > Math.abs(samples[0].velocity));
    const maximum = Math.max(...samples.map((s) => sign * s.y));
    assert.ok(maximum > 0.0435 && maximum < 0.0445, `peak ${maximum}`);
    assert.ok(Math.abs(samples.at(-1).y - sign * 0.04) < 0.0002);
    assert.ok(
      samples.some((s) => sign * s.velocity < 0),
      'braking returns from the overshoot',
    );
    assert.ok(samples.some((s) => sign * s.pitch < 0) && samples.some((s) => sign * s.pitch > 0));
  }
});

test('The analytical spring is frame-rate independent and bounded under long frame gaps', () => {
  const direct = springStep(0, 0, 0.04, 1, 10, 0.59);
  for (const fps of [30, 60, 120]) {
    const motion = createDroneMotion(calm);
    motion.reset(0);
    motion.setTarget(0.04, 0.04);
    let sample;
    for (let i = 0; i < fps; i++) sample = motion.step(1 / fps);
    assert.ok(Math.abs(sample.y - direct.position) < 1e-12);
    assert.ok(Math.abs(sample.velocity - direct.velocity) < 1e-12);
    const gap = motion.step(500);
    assert.ok(Math.abs(gap.offset) <= config.spring.maxOffset);
    assert.ok(Number.isFinite(gap.y));
  }
});

test('Continuous inputs preserve velocity; reversing decelerates without restarting a tween', () => {
  const motion = createDroneMotion(calm);
  motion.reset(0);
  motion.setTarget(-0.04, -0.02);
  for (let i = 0; i < 8; i++) motion.step(1 / 120);
  const before = motion.step(0);
  motion.setTarget(0.04, 0);
  const reversed = motion.step(0);
  assert.equal(reversed.y, before.y);
  assert.equal(reversed.velocity, before.velocity);
  assert.ok(reversed.velocity < 0);
  const samples = Array.from({ length: 120 }, () => motion.step(1 / 120));
  assert.ok(samples.some((s) => s.velocity > 0));
  assert.ok(Math.abs(samples.at(-1).y - 0.04) < 0.0003);
  for (let i = 0; i < 1000; i++) {
    const base = Math.sin(i * 0.07) * 2;
    motion.setTarget(base + (i % 2 ? 100 : -100), base);
    const state = motion.step(1 / 60);
    assert.ok(Math.abs(state.offset) <= config.spring.maxOffset + 1e-12);
    assert.ok(Math.abs(state.pitch) <= config.spring.maxTilt + 1e-12);
    assert.ok(Number.isFinite(state.velocity));
  }
});

test('Hover is smooth, seeded, bounded and halved on phones; zero elapsed time freezes it', () => {
  const desktop = createDroneMotion(config),
    phone = createDroneMotion(config),
    duplicate = createDroneMotion(config);
  for (const motion of [desktop, phone, duplicate]) {
    motion.reset(0.5);
    motion.setTarget(0.5, 0.5);
  }
  let before;
  for (let i = 0; i < 1200; i++) {
    const a = desktop.step(1 / 120),
      b = duplicate.step(1 / 120),
      c = phone.step(1 / 120, { mobile: true });
    assert.deepEqual(a, b);
    assert.ok(Math.abs(a.x) <= config.hover.horizontal);
    assert.ok(Math.abs(a.y - 0.5) <= config.hover.vertical);
    assert.ok(Math.abs(a.pitch) <= config.hover.tilt);
    assert.ok(Math.abs(a.yaw) <= config.hover.yaw);
    assert.ok(Math.abs(c.x * 2 - a.x) < 1e-12);
    assert.ok(Math.abs((c.y - 0.5) * 2 - (a.y - 0.5)) < 1e-12);
    if (before) assert.ok(Math.abs(a.x - before.x) < 0.0001);
    before = a;
  }
  assert.deepEqual(desktop.step(0), desktop.step(0));
  assert.notEqual(desktop.step(1 / 60).y, before.y);
  const reduced = desktop.step(1 / 60, { reduced: true });
  assert.deepEqual(reduced, { x: 0, y: 0.5, pitch: 0, yaw: 0, roll: 0, velocity: 0, offset: 0 });
});

test('Only drone travel extends; the original camera timing and three-live spacing remain fixed', () => {
  assert.deepEqual(config.travel, { start: -0.9, end: 4.77 });
  assert.ok(Math.abs((config.travel.end - config.travel.start) / 5.4 - 1.05) < 1e-12);
  assert.deepEqual(reelConfig.deviceAnimation, { start: -0.9, end: 4.5 });
  assert.equal(reelConfig.liveScrollSpan, 1.8);
});
