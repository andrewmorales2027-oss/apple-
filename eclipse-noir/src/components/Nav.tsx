import { useRef } from 'react';
import { useMagnetic } from '../lib/useMagnetic';

export function Nav({ magnetic }: { magnetic: boolean }) {
  const scope = useRef<HTMLElement>(null);
  useMagnetic(scope, magnetic, 0.24);

  return (
    <nav ref={scope} className="nav" aria-label="Primary">
      <a className="nav__brand" href="#top">
        Maison Vesper
      </a>
      <ul className="nav__links">
        <li>
          <a className="nav__link" href="#notes" data-magnetic="0.24">
            Notes
          </a>
        </li>
        <li>
          <a className="nav__link" href="#product" data-magnetic="0.24">
            Pre-order
          </a>
        </li>
      </ul>
    </nav>
  );
}
