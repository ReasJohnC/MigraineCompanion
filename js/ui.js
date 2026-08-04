import {
  STRUCTURE_SEQUENCE,
  getSelectableStructures,
  getStructure,
} from './data.js';

const STORAGE_KEY = 'migraine-companion:last-structure';

const CALLOUT_ANGLES = {
  'lateral-tuberal': '-34deg',
  paraventricular: '-74deg',
  suprachiasmatic: '-18deg',
  pineal: '132deg',
};

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function safeGetStoredStructure() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeStoreStructure(id) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}

function isSelectableId(id) {
  return STRUCTURE_SEQUENCE.includes(id);
}

function setPressedState(buttons, activeId) {
  buttons.forEach((button) => {
    const pressed = button.dataset.structureId === activeId;
    button.setAttribute('aria-pressed', String(pressed));
  });
}

function updateDetailPanel(structure) {
  setText('#structure-hook', structure.hook);
  setText('#structure-name', structure.name);
  setText('#structure-symptom', structure.symptom);
  setText('#structure-blurb', structure.blurb);
  setText('#structure-caption', structure.caption);

  const callout = document.querySelector('#structure-callout');
  const calloutCaption = document.querySelector('#callout-caption');
  const calloutLabel = document.querySelector('.callout-label');
  const nucleus = document.querySelector('.nucleus-zoom');

  if (callout) {
    callout.classList.add('is-visible');
    callout.setAttribute('aria-hidden', 'false');
  }
  if (calloutCaption) calloutCaption.textContent = structure.caption;
  if (calloutLabel) {
    calloutLabel.textContent = structure.nickname
      ? `${structure.nickname} circular view`
      : `${structure.name} circular view`;
  }
  if (nucleus) {
    nucleus.style.setProperty('--beam-angle', CALLOUT_ANGLES[structure.id] ?? '-28deg');
  }
}

function renderChips(container, onSelect) {
  const structures = getSelectableStructures();
  const buttons = structures.map((structure) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.dataset.structureId = structure.id;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = structure.name;
    button.addEventListener('click', () => onSelect(structure.id, { persist: true }));
    button.addEventListener('keydown', (event) => {
      const currentIndex = buttons.indexOf(button);
      let nextIndex = null;

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % buttons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = buttons.length - 1;
      }

      if (nextIndex !== null) {
        event.preventDefault();
        buttons[nextIndex].focus();
      }
    });
    container.appendChild(button);
    return button;
  });

  return buttons;
}

function initNavigation() {
  const nav = document.querySelector('.site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = Array.from(document.querySelectorAll('.nav-links a'));

  toggle?.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  links.forEach((link) => {
    link.addEventListener('click', () => {
      nav?.classList.remove('is-open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });

  const sections = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (!('IntersectionObserver' in window) || !sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      links.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
      });
    },
    {
      rootMargin: '-30% 0px -55% 0px',
      threshold: [0.1, 0.3, 0.6],
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function initCopy() {
  const prodrome = getStructure('prodrome-zone');
  const angles = getStructure('angles-of-force');

  if (prodrome) {
    setText('[data-copy="prodrome-hook"]', prodrome.hook);
    setText('[data-copy="prodrome-blurb"]', prodrome.blurb);
    setText('[data-copy="prodrome-caption"]', prodrome.caption);
  }

  if (angles) {
    setText('[data-copy="angles-hook"]', angles.hook);
    setText('[data-copy="angles-blurb"]', angles.blurb);
    setText('[data-copy="angles-caption"]', angles.caption);
  }
}

function initStructureModule(structureScene) {
  const chipList = document.querySelector('[data-chip-list]');
  if (!chipList || !structureScene) return;

  let buttons = [];

  const selectStructure = (id, options = {}) => {
    if (!isSelectableId(id)) return;
    const structure = getStructure(id);
    if (!structure) return;

    setPressedState(buttons, id);
    updateDetailPanel(structure);
    structureScene.revealStructure(id);

    if (options.persist) {
      safeStoreStructure(id);
    }
  };

  buttons = renderChips(chipList, selectStructure);

  const storedId = safeGetStoredStructure();
  if (storedId && isSelectableId(storedId)) {
    selectStructure(storedId, { persist: false });
  }
}

function initAnglesModule(anglesScene) {
  const playButton = document.querySelector('[data-play-sequence]');
  const showAllButton = document.querySelector('[data-show-all]');
  const status = document.querySelector('[data-sequence-status]');

  if (!anglesScene) return;

  playButton?.addEventListener('click', async () => {
    playButton.disabled = true;
    if (status) status.textContent = 'Playing lateral tuberal, paraventricular, suprachiasmatic, then pineal.';
    const completed = await anglesScene.playSequence(STRUCTURE_SEQUENCE);
    if (completed && status) {
      status.textContent = 'Sequence complete. The pineal beam uses the upper-posterior special angle.';
    }
    playButton.disabled = false;
  });

  showAllButton?.addEventListener('click', () => {
    anglesScene.showAllBeams();
    if (status) status.textContent = 'All four beams are visible together as a fan.';
  });
}

function initReducedMotionListener(scenes, motionQuery) {
  const apply = () => {
    scenes.forEach((scene) => scene?.setReducedMotion(motionQuery.matches));
  };

  apply();

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', apply);
  } else if (typeof motionQuery.addListener === 'function') {
    motionQuery.addListener(apply);
  }
}

export function initUI({ scenes, motionQuery }) {
  initCopy();
  initNavigation();
  initStructureModule(scenes.structures);
  initAnglesModule(scenes.angles);
  initReducedMotionListener(Object.values(scenes), motionQuery);
}
