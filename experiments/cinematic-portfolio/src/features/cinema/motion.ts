import { chapters, filmConfig, type ChapterId } from '../../data/cinematic.ts';

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (from: number, to: number, progress: number) => from + (to - from) * progress;
export function smooth(from: number, to: number, progress: number) {
  const t = clamp((progress - from) / (to - from));
  return t * t * (3 - 2 * t);
}
export function getLayout(small: boolean, single?: ChapterId) {
  let cursor = single ? 0 : filmConfig.heroScreens;
  const scenes = chapters
    .filter((chapter) => !single || chapter.id === single)
    .map((chapter) => {
      const duration = small ? chapter.mobileScreens : chapter.screens;
      const scene = { ...chapter, start: cursor, end: cursor + duration, duration };
      cursor += duration;
      return scene;
    });
  return { scenes, span: cursor };
}

/** Absolute scroll sampling. No elapsed clock, random seed, or direction-dependent state. */
export function sampleStory(screens: number, small: boolean, single?: ChapterId) {
  const layout = getLayout(small, single);
  const position = clamp(screens, 0, layout.span);
  const current = layout.scenes.find((scene) => position < scene.end) || layout.scenes.at(-1)!;
  const hero = single ? 0 : 1 - smooth(0.1, filmConfig.heroScreens + 0.15, position);
  return {
    position,
    progress: position / layout.span,
    hero,
    chapter: (!single && position < filmConfig.heroScreens - 0.08 ? 'hero' : current.id) as
      ChapterId | 'hero',
    scenes: layout.scenes.map((scene) => {
      const local = (position - scene.start) / scene.duration;
      const alpha = single
        ? 1
        : smooth(-0.08, 0.08, local) * (scene.id === 'footer' ? 1 : 1 - smooth(0.92, 1.08, local));
      return { id: scene.id, progress: clamp(local), alpha };
    }),
  };
}

export function sampleChapter(id: ChapterId, progress: number, small: boolean) {
  const p = clamp(progress);
  const focus = smooth(0.06, 0.73, p);
  const discipline = clamp(Math.floor(p * 3), 0, 2);
  return {
    p,
    reveal: smooth(0.04, 0.35, p),
    focus,
    aperture: lerp(small ? 8 : 18, 0, focus),
    photoScale: lerp(1, 1.095, smooth(0.1, 0.94, p)),
    separation: smooth(0.14, 0.43, p) * (1 - smooth(0.7, 0.91, p)),
    step: clamp(Math.floor(p * 4), 0, 3),
    discipline,
    work: clamp(Math.round(smooth(0.14, 0.9, p) * 6), 0, 6),
    strip: smooth(0.14, 0.9, p),
    credits: smooth(0.12, 0.48, p),
    fadeImage: id === 'footer' ? 1 - smooth(0, 0.62, p) : 1,
  };
}
