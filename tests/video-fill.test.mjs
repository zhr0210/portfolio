import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoFill } from '../experiments/ai-video/video-fill.js';

function fixture() {
  const video = new EventTarget();
  Object.assign(video, {
    videoWidth: 1920,
    videoHeight: 1080,
    readyState: 4,
    paused: true,
    ended: false,
  });
  const pending = new Map(),
    draws = [];
  let sequence = 0,
    fail = false;
  video.requestVideoFrameCallback = (callback) => {
    pending.set(++sequence, callback);
    return sequence;
  };
  video.cancelVideoFrameCallback = (id) => pending.delete(id);
  const canvas = {
    hidden: false,
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage(...args) {
        if (fail) throw new Error('unavailable frame');
        draws.push(args);
      },
    }),
  };
  const fill = createVideoFill(video, canvas);
  const event = (name) => video.dispatchEvent(new Event(name));
  return {
    video,
    canvas,
    fill,
    draws,
    pending,
    event,
    fail: (value) => {
      fail = value;
    },
  };
}

test('Video fill samples the existing video with cover sizing and releases offscreen storage', () => {
  const f = fixture();
  f.fill.update({ active: false });
  assert.equal(f.draws.length, 0);
  f.fill.update({ active: true, width: 1000, height: 1000 });
  assert.equal(f.canvas.width, 640);
  assert.equal(f.canvas.height, 640);
  const [source, x, y, width, height] = f.draws[0];
  assert.equal(source, f.video);
  assert.ok(x < 0 && y === 0 && width > 640 && height === 640);
  assert.equal(f.canvas.hidden, false);
  assert.equal(f.pending.size, 0, 'Paused films draw once without a continuous callback');
  f.fill.update({ active: false });
  assert.equal(f.canvas.width * f.canvas.height, 1);
  assert.equal(f.canvas.hidden, true);
  f.fill.dispose();
});

test('Video fill queues one decoded-frame callback and stops on pause, background or disposal', () => {
  const f = fixture();
  const update = { active: true, width: 600, height: 320 };
  f.fill.update(update);
  f.video.paused = false;
  f.event('playing');
  for (let i = 0; i < 10; i++) f.fill.update(update);
  assert.equal(f.pending.size, 1);
  const [id, callback] = f.pending.entries().next().value;
  f.pending.delete(id);
  const before = f.draws.length;
  callback();
  assert.equal(f.draws.length, before + 1);
  assert.equal(f.pending.size, 1);
  f.video.paused = true;
  f.event('pause');
  assert.equal(f.pending.size, 0);
  f.video.paused = false;
  f.event('playing');
  f.fill.update({ active: false });
  assert.equal(f.pending.size, 0);
  f.fill.update(update);
  assert.equal(f.pending.size, 1);
  f.fill.dispose();
  f.event('playing');
  f.fill.update(update);
  assert.equal(f.pending.size, 0);
  assert.equal(f.canvas.width * f.canvas.height, 1);
});

test('Source changes and unavailable frames expose the cover instead of a stale video fill', () => {
  const f = fixture();
  f.fill.update({ active: true, width: 500, height: 300 });
  f.event('emptied');
  assert.equal(f.canvas.hidden, true);
  f.fail(true);
  f.event('loadeddata');
  assert.equal(f.canvas.hidden, true);
  f.fail(false);
  f.event('loadeddata');
  assert.equal(f.canvas.hidden, false);
  f.event('error');
  assert.equal(f.canvas.hidden, true);
  f.fill.dispose();
});
