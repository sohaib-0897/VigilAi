'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ViewportFrame } from '@/components/primitives/viewport-frame';
import { cn } from '@/lib/utils';
import { TrackingSchematic } from './tracking-schematic';

// three + R3F stay out of the landing's first-load bundle; they only load for WebGL-capable, motion-OK clients.
const HeroScene = dynamic(() => import('./hero-scene'), { ssr: false, loading: () => null });

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('Hero scene disabled; showing the static schematic.', error);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Hero figure: the static schematic is server-rendered and always present, so
 * no-JS, reduced-motion and no-WebGL clients get the full illustration. Capable
 * clients load the WebGL scene over it. The scene stops rendering when it is
 * paused, scrolled offscreen, or in a hidden tab.
 */
export function HeroVisual() {
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluate = () => {
      const enabled = !motion.matches && supportsWebGL();
      setWebgl(enabled);
      if (!enabled) setReady(false);
    };
    evaluate();
    motion.addEventListener('change', evaluate);
    return () => motion.removeEventListener('change', evaluate);
  }, []);

  useEffect(() => {
    if (!webgl || !stage.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    observer.observe(stage.current);
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [webgl]);

  const running = !paused && inView && pageVisible;

  return (
    <ViewportFrame
      as="figure"
      label="Spatial analysis / scene"
      meta={
        <>
          <Badge variant="secondary">Simulation</Badge>
          {webgl && ready && (
            <button
              type="button"
              onClick={() => setPaused(value => !value)}
              aria-label={paused ? 'Play illustration' : 'Pause illustration'}
              className="-my-1 inline-flex h-8 w-8 items-center justify-center border border-border text-foreground transition-colors duration-micro ease-standard hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          )}
        </>
      }
      footer={
        <>
          <span>ILLUSTRATIVE SIMULATION · NO LIVE CAMERA DATA</span>
          <span className="hidden xl:inline">NORMALIZED GEOMETRY</span>
        </>
      }
      className="shadow-hard-3"
    >
      <div ref={stage} className="relative aspect-[4/3] w-full overflow-hidden bg-background">
        <TrackingSchematic
          className={cn(
            'absolute inset-0 h-full w-full transition-opacity duration-section ease-standard',
            ready && 'opacity-0',
          )}
        />
        {webgl && (
          <div
            className={cn(
              'absolute inset-0 opacity-0 transition-opacity duration-section ease-acquire',
              ready && 'opacity-100',
            )}
          >
            <SceneBoundary onError={() => { setWebgl(false); setReady(false); }}>
              <HeroScene running={running} onReady={() => setReady(true)} />
            </SceneBoundary>
          </div>
        )}
      </div>
    </ViewportFrame>
  );
}
