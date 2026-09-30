import React from 'react';
import Nav from './components/Nav.jsx';
import Opening from './components/Opening.jsx';
import Hero from './components/Hero.jsx';
import Panorama from './components/Panorama.jsx';
import Continuum from './components/Continuum.jsx';
import { SpaceDock } from './components/SpaceDock.jsx';
import { CLOCK } from './features/continuum/scene.jsx';
import { ContactDialog, ResumeDialog } from './components/Dialogs.jsx';
import { useSequence } from './hooks/useSequence.js';
function App() {
  const [reduced, setReduced] = React.useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [space, setSpace] = React.useState('about'),
    [chapter, setChapter] = React.useState('hero'),
    [view, setView] = React.useState('sphere');
  const [dialog, setDialog] = React.useState(null),
    [contactSeed, setContactSeed] = React.useState({});
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
        'portfolio-app flow-edition dual-edition continuum-edition' +
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
              <Continuum
                space={space}
                reduced={reduced}
                onResume={() => setDialog('resume')}
                onContact={(seed) => {
                  setContactSeed(seed || {});
                  setDialog('contact');
                }}
              />
            </div>
          </div>
          {Object.entries(CLOCK)
            .filter(([id]) => id !== 'hero')
            .map(([id, v]) => (
              <span
                id={'scene-' + id}
                key={id}
                className={'ct-anchor'}
                aria-hidden
                style={{
                  top: `calc(${v * 100}% - ${v * 100}dvh)`,
                }}
              />
            ))}
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
      {dialog === 'contact' && <ContactDialog onClose={close} {...contactSeed} />}
      {dialog === 'resume' && <ResumeDialog onClose={close} />}
    </div>
  );
}
export default App;
