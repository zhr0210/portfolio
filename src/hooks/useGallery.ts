import { useEffect, useRef, useState, type RefObject } from 'react';
import { frames, projects } from '../data/projects.js';

type Engine = InstanceType<
  (typeof import('../features/gallery/GalleryEngine.js'))['SphericalGallery']
>;
export interface GalleryHit {
  project: (typeof projects)[number];
  frame: (typeof frames)[number];
  cell?: number;
  x?: number;
  y?: number;
}
interface Options {
  enabled: boolean;
  locked: boolean;
  frameIds: number[];
  onOpen: (hit: GalleryHit) => void;
  onReady: () => void;
  onError: (error: Error) => void;
}

/** Load once on first use; keep current callbacks and dispose even during an async import. */
export function useGallery(canvas: RefObject<HTMLCanvasElement | null>, options: Options) {
  const engine = useRef<Engine | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (options.enabled) setStarted(true);
  }, [options.enabled]);

  useEffect(() => {
    if (!started) return;
    let disposed = false;
    let instance: Engine | null = null;
    import('../features/gallery/GalleryEngine.js')
      .then(({ SphericalGallery }) => {
        if (disposed || !canvas.current) return;
        instance = new SphericalGallery(canvas.current, {
          frames,
          projects,
          onHover: () => {},
          onOpen: (hit: GalleryHit) => latest.current.onOpen(hit),
          onReady: () => {
            if (!disposed) latest.current.onReady();
          },
          onError: (error: Error) => {
            if (!disposed) latest.current.onError(error);
          },
        });
        if (instance.disposed) return;
        engine.current = instance;
        const timeline = (window as Window & { __PANORAMA_TIMELINE__?: Engine['state'] })
          .__PANORAMA_TIMELINE__;
        if (timeline) instance.state = timeline;
        instance.setFilter(latest.current.frameIds, false);
        instance.setLocked(latest.current.locked);
        instance.setEnabled(latest.current.enabled);
      })
      .catch((error) => {
        if (!disposed) latest.current.onError(error);
      });
    return () => {
      disposed = true;
      instance?.destroy();
      engine.current = null;
    };
  }, [started, canvas]);

  useEffect(() => {
    engine.current?.setEnabled(options.enabled);
  }, [options.enabled]);
  useEffect(() => {
    engine.current?.setLocked(options.locked);
  }, [options.locked]);
  useEffect(() => {
    engine.current?.setFilter(options.frameIds);
  }, [options.frameIds]);
  return engine;
}
