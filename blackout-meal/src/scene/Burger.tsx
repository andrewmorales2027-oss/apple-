import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { scrollState } from "./scrollState";
import { getStyle } from "./style";
import { clamp01, easeOutBack, smoothstep } from "./easing";
import { BottomBun, TopBun } from "./parts/Buns";
import { Patties } from "./parts/Patty";
import { Cheese } from "./parts/Cheese";
import { Bacon } from "./parts/Bacon";
import { Lettuce, Onion, Pickles, Sauce, Tomato } from "./parts/Produce";
import { Steam } from "./parts/Steam";

export type LayerId =
  | "bottomBun"
  | "lettuce"
  | "patty"
  | "cheese"
  | "bacon"
  | "veg"
  | "sauce"
  | "topBun";

interface LayerSpec {
  id: LayerId;
  /** Where the layer starts, relative to its rest position. Off-frame in every case. */
  from: [number, number, number];
  /** Entry rotation, unwound as it settles. */
  spin: [number, number, number];
  /** Start of this layer's window inside the section's 0..1 progress. */
  at: number;
  /** How much of the section the layer takes to land. */
  span: number;
  /** Overshoot on landing — heavier layers hit harder. */
  weight: number;
}

/** Build order, bottom-up. Windows overlap slightly so the stack never stalls. */
export const LAYERS: LayerSpec[] = [
  { id: "bottomBun", from: [-4.6, -3.4, 1.8], spin: [0.5, 0.9, -0.45], at: 0.0, span: 0.22, weight: 1.15 },
  { id: "lettuce", from: [5.4, 1.4, -1.2], spin: [0.7, -1.3, 0.6], at: 0.105, span: 0.23, weight: 0.55 },
  { id: "patty", from: [0.4, 3.6, -6.2], spin: [-0.8, 0.5, 0.35], at: 0.21, span: 0.23, weight: 1.5 },
  { id: "cheese", from: [-0.3, 4.4, 0.7], spin: [0.3, 0.8, 0.25], at: 0.315, span: 0.24, weight: 0.75 },
  { id: "bacon", from: [-5.9, 1.8, 0.9], spin: [0.45, 1.5, -0.7], at: 0.44, span: 0.22, weight: 0.7 },
  { id: "veg", from: [0.9, 2.8, 5.6], spin: [0.95, -0.6, 0.45], at: 0.55, span: 0.23, weight: 0.8 },
  { id: "sauce", from: [0, 2.6, 0], spin: [0, 1.2, 0], at: 0.66, span: 0.2, weight: 0.5 },
  { id: "topBun", from: [0, 5.4, -0.7], spin: [0.22, -1.0, 0.18], at: 0.76, span: 0.24, weight: 1.35 },
];

export interface BurgerHandles {
  /** 0..1 assembly, damped. Read by the camera rig and the ingredient list. */
  assembly: React.RefObject<number>;
}

interface Props {
  reduced: boolean;
  handles: BurgerHandles;
}

/**
 * The centerpiece. Every layer is a wrapper group whose offset from its rest transform is
 * driven by scroll progress and damped in useFrame — never teleported, and never a React
 * state update per frame.
 */
export function Burger({ reduced, handles }: Props) {
  const groups = useRef<Partial<Record<LayerId, THREE.Group | null>>>({});
  const cheeseProgress = useRef(0);
  const steamIntensity = useRef(0);
  const damped = useRef(reduced ? 1 : 0);

  const scratch = useMemo(() => ({ v: new THREE.Vector3() }), []);

  const setRef = (id: LayerId) => (el: THREE.Group | null) => {
    groups.current[id] = el;
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);

    if (reduced) {
      damped.current = 1;
      cheeseProgress.current = 1;
      steamIntensity.current = 0;
    } else {
      const target = scrollState.progress.build;
      // Frame-rate independent damping: the scroll value leads, the scene follows.
      damped.current = THREE.MathUtils.damp(damped.current, target, 7, dt);
    }

    const p = damped.current;
    handles.assembly.current = p;

    // The hero withholds the burger: only the crown floats, alone, in the spotlight.
    const heroBlend = reduced ? 0 : 1 - smoothstep(0, 0.12, p);

    for (const layer of LAYERS) {
      const g = groups.current[layer.id];
      if (!g) continue;

      const t = clamp01((p - layer.at) / layer.span);
      const e = easeOutBack(t, 0.55 * layer.weight);
      const remaining = 1 - e;

      g.position.set(layer.from[0] * remaining, layer.from[1] * remaining, layer.from[2] * remaining);
      g.rotation.set(layer.spin[0] * remaining, layer.spin[1] * remaining, layer.spin[2] * remaining);

      // Impact squash: the amount the ease overshot past its target, read as compression.
      const squash = clamp01(Math.abs(e - 1) * 2.2) * (t > 0.35 ? 1 : 0);
      g.scale.set(1 + squash * 0.05, 1 - squash * 0.18, 1 + squash * 0.05);

      g.visible = t > 0.0005;

      if (layer.id === "cheese") cheeseProgress.current = t;

      if (layer.id === "topBun") {
        if (heroBlend > 0.0005) {
          g.visible = true;
          // Floating hero pose, lerped out as the build takes over.
          scratch.v.set(0, 0.55, 0);
          g.position.lerp(scratch.v, heroBlend);
          g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, performance.now() * 0.00012, heroBlend);
          g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.06, heroBlend);
          g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, heroBlend);
        }
      } else if (heroBlend > 0.5) {
        g.visible = false;
      }
    }

    // Steam arrives with the patty and is gone before the camera leaves the section.
    if (!reduced) {
      const on = smoothstep(0.24, 0.4, p) * (1 - smoothstep(0.86, 1, p));
      const sectionOwns = scrollState.active === "build" ? 1 : 0;
      steamIntensity.current = THREE.MathUtils.damp(steamIntensity.current, on * sectionOwns, 4, dt);
    }
  });

  const wrap = (id: LayerId, children: ReactNode) => (
    <group key={id} ref={setRef(id)}>
      {children}
    </group>
  );

  return (
    <group name="burger">
      {wrap("bottomBun", <BottomBun />)}
      {wrap("lettuce", <Lettuce />)}
      {wrap("patty", <Patties />)}
      {wrap("cheese", <Cheese progress={cheeseProgress} />)}
      {wrap("bacon", <Bacon />)}
      {wrap(
        "veg",
        <>
          <Tomato />
          <Onion />
          <Pickles />
        </>,
      )}
      {wrap("sauce", <Sauce />)}
      {wrap("topBun", <TopBun />)}
      {/* Steam is a photographic device — soft additive haze. Under a posteriser it
          resolves into flat ink blobs floating over the burger, so the flat directions
          go without it. */}
      {!reduced && getStyle().shading !== "toon" && <Steam intensity={steamIntensity} />}
    </group>
  );
}
