/**
 * Motion tokens for JS animation libraries (GSAP, Motion, R3F).
 * Mirrors the CSS custom properties in src/app/globals.css — keep both in sync.
 *
 *   micro     100–180 ms  press, toggle, hover tint
 *   ui        180–320 ms  menus, tabs, dialogs, row expansion
 *   section   400–700 ms  section reveals, panel transitions
 *   cinematic 700–1400 ms hero and storytelling beats
 *
 * Motion vocabulary: acquire (lock-on), mechanical (servo), signal (linear scan).
 * Everything must collapse to its final state under prefers-reduced-motion.
 */

export const duration = {
  micro: 0.14,
  ui: 0.24,
  section: 0.56,
  cinematic: 1.1,
} as const;

/** Cubic-bézier control points, usable as Motion `ease` arrays. */
export const easing = {
  standard: [0.2, 0, 0, 1],
  acquire: [0.16, 1, 0.3, 1],
  mechanical: [0.65, 0, 0.35, 1],
  exit: [0.4, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type EasingName = keyof typeof easing;

/** CSS / GSAP (CustomEase-free) string form. */
export const cssEasing = (name: EasingName) => `cubic-bezier(${easing[name].join(', ')})`;

/**
 * Evaluates a named easing curve for per-frame JS animation (e.g. R3F `useFrame`),
 * where CSS easing is unavailable. Maps progress `x` ∈ [0,1] to eased progress.
 */
export function ease(name: EasingName, x: number) {
  const [x1, y1, x2, y2] = easing[name];
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  // Bisection on the monotonic x(t) curve; 20 steps is well below 1e-5 error.
  let lo = 0;
  let hi = 1;
  let t = x;
  for (let i = 0; i < 20; i += 1) {
    t = (lo + hi) / 2;
    if (bez(t, x1, x2) < x) lo = t;
    else hi = t;
  }
  return bez(t, y1, y2);
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
