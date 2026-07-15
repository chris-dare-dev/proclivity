import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import "./MeshBackground.css";

/*
 * Animated wireframe-mesh background.
 *
 * A PlaneGeometry with many segments is rotated to a shallow perspective.
 * A ShaderMaterial displaces each vertex's Z by 3-octave simplex noise.
 * Two slow sine pairs drive a "wander" offset into the noise field so the
 * warp visibly travels across the screen instead of just pulsing in place.
 *
 * Library choice: react-three-fiber + a hand-written GLSL shader gives full
 * control over the displacement and runs entirely on the GPU. Vanta.js was
 * considered (TOPOLOGY effect is similar) but ships its own three.js bundle
 * and is much less tunable.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uWander;
  uniform float uAmp;
  uniform float uFreq;
  uniform float uSpeed;

  // Simplex 3D noise (Ashima Arts / Ian McEwan — public domain)
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  varying float vElevation;

  void main() {
    vec3 pos = position;
    vec2 q = pos.xy * uFreq + uWander;
    // 3-octave fBm — large rolling base + two finer ripples
    float n  = snoise(vec3(q,        uTime * uSpeed));
    n += 0.5  * snoise(vec3(q * 2.0,  uTime * uSpeed * 1.4));
    n += 0.25 * snoise(vec3(q * 4.0,  uTime * uSpeed * 1.9));
    pos.z = n * uAmp;
    vElevation = n;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vElevation;
  void main() {
    // Separate bright ridges from recessed valleys. This increases perceived
    // contrast without adding geometry, post-processing, or animation speed.
    float ridge = smoothstep(-0.55, 0.75, vElevation);
    float brightness = mix(0.50, 1.25, ridge);
    gl_FragColor = vec4(uColor * brightness, uAlpha);
  }
`;

/*
 * Time-of-day color cycle. Keys are placed at notable hours; the cycle
 * lerps continuously between adjacent keys with a smoothstep curve so
 * the color shift across the day is gradual rather than stepwise.
 *
 * Keys are sorted ascending and a sentinel at h+24 is appended so a time
 * after the last key (e.g. 23:00) interpolates correctly across midnight
 * toward the first key (01:00 indigo).
 */
const COLOR_KEYS_RAW: Array<{ h: number; hex: string; label: string }> = [
  { h: 1,  hex: "#4a3aff", label: "indigo"       },
  { h: 6,  hex: "#3d7eff", label: "bright blue"  },
  { h: 12, hex: "#2bd4c7", label: "turquoise"    },
  { h: 14, hex: "#5bd45b", label: "green"        },
  { h: 16, hex: "#ffd84a", label: "yellow"       },
  { h: 18, hex: "#ff9a3a", label: "orange"       },
  { h: 20, hex: "#ff4d4d", label: "red"          },
  { h: 22, hex: "#9a3aff", label: "purple"       },
];

function WarpMesh() {
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const colorKeys = useMemo(() => {
    const sorted = [...COLOR_KEYS_RAW]
      .sort((a, b) => a.h - b.h)
      .map((k) => ({ h: k.h, c: new THREE.Color(k.hex) }));
    // Wrap sentinel — first key at h+24 closes the loop across midnight.
    const first = sorted[0]!;
    return [...sorted, { h: first.h + 24, c: first.c }];
  }, []);

  // Shader alpha is held at 1.0 — the visual brightness is controlled by
  // .mesh-background's CSS opacity via the --mesh-intensity custom property,
  // which gives a single linear control (0–1) instead of multiplying CSS
  // opacity by a separate shader alpha.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWander: { value: new THREE.Vector2(0, 0) },
      uAmp: { value: 2.4 },
      uFreq: { value: 0.18 },
      uSpeed: { value: 0.035 },
      uColor: { value: new THREE.Color("#3d7eff") },
      uAlpha: { value: 1.0 },
    }),
    [],
  );

  const colorScratch = useMemo(() => new THREE.Color(), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    // Two layered sine pairs at different frequencies = quasi-random wander
    // that never repeats cleanly within a viewing session.
    uniforms.uWander.value.set(
      Math.sin(t * 0.013) * 9 + Math.sin(t * 0.031) * 3.5,
      Math.cos(t * 0.017) * 9 + Math.cos(t * 0.029) * 3.5,
    );

    // Time-of-day color interpolation. Cheap: ~8 comparisons + one lerp.
    const now = new Date();
    let h =
      now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    // If we're before the first key, advance into the wrapped range
    if (h < colorKeys[0]!.h) h += 24;
    for (let i = 0; i < colorKeys.length - 1; i++) {
      const a = colorKeys[i]!;
      const b = colorKeys[i + 1]!;
      if (h >= a.h && h < b.h) {
        const u = (h - a.h) / (b.h - a.h);
        const e = u * u * (3 - 2 * u); // smoothstep
        colorScratch.copy(a.c).lerp(b.c, e);
        uniforms.uColor.value.copy(colorScratch);
        break;
      }
    }
  });

  return (
    <mesh rotation={[-1.15, 0, 0]} position={[0, -3.2, 0]}>
      <planeGeometry args={[90, 50, 140, 80]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        wireframe
        transparent
      />
    </mesh>
  );
}

interface MeshBackgroundProps {
  /** Wire opacity, 0–1. Applied to the full mesh layer as a CSS variable. */
  intensity?: number | undefined;
  /**
   * When true, freezes the animation (frameloop="demand"). The OS-level
   * prefers-reduced-motion media query is also respected — this prop
   * lets in-app settings ADD reduced motion, never remove it.
   */
  reducedMotion?: boolean | undefined;
}

export function MeshBackground({
  intensity = 0.4,
  reducedMotion = false,
}: MeshBackgroundProps) {
  // OS-level preference is the strongest signal. The user setting can
  // only add reduced-motion, never override OS-level preference.
  const osReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const effectiveReduced = reducedMotion || osReducedMotion;

  // Pause rendering when the tab is hidden — saves battery, especially
  // because this lives on every new-tab page open.
  const [active, setActive] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      className="mesh-background"
      aria-hidden="true"
      style={{ "--mesh-intensity": intensity } as React.CSSProperties}
    >
      <Canvas
        camera={{ position: [0, 0, 11], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={effectiveReduced || !active ? "demand" : "always"}
      >
        <WarpMesh />
      </Canvas>
    </div>
  );
}
