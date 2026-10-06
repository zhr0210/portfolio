import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chapters } from '../data/cinematic.ts';
import { useScrollLock } from '../lib/ui.js';
import { StaggeredMenu } from '../vendor/react-bits/StaggeredMenu.tsx';

interface Props {
  active: string;
  space: string;
  view: string;
  reduced: boolean;
}
const navigate = (id: string) =>
  window.dispatchEvent(new CustomEvent('sequence-navigate', { detail: id }));
export default function CinemaNav({ active, space, view, reduced }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const app = document.querySelector<HTMLElement>('.portfolio-app');
    const wasInert = app?.inert || false;
    if (app) app.inert = true;
    const timer = requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }),
    );
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const nodes = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button') || [])];
      const first = nodes[0],
        last = nodes.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !panel.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener('keydown', key);
      if (app) app.inert = wasInert;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);
  const go = (id: string) => {
    setOpen(false);
    requestAnimationFrame(() => navigate(id));
  };
  const current = chapters.find((chapter) => chapter.id === active);
  const label =
    space === 'works' ? (view === 'list' ? '商业案例' : '作品全景') : current?.label || '开场';
  const en = space === 'works' ? 'SELECTED WORKS' : current?.en || 'INTRODUCTION';
  return (
    <>
      <nav className="site-nav" aria-label="页内导航">
        <button
          className="nav-chapter"
          aria-label={space === 'works' ? '作品，返回浏览起点' : '关于我，返回页首'}
          onClick={() => navigate(space === 'works' ? 'works' : 'hero')}
        >
          <span>{label}</span>
          <small>{en}</small>
        </button>
        <button
          className="menu-trigger film-menu-toggle"
          ref={trigger}
          id="menu-toggle"
          aria-expanded={open}
          aria-controls="cinema-menu"
          onClick={() => {
            if (!window.__INTRO_ACTIVE__ && !document.body.dataset.overlayOpen) setOpen(true);
          }}
        >
          MENU
          <i aria-hidden="true" />
        </button>
      </nav>
      {createPortal(
        <StaggeredMenu open={open} reduced={reduced}>
          <div ref={panel} id="cinema-menu" role="dialog" aria-modal="true" aria-label="章节目录">
            <div className="film-menu-top">
              <span>AFTERIMAGE / 余像</span>
              <button onClick={() => setOpen(false)} aria-label="关闭菜单">
                CLOSE <span>×</span>
              </button>
            </div>
            <div className="film-menu-intro">
              <p>
                一种观看，
                <br />
                不止一种表达。
              </p>
              <span>
                THE CHAPTERS
                <br />
                KILIAN ZHOU / PORTFOLIO
              </span>
            </div>
            <div className="film-menu-links">
              {chapters.map((chapter) => (
                <div key={chapter.id}>
                  <button
                    className="film-menu-item"
                    aria-current={active === chapter.id ? 'location' : undefined}
                    onClick={() => go(chapter.id)}
                  >
                    <small>{chapter.number}</small>
                    <span>{chapter.label}</span>
                    <em>{chapter.en}</em>
                    <i>↗</i>
                  </button>
                </div>
              ))}
            </div>
            <div className="film-menu-bottom">
              <button onClick={() => go('hero')}>返回开场 ↖</button>
              <button onClick={() => go('works')}>作品全景 ↗</button>
              <span>DESIGN · IMAGE · MOTION</span>
            </div>
          </div>
        </StaggeredMenu>,
        document.body,
      )}
    </>
  );
}
