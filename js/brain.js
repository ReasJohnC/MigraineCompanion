import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STRUCTURE_SEQUENCE, getStructure, getSelectableStructures } from './data.js';

const ACCENT = 0xff7a45;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const CAMERA_ZOOM = 1.16;
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

const CAMERA_PRESETS = {
  overview: {
    position: [1.7, 0.9, 2.08],
    target: [-0.08, -0.07, 0],
  },
  structures: {
    position: [1.55, 0.75, 1.88],
    target: [0.01, -0.12, 0.02],
  },
  angles: {
    position: [1.72, 0.95, 2.18],
    target: [-0.02, -0.08, 0],
  },
  'lateral-tuberal': {
    position: [1.22, 0.5, 1.42],
    target: [0.06, -0.18, 0.04],
  },
  paraventricular: {
    position: [1.05, 0.62, 1.45],
    target: [0.03, -0.11, 0.02],
  },
  suprachiasmatic: {
    position: [1.28, 0.48, 1.34],
    target: [0.13, -0.22, 0.02],
  },
  pineal: {
    position: [1.14, 0.78, 1.62],
    target: [-0.26, 0.04, 0],
  },
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

function corticalFoldSignal(x, y, z) {
  const warpA = fbmNoise3(x * 1.5 + 6.3, y * 1.7 - 3.7, z * 1.6 + 9.1, 3) - 0.5;
  const warpB = fbmNoise3(x * 1.8 - 8.4, y * 1.4 + 12.8, z * 1.7 - 4.2, 3) - 0.5;
  const bandA = Math.sin(x * 4.3 + y * 7.2 + z * 1.5 + warpA * 3.1);
  const bandB = Math.sin(x * -3.1 + y * 2.2 + z * 7.8 + warpB * 2.8);
  const bandC = Math.sin(x * 1.9 + y * 8.6 - z * 2.9 + (warpA + warpB) * 2.1);
  const foldedBands = Math.max(1 - bandA * bandA, 1 - bandB * bandB, 1 - bandC * bandC);
  const cellular = fbmNoise3(x * 3.1 + 2.7, y * 3.5 - 5.1, z * 3.3 + 1.6, 3);
  return clamp(foldedBands * 0.66 + cellular * 0.34);
}

let cerebrumGeoCache = null;
function createCerebrumGeometry() {
  if (cerebrumGeoCache) return cerebrumGeoCache.clone();
  const geometry = new THREE.IcosahedronGeometry(1, 60);
  cerebrumGeoCache = geometry;
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

    const foldMask = 1 - smoothstep(0.5, 0.96, -y);
    const fold = corticalFoldSignal(px, py, pz);
    const ridge = smoothstep(0.4, 0.92, fold);
    const groove = 1 - smoothstep(0.12, 0.62, fold);
    const fine = fbmNoise3(px * 5.4 + 3.8, py * 5.2 - 2.1, pz * 5.6 + 8.6, 2) - 0.5;
    const displacement = (ridge * 0.07 - groove * 0.082 + fine * 0.006) * foldMask;

    px += unit.x * displacement;
    py += unit.y * displacement;
    pz += unit.z * displacement;

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

    const sulcusDepth = clamp(groove * 0.76 + fissure * 0.64);
    color.copy(CORTEX_BASE_COLOR).lerp(CORTEX_GYRUS_COLOR, ridge * 0.48);
    color.lerp(CORTEX_SULCUS_COLOR, sulcusDepth * 0.72);
    writeColor(colors, i, color);
    vertexCache.set(cacheKey, [px, py, pz, color.r, color.g, color.b]);
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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

function createLongitudinalFissureGeometry() {
  const points = [];
  for (let i = 0; i <= 72; i += 1) {
    const t = i / 72;
    const x = lerp(-0.91, 0.9, t);
    const crown = Math.sin(t * Math.PI);
    const y = 0.33 + crown * 0.27 + (fbmNoise3(t * 5.6 + 2.4, 1.7, 4.3, 2) - 0.5) * 0.035;
    const z = 0.012 + Math.sin(t * Math.PI * 3.2) * 0.004;
    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 96, 0.012, 8, false);
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
    this.mode = options.mode ?? 'structures';
    this.reducedMotion = Boolean(options.reducedMotion);
    this.activeId = null;
    this.cameraFrame = null;
    this.beamFrame = null;
    this.beamResolve = null;
    this.sequenceToken = 0;
    this.markers = new Map();
    this.beams = new Map();
    this.labels = [];
    this.tmpVector = new THREE.Vector3();

    this.scene = new THREE.Scene();
    this.scene.background = null;

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
    if (this.mode !== 'overview') {
      this.createBeams();
    }
    this.createOverviewLabels();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.45;
    this.controls.maxDistance = 4.2;
    this.controls.maxPolarAngle = Math.PI * 0.78;
    this.controls.minPolarAngle = Math.PI * 0.15;

    this.applyModeDefaults(true);
    this.resize();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.render = this.render.bind(this);
    this.updateRunState = this.updateRunState.bind(this);

    this.isVisible = true;
    this.running = false;
    this.viewportObserver = new IntersectionObserver(
      (entries) => {
        this.isVisible = entries.some((entry) => entry.isIntersecting);
        this.updateRunState();
      },
      { threshold: 0.01 },
    );
    this.viewportObserver.observe(this.container);
    document.addEventListener('visibilitychange', this.updateRunState);
    this.updateRunState();
  }

  updateRunState() {
    const shouldRun = this.isVisible && document.visibilityState !== 'hidden';
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
    const cortexMaterial = makeTissueMaterial(0xffffff, 0.72, {
      roughness: 0.9,
      vertexColors: true,
      side: THREE.FrontSide,
    });
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

    const fissure = new THREE.Mesh(
      createLongitudinalFissureGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0x594345,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    fissure.renderOrder = 3;
    this.root.add(fissure);

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
    const markerGeometry = new THREE.SphereGeometry(0.038, 32, 16);
    const haloGeometry = new THREE.SphereGeometry(0.098, 32, 16);

    getSelectableStructures().forEach((structure) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.copy(vectorFromArray(structure.position));
      markerGroup.visible = false;

      const coreMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      });
      const core = new THREE.Mesh(markerGeometry, coreMaterial);
      core.renderOrder = 10;
      markerGroup.add(core);

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.renderOrder = 9;
      markerGroup.add(halo);

      this.root.add(markerGroup);
      this.markers.set(structure.id, {
        group: markerGroup,
        core,
        halo,
        coreMaterial,
        haloMaterial,
      });
    });
  }

  createBeams() {
    const structures = getSelectableStructures();
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);
    const flareGeometry = new THREE.SphereGeometry(0.075, 32, 16);

    structures.forEach((structure) => {
      const target = vectorFromArray(structure.position);
      const sourceAxis = vectorFromArray(structure.beamDir).normalize();
      const source = target.clone().add(sourceAxis.clone().multiplyScalar(1.52));
      const travel = sourceAxis.clone().multiplyScalar(-1).normalize();
      const fullLength = 3.04;
      const quaternion = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, travel);

      const group = new THREE.Group();
      group.visible = false;

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(beamGeometry, haloMaterial);
      halo.renderOrder = 11;
      group.add(halo);

      const coreMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(beamGeometry, coreMaterial);
      core.renderOrder = 12;
      group.add(core);

      const sourceMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sourceGlow = new THREE.Mesh(flareGeometry, sourceMaterial);
      sourceGlow.position.copy(source);
      sourceGlow.renderOrder = 13;
      group.add(sourceGlow);

      const flareMaterial = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flare = new THREE.Mesh(flareGeometry, flareMaterial);
      flare.position.copy(target);
      flare.renderOrder = 14;
      group.add(flare);

      this.root.add(group);
      this.beams.set(structure.id, {
        group,
        source,
        travel,
        fullLength,
        quaternion,
        core,
        halo,
        sourceGlow,
        flare,
        coreMaterial,
        haloMaterial,
        sourceMaterial,
        flareMaterial,
      });
      this.setBeamProgress(structure.id, 0);
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

  applyModeDefaults(immediate = false) {
    const preset = CAMERA_PRESETS[this.mode] ?? CAMERA_PRESETS.structures;
    this.zone.visible = this.mode === 'overview';
    this.labelLayer.hidden = this.mode !== 'overview';
    this.clearActive();
    this.moveCameraTo(preset, immediate || this.reducedMotion ? 0 : 650);
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
  }

  setMarkerVisible(id, visible) {
    const marker = this.markers.get(id);
    if (!marker) return;
    marker.group.visible = visible;
    marker.coreMaterial.opacity = visible ? 0.96 : 0;
    marker.haloMaterial.opacity = visible ? 0.18 : 0;
  }

  hideMarkers() {
    this.markers.forEach((_, id) => this.setMarkerVisible(id, false));
  }

  setBeamProgress(id, progress) {
    const beam = this.beams.get(id);
    if (!beam) return;

    const safeProgress = clamp(progress);
    const visible = safeProgress > 0.006;
    beam.group.visible = visible;

    if (!visible) {
      beam.flareMaterial.opacity = 0;
      return;
    }

    const length = Math.max(beam.fullLength * safeProgress, 0.001);
    const center = beam.source
      .clone()
      .add(beam.travel.clone().multiplyScalar(length * 0.5));

    beam.core.position.copy(center);
    beam.core.quaternion.copy(beam.quaternion);
    beam.core.scale.set(0.014, length, 0.014);

    beam.halo.position.copy(center);
    beam.halo.quaternion.copy(beam.quaternion);
    beam.halo.scale.set(0.052, length, 0.052);

    const crossIn = smoothstep(0.44, 0.52, safeProgress);
    const crossOut = 1 - smoothstep(0.62, 0.9, safeProgress);
    const flareStrength = crossIn * crossOut;
    beam.flareMaterial.opacity = 0.3 * flareStrength;
    beam.flare.scale.setScalar(1 + 2.8 * flareStrength);
    beam.sourceMaterial.opacity = 0.12 + 0.12 * Math.min(safeProgress * 1.4, 1);
  }

  hideBeams() {
    this.beams.forEach((_, id) => this.setBeamProgress(id, 0));
  }

  clearActive() {
    this.activeId = null;
    this.stopAnimations();
    this.hideMarkers();
    this.hideBeams();
  }

  stopAnimations() {
    if (this.cameraFrame) {
      cancelAnimationFrame(this.cameraFrame);
      this.cameraFrame = null;
    }
    if (this.beamFrame) {
      cancelAnimationFrame(this.beamFrame);
      this.beamFrame = null;
    }
    if (this.beamResolve) {
      this.beamResolve();
      this.beamResolve = null;
    }
  }

  revealStructure(id, options = {}) {
    const structure = getStructure(id);
    if (!structure || structure.noBeam || this.mode === 'overview') {
      return Promise.resolve();
    }

    this.sequenceToken += options.sequenceStep ? 0 : 1;
    this.stopAnimations();
    this.hideMarkers();
    this.hideBeams();
    this.activeId = id;
    this.setMarkerVisible(id, true);

    const preset = CAMERA_PRESETS[id] ?? CAMERA_PRESETS.structures;
    this.moveCameraTo(preset, this.reducedMotion || options.instant ? 0 : 760);

    if (this.reducedMotion || options.instant) {
      this.setBeamProgress(id, 1);
      return Promise.resolve();
    }

    return this.animateBeam(id, options.duration ?? 1180);
  }

  moveCameraTo(preset, duration = 0) {
    const targetLookAt = vectorFromArray(preset.target);
    const targetPosition = vectorFromArray(preset.position)
      .sub(targetLookAt)
      .multiplyScalar(CAMERA_ZOOM)
      .add(targetLookAt);

    if (!duration) {
      this.camera.position.copy(targetPosition);
      this.controls?.target.copy(targetLookAt);
      this.camera.lookAt(targetLookAt);
      this.controls?.update();
      return;
    }

    if (this.cameraFrame) {
      cancelAnimationFrame(this.cameraFrame);
      this.cameraFrame = null;
    }

    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startedAt = performance.now();

    const step = (now) => {
      const elapsed = now - startedAt;
      const progress = easeInOutCubic(clamp(elapsed / duration));
      this.camera.position.lerpVectors(startPosition, targetPosition, progress);
      this.controls.target.lerpVectors(startTarget, targetLookAt, progress);
      this.camera.lookAt(this.controls.target);
      this.controls.update();

      if (progress < 1) {
        this.cameraFrame = requestAnimationFrame(step);
      } else {
        this.cameraFrame = null;
      }
    };

    this.cameraFrame = requestAnimationFrame(step);
  }

  animateBeam(id, duration) {
    if (this.beamFrame) {
      cancelAnimationFrame(this.beamFrame);
      this.beamFrame = null;
    }

    return new Promise((resolve) => {
      this.beamResolve = resolve;
      const startedAt = performance.now();
      const step = (now) => {
        const elapsed = now - startedAt;
        const progress = easeInOutCubic(clamp(elapsed / duration));
        this.setBeamProgress(id, progress);

        if (progress < 1) {
          this.beamFrame = requestAnimationFrame(step);
        } else {
          this.beamFrame = null;
          this.beamResolve = null;
          resolve();
        }
      };

      this.setBeamProgress(id, 0);
      this.beamFrame = requestAnimationFrame(step);
    });
  }

  async playSequence(ids = STRUCTURE_SEQUENCE) {
    if (this.reducedMotion) {
      this.showAllBeams();
      return true;
    }

    const token = this.sequenceToken + 1;
    this.sequenceToken = token;
    this.clearActive();

    for (const id of ids) {
      if (token !== this.sequenceToken) return false;
      await this.revealStructure(id, {
        sequenceStep: true,
        duration: 1020,
      });
      if (token !== this.sequenceToken) return false;
      await new Promise((resolve) => window.setTimeout(resolve, 260));
    }

    return token === this.sequenceToken;
  }

  showAllBeams() {
    this.sequenceToken += 1;
    this.stopAnimations();
    this.activeId = null;
    this.hideMarkers();
    this.hideBeams();
    this.moveCameraTo(CAMERA_PRESETS.angles, this.reducedMotion ? 0 : 520);

    STRUCTURE_SEQUENCE.forEach((id) => {
      this.setMarkerVisible(id, true);
      this.setBeamProgress(id, 1);
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
    this.controls?.update();
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  }

  destroy() {
    this.running = false;
    this.stopAnimations();
    cancelAnimationFrame(this.frame);
    this.viewportObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.updateRunState);
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    disposeObject(this.root);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }
}
