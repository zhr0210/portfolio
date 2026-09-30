import React from 'react';
import { letters } from '../data/letterPaths.js';
/** Persistent vector typography. The geometry used during tracing is also the final title.
 * Counterforms are separate CLOSED contours. A length cursor visits them in sequence;
 * a compound fill preserves the holes. There is no temporary lettering / DOM-text swap. */
const clamp = (v) => Math.max(0, Math.min(1, v));
const split = (d) => (d.match(/[Mm][^Mm]*/g) || [d]).filter(Boolean);
function Glyphs({ word, front = false, outlineOnly = false }) {
  return letters[word].paths.map((d, i) => (
    <g key={i} data-glyph={i} className={'type-glyph'}>
      <path
        className={'glyph-face'}
        d={d}
        fillRule={'nonzero'}
        data-outline-only={String(front || outlineOnly)}
      />
      {split(d).map((contour, j) => (
        <path
          key={j}
          className={'glyph-contour'}
          d={contour}
          fill={'none'}
          pathLength={1}
          strokeLinecap={'round'}
          strokeLinejoin={'round'}
          data-contour={j}
        />
      ))}
    </g>
  ));
}
function syncStroke(svg) {
  const m = svg.getScreenCTM();
  if (!m) return;
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const width =
    (svg.classList.contains('intro-type') ? 1.15 : svg.dataset.front === 'true' ? 0.8 : 1.0) /
    scale;
  svg.querySelectorAll('.glyph-contour').forEach((p) => (p.style.strokeWidth = String(width)));
}
function register(svg) {
  if (!svg) return null;
  if (svg.__glyphs) return svg.__glyphs;
  svg.__glyphs = [...svg.querySelectorAll('.type-glyph')].map((g) => {
    let total = 0;
    const contours = [...g.querySelectorAll('.glyph-contour')].map((p) => {
      const length = p.getTotalLength(),
        offset = total;
      total += length;
      return {
        p,
        length,
        offset,
      };
    });
    return {
      g,
      face: g.querySelector('.glyph-face'),
      contours,
      total,
    };
  });
  return svg.__glyphs;
}
function paintGlyph(g, reveal, fill, stroke = 1, erase = 0) {
  // The same closed contours remain mounted when fully filled.
  for (const { p, length, offset } of g.contours) {
    const end = clamp((reveal * g.total - offset) / Math.max(1, length));
    const start = clamp((erase * g.total - offset) / Math.max(1, length));
    p.style.strokeDasharray = `${Math.max(0, end - start).toFixed(6)} 1`;
    p.style.strokeDashoffset = (-start).toFixed(6);
    p.style.strokeOpacity = end > start + 0.00001 ? String(stroke) : '0';
  }
  g.face.style.fillOpacity = String(g.face.dataset.outlineOnly === 'true' ? 0 : fill);
  g.g.dataset.draw = reveal.toFixed(4);
  g.g.dataset.fill = fill.toFixed(4);
}
function settle(svg) {
  const outlined = svg.dataset.outlineOnly === 'true',
    front = svg.dataset.front === 'true';
  syncStroke(svg);
  register(svg)?.forEach((g) =>
    paintGlyph(g, 1, outlined || front ? 0 : 1, front ? 0.18 : outlined ? 0.48 : 0.08),
  );
}
function VectorWord({
  word,
  className = '',
  front = false,
  outlineOnly = false,
  tag: Tag = 'span',
}) {
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current,
      svg = el.querySelector('svg'),
      metric = el.querySelector('.type-metric');
    register(svg);
    const measure = () => {
      const cs = getComputedStyle(metric),
        range = document.createRange();
      range.selectNodeContents(metric);
      const r = range.getBoundingClientRect(),
        parent = el.getBoundingClientRect();
      const cv = document.createElement('canvas'),
        ctx = cv.getContext('2d');
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = ctx.measureText(word),
        fs = parseFloat(cs.fontSize) || 100;
      const asc = m.fontBoundingBoxAscent || fs * 0.9,
        desc = m.fontBoundingBoxDescent || fs * 0.22;
      const inkAsc = m.actualBoundingBoxAscent || fs * 0.72,
        inkDesc = m.actualBoundingBoxDescent || 0;
      const spacing = parseFloat(cs.letterSpacing) || 0;
      const width = Math.max(
        1,
        r.width +
          (m.actualBoundingBoxLeft || 0) +
          (m.actualBoundingBoxRight || m.width) -
          m.width -
          spacing,
      );
      const left = r.left - parent.left - (m.actualBoundingBoxLeft || 0),
        baseline = r.top - parent.top + (r.height * asc) / (asc + desc);
      Object.assign(svg.style, {
        left: left + 'px',
        top: baseline - inkAsc + 'px',
        width: width + 'px',
        height: inkAsc + inkDesc + 'px',
      });
      syncStroke(svg);
    };
    measure();
    let dead = false;
    document.fonts.ready.then(() => {
      if (!dead) measure();
    });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (!window.__INTRO_ACTIVE__ && !document.body.dataset.introActive) settle(svg);
    return () => {
      dead = true;
      observer.disconnect();
    };
  }, [word]);
  return (
    <Tag
      ref={ref}
      className={className + ' vector-word'}
      aria-label={front ? undefined : word}
      aria-hidden={front || undefined}
    >
      <span className={'type-metric'} aria-hidden>
        {word}
      </span>
      <svg
        className={'vector-type'}
        viewBox={letters[word].viewBox.join(' ')}
        preserveAspectRatio={'none'}
        data-word={word}
        data-front={String(front)}
        data-outline-only={String(outlineOnly)}
        aria-hidden
      >
        <Glyphs word={word} front={front} outlineOnly={outlineOnly} />
      </svg>
    </Tag>
  );
}
export { syncStroke };
export { VectorWord };
export { Glyphs };
export { register };
export { paintGlyph };
export { settle };
