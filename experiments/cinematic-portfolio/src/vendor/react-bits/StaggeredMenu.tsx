/** Adapted from David Haz / React Bits StaggeredMenu (TS-CSS).
 * https://reactbits.dev/components/staggered-menu
 * See LICENSE.md. One reversible timeline; focus/locking stay in the portfolio adapter.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

interface StaggeredMenuProps {
  open: boolean;
  reduced: boolean;
  children: ReactNode;
}
export function StaggeredMenu({ open, reduced, children }: StaggeredMenuProps) {
  const host = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTlRef = useRef<gsap.core.Timeline | null>(null);
  const intent = useRef(open);
  intent.current = open;
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      openTlRef.current = gsap
        .timeline({
          paused: true,
          onComplete: () => {
            if (host.current) host.current.dataset.state = 'open';
          },
          onReverseComplete: () => {
            if (host.current) host.current.dataset.state = 'closed';
          },
        })
        .fromTo(
          '.film-menu-layer',
          { xPercent: 100 },
          { xPercent: 0, stagger: 0.06, duration: 0.42, ease: 'power3.inOut' },
          0,
        )
        .fromTo(
          panelRef.current,
          { xPercent: 100 },
          { xPercent: 0, duration: 0.46, ease: 'power3.inOut' },
          0.09,
        )
        .fromTo(
          '.film-menu-item',
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.36, stagger: 0.035, ease: 'power2.out' },
          0.3,
        );
    }, host);
    const visibility = () => {
      if (document.hidden) openTlRef.current?.pause();
      else if (openTlRef.current?.progress() !== (intent.current ? 1 : 0))
        openTlRef.current?.resume();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      ctx.revert();
    };
  }, []);
  useLayoutEffect(() => {
    if (host.current)
      host.current.dataset.state = reduced
        ? open
          ? 'open'
          : 'closed'
        : open
          ? 'opening'
          : 'closing';
    if (reduced) openTlRef.current?.progress(open ? 1 : 0).pause();
    else if (open) openTlRef.current?.play();
    else openTlRef.current?.reverse();
  }, [open, reduced]);
  return (
    <div
      ref={host}
      data-state="closed"
      className={`film-menu-motion ${open ? 'is-open' : ''}`}
      inert={!open}
      aria-hidden={!open}
    >
      <div className="film-menu-layer" aria-hidden="true" />
      <div className="film-menu-layer" aria-hidden="true" />
      <div ref={panelRef} className="film-menu-panel">
        {children}
      </div>
    </div>
  );
}
