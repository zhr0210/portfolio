import { siteConfig } from '../config/site';
import React from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock, useDialogFocus } from '../lib/ui.js';
import Icon from './Icon.jsx';
import { asset } from '../lib/assets.js';
import { frames } from '../data/projects.js';
import { GradientField } from '../features/detail/GradientField.js';
import { AutoReader } from '../features/detail/AutoReader.js';
/** Real media dimensions, not viewport aspect ratio, choose the detail composition. */
function describeMedia(project, dimensions) {
  const ratio =
    dimensions?.width && dimensions?.height
      ? dimensions.width / dimensions.height
      : project.width && project.height
        ? project.width / project.height
        : 9 / 16;
  const video = project.type === 'video' || project.mediaType === 'video' || !!project.video;
  return {
    ratio,
    video,
    portrait: ratio <= 1.04,
    long: !video && ratio < 0.45,
    source: asset(project.video || project.image || project.src || project.cover),
  };
}
function WorkPreview({ selection, onClose, onProject, available, reduced = false }) {
  const { project } = selection,
    frame = selection.frame || {
      offset: 0,
      label: '完整作品',
    };
  const [dimensions, setDimensions] = React.useState(null),
    [failed, setFailed] = React.useState(false),
    [loaded, setLoaded] = React.useState(false),
    [leaving, setLeaving] = React.useState(false),
    [canScrollDown, setCanScrollDown] = React.useState(false),
    [autoPaused, setAutoPaused] = React.useState(false);
  const m = describeMedia(project, dimensions),
    image = React.useRef(null),
    reader = React.useRef(null),
    mediaPane = React.useRef(null),
    gradient = React.useRef(null),
    placed = React.useRef(false),
    timer = React.useRef(0),
    raf = React.useRef(0),
    autoReader = React.useRef(null),
    returnCover = React.useRef(null),
    closing = React.useRef(false);
  const titleId = React.useId();
  const close = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    autoReader.current?.setPaused(true);
    if (reduced) {
      onClose();
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(onClose, reduced ? 0 : siteConfig.motion.detailClose);
  }, [onClose, reduced]);
  const panel = useDialogFocus(close);
  useScrollLock();
  React.useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(raf.current);
      autoReader.current?.destroy();
    },
    [],
  );
  React.useEffect(() => {
    // Keep the actual panorama behind the glass; never replace it with a stretched cover.
    document.body.dataset.artworkOpen = 'true';
    const app = document.querySelector('.portfolio-app'),
      old = app?.inert;
    if (app) app.inert = true;
    return () => {
      delete document.body.dataset.artworkOpen;
      if (app) app.inert = old;
    };
  }, []);
  React.useEffect(() => {
    if (!gradient.current || !panel.current) return;
    const effect = new GradientField(
      gradient.current,
      panel.current,
      asset(frame.src || project.cover || project.image),
      {
        reduced,
      },
    );
    return () => effect.destroy();
  }, [project.id, frame.src, reduced]);
  const load = (e) => {
    const el = e.currentTarget;
    setDimensions({
      width: el.videoWidth || el.naturalWidth,
      height: el.videoHeight || el.naturalHeight,
    });
    setLoaded(true);
  };
  React.useLayoutEffect(() => {
    if (!loaded || !reader.current || !image.current || placed.current) return;
    raf.current = requestAnimationFrame(() => {
      if (!reader.current || !image.current) return;
      // A short portrait fits in full. Only genuinely long art scrolls to the clicked segment.
      if (m.long) reader.current.scrollTop = (frame.offset || 0) * image.current.clientHeight;
      placed.current = true;
      checkScroll();
    });
  }, [loaded, m.long, frame.offset]);
  const index = available.findIndex((p) => p.id === project.id);
  const browse = (dir) => {
    if (available.length < 2 || leaving) return;
    const next = available[(Math.max(0, index) + dir + available.length) % available.length];
    onProject({
      project: next,
      frame: frames.find((f) => f.projectId === next.id) || {
        offset: 0,
        label: '完整作品',
      },
    });
  };
  const checkScroll = React.useCallback(() => {
    const r = reader.current;
    setCanScrollDown(!!(r && r.scrollHeight - r.clientHeight - r.scrollTop > 18));
  }, []);
  React.useEffect(() => {
    if (!loaded || failed || !m.long || reduced || !reader.current || !returnCover.current) return;
    const controller = new AutoReader(reader.current, returnCover.current, mediaPane.current, {
      onScroll: checkScroll,
    });
    autoReader.current = controller;
    controller.setPaused(autoPaused);
    return () => {
      controller.destroy();
      if (autoReader.current === controller) autoReader.current = null;
    };
  }, [loaded, failed, m.long, reduced, project.id, checkScroll]);
  const toggleAuto = () => {
    setAutoPaused((v) => {
      const next = !v;
      autoReader.current?.setPaused(next);
      return next;
    });
  };
  React.useEffect(() => {
    if (!loaded || !m.long || !reader.current) return;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(checkScroll) : null;
    ro?.observe(reader.current);
    const t = setTimeout(checkScroll, 80);
    return () => {
      clearTimeout(t);
      ro?.disconnect();
    };
  }, [loaded, m.long, checkScroll]);
  const reset = () => {
    if (autoReader.current) autoReader.current.reset();
    else
      reader.current?.scrollTo({
        top: 0,
        behavior: reduced ? 'auto' : 'smooth',
      });
  };
  // 16:9, 3:2, 4:3 and square media all determine their own height; the copy flows below.
  const classes =
    'artwork-card ' +
    (m.portrait ? 'layout-portrait' : 'layout-landscape') +
    (m.long ? ' is-long' : '') +
    (reduced ? ' reduced' : '');
  const media = m.video ? (
    <video
      ref={image}
      className={'artwork-file'}
      src={m.source}
      poster={project.poster ? asset(project.poster) : undefined}
      controls
      playsInline
      preload={'metadata'}
      onLoadedMetadata={load}
      onError={() => setFailed(true)}
      aria-label={project.title + ' — 视频作品'}
    />
  ) : (
    <img
      ref={image}
      className={'artwork-file'}
      src={m.source}
      alt={project.title + ' — 完整作品'}
      decoding={'async'}
      draggable={false}
      onLoad={load}
      onError={() => setFailed(true)}
    />
  );
  const date = project.date || project.year || '—';
  const information = (
    <aside className={'artwork-information'}>
      <div className={'artwork-info-top'}>
        <span className={'artwork-category'}>{project.category}</span>
        <span className={'artwork-record'}>
          {String(Math.max(0, index) + 1).padStart(2, '0') +
            ' / ' +
            String(available.length).padStart(2, '0')}
        </span>
      </div>
      <div className={'artwork-copy'}>
        <h2 id={titleId}>{project.title}</h2>
        {project.en && <p className={'artwork-en'}>{project.en}</p>}
        <div className={'artwork-hairline'} aria-hidden>
          <i />
          <span />
          <i />
        </div>
        <p className={'artwork-description'}>{project.description}</p>
        <div className={'artwork-tags'}>
          {(project.tags || []).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className={'artwork-info-bottom'}>
        <div className={'artwork-meta'}>
          <span>{project.format || (m.video ? '影像作品' : '视觉设计')}</span>
          <time
            dateTime={date === '—' ? undefined : String(date)}
            title={date === '—' ? '尚未填写创作日期' : undefined}
          >
            {date}
          </time>
        </div>
        <div className={'artwork-actions'}>
          <button
            aria-label={'上一个作品'}
            onClick={() => browse(-1)}
            disabled={available.length < 2}
          >
            <Icon name={'arrow'} size={14} />
            <span>{'上一件'}</span>
          </button>
          {m.long ? (
            <div className={'artwork-reading-controls'}>
              {!reduced && (
                <button
                  className={'artwork-auto-toggle'}
                  onClick={toggleAuto}
                  title={autoPaused ? '继续自动滚动' : '暂停自动滚动'}
                  aria-label={autoPaused ? '继续自动滚动' : '暂停自动滚动'}
                  aria-pressed={autoPaused}
                >
                  <svg width={13} height={13} viewBox={'0 0 16 16'} fill={'none'} aria-hidden>
                    {autoPaused ? (
                      <path d={'M5 3.3L12 8l-7 4.7Z'} fill={'currentColor'} />
                    ) : (
                      <path d={'M5.1 3.5v9M10.9 3.5v9'} stroke={'currentColor'} strokeWidth={1.5} />
                    )}
                  </svg>
                </button>
              )}
              <button
                className={'artwork-back-to-cover'}
                onClick={reset}
                title={'回到封面'}
                aria-label={'回到封面'}
              >
                <Icon name={'reset'} size={12} />
              </button>
            </div>
          ) : (
            <span className={'artwork-action-line'} aria-hidden />
          )}
          <button
            aria-label={'下一个作品'}
            onClick={() => browse(1)}
            disabled={available.length < 2}
          >
            <span>{'下一件'}</span>
            <Icon name={'arrow'} size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
  return createPortal(
    <div
      className={'artwork-layer' + (leaving ? ' is-leaving' : '') + (reduced ? ' reduced' : '')}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={'artwork-shade'} aria-hidden onClick={close} />
      <div className={'artwork-edge-blur'} aria-hidden />
      <article
        ref={panel}
        className={classes}
        role={'dialog'}
        aria-modal={'true'}
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          '--media-ratio': String(m.ratio),
        }}
      >
        <canvas ref={gradient} className={'artwork-glass-gradient'} aria-hidden />
        <div className={'artwork-glass-grain'} aria-hidden />
        <button className={'artwork-close'} aria-label={'关闭作品详情'} onClick={close}>
          <Icon name={'close'} size={16} />
        </button>
        <div ref={mediaPane} className={'artwork-media-pane'}>
          <div
            ref={reader}
            className={'artwork-reader'}
            tabIndex={m.long ? 0 : -1}
            onScroll={checkScroll}
            aria-label={m.long ? '完整作品长图，可上下滚动' : project.title + '作品画面'}
          >
            {failed ? (
              <div className={'artwork-error'} role={'status'}>
                {'这幅作品暂时无法加载。'}
                <button
                  onClick={() => {
                    setFailed(false);
                    setLoaded(false);
                    placed.current = false;
                  }}
                >
                  {'重试'}
                </button>
              </div>
            ) : (
              media
            )}
          </div>
          {m.long && loaded && !failed && (
            <div ref={returnCover} className={'artwork-return-cover'} aria-hidden>
              <img src={m.source} alt={''} draggable={false} decoding={'async'} />
            </div>
          )}
          {m.long && loaded && canScrollDown && (
            <span className={'artwork-scroll-cue'} aria-hidden>
              <svg width={18} height={28} viewBox={'0 0 18 28'} fill={'none'}>
                <path
                  d={'M9 2v8'}
                  stroke={'currentColor'}
                  strokeWidth={1.1}
                  strokeLinecap={'round'}
                />
                <path
                  d={'M5 10l4 4 4-4M5 16l4 4 4-4M5 22l4 4 4-4'}
                  stroke={'currentColor'}
                  strokeWidth={1.1}
                  strokeLinecap={'round'}
                  strokeLinejoin={'round'}
                />
              </svg>
            </span>
          )}
          {!loaded && !failed && (
            <span className={'artwork-loading'} role={'status'}>
              {'正在载入…'}
            </span>
          )}
        </div>
        {information}
      </article>
    </div>,
    document.body,
  );
}
export default WorkPreview;
export { describeMedia };
