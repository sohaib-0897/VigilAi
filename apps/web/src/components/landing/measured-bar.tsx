'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A relative bar for a measured value. Decorative (`aria-hidden`): the value it
 * encodes must be rendered as text beside it. Server markup is the final width,
 * so no-JS and reduced-motion clients see the measurement immediately. With
 * motion allowed, a bar that starts below the fold is collapsed off-screen and
 * fills once when it scrolls into view. Only the bar moves; numbers never count.
 */
export function MeasuredBar({ fraction, className }: { fraction: number; className?: string }) {
  const trackRef = useRef<HTMLSpanElement>(null);
  const width = `${Math.min(Math.max(fraction, 0), 1) * 100}%`;

  useEffect(() => {
    const track = trackRef.current;
    const fill = track?.firstElementChild as HTMLElement | null;
    if (!track || !fill || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Already on screen at hydration: keep the final state rather than replaying it.
    if (motion.matches || track.getBoundingClientRect().top < window.innerHeight) return;

    const settle = () => {
      fill.dataset.armed = 'false';
      observer.disconnect();
    };
    // Observe the track, not the fill: a scaleX(0) fill has an empty box.
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) settle(); }, { threshold: 0.6 });
    fill.dataset.armed = 'true';
    observer.observe(track);
    motion.addEventListener('change', settle);
    return () => {
      motion.removeEventListener('change', settle);
      settle();
    };
  }, []);

  return (
    <span ref={trackRef} aria-hidden="true" className="relative block h-3 border border-border bg-background">
      <span
        className={cn(
          'absolute inset-y-0 left-0 origin-left transition-transform duration-cinematic ease-acquire',
          'data-[armed=true]:scale-x-0 data-[armed=true]:transition-none',
          className,
        )}
        style={{ width }}
      />
    </span>
  );
}
