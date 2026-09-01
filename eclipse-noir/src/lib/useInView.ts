import { useEffect, useState, type RefObject } from 'react';

/**
 * Coarse "is this section anywhere near the viewport" signal. Used to mount and
 * unmount the expensive transmission ring, and to hand the camera to
 * OrbitControls — both are once-per-scroll-pass events, so React state is fine.
 */
export function useInView(
  ref: RefObject<HTMLElement | null>,
  { rootMargin = '0px', threshold = 0 }: { rootMargin?: string; threshold?: number } = {},
) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
      threshold,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, threshold]);

  return inView;
}
