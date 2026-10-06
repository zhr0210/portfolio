import { gsap } from 'gsap';
import { siteConfig } from '../config/site';
import React from 'react';
import { chapters as FILM_CHAPTERS } from '../data/cinematic.ts';
const CONTINUUM_CHAPTERS = [
  ['hero', '开场', 'INTRODUCTION'],
  ...FILM_CHAPTERS.map((chapter) => [chapter.id, chapter.label, chapter.en]),
];
const CHAPTERS = CONTINUUM_CHAPTERS.map(([id, label, en], at) => ({
  id,
  label,
  short: label.slice(0, 2),
  en,
  at,
})).concat([
  {
    id: 'works',
    label: '作品全景',
    short: '作品',
    en: 'SELECTED WORKS',
    at: 6,
  },
]);
const MOTION = siteConfig.motion;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
function useSequence({ reduced, onChapter, onSpace }) {
  const options = React.useRef({
    reduced,
    onChapter,
    onSpace,
  });
  options.current = {
    reduced,
    onChapter,
    onSpace,
  };
  React.useLayoutEffect(() => {
    const body = document.body,
      about = document.getElementById('about-space'),
      works = document.getElementById('works-space');
    const heroRun = document.getElementById('about-hero-run'),
      stage = document.getElementById('global-canvas');
    const orb = document.getElementById('hero-light-orb'),
      curtain = document.getElementById('space-curtain');
    const initialHash = location.hash;
    let space = 'about',
      view = 'sphere',
      chapter = 'hero',
      raf = 0,
      dead = false,
      paused = false,
      transition = null,
      bootAt = 0,
      booting = false;
    let saved = {
        about: 0,
        sphere: 0,
        list: 0,
      },
      initialized = false,
      pendingProject = null,
      wasHidden = false;
    const cleanups = [],
      restore = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const listen = (el, t, fn, o) => {
      el.addEventListener(t, fn, o);
      cleanups.push(() => el.removeEventListener(t, fn, o));
    };
    const announce = (id) => {
      if (chapter !== id) {
        chapter = id;
        options.current.onChapter(id);
      }
      body.dataset.chapter = id;
    };
    function timeline(data) {
      window.__PANORAMA_TIMELINE__ = data;
      window.dispatchEvent(
        new CustomEvent('panorama-timeline', {
          detail: data,
        }),
      );
    }
    function updateAccess() {
      body.dataset.space = space;
      body.dataset.workView = view;
      body.dataset.stage = space;
      about.inert = space !== 'about';
      works.inert = space !== 'works';
      about.setAttribute('aria-hidden', String(space !== 'about'));
      works.setAttribute('aria-hidden', String(space !== 'works'));
    }
    function setHash(hash) {
      try {
        history.replaceState(null, '', hash);
      } catch {
        /* about:blank test documents do not allow URL writes */
      }
    }
    function light() {
      const w = innerWidth,
        h = innerHeight,
        d = Math.min(h * 1.85, w * 1.38);
      orb.style.width = d + 'px';
      orb.style.height = d + 'px';
      orb.style.transform = `translate3d(${w * (w < 768 ? 0.88 : 0.85)}px,${h * 0.52}px,0) translate(-50%,-50%)`;
      orb.style.setProperty('--orb-strength', '.66');
    }
    function updateAbout() {
      let id = window.__CONTINUUM__?.getState().chapter || 'hero';
      if (options.current.reduced) {
        const visible = [...about.querySelectorAll('[data-chapter-id]')].find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.top <= innerHeight * 0.5 && rect.bottom > innerHeight * 0.5;
        });
        id = visible?.dataset.chapterId || 'hero';
      }
      announce(id);
      body.dataset.atHero = String(id === 'hero');
    }
    function reveal() {
      const current = space === 'about' ? about : works;
      for (const el of current.querySelectorAll('[data-scroll-reveal]')) {
        const r = el.getBoundingClientRect(),
          v = options.current.reduced
            ? 1
            : clamp((innerHeight * 0.99 - r.top) / (innerHeight * 0.32));
        el.style.setProperty('--reveal', String(v));
      }
    }
    function targetScroll(id, instant = false) {
      if (!id) return;
      if (id === 'works') {
        scrollTo({
          top: view === 'list' ? saved.list : 0,
          behavior: 'instant',
        });
        return;
      }
      if (id !== 'hero' && window.__CONTINUUM__) {
        window.__CONTINUUM__.go(id, 0.4, instant);
        return;
      }
      const el = id === 'hero' ? about : document.getElementById('scene-' + id);
      if (el)
        scrollTo({
          top: id === 'hero' ? 0 : scrollY + el.getBoundingClientRect().top,
          behavior: instant || options.current.reduced ? 'instant' : 'smooth',
        });
    }
    function finishSwitch(t) {
      t.tween?.kill();
      transition = null;
      delete body.dataset.spaceSwitching;
      curtain.style.opacity = '0';
      curtain.style.visibility = 'hidden';
      about.style.opacity = '';
      about.style.filter = '';
      works.style.opacity = '';
      works.style.filter = '';
      if (t.section) targetScroll(t.section, t.instant);
      if (pendingProject) {
        const hit = pendingProject;
        pendingProject = null;
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent('works-open-project', {
                detail: hit,
              }),
            ),
          70,
        );
      }
      request();
    }
    function switchTo(dest, section = null, instant = false) {
      if (window.__INTRO_ACTIVE__ || paused || body.dataset.overlayOpen || transition) return;
      if (dest === space) {
        if (section) targetScroll(section, instant);
        request();
        return;
      }
      saved[space === 'about' ? 'about' : view] = scrollY;
      transition = {
        from: space,
        to: dest,
        section,
        instant,
        start: performance.now(),
        duration: options.current.reduced ? 180 : MOTION.spaceDuration,
        progress: 0,
        swapped: false,
      };
      transition.tween = gsap.to(transition, {
        progress: 1,
        duration: transition.duration / 1000,
        ease: 'none',
        onUpdate: request,
      });
      body.dataset.spaceSwitching = 'true';
      curtain.style.visibility = 'visible';
      request();
    }
    function commit(t) {
      t.swapped = true;
      space = t.to;
      updateAccess();
      options.current.onSpace(space);
      setHash('#' + space);
      const y = space === 'about' ? saved.about : view === 'list' ? saved.list : 0;
      scrollTo({
        top: y,
        behavior: 'instant',
      });
      window.dispatchEvent(
        new CustomEvent('portfolio-space-change', {
          detail: space,
        }),
      );
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        scrollTo({
          top: y,
          behavior: 'instant',
        });
        request();
      });
      if (space === 'works' && view === 'sphere') {
        bootAt = performance.now();
        booting = true;
      }
    }
    function tick(now) {
      raf = 0;
      if (dead || document.hidden) return;
      if (transition) {
        const t = transition,
          p = t.progress;
        curtain.style.opacity = String(Math.sin(p * Math.PI) * 0.8);
        const out = t.from === 'about' ? about : works,
          into = t.to === 'about' ? about : works;
        if (!t.swapped) {
          out.style.opacity = String(1 - smooth(0, 0.48, p));
          out.style.filter = `blur(${smooth(0, 0.48, p) * 5}px)`;
        }
        if (p >= 0.48 && !t.swapped) commit(t);
        if (t.swapped) {
          into.style.opacity = String(smooth(0.48, 1, p));
          into.style.filter = `blur(${(1 - smooth(0.48, 1, p)) * 5}px)`;
        }
        if (p >= 1) finishSwitch(t);
        else request();
      }
      if (space === 'about') {
        updateAbout();
        timeline({
          visible: false,
          interactive: false,
          grid: 1,
          boot: 1,
          stars: 0,
          position: 1,
          reduced: options.current.reduced,
        });
      } else {
        announce('works');
        body.dataset.atHero = 'false';
        const boot = booting ? clamp((now - bootAt) / MOTION.screenBoot) : 1;
        timeline({
          visible: view === 'sphere',
          interactive: view === 'sphere' && !transition,
          grid: options.current.reduced ? 1 : smooth(0, 0.32, boot),
          boot: options.current.reduced ? 1 : boot,
          stars: 0,
          position: 1,
          reduced: options.current.reduced,
        });
        if (boot < 1 && !paused) {
          request();
        } else booting = false;
      }
      reveal();
    }
    function request() {
      if (!dead && !raf) raf = requestAnimationFrame(tick);
    }
    function navigate(e) {
      const d =
          typeof e.detail === 'string'
            ? {
                id: e.detail,
              }
            : e.detail || {},
        id = d.id;
      if (window.__INTRO_ACTIVE__) return;
      if (id === 'works') {
        if (d.reset) window.dispatchEvent(new Event('works-reset-view'));
        switchTo('works', 'works', !!d.instant);
      } else if (id === 'about') switchTo('about');
      else if (CHAPTERS.some((c) => c.id === id)) {
        if (space === 'about') targetScroll(id, !!d.instant);
        else switchTo('about', id, !!d.instant);
      }
    }
    listen(window, 'space-switch', (e) => switchTo(e.detail?.space || e.detail));
    listen(window, 'gallery-ready', () => {
      if (space === 'works' && view === 'sphere') {
        bootAt = performance.now();
        booting = true;
        request();
      }
    });
    listen(window, 'sequence-navigate', navigate);
    listen(window, 'works-view-change', (e) => {
      const next = e.detail === 'list' ? 'list' : 'sphere';
      if (next === view) return;
      if (space === 'works') saved[view] = scrollY;
      view = next;
      body.dataset.workView = view;
      if (space === 'works') {
        requestAnimationFrame(() => {
          scrollTo({
            top: view === 'list' ? saved.list : 0,
            behavior: 'instant',
          });
          window.__GALLERY__?.resize();
          request();
        });
      }
    });
    listen(window, 'show-work-category', (e) => {
      if (window.__INTRO_ACTIVE__) return;
      pendingProject = e.detail;
      switchTo('works', 'works', true);
      if (space === 'works' && !transition) {
        const d = pendingProject;
        pendingProject = null;
        window.dispatchEvent(
          new CustomEvent('works-open-project', {
            detail: d,
          }),
        );
      }
    });
    listen(
      window,
      'wheel',
      (e) => {
        if (window.__INTRO_ACTIVE__ || transition) {
          if (e.cancelable) e.preventDefault();
        }
      },
      {
        passive: false,
      },
    );
    listen(
      window,
      'touchmove',
      (e) => {
        if (window.__INTRO_ACTIVE__ || transition) {
          if (e.cancelable) e.preventDefault();
        }
      },
      {
        passive: false,
      },
    );
    listen(window, 'keydown', (e) => {
      if (
        (window.__INTRO_ACTIVE__ || transition) &&
        [
          'Escape',
          ' ',
          'PageDown',
          'PageUp',
          'Home',
          'End',
          'ArrowDown',
          'ArrowUp',
          'Tab',
        ].includes(e.key)
      )
        e.preventDefault();
    });
    listen(window, 'continuum-progress', () => {
      if (space === 'about') updateAbout();
    });
    listen(
      window,
      'scroll',
      () => {
        if (window.__INTRO_ACTIVE__ && scrollY > 0)
          scrollTo({
            top: 0,
            behavior: 'instant',
          });
        request();
      },
      {
        passive: true,
      },
    );
    listen(window, 'resize', () => {
      document.documentElement.style.setProperty('--stage-h', innerHeight + 'px');
      light();
      request();
    });
    listen(window, 'pause-scroll', () => {
      paused = true;
    });
    listen(window, 'resume-scroll', () => {
      paused = false;
      request();
    });
    listen(window, 'intro-complete', () => {
      initialized = true;
      request();
      if (initialHash === '#works') setTimeout(() => switchTo('works'), 220);
      else if (CHAPTERS.some((chapter) => '#' + chapter.id === initialHash))
        setTimeout(() => targetScroll(initialHash.slice(1), true), 220);
    });
    listen(window, 'hashchange', () => {
      if (!initialized || window.__INTRO_ACTIVE__) return;
      const id = location.hash.slice(1);
      navigate({
        detail: {
          id,
        },
      });
    });
    listen(document, 'visibilitychange', () => {
      if (document.hidden) {
        wasHidden = true;
        transition?.tween?.pause();
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        if (transition && wasHidden) transition.tween?.resume();
        wasHidden = false;
        request();
      }
    });
    const ro = new ResizeObserver(request);
    ro.observe(about);
    ro.observe(works);
    body.dataset.space = 'about';
    updateAccess();
    announce('hero');
    document.documentElement.style.setProperty('--stage-h', innerHeight + 'px');
    light();
    scrollTo({
      top: 0,
      behavior: 'instant',
    });
    request();
    window.__SEQUENCE__ = {
      getState: () => ({
        space,
        chapter,
        view,
        animating: !!transition,
        paused,
        loop: false,
        scrollY,
        saved: {
          ...saved,
        },
        config: MOTION,
      }),
      navigate: (id, instant = false) =>
        navigate({
          detail: {
            id,
            instant,
          },
        }),
    };
    return () => {
      dead = true;
      transition?.tween?.kill();
      cancelAnimationFrame(raf);
      ro.disconnect();
      cleanups.forEach((f) => f());
      delete window.__SEQUENCE__;
      history.scrollRestoration = restore;
    };
  }, []);
}
export { CHAPTERS };
export { MOTION };
export { useSequence };
