import { useEffect, type DependencyList, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

let registered = false;

export function ensureGsapPlugins(): void {
  if (typeof window === 'undefined' || registered) return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Component-scoped GSAP runner with automatic `gsap.context()` + `gsap.matchMedia()` cleanup
 * and built-in `prefers-reduced-motion` support. Prevents orphaned timelines or duplicate ScrollTriggers
 * across React Router route changes and StrictMode double-mounts.
 */
export function useGsapScope(
  scopeRef: RefObject<HTMLElement | null>,
  setup: (context: { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger; reduced: boolean }) => void,
  deps: DependencyList = [],
): void {
  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return;

    ensureGsapPlugins();

    const mm = gsap.matchMedia();
    let ctx: gsap.Context | undefined;

    mm.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        reduced: '(prefers-reduced-motion: reduce)',
      },
      (conditions) => {
        const reduced = Boolean(conditions.conditions?.reduced);
        ctx = gsap.context(() => {
          setup({ gsap, ScrollTrigger, reduced });
        }, root);

        return () => {
          ctx?.revert();
        };
      },
    );

    const refreshId = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      window.cancelAnimationFrame(refreshId);
      ctx?.revert();
      mm.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export { gsap, ScrollTrigger };
