import { BrainScene, STAGE_ORDER } from './brain.js';
import { initUI } from './ui.js';

// Drives the one scene from the scroll position: which section owns the model, where on
// screen it should be framed, and how far between two keyframes the camera has travelled.
function createScrollRig(scene, hitArea, onStageChange) {
  const windows = STAGE_ORDER.map((id) => ({
    id,
    section: document.getElementById(id),
    window: document.querySelector(`[data-brain][data-stage="${id}"]`),
  })).filter((entry) => entry.section);

  let active = null;

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
      hitArea.style.left = `${target.left}px`;
      hitArea.style.top = `${target.top}px`;
      hitArea.style.width = `${target.width}px`;
      hitArea.style.height = `${target.height}px`;
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
  return { update: schedule };
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
  if (scene) createScrollRig(scene, hitArea, ui.onStageChange);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
