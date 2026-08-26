import { BrainScene, STAGE_ORDER } from './brain.js';
import { initUI } from './ui.js';

// Drives the one scene from the scroll position: which section owns the model, where on
// screen it should be framed, and how far between two keyframes the camera has travelled.
// How far the active window's centre may drift from the viewport's (in viewport heights)
// before the model starts to recede, where the recession completes, and how much of the
// model is left at the bottom. The floor keeps the specimen present as a ghost rather
// than blinking out, which would break the one-specimen conceit.
const FADE_START = 0.2;
const FADE_END = 0.75;
const FADE_FLOOR = 0.14;

function createScrollRig(scene, hitArea, onStageChange) {
  const windows = STAGE_ORDER.map((id) => ({
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
    // else; the canvas itself must not swallow scrolls over the copy.
    const target = nearest.window?.getBoundingClientRect();
    if (target && target.height) {
      scene.setFrameRect(target);
      hitArea.style.display = 'block';
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

function showSceneFallback() {
  const container = document.getElementById('brain-canvas');
  const loading = container?.querySelector('.brain-loading');
  if (loading) {
    loading.textContent = 'The 3D schematic could not be initialized in this browser.';
  }
  document.body.classList.add('no-webgl');
}

function bootstrap() {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const container = document.getElementById('brain-canvas');
  const hitArea = document.getElementById('stage-hit');

  // The stage windows are matched to keyframes by section id, which is what the rig
  // walks; data-brain stays the hook the UI modules already use.
  document.querySelectorAll('[data-brain]').forEach((element) => {
    element.dataset.stage = element.closest('section')?.id ?? '';
  });

  let scene = null;
  try {
    scene = new BrainScene(container, { reducedMotion: motionQuery.matches, hitArea });
  } catch {
    showSceneFallback();
  }

  window.__scene = scene;
  // The UI modules were written against one scene per section; they now share the one.
  const scenes = { overview: scene, simulator: scene, structures: scene, angles: scene };
  window.__scenes = scenes;

  const ui = initUI({ scenes, motionQuery });
  if (scene) window.__rig = createScrollRig(scene, hitArea, ui.onStageChange);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
