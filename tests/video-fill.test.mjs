import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoFill, drawMirroredCover } from '../experiments/ai-video/video-fill.js';

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
    draws = [],
    transforms = [],
    stack = [];
  let transform = [1, 1, 0, 0];
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
    style: {},
    getContext: () => ({
      save() {
        stack.push([...transform]);
      },
      restore() {
        transform = stack.pop();
      },
      translate(x, y) {
        transform[2] += x * transform[0];
        transform[3] += y * transform[1];
      },
      scale(x, y) {
        transform[0] *= x;
        transform[1] *= y;
      },
      drawImage(...args) {
        if (fail) throw new Error('unavailable frame');
        draws.push(args);
        transforms.push([...transform]);
      },
    }),
  };
  const fill = createVideoFill(video, canvas, { maxSize: 640 });
  const event = (name) => video.dispatchEvent(new Event(name));
  return {
    video,
    canvas,
    fill,
    draws,
    transforms,
    pending,
    event,
    fail: (value) => {
      fail = value;
    },
  };
}

test('Video fill reflects the actual cover borders with continuous seam coordinates', () => {
  const f = fixture();
  f.fill.update({ active: false });
  assert.equal(f.draws.length, 0);
  f.fill.update({ active: true, width: 1000, height: 1000, edgeInset: 0 });
  assert.ok(f.canvas.width <= 640 && f.canvas.height <= 642);
  const [source, x, y, width, height, dx, pad, dw, dh] = f.draws[0];
  assert.equal(source, f.video);
  assert.equal(x, 420);
  assert.equal(y, 0);
  assert.equal(width, 1080);
  assert.equal(height, 1080);
  assert.equal(dx, 0);
  assert.equal(dw, f.canvas.width);
  const top = f.draws[1],
    bottom = f.draws[2];
  assert.equal(top[2], y);
  assert.equal(top[3], width);
  assert.equal(top[7], dw);
  assert.equal(bottom[2] + bottom[4], y + height);
  assert.deepEqual(f.transforms[1], [1, -1, 0, pad]);
  assert.deepEqual(f.transforms[2], [1, -1, 0, pad + dh]);
  assert.equal(bottom[6] + bottom[8], 0);
  assert.ok(pad > 0 && f.canvas.height === dh + pad * 2);
  assert.equal(f.canvas.hidden, false);
  assert.equal(f.pending.size, 0, 'Paused films draw once without a continuous callback');
  f.fill.update({ active: false });
  assert.equal(f.canvas.width * f.canvas.height, 1);
  assert.equal(f.canvas.hidden, true);
  f.fill.dispose();
});

test('Mirror seams follow the clipped interior border rather than duplicating encoded dark rows', () => {
  const f = fixture();
  drawMirroredCover(f.canvas.getContext('2d'), f.video, {
    width: 400,
    height: 200,
    padding: 20,
    aspect: 2,
    edgeInset: 2,
  });
  const middle = f.draws[0],
    top = f.draws[1],
    bottom = f.draws[2];
  assert.ok(Math.abs(middle[2] - 69.6) < 1e-9);
  assert.ok(Math.abs(middle[4] - 940.8) < 1e-9);
  assert.equal(middle[6], 22);
  assert.equal(middle[8], 196);
  assert.equal(top[2], middle[2]);
  assert.ok(Math.abs(bottom[2] + bottom[4] - middle[2] - middle[4]) < 1e-9);
  assert.deepEqual(f.transforms[1], [1, -1, 0, 22]);
  assert.deepEqual(f.transforms[2], [1, -1, 0, 218]);
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
  assert.equal(f.draws.length, before + 3);
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
