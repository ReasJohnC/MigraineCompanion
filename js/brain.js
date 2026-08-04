import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  BEAM_DEFS,
  BEAM_SEQUENCE,
  STRUCTURES,
  getStructure,
  getSymptom,
} from './data.js';

const ACCENT = 0xff7a45;
// Cool is the instrument: an unstruck nucleus is a measurement, not a claim.
const BIO = 0x41d4c8;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const CORTEX_BASE_COLOR = new THREE.Color(0xc79b93);
const CORTEX_GYRUS_COLOR = new THREE.Color(0xe2b9ad);
const CORTEX_SULCUS_COLOR = new THREE.Color(0x85605f);
const CEREBELLUM_BASE_COLOR = new THREE.Color(0xbc8e88);
const CEREBELLUM_RIDGE_COLOR = new THREE.Color(0xd7aba1);
const CEREBELLUM_GROOVE_COLOR = new THREE.Color(0x765554);

const CORE_MARKERS = [
  { label: 'Thalamus', position: [-0.05, 0.02, 0] },
  { label: 'Hypothalamus', position: [0.05, -0.16, 0] },
  { label: 'Pineal', position: [-0.28, 0.05, 0] },
];

// Where the camera goes when a single structure is selected, overriding the section's
// own keyframe until the selection clears.
const CAMERA_PRESETS = {
  'lateral-tuberal': {
    position: [1.62, 0.66, 1.89],
    target: [0.06, -0.18, 0.04],
  },
  paraventricular: {
    position: [1.4, 0.82, 1.93],
    target: [0.03, -0.11, 0.02],
  },
  suprachiasmatic: {
    position: [1.7, 0.64, 1.78],
    target: [0.13, -0.22, 0.02],
  },
  pineal: {
    position: [1.52, 1.04, 2.16],
    target: [-0.26, 0.04, 0],
  },
};

// One keyframe per section, in document order. The camera is never cut between them: it
// runs a spline through this list as the reader scrolls, so the whole page is one move
// through one specimen.
const STAGE_KEYFRAMES = {
  hero: {
    position: [2.06, 0.78, 2.64],
    target: [0, 0, 0],
    fov: 34,
  },
  'prodrome-zone': {
    position: [1.97, 1.04, 2.41],
    target: [-0.08, -0.07, 0],
    fov: 38,
    zone: true,
    labels: true,
  },
  simulator: {
    position: [1.8, 0.87, 2.18],
    target: [0.01, -0.12, 0.02],
    fov: 36,
  },
  structures: {
    position: [1.72, 0.8, 2.05],
    target: [0.01, -0.12, 0.02],
    fov: 36,
  },
  'pineal-body': {
    position: [1.15, 0.85, 1.9],
    target: [-0.26, 0.04, 0],
    fov: 34,
  },
  // Looking down the axis that opens the fan widest. Measured over every pair of beams,
  // the tightest apparent separation is 33.0° from here against 0.9° from the old 3/4
  // view, where four of the five lines collapsed into one bundle. This changes the
  // viewpoint, never the vectors — see plan §C3.4.
  'angles-of-force': {
    position: [1.24, 2.18, 0.78],
    target: [-0.02, -0.08, 0],
    fov: 40,
  },
};

export const STAGE_ORDER = [
  'hero',
  'prodrome-zone',
  'simulator',
  'structures',
  'pineal-body',
  'angles-of-force',
];

const STAGE_POSITION_CURVE = new THREE.CatmullRomCurve3(
  STAGE_ORDER.map((id) => new THREE.Vector3(...STAGE_KEYFRAMES[id].position)),
);
const STAGE_TARGET_CURVE = new THREE.CatmullRomCurve3(
  STAGE_ORDER.map((id) => new THREE.Vector3(...STAGE_KEYFRAMES[id].target)),
);

function lerpKeyframeFov(u) {
  const lower = Math.max(0, Math.min(STAGE_ORDER.length - 1, Math.floor(u)));
  const upper = Math.min(STAGE_ORDER.length - 1, lower + 1);
  const a = STAGE_KEYFRAMES[STAGE_ORDER[lower]].fov ?? 38;
  const b = STAGE_KEYFRAMES[STAGE_ORDER[upper]].fov ?? 38;
  return a + (b - a) * clamp(u - lower, 0, 1);
}

// How long the rig stays out of the way after the reader stops turning the model.
const USER_CONTROL_HOLD = 2600;

// An ellipsoid fitted inside the displaced cerebrum's measured bounds (x -1.13..1.19,
// y -0.59..0.84, z -0.64..0.68), so any point on it is under the cortical surface rather
// than in open air. It bounds where the cursor may travel and marks where the force
// crosses into the tissue.
const CORTEX_HULL_CENTER = new THREE.Vector3(0.02, 0.06, 0);
const CORTEX_HULL_RADII = new THREE.Vector3(1.1, 0.68, 0.6);

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

// Where a beam crosses the cortical hull, as progress along its full length. Returns
// null for a line that misses the hull entirely, which no configured beam does.
function hullCrossings(source, travel, fullLength) {
  const origin = source.clone().sub(CORTEX_HULL_CENTER).divide(CORTEX_HULL_RADII);
  const direction = travel.clone().multiplyScalar(fullLength).divide(CORTEX_HULL_RADII);

  const a = direction.dot(direction);
  const b = 2 * origin.dot(direction);
  const c = origin.dot(origin) - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return null;

  const root = Math.sqrt(discriminant);
  return { entry: (-b - root) / (2 * a), exit: (-b + root) / (2 * a) };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const BEAM_TRAVEL_IN = 620;
const BEAM_DWELL = 460;
const BEAM_TRAVEL_OUT = 620;
export const BEAM_DURATION = BEAM_TRAVEL_IN + BEAM_DWELL + BEAM_TRAVEL_OUT;

// Progress 0.5 is the structure itself, so the cursor holds there while the
// reader takes in the label that has just appeared.
function beamTimeline(elapsed) {
  if (elapsed < BEAM_TRAVEL_IN) {
    return { progress: easeInOutCubic(elapsed / BEAM_TRAVEL_IN) * 0.5, crossed: false };
  }
  if (elapsed < BEAM_TRAVEL_IN + BEAM_DWELL) {
    return { progress: 0.5, crossed: true };
  }
  const t = clamp((elapsed - BEAM_TRAVEL_IN - BEAM_DWELL) / BEAM_TRAVEL_OUT);
  return { progress: 0.5 + easeInOutCubic(t) * 0.5, crossed: true };
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fadeNoise(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function fract(value) {
  return value - Math.floor(value);
}

function hashNoise3(x, y, z) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123);
}

function valueNoise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fadeNoise(fx);
  const uy = fadeNoise(fy);
  const uz = fadeNoise(fz);

  const x00 = lerp(hashNoise3(ix, iy, iz), hashNoise3(ix + 1, iy, iz), ux);
  const x10 = lerp(hashNoise3(ix, iy + 1, iz), hashNoise3(ix + 1, iy + 1, iz), ux);
  const x01 = lerp(hashNoise3(ix, iy, iz + 1), hashNoise3(ix + 1, iy, iz + 1), ux);
  const x11 = lerp(hashNoise3(ix, iy + 1, iz + 1), hashNoise3(ix + 1, iy + 1, iz + 1), ux);
  const y0 = lerp(x00, x10, uy);
  const y1 = lerp(x01, x11, uy);
  return lerp(y0, y1, uz);
}

function fbmNoise3(x, y, z, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;

  for (let i = 0; i < octaves; i += 1) {
    value += valueNoise3(x * frequency, y * frequency, z * frequency) * amplitude;
    normalizer += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }

  return value / normalizer;
}

function ridgedNoise3(x, y, z, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalizer = 0;

  for (let i = 0; i < octaves; i += 1) {
    const noise = valueNoise3(x * frequency, y * frequency, z * frequency);
    value += (1 - Math.abs(noise * 2 - 1)) * amplitude;
    normalizer += amplitude;
    amplitude *= 0.52;
    frequency *= 2.12;
  }

  return value / normalizer;
}

function vectorFromArray(value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function makeTissueMaterial(color, opacity, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: options.roughness ?? 0.72,
    metalness: 0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    vertexColors: options.vertexColors ?? false,
    depthWrite: false,
    side: options.side ?? THREE.DoubleSide,
  });
}

function makeLineMaterial(color, opacity) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

function writeColor(colors, index, color) {
  const offset = index * 3;
  colors[offset] = color.r;
  colors[offset + 1] = color.g;
  colors[offset + 2] = color.b;
}

// The cortex is built in two halves. The CPU shapes the silhouette — lobes, temporal
// bulge, midline fissure, flattened base — because that geometry was tuned against the
// author's coordinates and must not drift. The sulci are a displacement field evaluated
// per vertex on the GPU, so the mesh carries a sixth of the triangles it used to and its
// normals come from the field's own gradient rather than computeVertexNormals(), which is
// what produced the visible facets and the wedge-shaped banding across the surface.
const CORTEX_NOISE_GLSL = /* glsl */ `
  float mcHash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
  }

  float mcValueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(
        mix(mcHash(i), mcHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(mcHash(i + vec3(0.0, 1.0, 0.0)), mcHash(i + vec3(1.0, 1.0, 0.0)), f.x),
        f.y
      ),
      mix(
        mix(mcHash(i + vec3(0.0, 0.0, 1.0)), mcHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(mcHash(i + vec3(0.0, 1.0, 1.0)), mcHash(i + vec3(1.0, 1.0, 1.0)), f.x),
        f.y
      ),
      f.z
    );
  }

  float mcFbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float norm = 0.0;
    for (int i = 0; i < 3; i += 1) {
      value += mcValueNoise(p) * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
      p *= 2.03;
    }
    return value / norm;
  }

  // Warped sine bands crossed with cellular noise: gyri that wander rather than stripe.
  float mcFold(vec3 p) {
    float warpA = mcFbm(p * 1.5 + vec3(6.3, -3.7, 9.1)) - 0.5;
    float warpB = mcFbm(p * 1.8 + vec3(-8.4, 12.8, -4.2)) - 0.5;
    float a = sin(p.x * 4.3 + p.y * 7.2 + p.z * 1.5 + warpA * 3.1);
    float b = sin(p.x * -3.1 + p.y * 2.2 + p.z * 7.8 + warpB * 2.8);
    float c = sin(p.x * 1.9 + p.y * 8.6 - p.z * 2.9 + (warpA + warpB) * 2.1);
    float bands = max(max(1.0 - a * a, 1.0 - b * b), 1.0 - c * c);
    return clamp(bands * 0.66 + mcFbm(p * 3.1 + vec3(2.7, -5.1, 1.6)) * 0.34, 0.0, 1.0);
  }

  // Signed height of the cortical surface above its smooth base.
  float mcRelief(vec3 p) {
    float fold = mcFold(p);
    float ridge = smoothstep(0.4, 0.92, fold);
    float groove = 1.0 - smoothstep(0.12, 0.62, fold);
    float mask = 1.0 - smoothstep(0.5, 0.96, -p.y);
    return (ridge * 0.07 - groove * 0.082) * mask;
  }
`;

// The cortex reads as a scan shell rather than a solid: near-transparent face-on so the
// deep structures are actually visible — the original "you must be able to see inside"
// requirement, which a 0.72-opacity solid never met — and bright at grazing angles, where
// the silhouette does the describing. A slow drift of contour lines over the relief field
// says "surface being measured" using the real geometry rather than decoration.
function createCortexMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xc8a79d,
    roughness: 0.58,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vRelief;
         varying vec3 vSmoothNormal;
         ${CORTEX_NOISE_GLSL}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
         float relief = mcRelief(position);
         vRelief = relief;
         vSmoothNormal = normalize(normalMatrix * objectNormal);
         // Gradient of the relief field, tetrahedral taps. Subtracting its tangential
         // part from the base normal gives the true surface normal analytically, so the
         // shading has no facets to show.
         const float e = 0.045;
         vec2 k = vec2(1.0, -1.0);
         vec3 grad = (
           k.xyy * mcRelief(position + k.xyy * e) +
           k.yyx * mcRelief(position + k.yyx * e) +
           k.yxy * mcRelief(position + k.yxy * e) +
           k.xxx * mcRelief(position + k.xxx * e)
         ) / (4.0 * e);
         objectNormal = normalize(objectNormal - (grad - dot(grad, objectNormal) * objectNormal));`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         transformed += normal * relief;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime;
         varying float vRelief;
         varying vec3 vSmoothNormal;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float facing = abs(dot(normalize(vSmoothNormal), normalize(vViewPosition)));
         float fresnel = pow(1.0 - facing, 2.4);
         // Contour bands on the relief field, drifting slowly.
         float contour = abs(fract(vRelief * 19.0 - uTime * 0.05) - 0.5) * 2.0;
         float isoline = (1.0 - smoothstep(0.0, 0.4, contour)) * 0.4;
         gl_FragColor.rgb += vec3(0.24, 0.62, 0.6) * isoline * (0.4 + fresnel);
         gl_FragColor.rgb += vec3(1.0, 0.74, 0.62) * pow(fresnel, 1.6) * 0.62;
         gl_FragColor.a *= mix(0.17, 0.95, fresnel) + isoline * 0.2;`,
      );

    material.userData.shader = shader;
  };

  return material;
}

// Deep tissue seen through the shell: warm forward scattering, a cool ambient wrap and a
// soft rim, so the thalamus and its neighbours read as bodies with volume rather than as
// stickers pasted onto the surface.
function createDeepTissueMaterial(color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.52,
    metalness: 0,
    transparent: true,
    opacity: options.opacity ?? 0.92,
    emissive: options.emissive ?? 0x2a1410,
    emissiveIntensity: options.emissiveIntensity ?? 0.35,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float facing = abs(dot(normalize(vNormal), normalize(vViewPosition)));
       float rim = pow(1.0 - facing, 3.0);
       gl_FragColor.rgb += vec3(0.45, 0.72, 0.78) * rim * 0.55;
       gl_FragColor.a = min(1.0, gl_FragColor.a + rim * 0.25);`,
    );
  };

  return material;
}

// The force, as an instrument trace rather than a plastic tube. Brightness peaks along
// the tube's centre line instead of its silhouette, so it reads as a filament with a soft
// edge; a gaussian travelling along the length is the charge propagating, and it vanishes
// when nothing is in flight.
function createBeamMaterial({ color, width, intensity }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uHot: { value: new THREE.Color(0xffd9a8) },
      uWidth: { value: width },
      uIntensity: { value: intensity },
      // Position of the travelling pulse along the beam, or below zero for none.
      uPulse: { value: -1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHot;
      uniform float uWidth;
      uniform float uIntensity;
      uniform float uPulse;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;

      void main() {
        // Facing the camera is the middle of the tube; grazing is its edge.
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float core = pow(facing, uWidth);
        float glow = pow(facing, uWidth * 0.22) * 0.35;

        float pulse = 0.0;
        if (uPulse >= 0.0) {
          float d = (vUv.y - uPulse) * 13.0;
          pulse = exp(-d * d);
          // A short wake trailing the front, never ahead of it.
          pulse += exp(-abs(d) * 2.6) * step(vUv.y, uPulse) * 0.4;
        }

        vec3 tint = mix(uColor, uHot, min(1.0, core * 0.55 + pulse));
        float alpha = (core + glow) * uIntensity + pulse * 0.85;
        if (alpha <= 0.001) discard;
        gl_FragColor = vec4(tint, min(1.0, alpha));
      }
    `,
  });
}

// Both caches hand out clones and never the cached object itself, so a scene disposing
// its own geometry cannot take the shared original down with it.
let cerebrumGeoCache = null;
function createCerebrumGeometry() {
  if (cerebrumGeoCache) return cerebrumGeoCache.clone();
  // 33,620 triangles against the old 74,420: enough that the contour bands span several
  // of them rather than breaking along their edges, at less than half the cost.
  const geometry = new THREE.IcosahedronGeometry(1, 40);
  const position = geometry.attributes.position;
  const unit = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    unit.fromBufferAttribute(position, i).normalize();
    const x = unit.x;
    const y = unit.y;
    const z = unit.z;
    const absX = Math.abs(x);
    const absZ = Math.abs(z);
    const frontalPole = smoothstep(0.1, 0.92, x);
    const occipitalPole = smoothstep(0.12, 0.92, -x);
    const inferior = smoothstep(0.2, 0.96, -y);
    const dorsal = smoothstep(-0.35, 0.82, y);
    const lateral = smoothstep(0.22, 0.86, absZ);
    const temporalLobe = smoothstep(0.08, 0.82, -y) * lateral * (1 - smoothstep(0.48, 0.9, absX));

    const radiusX = 1.03 + frontalPole * 0.09 + occipitalPole * 0.045 - inferior * 0.018;
    const radiusY = 0.72 + smoothstep(0.18, 0.9, y) * 0.03 - inferior * 0.095;
    const radiusZ = 0.58 + temporalLobe * 0.11 + frontalPole * 0.025 + occipitalPole * 0.018;

    let px = x * radiusX;
    let py = y * radiusY - temporalLobe * 0.052;
    let pz = z * radiusZ * (1 + temporalLobe * 0.05);

    const fissure =
      (1 - smoothstep(0.012, 0.15, absZ)) *
      dorsal *
      (1 - smoothstep(0.84, 1, absX));
    py -= fissure * 0.13;
    pz += (z >= 0 ? 1 : -1) * fissure * 0.026;

    const baseFloor = -0.62 + smoothstep(0.2, 0.94, absX) * 0.035 + lateral * 0.025;
    if (py < baseFloor) {
      py = baseFloor + (py - baseFloor) * 0.2;
    }

    position.setXYZ(i, px, py, pz);
  }

  // IcosahedronGeometry is non-indexed: every triangle owns its three corners, so
  // computeVertexNormals() hands each vertex its own face's normal. Displacing along
  // those in the shader pushes neighbouring triangles apart and the mesh splits open
  // along every edge — the dark lattice that read as a wireframe over the cortex.
  // Merging the duplicates first gives shared vertices, smooth normals, and a surface
  // the relief field can lift without tearing.
  const merged = mergeVertices(geometry);
  geometry.dispose();
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  cerebrumGeoCache = merged;
  return merged.clone();
}

let cerebellumGeoCache = null;
function createCerebellumGeometry() {
  if (cerebellumGeoCache) return cerebellumGeoCache.clone();
  const geometry = new THREE.IcosahedronGeometry(1, 36);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const unit = new THREE.Vector3();
  const color = new THREE.Color();
  const vertexCache = new Map();

  for (let i = 0; i < position.count; i += 1) {
    const originalX = position.getX(i);
    const originalY = position.getY(i);
    const originalZ = position.getZ(i);
    const cacheKey = `${originalX.toFixed(5)}:${originalY.toFixed(5)}:${originalZ.toFixed(5)}`;
    const cached = vertexCache.get(cacheKey);

    if (cached) {
      position.setXYZ(i, cached[0], cached[1], cached[2]);
      colors[i * 3] = cached[3];
      colors[i * 3 + 1] = cached[4];
      colors[i * 3 + 2] = cached[5];
      continue;
    }

    unit.fromBufferAttribute(position, i).normalize();
    const x = unit.x;
    const y = unit.y;
    const z = unit.z;
    const warp = fbmNoise3(x * 3.1 + 5.1, y * 2.1 - 1.7, z * 3.3 + 9.4, 3) - 0.5;
    const folia = Math.sin((y + 1.08) * 53 + warp * 2.5 + x * 0.8);
    const ridge = smoothstep(0.12, 0.95, folia);
    const groove = smoothstep(0.3, 0.98, -folia);
    const vermis = (1 - smoothstep(0.04, 0.32, Math.abs(z))) * smoothstep(-0.72, 0.78, y);
    const displacement =
      ridge * 0.026 -
      groove * 0.046 +
      vermis * 0.014 +
      (fbmNoise3(x * 8.5 - 1.1, y * 8.1 + 2.4, z * 7.7 + 3.2, 2) - 0.5) * 0.008;

    position.setXYZ(i, x * (1 + displacement), y * (1 + displacement * 0.55), z * (1 + displacement));

    color.copy(CEREBELLUM_BASE_COLOR).lerp(CEREBELLUM_RIDGE_COLOR, ridge * 0.42);
    color.lerp(CEREBELLUM_GROOVE_COLOR, groove * 0.68);
    writeColor(colors, i, color);
    vertexCache.set(cacheKey, [
      x * (1 + displacement),
      y * (1 + displacement * 0.55),
      z * (1 + displacement),
      color.r,
      color.g,
      color.b,
    ]);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const merged = mergeVertices(geometry);
  geometry.dispose();
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  cerebellumGeoCache = merged;
  return merged.clone();
}

function createBrainstemGeometry() {
  const profile = [
    new THREE.Vector2(0, -0.43),
    new THREE.Vector2(0.058, -0.42),
    new THREE.Vector2(0.076, -0.34),
    new THREE.Vector2(0.09, -0.24),
    new THREE.Vector2(0.15, -0.12),
    new THREE.Vector2(0.18, -0.02),
    new THREE.Vector2(0.158, 0.08),
    new THREE.Vector2(0.12, 0.2),
    new THREE.Vector2(0.092, 0.31),
    new THREE.Vector2(0, 0.36),
  ];
  const geometry = new THREE.LatheGeometry(profile, 48);
  geometry.computeVertexNormals();
  return geometry;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

export class BrainScene {
  constructor(container, options = {}) {
    this.container = container;
    this.stage = 'hero';
    this.reducedMotion = Boolean(options.reducedMotion);
    this.activeIds = [];
    this.frameRect = null;
    this.rigPose = null;
    this.focusPose = null;
    this.delta = 0.016;
    this.sequenceToken = 0;
    this.markers = new Map();
    this.beams = new Map();
    this.beamAnimations = new Map();
    this.labels = [];
    this.tmpVector = new THREE.Vector3();

    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(0x05070d, 2.2, 6.4);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);
    this.container.querySelector('.brain-loading')?.remove();

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'brain-label-layer';
    this.container.appendChild(this.labelLayer);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.createLights();
    this.createBrain();
    this.createCoreStructures();
    this.createInteractiveMarkers();
    this.createBeams();
    this.createOverviewLabels();

    // Pointer events arrive on a separate element tracking the active stage window: the
    // canvas itself is behind the whole document and must not swallow scrolls or clicks.
    this.controls = new OrbitControls(this.camera, options.hitArea ?? this.renderer.domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    // Framing pushes the camera back so the model reads at its window's size rather than
    // the viewport's, so the usable range is much wider than it was inside a stage box.
    this.controls.minDistance = 0.9;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.86;
    this.controls.minPolarAngle = Math.PI * 0.1;

    // While the reader is turning the model themselves the rig stops writing the camera,
    // and eases back only once they have let go and settled.
    this.userControlUntil = 0;
    this.controls.addEventListener('start', () => {
      this.userControlUntil = Infinity;
    });
    this.controls.addEventListener('end', () => {
      this.userControlUntil = performance.now() + USER_CONTROL_HOLD;
    });

    this.handleKey = this.handleKey.bind(this);
    this.render = this.render.bind(this);
    this.updateRunState = this.updateRunState.bind(this);

    // Every stage window drives the same camera; whichever one has focus can turn it.
    this.keyTargets = Array.from(document.querySelectorAll('[data-brain]'));
    this.keyTargets.forEach((element) => element.addEventListener('keydown', this.handleKey));

    this.setStage('hero', { immediate: true });
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.running = false;
    document.addEventListener('visibilitychange', this.updateRunState);
    this.updateRunState();
  }

  updateRunState() {
    // The one canvas is on screen for the whole document, so only tab visibility can
    // pause it.
    const shouldRun = document.visibilityState !== 'hidden';
    if (shouldRun && !this.running) {
      this.running = true;
      this.frame = requestAnimationFrame(this.render);
    } else if (!shouldRun && this.running) {
      this.running = false;
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      }
    }
  }

  // --- camera rig ----------------------------------------------------------
  // The rig holds the pose the camera is heading for. Scroll moves it along a spline
  // through the stage keyframes; a selection can pull it to a structure; the render loop
  // eases the real camera toward it. Nothing jump-cuts.

  // Handing the model to a different section: it drops whatever the previous section had
  // lit, and that section's own handler re-applies its state.
  setStage(id, { immediate = false } = {}) {
    const keyframe = STAGE_KEYFRAMES[id] ?? STAGE_KEYFRAMES.hero;
    this.stage = id;
    this.focusPose = null;
    this.zone.visible = Boolean(keyframe.zone);
    this.labelLayer.hidden = !keyframe.labels;
    this.clearActive();
    this.setRigPose(keyframe, immediate);
  }

  setRigPose(pose, immediate = false) {
    this.rigPose = {
      position: vectorFromArray(pose.position),
      target: vectorFromArray(pose.target),
      fov: pose.fov ?? 38,
    };
    if (immediate || this.reducedMotion) this.snapToRig();
  }

  // Scroll position between two stages, as a float index into STAGE_ORDER. The camera
  // follows a Catmull-Rom spline through the keyframes rather than crossfading views.
  setScrollProgress(u) {
    if (this.focusPose) return;
    const span = STAGE_ORDER.length - 1;
    const t = clamp(u / span, 0, 1);
    this.rigPose = {
      position: STAGE_POSITION_CURVE.getPoint(t),
      target: STAGE_TARGET_CURVE.getPoint(t),
      fov: lerpKeyframeFov(u),
    };
    if (this.reducedMotion) this.snapToRig();
  }

  // A selection pulls the camera to its structure and holds it there until cleared.
  setFocus(structureId) {
    const preset = CAMERA_PRESETS[structureId];
    if (!preset) return;
    this.focusPose = true;
    this.setRigPose({ ...preset, fov: 34 });
  }

  // Holds a section's own keyframe against further scrolling. The capstone needs this:
  // its framing is what makes five angles read as five lines, and it must not depend on
  // the reader happening to have that section exactly centred.
  focusStage(id) {
    const keyframe = STAGE_KEYFRAMES[id];
    if (!keyframe) return;
    this.focusPose = true;
    this.setRigPose(keyframe);
  }

  // Releases the camera back to the section's framing without disturbing what is lit.
  clearFocus() {
    this.focusPose = null;
    this.setRigPose(STAGE_KEYFRAMES[this.stage] ?? STAGE_KEYFRAMES.hero);
  }

  // The viewport rect the model should appear inside, in CSS pixels. The camera is
  // offset so the model lands in that rect rather than in the middle of the screen.
  setFrameRect(rect) {
    this.frameRect = rect;
  }

  framedPose(position, target) {
    const rect = this.frameRect;
    if (!rect || !rect.height) return { position, target };

    const width = window.innerWidth;
    const height = window.innerHeight;
    // Push back so the model reads at the window's size, not the viewport's.
    const fit = clamp(height / rect.height, 1, 2.6);
    const framedPosition = target.clone().add(position.clone().sub(target).multiplyScalar(fit));

    const distance = framedPosition.distanceTo(target);
    const worldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const worldWidth = worldHeight * this.camera.aspect;
    const ndcX = ((rect.left + rect.width / 2) / width) * 2 - 1;
    const ndcY = -((((rect.top + rect.height / 2) / height) * 2) - 1);

    const forward = target.clone().sub(framedPosition).normalize();
    const right = forward.clone().cross(this.camera.up).normalize();
    const up = right.clone().cross(forward).normalize();
    const shift = right
      .multiplyScalar((-ndcX * worldWidth) / 2)
      .add(up.multiplyScalar((-ndcY * worldHeight) / 2));

    return { position: framedPosition.add(shift), target: target.clone().add(shift) };
  }

  snapToRig() {
    if (!this.rigPose) return;
    this.camera.fov = this.rigPose.fov;
    const { position, target } = this.framedPose(this.rigPose.position, this.rigPose.target);
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
    this.controls.update();
  }

  updateRig(now) {
    if (!this.rigPose || now < this.userControlUntil) return;
    const { position, target } = this.framedPose(this.rigPose.position, this.rigPose.target);
    // Frame-rate independent easing toward the rig pose.
    const ease = 1 - Math.pow(0.0016, this.delta);
    this.camera.position.lerp(position, ease);
    this.controls.target.lerp(target, ease);
    this.camera.fov += (this.rigPose.fov - this.camera.fov) * ease;
    this.camera.updateProjectionMatrix();
  }

  createLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff8f3, 0xc9c1c5, 2.2));

    const key = new THREE.DirectionalLight(0xfff2e8, 2.35);
    key.position.set(2.4, 3.3, 2.6);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xf0d7d0, 0.86);
    fill.position.set(-1.8, 0.8, 1.6);
    this.scene.add(fill);

    const back = new THREE.DirectionalLight(0xffffff, 1.15);
    back.position.set(-2.2, 1.5, -1.35);
    this.scene.add(back);
  }

  createBrain() {
    const cortexMaterial = createCortexMaterial();
    this.cortexMaterial = cortexMaterial;
    const cerebellumMaterial = makeTissueMaterial(0xffffff, 0.59, {
      roughness: 0.86,
      vertexColors: true,
    });
    const brainstemMaterial = makeTissueMaterial(0xb98a84, 0.6, {
      roughness: 0.72,
    });
    const innerMaterial = makeTissueMaterial(0x8e686d, 0.34, {
      roughness: 0.78,
    });

    const cerebrum = new THREE.Mesh(createCerebrumGeometry(), cortexMaterial);
    cerebrum.position.set(0, 0.03, 0);
    cerebrum.renderOrder = 1;
    this.root.add(cerebrum);

    const cerebellum = new THREE.Mesh(createCerebellumGeometry(), cerebellumMaterial);
    cerebellum.scale.set(0.42, 0.23, 0.32);
    cerebellum.position.set(-0.72, -0.41, -0.03);
    cerebellum.renderOrder = 1;
    this.root.add(cerebellum);

    const brainstem = new THREE.Mesh(createBrainstemGeometry(), brainstemMaterial);
    brainstem.position.set(-0.04, -0.62, 0);
    brainstem.rotation.z = -0.08;
    brainstem.renderOrder = 1;
    this.root.add(brainstem);

    // The longitudinal fissure is cut into the cortical displacement field (see the
    // `fissure` term in createCerebrumGeometry) rather than drawn as an object on top.

    const ventricle = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), innerMaterial);
    ventricle.scale.set(0.12, 0.22, 0.05);
    ventricle.position.set(-0.02, -0.06, 0.015);
    ventricle.renderOrder = 4;
    this.root.add(ventricle);

    this.zone = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffc3a3,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.zone.scale.set(0.52, 0.36, 0.25);
    this.zone.position.set(-0.07, -0.04, 0);
    this.zone.renderOrder = 2;
    this.root.add(this.zone);
  }

  createCoreStructures() {
    const thalamusMaterial = makeTissueMaterial(0xb77d78, 0.76, {
      roughness: 0.68,
    });
    const thalamus = new THREE.Group();
    thalamus.position.set(-0.05, 0.02, 0);

    [-0.055, 0.055].forEach((zOffset) => {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), thalamusMaterial.clone());
      lobe.scale.set(0.19, 0.14, 0.09);
      lobe.position.set(0, 0, zOffset);
      lobe.renderOrder = 5;
      thalamus.add(lobe);
    });

    const thalamicBridge = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), thalamusMaterial.clone());
    thalamicBridge.scale.set(0.09, 0.07, 0.05);
    thalamicBridge.renderOrder = 5;
    thalamus.add(thalamicBridge);
    this.root.add(thalamus);

    const hypothalamusMaterial = makeTissueMaterial(0xc0877d, 0.78, {
      roughness: 0.66,
    });
    const hypothalamus = new THREE.Group();
    hypothalamus.position.set(0.05, -0.16, 0);

    const hypothalamusBody = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 18), hypothalamusMaterial);
    hypothalamusBody.scale.set(0.16, 0.095, 0.085);
    hypothalamusBody.renderOrder = 5;
    hypothalamus.add(hypothalamusBody);

    const infundibulum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.041, 0.13, 28, 4, true),
      hypothalamusMaterial.clone(),
    );
    infundibulum.position.set(0.018, -0.088, 0);
    infundibulum.rotation.z = -0.08;
    infundibulum.renderOrder = 5;
    hypothalamus.add(infundibulum);
    this.root.add(hypothalamus);

    const pinealMaterial = makeTissueMaterial(0xc98f82, 0.82, {
      roughness: 0.62,
      emissive: 0x4b201c,
      emissiveIntensity: 0.1,
    });
    const pineal = new THREE.Group();
    pineal.position.set(-0.28, 0.05, 0);

    const pinealBody = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), pinealMaterial);
    pinealBody.scale.set(0.052, 0.04, 0.042);
    pinealBody.renderOrder = 6;
    pineal.add(pinealBody);

    const pinealTaper = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.068, 32, 1, true), pinealMaterial.clone());
    pinealTaper.position.set(-0.036, 0, 0);
    pinealTaper.rotation.z = Math.PI / 2;
    pinealTaper.renderOrder = 6;
    pineal.add(pinealTaper);
    this.root.add(pineal);
  }

  createInteractiveMarkers() {
    const coreGeometry = new THREE.SphereGeometry(0.02, 24, 12);
    const shellGeometry = new THREE.SphereGeometry(0.062, 24, 12);

    STRUCTURES.forEach((structure) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(vectorFromArray(structure.position));

      const coreMaterial = new THREE.MeshBasicMaterial({
        color: BIO,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        fog: false,
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.renderOrder = 10;
      markerGroup.add(core);

      const shellMaterial = new THREE.MeshBasicMaterial({
        color: BIO,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const shell = new THREE.Mesh(shellGeometry, shellMaterial);
      shell.renderOrder = 9;
      markerGroup.add(shell);

      this.root.add(markerGroup);
      this.markers.set(structure.id, {
        group: markerGroup,
        core,
        shell,
        coreMaterial,
        shellMaterial,
        active: false,
      });
    });
  }

  createBeams() {
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
    const flareGeometry = new THREE.SphereGeometry(0.06, 24, 12);
    const ringGeometry = new THREE.RingGeometry(0.86, 1, 48);

    BEAM_DEFS.forEach((symptom) => {
      const structure = getStructure(symptom.structureId);
      if (!structure) return;

      const target = vectorFromArray(structure.position);
      const sourceAxis = vectorFromArray(symptom.beamDir).normalize();
      const source = target.clone().add(sourceAxis.clone().multiplyScalar(1.52));
      const travel = sourceAxis.clone().multiplyScalar(-1).normalize();
      const fullLength = 3.04;
      const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, travel);
      const crossings = hullCrossings(source, travel, fullLength);

      const group = new THREE.Group();
      group.visible = false;

      // The line never changes length; because its midpoint is the target, the pulse
      // travelling 0 to 1 crosses the structure at exactly 0.5.
      const haloMaterial = createBeamMaterial({ color: ACCENT, width: 1.1, intensity: 0.16 });
      const halo = new THREE.Mesh(beamGeometry, haloMaterial);
      halo.position.copy(target);
      halo.quaternion.copy(quaternion);
      halo.scale.set(0.05, fullLength, 0.05);
      halo.renderOrder = 11;
      group.add(halo);

      const coreMaterial = createBeamMaterial({ color: ACCENT, width: 5.5, intensity: 0.9 });
      const core = new THREE.Mesh(beamGeometry, coreMaterial);
      core.position.copy(target);
      core.quaternion.copy(quaternion);
      core.scale.set(0.016, fullLength, 0.016);
      core.renderOrder = 12;
      group.add(core);

      // Where the force crosses into the tissue. Without this the entry happens off
      // screen and "the force enters from outside" is a claim the picture never shows.
      const entryMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd9a8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const entryRing = new THREE.Mesh(ringGeometry, entryMaterial);
      entryRing.position.copy(
        source.clone().add(travel.clone().multiplyScalar(fullLength * (crossings?.entry ?? 0.35))),
      );
      entryRing.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), travel));
      entryRing.scale.setScalar(0.14);
      entryRing.renderOrder = 13;
      group.add(entryRing);

      const flareMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd9a8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const flare = new THREE.Mesh(flareGeometry, flareMaterial);
      flare.position.copy(target);
      flare.renderOrder = 14;
      group.add(flare);

      // A shockwave expanding from the struck nucleus, timed to the readout line.
      const shockMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      const shock = new THREE.Mesh(ringGeometry, shockMaterial);
      shock.position.copy(target);
      shock.renderOrder = 15;
      group.add(shock);

      this.root.add(group);
      this.beams.set(symptom.id, {
        group,
        source,
        travel,
        fullLength,
        target,
        // The structure sits at 0.5 by construction; travel stops at the far surface.
        entryProgress: crossings?.entry ?? 0,
        exitProgress: crossings?.exit ?? 1,
        core,
        halo,
        entryRing,
        flare,
        shock,
        coreMaterial,
        haloMaterial,
        entryMaterial,
        flareMaterial,
        shockMaterial,
      });
      this.setBeamCursor(symptom.id, 0);
    });
  }

  createOverviewLabels() {
    CORE_MARKERS.forEach((marker) => {
      const element = document.createElement('span');
      element.className = 'brain-label';
      element.dataset.label = marker.label;
      element.textContent = marker.label;
      this.labelLayer.appendChild(element);
      this.labels.push({
        element,
        position: vectorFromArray(marker.position),
      });
    });
  }

  // Keyboard orbit: the stage is a control surface, and a pointer was the only way to
  // turn the model. Arrows rotate, +/- zoom, 0 returns to the section's framing.
  handleKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const ROTATE_STEP = 0.14;
    const ZOOM_STEP = 1.12;
    const offset = this.camera.position.clone().sub(this.controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    switch (event.key) {
      case 'ArrowLeft':
        spherical.theta -= ROTATE_STEP;
        break;
      case 'ArrowRight':
        spherical.theta += ROTATE_STEP;
        break;
      case 'ArrowUp':
        spherical.phi -= ROTATE_STEP;
        break;
      case 'ArrowDown':
        spherical.phi += ROTATE_STEP;
        break;
      case '+':
      case '=':
        spherical.radius /= ZOOM_STEP;
        break;
      case '-':
      case '_':
        spherical.radius *= ZOOM_STEP;
        break;
      case '0':
        event.preventDefault();
        this.userControlUntil = 0;
        return;
      default:
        return;
    }

    event.preventDefault();
    this.userControlUntil = performance.now() + USER_CONTROL_HOLD;
    spherical.phi = clamp(spherical.phi, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    spherical.radius = clamp(
      spherical.radius,
      this.controls.minDistance,
      this.controls.maxDistance,
    );
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    if (this.controls) {
      this.controls.enableDamping = !this.reducedMotion;
    }
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    // A full-viewport canvas costs four times the pixels at DPR 2; cap it on the small
    // screens least able to pay for them.
    const cap = width < 760 ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  }

  // Every nucleus stays on screen. A struck one burns warm; the rest hold as dim cool
  // points, so the reader can see the whole neighbourhood and what the force did *not*
  // reach — which is the section's actual argument.
  setMarkerVisible(id, active) {
    const marker = this.markers.get(id);
    if (!marker) return;
    marker.active = Boolean(active);
    marker.coreMaterial.color.set(active ? 0xffd9a8 : BIO);
    marker.shellMaterial.color.set(active ? ACCENT : BIO);
    marker.coreMaterial.opacity = active ? 1 : 0.42;
    marker.core.scale.setScalar(active ? 1.5 : 1);
  }

  hideMarkers() {
    this.markers.forEach((_, id) => this.setMarkerVisible(id, false));
  }

  // A slow breath on the struck nucleus; the others sit still.
  updateMarkers(now) {
    const breath = 0.5 + 0.5 * Math.sin(now / 620);
    this.markers.forEach((marker) => {
      marker.shellMaterial.opacity = marker.active ? 0.16 + breath * 0.2 : 0.07;
      marker.shell.scale.setScalar(marker.active ? 1 + breath * 0.35 : 0.8);
    });
  }

  setBeamVisible(id, visible) {
    const beam = this.beams.get(id);
    if (!beam) return;
    beam.group.visible = visible;
    if (!visible) {
      beam.flareMaterial.opacity = 0;
      beam.entryMaterial.opacity = 0;
      beam.shockMaterial.opacity = 0;
      this.setCursorVisible(id, false);
    }
  }

  // The pulse means "the force is travelling right now". Anything else — a resolved
  // strike, the capstone fan — carries no pulse, so nothing is ever left mid-flight.
  setCursorVisible(id, visible) {
    const beam = this.beams.get(id);
    if (!beam || visible) return;
    beam.coreMaterial.uniforms.uPulse.value = -1;
    beam.haloMaterial.uniforms.uPulse.value = -1;
    beam.entryMaterial.opacity = 0;
    beam.shockMaterial.opacity = 0;
  }

  setBeamCursor(id, progress) {
    const beam = this.beams.get(id);
    if (!beam) return;

    const timeline = clamp(progress);
    // The outbound half is compressed so the pulse stops at the far cortical surface
    // instead of continuing into open air on the other side of the head.
    const travelled =
      timeline <= 0.5 ? timeline : 0.5 + (timeline - 0.5) * (beam.exitProgress - 0.5) * 2;
    beam.coreMaterial.uniforms.uPulse.value = travelled;
    beam.haloMaterial.uniforms.uPulse.value = travelled;

    // The entry ring blooms as the force crosses the cortical surface.
    const atEntry = 1 - clamp(Math.abs(travelled - beam.entryProgress) / 0.09);
    const entry = smoothstep(0, 1, atEntry);
    beam.entryMaterial.opacity = 0.85 * entry;
    beam.entryRing.scale.setScalar(0.1 + 0.13 * (1 - entry));

    // Everything brightens as the pulse passes through the structure.
    const nearness = 1 - clamp(Math.abs(timeline - 0.5) / 0.14);
    const strength = smoothstep(0, 1, nearness);
    beam.flareMaterial.opacity = 0.6 * strength;
    beam.flare.scale.setScalar(1 + 2.2 * strength);
    beam.coreMaterial.uniforms.uIntensity.value = 0.7 + 0.5 * strength;

    // The shockwave leaves the nucleus once the force has arrived, and only then.
    const wave = clamp((timeline - 0.5) / 0.3);
    beam.shockMaterial.opacity = wave > 0 ? 0.5 * (1 - wave) : 0;
    beam.shock.scale.setScalar(0.06 + wave * 0.44);
    beam.shock.quaternion.copy(this.camera.quaternion);
  }

  // The look a beam holds once the force has passed through: lit at the structure, no
  // pulse. The flare is additive and the four targets sit within about 0.3 units of each
  // other, so several at once stack into one white blob — beams shown together decay to a
  // thin trace instead, and the fan reads as distinct paths.
  setBeamResolved(id, { flare = true } = {}) {
    const beam = this.beams.get(id);
    if (!beam) return;
    this.setBeamVisible(id, true);
    this.setCursorVisible(id, false);
    beam.flareMaterial.opacity = flare ? 0.55 : 0;
    beam.flare.scale.setScalar(flare ? 2.6 : 1);
    beam.coreMaterial.uniforms.uIntensity.value = flare ? 0.85 : 0.5;
    beam.haloMaterial.uniforms.uIntensity.value = flare ? 0.16 : 0.08;
  }

  hideBeams() {
    this.beams.forEach((_, id) => {
      this.setBeamVisible(id, false);
      this.setBeamCursor(id, 0);
      this.setCursorVisible(id, false);
    });
  }

  clearActive() {
    this.activeIds = [];
    this.stopAnimations();
    this.hideMarkers();
    this.hideBeams();
  }

  stopAnimations() {
    this.beamAnimations.forEach((animation) => animation.resolve?.());
    this.beamAnimations.clear();
  }

  // One cursor pass: travel to the structure, hold there long enough for its
  // label to be read, then continue to the far side.
  startBeam(id, options = {}) {
    return new Promise((resolve) => {
      if (!this.beams.has(id)) {
        resolve();
        return;
      }
      this.setBeamVisible(id, true);
      this.setBeamCursor(id, 0);
      this.setCursorVisible(id, true);
      this.beamAnimations.set(id, {
        startedAt: performance.now() + (options.delay ?? 0),
        onCross: options.onCross,
        crossed: false,
        resolve,
      });
      this.updateRunState();
    });
  }

  tickBeams(now) {
    if (!this.beamAnimations.size) return;

    this.beamAnimations.forEach((animation, id) => {
      const elapsed = now - animation.startedAt;
      if (elapsed < 0) return;

      const { progress, crossed } = beamTimeline(elapsed);
      this.setBeamCursor(id, progress);

      if (crossed && !animation.crossed) {
        animation.crossed = true;
        animation.onCross?.(id);
      }

      if (elapsed >= BEAM_DURATION) {
        this.setBeamResolved(id, { flare: this.activeIds.length === 1 });
        this.beamAnimations.delete(id);
        animation.resolve?.();
        if (!this.beamAnimations.size) this.updateRunState();
      }
    });
  }

  revealSymptoms(ids, options = {}) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => this.beams.has(id));
    if (!list.length) {
      this.clearActive();
      return Promise.resolve();
    }

    this.sequenceToken += options.sequenceStep ? 0 : 1;
    this.stopAnimations();
    this.hideMarkers();
    this.hideBeams();
    this.activeIds = list;

    list.forEach((id) => {
      const symptom = getSymptom(id);
      if (symptom) this.setMarkerVisible(symptom.structureId, true);
    });

    const single = list.length === 1 ? getSymptom(list[0]) : null;
    if (single) this.setFocus(single.structureId);
    else this.clearFocus();

    if (this.reducedMotion || options.instant) {
      list.forEach((id) => {
        this.setBeamResolved(id, { flare: list.length === 1 });
        options.onCross?.(id);
      });
      return Promise.resolve();
    }

    // Stagger so several cursors reach their structures in reading order.
    return Promise.all(
      list.map((id, index) =>
        this.startBeam(id, { delay: index * 260, onCross: options.onCross }),
      ),
    );
  }

  // Reveals one angle on its own, with no travel. The reduced-motion capstone steps
  // through the sequence with this so "Play" and "Show all" stay different actions.
  showSingleAngle(id) {
    this.sequenceToken += 1;
    this.stopAnimations();
    this.hideMarkers();
    this.hideBeams();
    if (!this.beams.has(id)) return;

    this.activeIds = [id];
    const symptom = getSymptom(id);
    if (symptom) this.setMarkerVisible(symptom.structureId, true);
    this.setBeamResolved(id);

    if (symptom) this.setFocus(symptom.structureId);
  }

  // Invalidates the running sequence's token, so its loop stops at the next step.
  cancelSequence() {
    this.sequenceToken += 1;
    this.clearActive();
  }

  async playSequence(ids = BEAM_SEQUENCE, options = {}) {
    const token = this.sequenceToken + 1;
    this.sequenceToken = token;
    this.clearActive();

    for (const id of ids) {
      if (token !== this.sequenceToken) return false;
      await this.revealSymptoms([id], {
        sequenceStep: true,
        onCross: options.onCross,
      });
      if (token !== this.sequenceToken) return false;
      await new Promise((resolve) => window.setTimeout(resolve, 200));
    }

    return token === this.sequenceToken;
  }

  showAllBeams() {
    this.sequenceToken += 1;
    this.stopAnimations();
    this.activeIds = [...BEAM_SEQUENCE];
    this.hideMarkers();
    this.hideBeams();
    this.focusStage('angles-of-force');

    BEAM_SEQUENCE.forEach((id) => {
      const symptom = getSymptom(id);
      if (symptom) this.setMarkerVisible(symptom.structureId, true);
      this.setBeamResolved(id, { flare: false });
    });
  }

  updateLabels() {
    if (this.labelLayer.hidden) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.labels.forEach((label) => {
      this.tmpVector.copy(label.position);
      this.tmpVector.project(this.camera);
      const x = (this.tmpVector.x * 0.5 + 0.5) * width;
      const y = (-this.tmpVector.y * 0.5 + 0.5) * height;
      const visible = this.tmpVector.z < 1 && x > -40 && x < width + 40 && y > -40 && y < height + 40;

      label.element.style.left = `${x}px`;
      label.element.style.top = `${y}px`;
      label.element.style.opacity = visible ? '1' : '0';
    });
  }

  render() {
    if (!this.running) return;
    const now = performance.now();
    this.delta = Math.min(0.05, (now - (this.lastFrame ?? now - 16)) / 1000);
    this.lastFrame = now;

    const shader = this.cortexMaterial?.userData.shader;
    if (shader) shader.uniforms.uTime.value = now / 1000;

    this.tickBeams(now);
    this.updateMarkers(now);
    this.updateRig(now);
    this.controls?.update();
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  }

  destroy() {
    this.running = false;
    this.stopAnimations();
    cancelAnimationFrame(this.frame);
    this.keyTargets?.forEach((el) => el.removeEventListener('keydown', this.handleKey));
    document.removeEventListener('visibilitychange', this.updateRunState);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    disposeObject(this.root);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }
}
