import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { chapters, filmConfig, type ChapterId } from '../data/cinematic.ts';
import { FilmChapter } from '../features/cinema/FilmChapter.tsx';
import { clamp, getLayout, sampleStory } from '../features/cinema/motion.ts';

interface Props {
  active?: boolean;
  reduced: boolean;
  single?: ChapterId;
  onWork: (id: number) => void;
  onContact: () => void;
  onResume: () => void;
  onWorks: () => void;
}
function initialFrame(single?: ChapterId) {
  return sampleStory(0, innerWidth < filmConfig.mobileBreakpoint, single);
}
export default function CinemaStory({
  active = true,
  reduced,
  single,
  onWork,
  onContact,
  onResume,
  onWorks,
}: Props) {
  const [frame, setFrame] = useState(() => initialFrame(single));
  const [small, setSmall] = useState(() => innerWidth < filmConfig.mobileBreakpoint);
  const options = useRef({ active, reduced });
  options.current = { active, reduced };
  const seek = useRef<(id: ChapterId, local?: number, instant?: boolean) => void>(() => {});
  useLayoutEffect(() => {
    const run = document.getElementById('about-hero-run')!;
    const hero = document.getElementById('global-canvas');
    const clock = { screens: 0 };
    let motion: gsap.core.Tween | null = null;
    let raf = 0,
      alive = true,
      paused = false;
    const isSmall = () => innerWidth < filmConfig.mobileBreakpoint;
    const spanPixels = () => Math.max(1, run.offsetHeight - innerHeight);
    const apply = () => {
      if (!alive) return;
      const scene = sampleStory(clock.screens, isSmall(), single);
      setFrame(scene);
      if (hero) {
        hero.style.opacity = String(options.current.reduced ? 1 : scene.hero);
        hero.style.visibility =
          options.current.reduced || scene.hero > 0.0001 ? 'visible' : 'hidden';
        hero.style.transform = options.current.reduced
          ? ''
          : `translateY(${-clamp(clock.screens / 0.9) * innerHeight * 0.085}px)`;
        hero.style.filter = 'none';
        hero.inert = !options.current.reduced && scene.hero < 0.6;
      }
      run.dataset.playhead = String(scene.progress);
      if (single) {
        document.body.dataset.chapter = single;
        document.body.dataset.space = 'about';
      }
      window.dispatchEvent(
        new CustomEvent('continuum-progress', { detail: { progress: scene.progress } }),
      );
    };
    const update = () => {
      raf = 0;
      if (!alive || document.hidden || paused || !options.current.active) return;
      const layout = getLayout(isSmall(), single);
      const target = window.__INTRO_ACTIVE__ ? 0 : clamp(scrollY / spanPixels()) * layout.span;
      motion?.kill();
      if (options.current.reduced) {
        clock.screens = target;
        apply();
      } else
        motion = gsap.to(clock, {
          screens: target,
          duration: filmConfig.settleSeconds,
          ease: 'power2.out',
          onUpdate: apply,
        });
    };
    const request = () => {
      if (!raf && alive) raf = requestAnimationFrame(update);
    };
    const resize = () => {
      const narrow = isSmall();
      setSmall(narrow);
      const layout = getLayout(narrow, single);
      if (!options.current.reduced) run.style.height = `${(layout.span + 1) * 100}svh`;
      else run.style.height = 'auto';
      request();
    };
    const visibility = () => {
      if (document.hidden) {
        motion?.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      } else request();
    };
    const pause = () => {
      paused = true;
      motion?.pause();
    };
    const resume = () => {
      paused = false;
      request();
    };
    const go = (id: ChapterId, local = 0.4, instant = false) => {
      if (window.__INTRO_ACTIVE__) return;
      const spec = getLayout(isSmall(), single).scenes.find((chapter) => chapter.id === id);
      if (!spec) return;
      if (options.current.reduced) {
        document
          .querySelector(`[data-chapter-id="${id}"]`)
          ?.scrollIntoView({ behavior: 'instant', block: 'start' });
      } else
        scrollTo({
          top:
            ((spec.start + spec.duration * local) / getLayout(isSmall(), single).span) *
            spanPixels(),
          behavior: instant ? 'instant' : 'smooth',
        });
    };
    seek.current = go;
    window.__CONTINUUM__ = {
      getState: () => ({
        ...sampleStory(clock.screens, isSmall(), single),
        target: scrollY,
        raf,
        paused,
      }),
      go,
    };
    const observer = new ResizeObserver(request);
    observer.observe(run);
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('intro-complete', request);
    window.addEventListener('portfolio-space-change', request);
    window.addEventListener('pause-scroll', pause);
    window.addEventListener('resume-scroll', resume);
    document.addEventListener('visibilitychange', visibility);
    resize();
    apply();
    return () => {
      alive = false;
      motion?.kill();
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('scroll', request);
      window.removeEventListener('resize', resize);
      window.removeEventListener('intro-complete', request);
      window.removeEventListener('portfolio-space-change', request);
      window.removeEventListener('pause-scroll', pause);
      window.removeEventListener('resume-scroll', resume);
      document.removeEventListener('visibilitychange', visibility);
      delete window.__CONTINUUM__;
    };
  }, [single, reduced]);
  const localFrames = frame.scenes;
  return (
    <div className={`film-story${reduced ? ' is-static' : ''}`}>
      {chapters
        .filter((chapter) => !single || chapter.id === single)
        .map((chapter) => {
          const local = localFrames.find((scene) => scene.id === chapter.id);
          const visible = reduced || (!!local && local.alpha > 0.0001);
          const current = reduced || frame.chapter === chapter.id;
          return (
            <div
              key={chapter.id}
              className="film-scene-layer"
              style={
                reduced
                  ? undefined
                  : { opacity: local?.alpha || 0, visibility: visible ? 'visible' : 'hidden' }
              }
              inert={!current || !visible}
              aria-hidden={!visible}
            >
              <FilmChapter
                id={chapter.id}
                progress={local?.progress || 0}
                small={small}
                reduced={reduced}
                onWork={onWork}
                onContact={onContact}
                onResume={onResume}
                onWorks={onWorks}
                onSeek={(p) => seek.current(chapter.id, p)}
              />
            </div>
          );
        })}
      {!reduced && (
        <div
          className="film-progress"
          inert={!single && frame.hero > 0.6}
          aria-hidden={!single && frame.hero > 0.6}
          style={{ opacity: single ? 1 : 1 - frame.hero }}
        >
          <span>AFTERIMAGE / 余像</span>
          <div className="film-progress-rule">
            <i style={{ transform: `scaleX(${frame.progress})` }} />
          </div>
          <span>{String(Math.round(frame.progress * 100)).padStart(2, '0')} %</span>
          <button onClick={onWorks}>作品全景 ↗</button>
        </div>
      )}
    </div>
  );
}
