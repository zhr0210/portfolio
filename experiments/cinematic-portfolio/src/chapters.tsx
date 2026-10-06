import { createRoot, type Root } from 'react-dom/client';
import { useEffect, useState } from 'react';
import CinemaStory from './components/CinemaStory.tsx';
import WorkPreview from './components/WorkPreview.jsx';
import { ContactDialog, ResumeDialog } from './components/Dialogs.jsx';
import { chapters, isChapterId } from './data/cinematic.ts';
import { projects, frames } from './data/projects.js';
import { applySiteConfig } from './config/site';
import './legacy.css';
import './dual-space.css';
import './continuum.css';
import './cinema.css';

const requested = new URLSearchParams(location.search).get('chapter');
const chapter = isChapterId(requested) ? requested : 'profile';
type Selection = { project: (typeof projects)[number]; frame?: (typeof frames)[number] };

function ChapterPreview() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dialog, setDialog] = useState<'contact' | 'resume' | null>(null);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  // The media listener is shared with the full preview's App behavior.
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
  const work = (id: number) => {
    const project = projects.find((item) => item.id === id);
    if (project) setSelection({ project, frame: frames.find((frame) => frame.projectId === id) });
  };
  return (
    <>
      <div
        className={`portfolio-app flow-edition dual-edition continuum-edition afterimage-edition chapter-preview${reduced ? ' reduce-motion' : ''}`}
      >
        <nav className="film-lab-nav" aria-label="设计预览">
          <a href="./index.html">
            KILIAN ZHOU<span>AFTERIMAGE</span>
          </a>
          <a href="./index.html">整站预览 ↗</a>
        </nav>
        <div className="film-lab-chapters" aria-label="选择章节">
          {chapters.map((item) => (
            <a
              key={item.id}
              href={`./chapters.html?chapter=${item.id}`}
              aria-current={item.id === chapter ? 'page' : undefined}
            >
              <small>{item.number}</small>
              {item.label}
            </a>
          ))}
        </div>
        <main id="about-space">
          <div id="about-hero-run" className="about-hero-run">
            <div className="ct-theatre">
              <div id="editorial-flow" className="about-flow">
                <CinemaStory
                  single={chapter}
                  reduced={reduced}
                  onWork={work}
                  onContact={() => setDialog('contact')}
                  onResume={() => setDialog('resume')}
                  onWorks={() => {
                    location.href = './index.html#works';
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
      {selection && (
        <WorkPreview
          key={selection.project.id + '-' + selection.frame?.id}
          selection={selection}
          onClose={() => setSelection(null)}
          onProject={setSelection}
          available={projects}
          reduced={reduced}
        />
      )}
      {dialog === 'contact' && <ContactDialog onClose={() => setDialog(null)} />}
      {dialog === 'resume' && <ResumeDialog onClose={() => setDialog(null)} />}
    </>
  );
}
document.body.classList.add('afterimage-preview');
document.body.dataset.space = 'about';
document.body.dataset.chapter = chapter;
applySiteConfig();
const root = document.getElementById('root');
if (!root) throw new Error('Chapter preview root is missing.');
// Keep one root when this preview entry is re-evaluated by Vite HMR.
const reactRoot: Root = import.meta.hot?.data.reactRoot ?? createRoot(root);
if (import.meta.hot) import.meta.hot.data.reactRoot = reactRoot;
reactRoot.render(<ChapterPreview />);
