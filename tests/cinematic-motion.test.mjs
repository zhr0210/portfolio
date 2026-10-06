import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  chapters,
  filmCopy,
  filmMedia,
} from '../experiments/cinematic-portfolio/src/data/cinematic.ts';
import {
  getLayout,
  sampleChapter,
  sampleStory,
} from '../experiments/cinematic-portfolio/src/features/cinema/motion.ts';
import { projects } from '../experiments/cinematic-portfolio/src/data/projects.js';

for (const small of [false, true]) {
  test(`Cinematic chapters reverse to identical states on ${small ? 'phone' : 'desktop'}`, () => {
    const span = getLayout(small).span;
    const forward = Array.from({ length: 151 }, (_, index) =>
      sampleStory((index / 150) * span, small),
    );
    const reverse = Array.from({ length: 151 }, (_, index) =>
      sampleStory(((150 - index) / 150) * span, small),
    ).reverse();
    assert.deepEqual(forward, reverse);
    for (const chapter of chapters) {
      const states = [0, 0.25, 0.5, 0.75, 1].map((p) => sampleChapter(chapter.id, p, small));
      assert.deepEqual(
        states,
        [1, 0.75, 0.5, 0.25, 0].map((p) => sampleChapter(chapter.id, p, small)).reverse(),
      );
    }
  });
  test(`Chapter boundaries overlap without a blank camera on ${small ? 'phone' : 'desktop'}`, () => {
    const layout = getLayout(small);
    for (const chapter of layout.scenes.slice(1)) {
      const state = sampleStory(chapter.start, small);
      assert.equal(state.chapter, chapter.id);
      assert.ok(state.scenes.reduce((sum, scene) => sum + scene.alpha, 0) >= 0.99);
      for (const scene of state.scenes) assert.ok(scene.progress >= 0 && scene.progress <= 1);
    }
    assert.equal(sampleStory(-100, small).progress, 0);
    assert.equal(sampleStory(100, small).progress, 1);
    assert.equal(sampleStory(100, small).chapter, 'footer');
  });
}
test('Each chapter preview spans its full motion without a hero interval', () => {
  for (const small of [true, false])
    for (const chapter of chapters) {
      const layout = getLayout(small, chapter.id);
      assert.equal(layout.scenes.length, 1);
      assert.equal(layout.scenes[0].start, 0);
      assert.equal(sampleStory(0, small, chapter.id).hero, 0);
      assert.equal(sampleStory(layout.span, small, chapter.id).scenes[0].progress, 1);
      assert.equal(sampleStory(layout.span, small, chapter.id).scenes[0].alpha, 1);
    }
});
test('Film uses seven complete original works and existing source images', () => {
  assert.deepEqual(
    projects.map((project) => project.id),
    [1, 2, 3, 4, 5, 6, 7],
  );
  const paths = [
    ...Object.values(filmMedia),
    ...filmCopy.archive.disciplines.map((item) => item.image),
    ...projects.flatMap((project) => [project.cover, project.image]),
  ];
  for (const path of paths)
    assert.ok(existsSync(new URL('../public' + path, import.meta.url)), path);
});
