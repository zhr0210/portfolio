import type { ChapterId } from './data/cinematic';

declare global {
  interface Window {
    __INTRO_ACTIVE__?: boolean;
    __CONTINUUM__?: {
      getState(): {
        progress: number;
        chapter: ChapterId | 'hero';
        position: number;
        paused: boolean;
        raf: number;
        target: number;
      };
      go(id: ChapterId, local?: number, instant?: boolean): void;
    };
  }
}
