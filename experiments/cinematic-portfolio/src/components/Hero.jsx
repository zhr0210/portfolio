import React from 'react';
import { asset } from '../lib/assets.js';
import { navigateScene } from '../lib/ui.js';
import Icon from './Icon.jsx';
import { VectorWord } from './VectorType.jsx';
const h = React.createElement;
function Words({ front = false }) {
  return (
    <div
      className={'hero-words' + (front ? ' hero-overprint' : '')}
      aria-hidden={front || undefined}
    >
      <div className={'hero-name'}>
        {h(
          front ? 'div' : 'h1',
          {
            'aria-label': front ? undefined : 'Kilian Zhou 作品集',
          },
          <VectorWord word={'KILIAN'} className={'hero-kilian'} front={front} />,
          <VectorWord word={'ZHOU'} className={'hero-zhou'} front={front} />,
          <VectorWord word={'作品集'} className={'hero-cn'} front={front} />,
        )}
      </div>
      {!front && (
        <VectorWord tag={'h2'} word={'PORTFOLIO'} className={'hero-portfolio'} outlineOnly />
      )}
      {!front && (
        <div className={'hero-bio'}>
          <p className={'hero-role'}>
            {'平面设计师&摄影摄像师&剪辑师'}
            <span>{'GRAPHIC DESIGNER, PHOTOGRAPHER & VIDEOGRAPHER, AND EDITOR'}</span>
          </p>
          <p className={'hero-description'}>
            {'通过巨石般的字体设计与严谨的档案式精确性，定义视觉语言。'}
            <br className={'desktop-only'} />
            {'从一帧影像出发，探索设计、摄影与智能创作的边界。'}
          </p>
        </div>
      )}
    </div>
  );
}
function Hero() {
  const composition = React.useRef(null);
  React.useLayoutEffect(() => {
    const host = composition.current,
      base = host.querySelector('.hero-words:not(.hero-overprint)'),
      front = host.querySelector('.hero-overprint');
    let alive = true;
    const align = () => {
      if (alive && base && front) front.style.height = base.getBoundingClientRect().height + 'px';
    };
    align();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(align);
    ro?.observe(base);
    document.fonts.ready.then(align);
    window.addEventListener('resize', align);
    return () => {
      alive = false;
      ro?.disconnect();
      window.removeEventListener('resize', align);
    };
  }, []);
  return (
    <section
      id={'scene-hero'}
      className={'sequence-scene hero-scene'}
      aria-label={'首页 — Kilian Zhou 作品集'}
    >
      <div ref={composition} className={'hero-composition'}>
        <Words />
        <div className={'hero-portrait-plane'} aria-hidden>
          <img
            className={'hero-portrait-isolated hero-portrait-dark'}
            src={asset('/images/optimized/portrait-light.webp')}
            alt={''}
            fetchPriority={'high'}
            draggable={false}
          />
          <img
            className={'hero-portrait-isolated hero-portrait-reveal'}
            src={asset('/images/optimized/portrait-light.webp')}
            alt={''}
            draggable={false}
          />
        </div>
        <Words front />
        <div className={'hero-hover-zone'} aria-hidden />
      </div>
      <div className={'hero-footnote'}>
        <span>{'INDEPENDENT VISUAL PRACTICE'}</span>
        <button onClick={() => navigateScene('profile')}>
          {'走进我的创作 '}
          <Icon name={'down'} size={14} />
        </button>
      </div>
    </section>
  );
}
export default Hero;
