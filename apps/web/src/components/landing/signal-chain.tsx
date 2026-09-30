'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type SignalStage = { title: string; label: string; description: string };

/**
 * The pipeline as a signal bus. Server markup is the final state (every stage
 * acquired, reticle on the last stage), so no-JS and reduced-motion clients see
 * the complete chain. With motion allowed, GSAP ScrollTrigger is loaded lazily
 * and scrubs the bus with scroll: the fill advances, each stage locks on as the
 * fill reaches its node, and the reticle follows the leading stage.
 */
export function SignalChain({ stages }: { stages: readonly SignalStage[] }) {
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-stage]'));
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const horizontal = window.matchMedia('(min-width: 1024px)');
    let thresholds: number[] = items.map((_, i) => (i + 0.5) / items.length);
    let teardown: (() => void) | undefined;
    let disposed = false;

    const apply = (progress: number) => {
      list.style.setProperty('--progress', progress.toFixed(4));
      let head = -1;
      items.forEach((item, i) => {
        const acquired = progress >= thresholds[i] - 0.001;
        if (acquired) head = i;
        item.dataset.state = acquired ? 'acquired' : 'idle';
      });
      items.forEach((item, i) => { item.dataset.head = String(i === head); });
    };

    // Node centres along the bus axis, as a fraction of its length. Read once per
    // ScrollTrigger refresh (resize, font swap), never per scroll frame.
    const measure = () => {
      const box = list.getBoundingClientRect();
      thresholds = items.map(item => {
        const node = item.querySelector<HTMLElement>('[data-node]')?.getBoundingClientRect();
        if (!node) return 0;
        return horizontal.matches
          ? (node.left + node.width / 2 - box.left) / box.width
          : (node.top + node.height / 2 - box.top) / box.height;
      });
    };

    let generation = 0;
    const start = async () => {
      const run = ++generation;
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
      if (disposed || motion.matches || run !== generation) return;
      gsap.registerPlugin(ScrollTrigger);
      const state = { progress: 0 };
      measure();
      apply(0);
      const tween = gsap.to(state, {
        progress: 1,
        ease: 'none',
        onUpdate: () => apply(state.progress),
        scrollTrigger: {
          trigger: list,
          start: 'top 80%',
          end: 'bottom 55%',
          scrub: 0.6,
          onRefresh: () => { measure(); apply(state.progress); },
        },
      });
      teardown = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    };

    const evaluate = () => {
      generation += 1;
      teardown?.();
      teardown = undefined;
      apply(1);
      if (!motion.matches) void start();
    };

    evaluate();
    motion.addEventListener('change', evaluate);
    return () => {
      disposed = true;
      motion.removeEventListener('change', evaluate);
      teardown?.();
      apply(1);
    };
  }, []);

  const last = stages.length - 1;

  return (
    <div className="border border-border-strong bg-surface">
      <ol ref={listRef} className="relative grid lg:grid-cols-6" style={{ ['--progress' as string]: 1 }}>
        {/* Bus: a hairline track plus an ink fill scrubbed by --progress. Vertical below lg. */}
        <span aria-hidden="true" className="absolute bottom-0 left-6 top-0 w-px bg-border lg:bottom-auto lg:left-0 lg:right-0 lg:top-6 lg:h-px lg:w-auto" />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[23px] top-0 w-[3px] origin-top scale-y-[var(--progress)] bg-foreground lg:bottom-auto lg:left-0 lg:right-0 lg:top-[23px] lg:h-[3px] lg:w-auto lg:origin-left lg:scale-x-[var(--progress)] lg:scale-y-100"
        />
        {stages.map((stage, index) => (
          <li
            key={stage.title}
            data-stage=""
            data-state="acquired"
            data-head={String(index === last)}
            className={cn(
              'group/stage vg-brackets relative flex flex-col py-5 pl-14 pr-5 [--bracket-inset:6px] [--bracket-size:10px]',
              'after:opacity-0 after:transition-opacity after:duration-ui after:ease-acquire data-[head=true]:after:opacity-100',
              'border-t border-border first:border-t-0 lg:border-l lg:border-t-0 lg:px-5 lg:pb-7 lg:pt-0 lg:first:border-l-0',
            )}
          >
            <span
              data-node=""
              aria-hidden="true"
              className={cn(
                'absolute left-6 top-8 z-[1] h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-border-strong bg-surface lg:left-5 lg:top-6 lg:translate-x-0',
                'transition-colors duration-ui ease-acquire group-data-[state=acquired]/stage:bg-signal',
              )}
            />
            <div className="flex h-6 items-center lg:h-12 lg:pl-6">
              {/* Sits on the bus like a schematic tag: the surface backing interrupts the rail. */}
              <span className="vg-telemetry relative z-[1] bg-surface text-muted-foreground lg:px-1.5 transition-colors duration-ui ease-standard group-data-[state=acquired]/stage:text-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-3 font-display text-title font-extrabold uppercase tracking-[-0.01em] [font-stretch:90%] lg:mt-4">{stage.title}</h3>
            <p className="vg-label mt-2 text-muted-foreground lg:min-h-[2.8em]">{stage.label}</p>
            <p className="mt-3 text-body-sm text-muted-foreground">{stage.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
