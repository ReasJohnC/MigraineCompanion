import { initUI } from './ui.js';

// Only the page's own modules load statically. The 3-D module and three.js (670 KB) arrive
// by dynamic import below: when they were part of this graph, every word on the page waited
// for them, so a slow connection saw a blank page. They are deliberately not preloaded —
// measured at 90 KB/s, a preload's share of the bandwidth held the headline back from 1.3 s
// to 3.5 s and brought the model forward by only half a second.

const STAGE_LOADING = 'Loading brain model…';
const STAGE_FAILED = 'The 3D schematic could not be initialized in this browser.';

// Drives the one scene from the scroll position: which section owns the model, where on
// screen it should be framed, and how far between two keyframes the camera has travelled.
// How far the active window's centre may drift from the viewport's (in viewport heights)
// before the model starts to recede, where the recession completes, and how much of the
// model is left at the bottom. The floor keeps the specimen present as a ghost rather
// than blinking out, which would break the one-specimen conceit.
const FADE_START = 0.2;
const FADE_END = 0.75;
const FADE_FLOOR = 0.14;

function createScrollRig(scene, stageOrder, hitArea, onStageChange) {
  const windows = stageOrder.map((id) => ({
    id,
    section: document.getElementById(id),
    window: document.querySelector(`[data-brain][data-stage="${id}"]`),
  })).filter((entry) => entry.section);

  const canvasShell = document.getElementById('brain-canvas');
  let active = null;
  let hitWidth = -1;
  let hitHeight = -1;

  const update = () => {
    const middle = window.innerHeight / 2;

    // The stage nearest the middle of the viewport owns the model.
    let nearest = null;
    let nearestDistance = Infinity;
    windows.forEach((entry, index) => {
      const rect = (entry.window ?? entry.section).getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { ...entry, index, rect };
      }
    });
    if (!nearest) return;

    // Continuous position along the keyframe list: the section's own index, plus how far
    // the reader has scrolled past its centre toward the next one.
    const offset = (middle - (nearest.rect.top + nearest.rect.height / 2)) / window.innerHeight;
    scene.setScrollProgress(nearest.index + Math.max(-0.999, Math.min(0.999, offset)));

    // The model always yields to the copy: once its window is scrolled past, the whole
    // canvas recedes toward the floor, and it comes back only as the next window arrives.
    const away = Math.min(1, Math.max(0, (Math.abs(offset) - FADE_START) / (FADE_END - FADE_START)));
    const eased = away * away * (3 - 2 * away);
    if (canvasShell) canvasShell.style.opacity = (1 - (1 - FADE_FLOOR) * eased).toFixed(3);

    if (nearest.id !== active) {
      active = nearest.id;
      scene.setStage(nearest.id);
      onStageChange?.(nearest.id);
    }

    // The pointer surface tracks the active window so orbiting works there and nowhere
    // else; the canvas itself must not swallow scrolls over the copy. The hero's figure
    // frames the model but is not a stage: turning the model there would pull the zone
    // out from under the reticle drawn on it.
    const target = nearest.window?.getBoundingClientRect();
    if (target && target.height) {
      scene.setFrameRect(target);
      hitArea.style.display = nearest.window.classList.contains('stage-window') ? 'block' : 'none';
      // Position with a transform so the per-scroll write composites instead of laying
      // out; the size genuinely changes only across sections.
      hitArea.style.transform = `translate(${target.left}px, ${target.top}px)`;
      if (target.width !== hitWidth || target.height !== hitHeight) {
        hitWidth = target.width;
        hitHeight = target.height;
        hitArea.style.width = `${hitWidth}px`;
        hitArea.style.height = `${hitHeight}px`;
      }
    } else {
      scene.setFrameRect(null);
      hitArea.style.display = 'none';
    }
  };

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  return { update: schedule, sync: update };
}

// Each stage says what the model is doing — loading, or unable to start — inside the stage
// itself. The fallback used to be one sentence fixed in the middle of the viewport, where
// it floated over every section in turn.
function setStageStatus(text) {
  document.querySelectorAll('.stage-window').forEach((stage) => {
    let status = stage.querySelector('.stage-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'stage-status';
      stage.appendChild(status);
    }
    status.textContent = text;
  });
}

function showSceneFallback() {
  document.body.classList.remove('scene-loading');
  document.body.classList.add('no-webgl');
  setStageStatus(STAGE_FAILED);
  // These two drive the model and nothing else.
  document.querySelectorAll('[data-play-sequence], [data-show-all]').forEach((button) => {
    button.disabled = true;
  });
}

async function bootstrap() {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const container = document.getElementById('brain-canvas');
  const hitArea = document.getElementById('stage-hit');

  // The stage windows are matched to keyframes by section id, which is what the rig
  // walks; data-brain stays the hook the UI modules already use.
  document.querySelectorAll('[data-brain]').forEach((element) => {
    element.dataset.stage = element.closest('section')?.id ?? '';
  });

  // Copy and controls go live at once. The UI reaches the scene through a getter, so its
  // controls work before the model exists and drive it once it does.
  let scene = null;
  const ui = initUI({ getScene: () => scene, motionQuery });
  document.body.classList.add('scene-loading');
  setStageStatus(STAGE_LOADING);

  let stageOrder;
  try {
    const brain = await import('./brain.js');
    stageOrder = brain.STAGE_ORDER;
    scene = new brain.BrainScene(container, { reducedMotion: motionQuery.matches, hitArea });
  } catch {
    showSceneFallback();
    return;
  }

  // Exposed for the verification harness, under the names its checks use.
  window.__scene = scene;
  window.__scenes = { overview: scene, simulator: scene, structures: scene, angles: scene };

  // Handing the model to the section in view also restates that section's selection.
  window.__rig = createScrollRig(scene, stageOrder, hitArea, ui.onStageChange);
  // The scene was built before any stage window was known, so its first pose is the raw
  // keyframe. Start from the framed pose instead of easing out to it on the first frames
  // — for the hero that raw pose is inside the cortex.
  scene.snapToRig();
  document.body.classList.replace('scene-loading', 'scene-ready');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
