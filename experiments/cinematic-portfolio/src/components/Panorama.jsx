import React from 'react';
import { createPortal } from 'react-dom';
import { useGallery } from '../hooks/useGallery';
import { projects, frames, categories } from '../data/projects.js';
import { asset } from '../lib/assets.js';
import { useScrollLock, useDialogFocus, navigateScene } from '../lib/ui.js';
import Icon from './Icon.jsx';
import Preview from './WorkPreview.jsx';
function ViewIcon({ list = false }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox={'0 0 24 24'}
      fill={'none'}
      stroke={'currentColor'}
      strokeWidth={1.35}
      aria-hidden
    >
      {list
        ? [
            <path key={1} d={'M8 5h13M8 12h13M8 19h13'} />,
            <path key={2} d={'M2 5h1M2 12h1M2 19h1'} strokeWidth={2} />,
          ]
        : [
            <rect key={1} x={3} y={3} width={7} height={7} rx={1} />,
            <rect key={2} x={14} y={3} width={7} height={7} rx={1} />,
            <rect key={3} x={3} y={14} width={7} height={7} rx={1} />,
            <rect key={4} x={14} y={14} width={7} height={7} rx={1} />,
          ]}
    </svg>
  );
}
function Panorama({ active, reduced, onView }) {
  const canvas = React.useRef(null),
    galleryRef = React.useRef(null);
  const [view, setView] = React.useState('sphere'),
    [filter, setFilter] = React.useState('全部作品'),
    [filterOpen, setFilterOpen] = React.useState(false);
  const [selection, setSelection] = React.useState(null),
    [ready, setReady] = React.useState(false),
    [fallback, setFallback] = React.useState(false);
  const filtered = projects.filter((p) => filter === '全部作品' || p.category === filter);
  const close = React.useCallback(() => {
    setSelection(null);
    galleryRef.current?.setLocked(false);
  }, []);
  const open = React.useCallback((hit) => {
    setSelection(hit);
    setFilterOpen(false);
    galleryRef.current?.setLocked(true);
  }, []);
  const frameIds = React.useMemo(
    () =>
      frames
        .filter((f) =>
          projects.some(
            (p) => p.id === f.projectId && (filter === '全部作品' || p.category === filter),
          ),
        )
        .map((f) => f.id),
    [filter],
  );
  const engine = useGallery(canvas, {
    enabled: active && view === 'sphere',
    locked: !!selection || filterOpen,
    frameIds,
    onOpen: open,
    onReady: () => {
      setReady(true);
      window.dispatchEvent(new Event('gallery-ready'));
    },
    onError: (error) => {
      console.warn('Gallery compatibility:', error.message);
      setFallback(true);
      setView('list');
    },
  });
  galleryRef.current = engine.current;
  React.useEffect(() => {
    if (!active) {
      close();
      setFilterOpen(false);
    }
  }, [active]);
  React.useEffect(() => {
    if (!filterOpen) return;
    const key = (e) => {
      if (e.key === 'Escape') {
        setFilterOpen(false);
        document.getElementById('filter-toggle')?.focus();
      }
    };
    const outside = (e) => {
      if (!e.target.closest('.panorama-filter')) setFilterOpen(false);
    };
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
    };
  }, [filterOpen]);
  React.useLayoutEffect(() => {
    onView?.(view);
    window.dispatchEvent(
      new CustomEvent('works-view-change', {
        detail: view,
      }),
    );
  }, [view]);
  React.useEffect(() => {
    const reset = () => {
      close();
      setFilterOpen(false);
      setView('sphere');
    };
    window.addEventListener('works-reset-view', reset);
    return () => window.removeEventListener('works-reset-view', reset);
  }, [close]);
  React.useEffect(() => {
    const focus = (e) => {
      const d = e.detail || {};
      close();
      setView('sphere');
      setFilterOpen(false);
      if (d.category && categories.includes(d.category)) setFilter(d.category);
      if (d.projectId) {
        setFilter('全部作品');
        const project = projects.find((p) => p.id === d.projectId);
        if (project)
          open({
            project,
            frame: frames.find((f) => f.projectId === project.id),
          });
      }
    };
    window.addEventListener('works-open-project', focus);
    return () => window.removeEventListener('works-open-project', focus);
  }, [close, open]);
  const changeView = (v) => {
    close();
    setFilterOpen(false);
    setView(v);
  };
  return (
    <section
      id={'scene-works'}
      className={'sequence-scene panorama-scene ' + (view === 'list' ? 'is-list' : '')}
      aria-label={'作品库，沉浸式网格或商业案例列表'}
    >
      <canvas
        ref={canvas}
        className={'panorama-canvas'}
        style={{
          visibility: view === 'sphere' ? 'visible' : 'hidden',
        }}
        tabIndex={active && view === 'sphere' ? 0 : -1}
        role={'img'}
        aria-label={
          '沉浸式作品网格。按住拖动探索，点击打开作品详情。方向键移动视野，回车打开中央作品。'
        }
      />
      {view === 'sphere' && <div className={'panorama-vignette'} aria-hidden />}
      {!ready && !fallback && view === 'sphere' && (
        <div className={'panorama-loading'} role={'status'}>
          <span className={'loading-dot'} />
          {'正在准备作品…'}
        </div>
      )}
      {view === 'list' && (
        <div className={'case-list-view'}>
          <header className={'case-list-heading'}>
            <div>
              <span className={'eyebrow'}>{'01 / WORK INDEX'}</span>
              <h2>
                {'商业案例'}
                <span>{'Selected work.'}</span>
              </h2>
            </div>
            <p>
              {String(filtered.length).padStart(2, '0') +
                ' / ' +
                String(projects.length).padStart(2, '0') +
                ' 个作品'}
              <br />
              {'图像与文字，另一种阅读节奏。'}
            </p>
          </header>
          {fallback && (
            <p className={'webgl-note'} role={'status'}>
              {'图形预览暂不可用，已切换为完整的图文列表。'}
            </p>
          )}
          <div className={'case-list-scroll'} aria-label={'商业案例列表'}>
            {filtered.map((project) => (
              <button
                key={project.id}
                className={'case-row'}
                data-scroll-reveal
                onClick={() =>
                  open({
                    project,
                    frame: frames.find((f) => f.projectId === project.id),
                  })
                }
                aria-label={'查看 ' + project.title}
              >
                <span className={'case-number'}>{String(project.id).padStart(2, '0')}</span>
                <div className={'case-copy'}>
                  <h3>{project.title}</h3>
                  <span className={'case-en'}>{project.en}</span>
                  <p>{project.description}</p>
                </div>
                <span className={'case-category'}>
                  {project.category}
                  <small>{(project.year || '—') + ' / EDITORIAL'}</small>
                </span>
                <img
                  src={asset(project.cover)}
                  alt={project.title + '封面'}
                  loading={'lazy'}
                  draggable={false}
                />
                <Icon name={'diagonal'} size={18} />
              </button>
            ))}
            <div className={'case-list-end'}>
              <span>{'END OF INDEX / ' + String(filtered.length).padStart(2, '0')}</span>
              <button
                className={'text-button'}
                onClick={() =>
                  window.scrollTo({
                    top: 0,
                    behavior: reduced ? 'instant' : 'smooth',
                  })
                }
              >
                {'返回作品目录 '}
                <Icon name={'down'} size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
      {createPortal(
        <div className={'panorama-controls flow-panorama-controls'}>
          <div className={'lens-view-group'}>
            <div className={'panorama-view-switch'} role={'group'} aria-label={'作品浏览模式'}>
              <button
                className={view === 'sphere' ? 'selected' : ''}
                aria-pressed={view === 'sphere'}
                aria-label={'沉浸网格模式'}
                title={'沉浸网格'}
                disabled={fallback}
                onClick={() => changeView('sphere')}
              >
                <ViewIcon />
              </button>
              <button
                className={view === 'list' ? 'selected' : ''}
                aria-pressed={view === 'list'}
                aria-label={'商业案例列表模式'}
                title={'文字列表'}
                onClick={() => changeView('list')}
              >
                <ViewIcon list />
              </button>
            </div>
            {view === 'sphere' && (
              <button
                className={'lens-reset'}
                aria-label={'全景视角归位'}
                title={'视角归位'}
                onClick={() => galleryRef.current?.reset()}
              >
                <Icon name={'reset'} size={15} />
              </button>
            )}
          </div>
          <div className={'panorama-filter'}>
            {filterOpen && (
              <div
                id={'works-filter-panel'}
                className={'filter-popover'}
                aria-label={'筛选作品类别'}
              >
                <header>
                  {'作品分类'}
                  <span>{'FILTER'}</span>
                </header>
                {categories.map((c) => {
                  const count =
                    c === '全部作品'
                      ? projects.length
                      : projects.filter((p) => p.category === c).length;
                  return (
                    <button
                      key={c}
                      className={filter === c ? 'selected' : ''}
                      aria-pressed={filter === c}
                      onClick={() => {
                        setFilter(c);
                        setFilterOpen(false);
                      }}
                    >
                      <span>{c}</span>
                      <span>{String(count).padStart(2, '0')}</span>
                      {filter === c && <i />}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              id={'filter-toggle'}
              className={'filter-trigger'}
              aria-expanded={filterOpen}
              aria-controls={'works-filter-panel'}
              onClick={() => setFilterOpen((v) => !v)}
            >
              {filter === '全部作品' ? '筛选' : filter}
              <span>{String(filtered.length).padStart(2, '0')}</span>
            </button>
          </div>
        </div>,
        document.body,
      )}
      <span className={'sr-only'} role={'status'} aria-live={'polite'}>
        {'当前显示 ' + filtered.length + ' 个作品。'}
      </span>
      {selection && (
        <Preview
          key={selection.project.id + '-' + selection.frame.id}
          selection={selection}
          onClose={close}
          onProject={open}
          available={filtered}
          reduced={reduced}
        />
      )}
    </section>
  );
}
export default Panorama;
