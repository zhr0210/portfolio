/** Adapted from David Haz / React Bits ScrollReveal (TS-CSS).
 * https://reactbits.dev/text-animations/scroll-reveal
 * See LICENSE.md. External progress replaces element ScrollTriggers for a pinned stage.
 */
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface ScrollRevealProps {
  children: readonly string[];
  progress: number;
  reduced?: boolean;
  className?: string;
}
export function ScrollReveal({ children, progress, reduced, className = '' }: ScrollRevealProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      timeline.current = gsap
        .timeline({ paused: true })
        .fromTo(
          '.film-reveal-phrase',
          { opacity: 0.22, yPercent: 55, rotate: 0.8 },
          { opacity: 1, yPercent: 0, rotate: 0, duration: 1, stagger: 0.18, ease: 'none' },
        );
    }, containerRef);
    return () => {
      ctx.revert();
      timeline.current = null;
    };
  }, [children]);
  useLayoutEffect(() => {
    timeline.current?.progress(reduced ? 1 : Math.max(0, Math.min(1, progress)));
  }, [progress, reduced, children]);
  return (
    <h2 className={`film-title ${className}`} ref={containerRef} aria-label={children.join('')}>
      {children.map((phrase) => (
        <span className="film-reveal-line" key={phrase} aria-hidden="true">
          <span className="film-reveal-phrase">{phrase}</span>
        </span>
      ))}
    </h2>
  );
}
