/** Single deterministic motion model shared by the interactive page and Remotion.
 * p is the viewer's scroll progress, not a clock. Geometry remains mounted.
 * No random values, timed CSS animations or video backgrounds are used here. */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (x) => {
  x = clamp(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const range = (a, b, p) => ease((p - a) / (b - a));
const tween = (p, keys) => {
  if (p <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++)
    if (p <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i],
        t = ease((p - a[0]) / (b[0] - a[0]));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], t));
    }
  return keys[keys.length - 1].slice(1);
};
const CLOCK = {
  hero: 0,
  profile: 0.165,
  method: 0.345,
  archive: 0.565,
  evidence: 0.775,
  footer: 0.955,
};
const CHAPTERS = [
  ['hero', '开场', 'INTRODUCTION'],
  ['profile', '观看方式', 'PERSPECTIVE'],
  ['method', '创作过程', 'COMPOSITION'],
  ['archive', '实践档案', 'PRACTICE'],
  ['evidence', '作品证据', 'SELECTED WORK'],
  ['footer', '联系合作', 'NEXT FRAME'],
];
const MEDIA = {
  space: '/images/about-crops/corridor.webp',
  detail: '/images/about-crops/detail.webp',
  ceremony: '/images/about-crops/ceremony.webp',
};
const RECORDS = [
  {
    id: 'sonic',
    year: '2023',
    title: '声学字体探索',
    en: 'SONIC TYPOGRAPHY',
    kind: '交互设计 · 项目探索',
    image: '/images/gitee/image-1.jpg',
    body: '将声音的节奏转译为排版的运动。关注实时音频响应，以及视觉系统与数字界面的整合。',
    tags: ['动态排版', '实时响应', '视觉系统'],
  },
  {
    id: 'identity',
    year: '2022',
    title: '柏林时装周形象识别',
    en: 'FASHION WEEK IDENTITY',
    kind: '品牌设计 · 项目探索',
    image: '/images/gitee/image-2.jpg',
    body: '在工业感与现代时尚之间建立视觉语言。由形象识别延伸到整体品牌系统，让不同载体保持同一个表达。',
    tags: ['形象识别', '品牌系统', '视觉语言'],
  },
];
const WORKS = [
  {
    id: 1,
    title: '盛启预告',
    category: '品牌叙事',
    src: '/images/panorama/01-01.webp',
  },
  {
    id: 2,
    title: '启幕盛典',
    category: '品牌叙事',
    src: '/images/panorama/02-01.webp',
  },
  {
    id: 3,
    title: '启幕大促',
    category: '活动推广',
    src: '/images/panorama/03-01.webp',
  },
  {
    id: 4,
    title: '全运会接待回顾',
    category: '活动推广',
    src: '/images/panorama/04-01.webp',
  },
  {
    id: 5,
    title: '岁末家宴',
    category: '餐饮视觉',
    src: '/images/panorama/05-01.webp',
  },
  {
    id: 6,
    title: '春季大促',
    category: '活动推广',
    src: '/images/panorama/06-01.webp',
  },
  {
    id: 7,
    title: '春馔',
    category: '餐饮视觉',
    src: '/images/panorama/07-01.webp',
  },
];
function model(p, small = false) {
  const main = tween(
    p,
    small
      ? [
          [0, 0.55, 1.06, 0.4, 0.48, -9, 12],
          [0.13, 0.5, 0.38, 0.44, 0.43, -4, 7],
          [0.225, 0.04, 0.12, 0.92, 0.76, 0, 0],
          [0.32, 0.04, 0.1, 0.92, 0.73, 0, 0],
          [0.455, 0.08, 0.545, 0.84, 0.28, 0, 0],
          [0.545, 0.6, 0.67, 0.33, 0.18, -4, 5],
          [0.65, 0.6, 0.67, 0.33, 0.18, 0, 0],
          [0.735, 0.055, 0.355, 0.275, 0.16, -3, 0],
          [0.83, 0.055, 0.355, 0.275, 0.16, -3, 0],
          [0.94, 0.72, 1.02, 0.16, 0.22, 14, -14],
        ]
      : [
          [0, 0.65, 1.1, 0.31, 0.6, -8, 18],
          [0.13, 0.635, 0.19, 0.3, 0.61, -3, 9],
          [0.215, 0.6, 0.18, 0.33, 0.64, 0, 0],
          [0.295, 0.035, 0.1, 0.93, 0.78, 0, 0],
          [0.345, 0.035, 0.1, 0.93, 0.78, 0, 0],
          [0.465, 0.535, 0.2, 0.415, 0.565, 0, -6],
          [0.545, 0.627, 0.18, 0.307, 0.62, -4, -8],
          [0.645, 0.627, 0.18, 0.307, 0.62, 0, 0],
          [0.735, 0.055, 0.39, 0.174, 0.335, -5, 0],
          [0.83, 0.055, 0.39, 0.174, 0.335, -5, 0],
          [0.94, -0.2, 0.38, 0.13, 0.25, -18, 16],
        ],
  );
  return {
    p,
    main,
    hero: 1 - range(0.008, 0.1, p),
    backdrop: range(0.07, 0.17, p),
    profile: range(0.073, 0.135, p) * (1 - range(0.205, 0.262, p)),
    method: range(0.255, 0.295, p) * (1 - range(0.47, 0.515, p)),
    archive: range(0.5, 0.552, p) * (1 - range(0.65, 0.717, p)),
    evidence: range(0.704, 0.75, p) * (1 - range(0.835, 0.897, p)),
    footer: range(0.867, 0.929, p),
    mainAlpha: range(0.037, 0.12, p) * (1 - range(0.85, 0.928, p)),
    grid: range(0.348, 0.435, p) * (1 - range(0.47, 0.526, p)),
    strips: range(0.392, 0.454, p) * (1 - range(0.474, 0.533, p)),
    photoShade: range(0.243, 0.29, p) * 0.4 * (1 - range(0.36, 0.44, p)),
    archiveImage: range(0.496, 0.537, p) * (1 - range(0.683, 0.728, p)),
    proofImage: range(0.682, 0.74, p),
    profileEnter: range(0.092, 0.147, p),
    profileExit: range(0.205, 0.252, p),
    methodEnter: range(0.25, 0.304, p),
    methodExit: range(0.463, 0.519, p),
    archiveEnter: range(0.501, 0.556, p),
    archiveExit: range(0.656, 0.707, p),
    evidenceEnter: range(0.699, 0.755, p),
    evidenceExit: range(0.837, 0.894, p),
    footerEnter: range(0.868, 0.941, p),
  };
}
function createScene(React, asset, ImageComponent = 'img') {
  const h = React.createElement;
  function Lines({ items, enter, exit = 0, className = '', serif = false }) {
    return (
      <h2 className={'ct-headline ' + className}>
        {items.map((text, i) => (
          <span className={'ct-line'} key={i}>
            <span
              className={serif && i === items.length - 1 ? 'ct-italic' : ''}
              style={{
                transform: `translate3d(0,${(1 - enter) * 112 - exit * 115}%,0) rotate(${(1 - enter) * 2 - exit * 1.1}deg)`,
              }}
            >
              {text}
            </span>
          </span>
        ))}
      </h2>
    );
  }
  const layer = (alpha) => ({
    opacity: alpha,
    visibility: alpha > 0.0001 ? 'visible' : 'hidden',
    pointerEvents: 'none',
  });
  function Plate({ src, alt = '', className = '', style = {}, ...rest }) {
    return (
      <ImageComponent
        src={asset(src)}
        alt={alt}
        className={className}
        style={style}
        draggable={false}
        {...rest}
      />
    );
  }
  return function ContinuumScene({
    progress = 0,
    small = false,
    record = 0,
    crop = 0.5,
    onCrop,
    onRecord,
    onWork,
    onContact,
    onResume,
    film = false,
  }) {
    const m = model(progress, small),
      p = m.p,
      r = RECORDS[record] || RECORDS[0],
      a = m.main;
    const photoZoom = lerp(1.08, 1.02, range(0.24, 0.36, p));
    const separation = m.strips * 0.82;
    return (
      <div
        className={'ct-scene' + (small ? ' is-small' : '')}
        data-act={
          p < 0.255
            ? 'perspective'
            : p < 0.505
              ? 'composition'
              : p < 0.7
                ? 'practice'
                : p < 0.87
                  ? 'work'
                  : 'contact'
        }
      >
        <div
          className={'ct-atmosphere'}
          style={{
            opacity: m.backdrop,
          }}
        >
          <div
            className={'ct-ambient-light'}
            style={{
              transform: `translate3d(${Math.sin(p * 5) * 7}vw,${Math.cos(p * 4) * 8}vh,0)`,
            }}
          />
        </div>
        <div className={'ct-profile'} style={layer(m.profile)} inert={m.profile < 0.75}>
          <div className={'ct-kicker'}>
            <span>{'01 / PERSPECTIVE'}</span>
            <span>{'创作者 · Kilian Zhou'}</span>
          </div>
          <Lines
            items={['不是一种风格。', '是一种看法。']}
            enter={m.profileEnter}
            exit={m.profileExit}
          />
          <div
            className={'ct-profile-copy'}
            style={{
              transform: `translateY(${(1 - m.profileEnter) * 40 - m.profileExit * 30}px)`,
            }}
          >
            <p>{'平面设计、摄影摄像与剪辑，是我理解同一个想法的不同方式。'}</p>
            <p className={'ct-muted'}>
              {'从一帧影像出发。选择边界、建立秩序，再让时间赋予它节奏。'}
            </p>
          </div>
          <span
            className={'ct-profile-word'}
            style={{
              transform: `translateX(${(1 - m.profileEnter) * 14 - m.profileExit * 12}%)`,
            }}
          >
            {'PERSPECTIVE'}
          </span>
          <span className={'ct-caption'}>{'影像取自现有项目 / A FRAME FROM THE WORK'}</span>
        </div>
        <div
          className={'ct-sheet'}
          role={m.grid > 0.75 ? 'slider' : undefined}
          tabIndex={m.grid > 0.75 ? 0 : -1}
          aria-label={m.grid > 0.75 ? '拖动取景边界' : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(crop * 100)}
          onPointerDown={(e) => {
            if (m.grid < 0.75) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const b = e.currentTarget.getBoundingClientRect();
            onCrop?.(clamp((e.clientX - b.left) / b.width));
          }}
          onPointerMove={(e) => {
            if (!e.buttons || m.grid < 0.75) return;
            const b = e.currentTarget.getBoundingClientRect();
            onCrop?.(clamp((e.clientX - b.left) / b.width));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              onCrop?.(clamp(crop + (e.key === 'ArrowRight' ? 0.05 : -0.05)));
            }
          }}
          style={{
            pointerEvents: m.grid > 0.75 ? 'auto' : 'none',
            cursor: m.grid > 0.75 ? 'ew-resize' : 'default',
            left: a[0] * 100 + '%',
            top: a[1] * 100 + '%',
            width: a[2] * 100 + '%',
            height: a[3] * 100 + '%',
            opacity: m.mainAlpha,
            transform: `perspective(1400px) rotateY(${a[5]}deg) rotateZ(${a[4]}deg)`,
            borderRadius: lerp(4, 1, range(0.2, 0.28, p)) + 'px',
          }}
        >
          <div
            className={'ct-image-content'}
            style={{
              clipPath: `inset(0 ${m.grid * crop * 19}% 0 ${m.grid * crop * 19}%)`,
            }}
          >
            <Plate
              src={MEDIA.space}
              className={'ct-source-photo'}
              style={{
                opacity: 1 - separation,
                transform: `scale(${photoZoom})`,
                objectPosition: `${42 + crop * 16}% 50%`,
              }}
            />
            <div
              className={'ct-image-shade'}
              style={{
                opacity: m.photoShade,
              }}
            />
            <div
              className={'ct-record-design'}
              data-record={record}
              style={{
                opacity: m.archiveImage,
              }}
            >
              <span className={'ct-study-top'}>{'TYPE / SYSTEM / STUDY'}</span>
              <div className={'ct-study-word'}>
                {record === 0 ? 'SOUND' : 'FORM'}
                <em>{record === 0 ? 'as form.' : 'in motion.'}</em>
              </div>
              <svg
                className={'ct-study-lines'}
                viewBox={'0 0 400 320'}
                preserveAspectRatio={'none'}
                aria-hidden
              >
                {Array.from(
                  {
                    length: 22,
                  },
                  (_, i) => (
                    <path
                      key={i}
                      d={
                        record === 0
                          ? `M-15 ${85 + i * 6} C75 ${15 + i * 3},135 ${290 - i * 4},205 ${132 + i * 4} S305 ${65 + i * 2},415 ${145 + i * 7}`
                          : `M-30 ${40 + i * 12} L110 ${92 + i * 5} L230 ${62 + i * 7} L430 ${120 + i * 4}`
                      }
                      fill={'none'}
                      stroke={'#cdd6c0'}
                      strokeWidth={0.7}
                      opacity={0.2 + i * 0.022}
                    />
                  ),
                )}
              </svg>
              <span className={'ct-study-bottom'}>
                {'PROJECT CONCEPT'}
                <small>{'项目概念示意 · 非交付原图'}</small>
              </span>
            </div>
            <Plate
              src={WORKS[0].src}
              className={'ct-proof-photo'}
              style={{
                opacity: m.proofImage,
              }}
            />
          </div>
          <div
            className={'ct-photo-planes'}
            aria-hidden
            style={{
              opacity: separation,
              visibility: separation > 0.001 ? 'visible' : 'hidden',
              clipPath: `inset(-8% ${m.grid * crop * 10}% -8% ${m.grid * crop * 10}%)`,
            }}
          >
            {Array.from(
              {
                length: 5,
              },
              (_, i) => (
                <div
                  className={'ct-photo-plane'}
                  key={i}
                  style={{
                    left: i * 20 + '%',
                    transform: `perspective(800px) translate3d(${(i - 2) * separation * 13}px,${Math.sin(i * 1.2) * separation * 18}px,0) rotateY(${(i - 2) * separation * -8}deg)`,
                    boxShadow: `${separation * -12}px ${separation * 13}px ${separation * 21}px rgba(0,0,0,.30)`,
                  }}
                >
                  <Plate
                    src={MEDIA.space}
                    style={{
                      left: -i * 100 + '%',
                      objectPosition: `${42 + crop * 16}% 50%`,
                    }}
                  />
                </div>
              ),
            )}
          </div>
          <div
            className={'ct-registration'}
            style={{
              opacity: m.grid,
            }}
          >
            <i />
            <i />
            <i />
            <i />
            <div className={'ct-rule-of-thirds'} />
            <span>{'FRAME / 01'}</span>
          </div>
          <div
            className={'ct-crop-shade'}
            style={{
              opacity: m.grid,
              left: crop * 19 + '%',
              right: crop * 19 + '%',
            }}
          >
            <i />
            <i />
          </div>
          <div
            className={'ct-image-label'}
            style={{
              opacity: m.profile,
            }}
          >
            {'STUDY OF SPACE'}
            <span>{'01'}</span>
          </div>
        </div>
        <div className={'ct-method'} style={layer(m.method)} inert={m.method < 0.75}>
          <div className={'ct-method-label'}>{'02 / COMPOSITION'}</div>
          <div
            className={'ct-method-statement'}
            style={{
              transform: `translate3d(0vw,${range(0.348, 0.448, p) * (small ? -5 : -5)}vh,0) scale(${1 - range(0.348, 0.448, p) * (small ? 0.12 : 0.33)})`,
              transformOrigin: 'left top',
            }}
          >
            <Lines
              items={['把看见的，', '变成被记住的。']}
              enter={m.methodEnter}
              exit={m.methodExit}
            />
          </div>
          <div
            className={'ct-method-details'}
            style={{
              opacity: range(0.354, 0.434, p) * (1 - m.methodExit),
              transform: `translateY(${(1 - range(0.355, 0.438, p)) * 32}px)`,
            }}
          >
            <p>
              {'设计不是不断增加。'}
              <br />
              {'而是让每一次选择都有理由。'}
            </p>
            <div className={'ct-method-row'}>
              <small>{'01'}</small>
              <strong>{'观察'}</strong>
              <span>{'找到画面的中心'}</span>
            </div>
            <div className={'ct-method-row'}>
              <small>{'02'}</small>
              <strong>{'编排'}</strong>
              <span>{'建立信息的轻重'}</span>
            </div>
            <div className={'ct-method-row'}>
              <small>{'03'}</small>
              <strong>{'叙事'}</strong>
              <span>{'让节奏带着人向前'}</span>
            </div>
          </div>
          <div
            className={'ct-crop-control'}
            inert={m.grid < 0.75}
            style={{
              opacity: m.grid,
            }}
          >
            <span className={'ct-crop-instruction'}>{'↔ 拖动画面，改变取景边界'}</span>
            <span>{'COMPOSE / ' + String(Math.round(crop * 100)).padStart(2, '0')}</span>
          </div>
        </div>
        <div className={'ct-archive'} style={layer(m.archive)} inert={m.archive < 0.75}>
          <div className={'ct-kicker'}>
            <span>{'03 / PRACTICE'}</span>
            <span>{'实践档案'}</span>
          </div>
          <Lines items={['实践，', '形成语言。']} enter={m.archiveEnter} exit={m.archiveExit} />
          <div
            className={'ct-record-list'}
            style={{
              transform: `translateY(${(1 - m.archiveEnter) * 42 - m.archiveExit * 50}px)`,
            }}
          >
            {RECORDS.map((item, i) => (
              <button
                className={'ct-record' + (record === i ? ' selected' : '')}
                key={item.id}
                aria-expanded={record === i}
                onClick={() => onRecord?.(i)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') onRecord?.(i);
                }}
                onFocus={() => onRecord?.(i)}
              >
                <span className={'ct-record-year'}>{item.year}</span>
                <span className={'ct-record-title'}>
                  {item.title}
                  <small>{item.en}</small>
                </span>
                <span className={'ct-record-arrow'}>{record === i ? '−' : '+'}</span>
              </button>
            ))}
            <p className={'ct-record-body'}>{r.body}</p>
            <div className={'ct-record-tags'}>
              {r.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <p className={'ct-record-source'}>{'原站项目探索记录 · 非任职证明'}</p>
          </div>
          <span className={'ct-record-meta'}>{r.kind}</span>
          <button className={'ct-text-link ct-resume'} onClick={onResume}>
            {'查看能力档案'}
            <span>{'↗'}</span>
          </button>
        </div>
        <div className={'ct-evidence'} style={layer(m.evidence)} inert={m.evidence < 0.75}>
          <div className={'ct-kicker'}>
            <span>{'04 / SELECTED WORK'}</span>
            <span>{'表达有迹'}</span>
          </div>
          <Lines items={['让作品，继续说。']} enter={m.evidenceEnter} exit={m.evidenceExit} />
          <p className={'ct-evidence-description'}>
            {'品牌叙事、活动推广与餐饮视觉。'}
            <br />
            {'每一次表达，都落实为可以展开阅读的作品。'}
          </p>
          <span className={'ct-evidence-note'}>{'07 件完整作品 / 点击进入作品空间'}</span>
          <button
            className={'ct-first-work'}
            aria-label={'查看盛启预告完整作品'}
            onClick={() => onWork?.(1)}
          >
            <span>{'01'}</span>
            <strong>{'盛启预告'}</strong>
            <span>{'↗'}</span>
          </button>
        </div>
        {WORKS.slice(1).map((work, i) => {
          const t = range(0.674 + i * 0.005, 0.747 + i * 0.002, p),
            out = range(0.847 + i * 0.003, 0.918 + i * 0.003, p);
          const x = small ? ((i + 1) % 3) * 0.31 + 0.055 : 0.257 + i * 0.119;
          const y = small
            ? 0.355 + Math.floor((i + 1) / 3) * 0.183
            : 0.43 + Math.sin((i + 1) * 2.1) * 0.058;
          const width = small ? 0.275 : 0.104,
            height = small ? 0.16 : 0.266;
          const startX = a[0] + 0.03 * (i + 1),
            startY = a[1] + 0.025 * (i + 1);
          return (
            <button
              key={work.id}
              className={'ct-proof-sheet'}
              aria-label={'查看' + work.title + '完整作品'}
              inert={t < 0.85 || out > 0.1}
              onClick={() => onWork?.(work.id)}
              style={{
                left: lerp(startX, x, t) * 100 + '%',
                top: (lerp(startY, y, t) + out * (i % 2 ? -0.45 : 0.7)) * 100 + '%',
                width: lerp(a[2] * 0.65, width, t) * 100 + '%',
                height: lerp(a[3] * 0.7, height, t) * 100 + '%',
                opacity: t * (1 - out),
                visibility: t > 0.001 ? 'visible' : 'hidden',
                transform: `rotate(${Math.sin(i * 1.8) * 6 * t + out * (i % 2 ? 9 : -10)}deg)`,
                zIndex: 4 + i,
                pointerEvents: t > 0.85 && out < 0.1 ? 'auto' : 'none',
              }}
            >
              <Plate src={work.src} alt={work.title} />
              <span className={'ct-proof-label'}>
                {String(work.id).padStart(2, '0')}
                <strong>{work.title}</strong>
                <i>{'↗'}</i>
              </span>
            </button>
          );
        })}
        <div className={'ct-contact'} style={layer(m.footer)} inert={m.footer < 0.75}>
          <div className={'ct-contact-overline'}>{'NEXT / THE FRAME WE MAKE TOGETHER'}</div>
          <Lines
            items={['下一帧，', '一起完成。']}
            enter={m.footerEnter}
            className={'ct-contact-title'}
          />
          <div className={'ct-contact-bottom'}>
            <p>
              {'从一个想法，开始一次合作。'}
              <br />
              {'平面设计 / 摄影摄像 / 剪辑与调色'}
            </p>
            <button
              className={'ct-contact-action'}
              onClick={() =>
                onContact?.({
                  type: '品牌与平面设计',
                })
              }
            >
              <span>{'聊聊你的项目'}</span>
              <i aria-hidden>{'↗'}</i>
            </button>
          </div>
          <div className={'ct-contact-colophon'}>
            <span>{'KILIAN ZHOU'}</span>
            <span>{'DESIGN · IMAGE · MOTION'}</span>
          </div>
        </div>
        <div
          className={'ct-act-track'}
          style={{
            opacity: m.backdrop * (1 - m.footer),
          }}
        >
          <span>{p < 0.255 ? '观察' : p < 0.505 ? '编排' : p < 0.704 ? '实践' : '作品'}</span>
          <div>
            <i
              style={{
                transform: `scaleX(${clamp((p - 0.11) / 0.76)})`,
              }}
            />
          </div>
          <span>{'CONTINUUM'}</span>
        </div>
      </div>
    );
  };
}
export { createScene, model, CLOCK, CHAPTERS, MEDIA, RECORDS, WORKS, clamp, lerp, range, tween };
