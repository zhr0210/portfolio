import React from 'react';
import Nav from './components/CinemaNav.tsx';
import Opening from './components/Opening.jsx';
import Hero from './components/Hero.jsx';
import Panorama from './components/Panorama.jsx';
import CinemaStory from './components/CinemaStory.tsx';
import { SpaceDock } from './components/SpaceDock.jsx';
import { getLayout } from './features/cinema/motion.ts';
import WorkPreview from './components/WorkPreview.jsx';
import { projects, frames } from './data/projects.js';
import { ContactDialog, ResumeDialog } from './components/Dialogs.jsx';
import { useSequence } from './hooks/useSequence.js';
function App() {
  const layout = getLayout(innerWidth < 768);
  const [reduced, setReduced] = React.useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [space, setSpace] = React.useState('about'),
    [chapter, setChapter] = React.useState('hero'),
    [view, setView] = React.useState('sphere');
  const [dialog, setDialog] = React.useState(null),
    [contactSeed, setContactSeed] = React.useState({});
  const [selection, setSelection] = React.useState(null);
  const openWork = (id) => {
    const project = projects.find((item) => item.id === id);
    if (project) setSelection({ project, frame: frames.find((item) => item.projectId === id) });
  };
  const close = React.useCallback(() => setDialog(null), []);
  useSequence({
    reduced,
    onChapter: setChapter,
    onSpace: setSpace,
  });
  React.useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)'),
      fn = (e) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return (
    <div
      className={
        'portfolio-app flow-edition dual-edition continuum-edition afterimage-edition' +
        (reduced ? ' reduce-motion' : '')
      }
      data-space={space}
    >
      <Nav active={chapter} space={space} view={view} reduced={reduced} />
      <main
        id={'about-space'}
        role={'tabpanel'}
        aria-labelledby={'tab-about'}
        className={'realm about-realm'}
        inert={space !== 'about'}
        aria-hidden={space !== 'about'}
      >
        <div id={'about-hero-run'} className={'about-hero-run'}>
          <div className={'ct-theatre'}>
            <div id={'global-canvas'} className={'global-canvas about-hero-stage'}>
              <div id={'world-typography'} className={'world-typography'} aria-hidden>
                <div className={'world-line world-line-top'}>
                  <span>
                    {'EDITORIAL VANGUARD · VISUAL DESIGN · EDITORIAL VANGUARD · VISUAL DESIGN · '}
                  </span>
                </div>
                <div className={'world-line world-line-bottom'}>
                  <span>{'DIGITAL ARCHIVE · PHOTOGRAPHY · DIGITAL ARCHIVE · PHOTOGRAPHY · '}</span>
                </div>
              </div>
              <div id={'hero-light-orb'} aria-hidden />
              <Hero />
            </div>
            <div id={'editorial-flow'} className={'about-flow'}>
              <CinemaStory
                active={space === 'about'}
                reduced={reduced}
                onWork={openWork}
                onWorks={() =>
                  window.dispatchEvent(new CustomEvent('space-switch', { detail: 'works' }))
                }
                onResume={() => setDialog('resume')}
                onContact={(seed) => {
                  setContactSeed(seed || {});
                  setDialog('contact');
                }}
              />
            </div>
          </div>
          {layout.scenes.map(({ id, start, duration }) => {
            const v = (start + duration * 0.4) / layout.span;
            return (
              <span
                id={'scene-' + id}
                key={id}
                className={'ct-anchor'}
                aria-hidden
                style={{
                  top: `calc(${v * 100}% - ${v * 100}dvh)`,
                }}
              />
            );
          })}
        </div>
      </main>
      <main
        id={'works-space'}
        role={'tabpanel'}
        aria-labelledby={'tab-works'}
        className={'realm works-realm'}
        inert={space !== 'works'}
        aria-hidden={space !== 'works'}
      >
        <Panorama active={space === 'works'} reduced={reduced} onView={setView} />
      </main>
      <div className={'flow-edge-diffusion'} aria-hidden />
      <div id={'space-curtain'} className={'space-curtain'} aria-hidden>
        <i />
      </div>
      <SpaceDock space={space} />
      <Opening reduced={reduced} />
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
      {dialog === 'contact' && <ContactDialog onClose={close} {...contactSeed} />}
      {dialog === 'resume' && <ResumeDialog onClose={close} />}
    </div>
  );
}
export default App;
