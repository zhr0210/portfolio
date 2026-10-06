import { type CSSProperties } from 'react';
import { chapters, filmCopy, filmMedia, type ChapterId } from '../../data/cinematic.ts';
import { projects } from '../../data/projects.js';
import { asset } from '../../lib/assets.js';
import { ScrollReveal } from '../../vendor/react-bits/ScrollReveal.tsx';
import { clamp, lerp, sampleChapter, smooth } from './motion.ts';

interface Props {
  id: ChapterId;
  progress: number;
  small: boolean;
  reduced: boolean;
  onWork: (id: number) => void;
  onContact: () => void;
  onResume: () => void;
  onWorks: () => void;
  onSeek?: (progress: number) => void;
}
const variables = (values: Record<string, string | number>) => values as CSSProperties;
function Image({
  src,
  className = '',
  style,
  alt = '',
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return (
    <img
      src={asset(src)}
      alt={alt}
      className={className}
      style={style}
      draggable={false}
      decoding="async"
    />
  );
}

export function FilmChapter({
  id,
  progress,
  small,
  reduced,
  onWork,
  onContact,
  onResume,
  onWorks,
  onSeek,
}: Props) {
  const spec = chapters.find((chapter) => chapter.id === id)!;
  const p = reduced ? 0.55 : progress;
  const m = sampleChapter(id, p, small);
  const title = filmCopy[id].title;
  const discipline = filmCopy.archive.disciplines[m.discipline];
  const strip = clamp((p - 0.14) / 0.76);
  const workIndex = Math.round(strip * 6);
  return (
    <section
      className={`film-chapter film-${id}${reduced ? ' film-static' : ''}`}
      aria-label={`${spec.label} / ${spec.en}`}
      data-chapter-id={id}
      style={variables({ '--chapter-progress': p, '--strip': strip })}
    >
      <header className="film-scene-heading">
        <span>
          {spec.number}
          <i />
          {spec.en}
        </span>
        <span>{spec.label}</span>
      </header>
      {id === 'profile' && (
        <>
          <div className="film-ghost-word" aria-hidden="true">
            AFTERIMAGE
          </div>
          <figure
            className="film-image-window"
            style={
              reduced
                ? undefined
                : {
                    left: `${lerp(small ? 7 : 42, small ? 0 : 27, m.focus)}%`,
                    width: `${lerp(small ? 86 : 52, small ? 100 : 73, m.focus)}%`,
                    clipPath: `inset(0 ${m.aperture * 0.2}% 0 ${m.aperture * 0.2}%)`,
                  }
            }
          >
            <Image
              src={filmMedia.space}
              alt="现有作品中的走廊空间影像"
              style={{ transform: `scale(${m.photoScale})` }}
            />
            <span className="film-image-corner" aria-hidden="true">
              KZ — 01
            </span>
            <figcaption>
              {filmCopy.profile.caption}
              <span>THE WORLD WITHIN A FRAME</span>
            </figcaption>
          </figure>
          <div
            className="film-profile-copy"
            style={
              reduced ? undefined : { transform: `translateY(${-m.focus * (small ? 0 : 20)}px)` }
            }
          >
            <p className="film-overline">KILIAN ZHOU / VISUAL PRACTICE</p>
            <ScrollReveal progress={m.reveal} reduced={reduced}>
              {title}
            </ScrollReveal>
            <p className="film-statement">{filmCopy.profile.statement}</p>
            <p className="film-body">{filmCopy.profile.body}</p>
          </div>
          <span className="film-frame-rule" aria-hidden="true">
            <i />A FRAME IS A WAY OF SEEING.
          </span>
        </>
      )}
      {id === 'method' && (
        <>
          <div className="film-ghost-word" aria-hidden="true">
            THE CUT
          </div>
          <div className="film-method-copy">
            <ScrollReveal progress={m.reveal} reduced={reduced}>
              {title}
            </ScrollReveal>
            <p className="film-statement">{filmCopy.method.statement}</p>
          </div>
          <div className="film-cut-stage" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="film-cut-slice"
                style={{
                  left: `${index * 33.3333}%`,
                  transform: `translate3d(${(index - 1) * m.separation * (small ? 17 : 42)}px,${(index === 1 ? -1 : 1) * m.separation * 20}px,0) rotate(${(index - 1) * m.separation * 2.5}deg)`,
                }}
              >
                <Image
                  src={filmMedia.space}
                  style={{
                    left: `${-index * 100}%`,
                    transform: `scale(${1 + m.separation * 0.04})`,
                  }}
                />
              </div>
            ))}
            <svg
              className="film-composition-grid"
              viewBox="0 0 600 320"
              preserveAspectRatio="none"
              style={{ opacity: 0.1 + m.separation * 0.7 }}
            >
              <path d="M200 0v320M400 0v320M0 106h600M0 213h600" />
              <path
                d="M20 45V20h25M555 20h25v25M580 275v25h-25M45 300H20v-25"
                className="film-grid-corners"
              />
              <circle cx="300" cy="160" r="8" />
              <path d="M300 142v36M282 160h36" />
            </svg>
            <span className="film-cut-note">
              COMPOSITION STUDY<span>{String(m.step + 1).padStart(2, '0')} / 04</span>
            </span>
          </div>
          <ol className="film-method-steps">
            {filmCopy.method.steps.map((step, index) => (
              <li key={step.en} className={reduced || index === m.step ? 'is-current' : ''}>
                <div>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <small>{step.en}</small>
                </div>
                <h3>{step.name}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      {id === 'archive' && (
        <>
          <div className="film-ghost-word" aria-hidden="true">
            IN BETWEEN
          </div>
          <div className="film-practice-title">
            <ScrollReveal progress={m.reveal} reduced={reduced}>
              {title}
            </ScrollReveal>
            <p className="film-statement">{filmCopy.archive.statement}</p>
          </div>
          <div className="film-practice-stage">
            {filmCopy.archive.disciplines.map((item, index) => {
              const u = p * 3;
              const alpha = reduced
                ? 1
                : (index === 0 ? 1 : smooth(index - 0.15, index + 0.15, u)) *
                  (index === 2 ? 1 : 1 - smooth(index + 0.85, index + 1.15, u));
              return (
                <figure
                  key={item.en}
                  className="film-practice-frame"
                  style={
                    reduced
                      ? undefined
                      : {
                          opacity: alpha,
                          visibility: alpha > 0.001 ? 'visible' : 'hidden',
                          transform: `translateY(${(index - u + 0.5) * 28}px) scale(${1.02 + (u - index) * 0.035})`,
                        }
                  }
                >
                  <Image src={item.image} alt={`${item.name}方向的现有作品画面`} />
                  <figcaption>
                    <span>
                      0{index + 1} / {item.en}
                    </span>
                    <span>{item.word}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <div className="film-practice-info">
            <ol>
              {filmCopy.archive.disciplines.map((item, index) => (
                <li key={item.en} className={index === m.discipline ? 'is-current' : ''}>
                  <button onClick={() => onSeek?.((index + 0.5) / 3)}>
                    <span>{item.name}</span>
                    <small>{item.en}</small>
                    <i>↗</i>
                  </button>
                  {reduced && <p className="film-body">{item.body}</p>}
                </li>
              ))}
            </ol>
            {!reduced && <p className="film-body">{discipline.body}</p>}
            <button className="film-text-link" onClick={onResume}>
              查看能力档案 <span>↗</span>
            </button>
          </div>
        </>
      )}
      {id === 'evidence' && (
        <>
          <div className="film-selected-heading">
            <ScrollReveal progress={m.reveal} reduced={reduced}>
              {title}
            </ScrollReveal>
            <div>
              <p className="film-statement">{filmCopy.evidence.statement}</p>
              <p className="film-body">{filmCopy.evidence.body}</p>
            </div>
          </div>
          <div className="film-strip-window">
            <div className="film-strip">
              {projects.map((work, index) => {
                const distance = clamp(Math.abs(index - strip * 6));
                return (
                  <button
                    key={work.id}
                    className={`film-work-frame${index === workIndex ? ' is-current' : ''}`}
                    aria-label={`查看${work.title}完整作品`}
                    tabIndex={reduced || distance < 1 ? 0 : -1}
                    onClick={() => onWork(work.id)}
                    style={
                      reduced
                        ? undefined
                        : {
                            opacity: 1 - distance * 0.55,
                            transform: `translateY(${distance * 16}px) scale(${1 - distance * 0.075})`,
                          }
                    }
                  >
                    <div className="film-perforation" aria-hidden="true" />
                    <div className="film-work-image">
                      <Image src={work.cover} alt={work.title} />
                      <span>↗</span>
                    </div>
                    <div className="film-work-caption">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <h3>
                        {work.title}
                        <small>{work.en}</small>
                      </h3>
                      <span>↗</span>
                    </div>
                    <div className="film-perforation" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="film-selected-bottom">
            <span>
              {String(workIndex + 1).padStart(2, '0')} / 07 <i />
              {projects[workIndex].category}
            </span>
            <div>
              <button
                aria-label="上一幅画面"
                disabled={workIndex === 0}
                onClick={() => onSeek?.(0.14 + ((workIndex - 1) / 6) * 0.76)}
              >
                ←
              </button>
              <button
                aria-label="下一幅画面"
                disabled={workIndex === 6}
                onClick={() => onSeek?.(0.14 + ((workIndex + 1) / 6) * 0.76)}
              >
                →
              </button>
              <button className="film-text-link" onClick={onWorks}>
                进入作品全景 <span>↗</span>
              </button>
            </div>
          </div>
        </>
      )}
      {id === 'footer' && (
        <>
          <div
            className="film-end-image"
            aria-hidden="true"
            style={{ opacity: m.fadeImage * 0.28, transform: `scale(${1.06 - m.credits * 0.06})` }}
          >
            <Image src={filmMedia.ceremony} />
          </div>
          <div className="film-end-copy">
            <p className="film-overline">THE NEXT FRAME IS STILL UNWRITTEN.</p>
            <ScrollReveal progress={m.credits} reduced={reduced}>
              {title}
            </ScrollReveal>
            <p className="film-statement">{filmCopy.footer.statement}</p>
            <div className="film-end-actions">
              <button onClick={onContact}>
                {filmCopy.footer.contact}
                <span>↗</span>
              </button>
              <button className="film-text-link" onClick={onResume}>
                能力档案 <span>↗</span>
              </button>
            </div>
            <p className="film-end-services">{filmCopy.footer.body}</p>
          </div>
          <div className="film-colophon">
            <strong>KILIAN ZHOU</strong>
            <span>DESIGN · IMAGE · MOTION</span>
            <span>AFTERIMAGE / 余像</span>
          </div>
        </>
      )}
    </section>
  );
}
