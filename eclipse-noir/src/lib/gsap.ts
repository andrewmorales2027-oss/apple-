import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Never let ScrollTrigger take the scroll away from the user: no pinning, no
// scroll normalisation, no scroller-proxy. Everything on this page reads the
// native scroll position and writes to the 3D scene. Arrow keys, Space,
// PageUp/PageDown, Home/End and screen-reader virtual cursors all keep working.
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };
