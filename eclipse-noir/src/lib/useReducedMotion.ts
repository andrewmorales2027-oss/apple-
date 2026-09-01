import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const read = () =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false;

/** Live — flipping the OS setting re-renders the page into its static form. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(read);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
