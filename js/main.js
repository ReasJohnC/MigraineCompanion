import { BrainScene } from './brain.js';
import { initUI } from './ui.js';

function createScene(selector, mode, reducedMotion) {
  const container = document.querySelector(selector);
  if (!container) return null;
  return new BrainScene(container, { mode, reducedMotion });
}

function showSceneFallback(selector) {
  const container = document.querySelector(selector);
  if (!container) return;
  const fallback = document.createElement('p');
  fallback.className = 'brain-loading';
  fallback.textContent = 'The 3D schematic could not be initialized in this browser.';
  container.appendChild(fallback);
}

function bootstrap() {
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = motionQuery.matches;
  const scenes = {};

  try {
    scenes.overview = createScene('[data-brain="overview"]', 'overview', reducedMotion);
    scenes.simulator = createScene('[data-brain="simulator"]', 'simulator', reducedMotion);
    scenes.structures = createScene('[data-brain="structures"]', 'structures', reducedMotion);
    scenes.angles = createScene('[data-brain="angles"]', 'angles', reducedMotion);
  } catch {
    showSceneFallback('[data-brain="overview"]');
    showSceneFallback('[data-brain="simulator"]');
    showSceneFallback('[data-brain="structures"]');
    showSceneFallback('[data-brain="angles"]');
  }

  initUI({ scenes, motionQuery });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
