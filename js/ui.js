import {
  AURA_SYMPTOM,
  BEAM_DEFS,
  BEAM_SEQUENCE,
  PAGE_COPY,
  SYMPTOMS,
  getStructure,
  getSymptom,
  readout,
} from './data.js';

const STORAGE_KEY = 'migraine-companion:last-selection';

const CALLOUT_ANGLES = {
  mood: '-34deg',
  gut: '-8deg',
  fluid: '-74deg',
  wake: '-18deg',
  aura: '132deg',
};

const MODE_LABELS = {
  'no-aura': 'Migraine without Aura',
  aura: 'Migraine with Aura',
};

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function safeRead() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function safeStore(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in hardened browser contexts.
  }
}

// Renders the book title as a <cite>, or as a link once the author supplies a URL.
function citeBook(title, url) {
  const cite = document.createElement('cite');
  cite.textContent = title;
  if (!url) return cite;
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  link.appendChild(cite);
  return link;
}

function initCopy() {
  const { hero, prodromeZone, pineal, angles, footer } = PAGE_COPY;

  setText('[data-copy="hero-eyebrow"]', hero.eyebrow);
  setText('[data-copy="hero-title"]', hero.title);
  setText('[data-copy="hero-thesis"]', hero.thesis);
  setText('[data-copy="hero-disclaimer"]', hero.disclaimer);

  setText('[data-copy="prodrome-title"]', prodromeZone.title);
  setText('[data-copy="prodrome-hook"]', prodromeZone.hook);
  setText('[data-copy="prodrome-blurb"]', prodromeZone.blurb);
  setText('[data-copy="prodrome-caption"]', prodromeZone.caption);

  setText('[data-copy="pineal-title"]', pineal.title);
  setText('[data-copy="pineal-blurb"]', pineal.blurb);
  setText('[data-copy="pineal-caption"]', pineal.caption);

  const theory = document.querySelector('[data-copy="pineal-theory"]');
  if (theory) {
    theory.textContent = `${pineal.theory} `;
    theory.appendChild(citeBook(pineal.bookTitle, footer.bookUrl));
    theory.appendChild(document.createTextNode('.'));
  }

  const points = document.querySelector('[data-pineal-points]');
  if (points) {
    pineal.points.forEach((point) => {
      const item = document.createElement('li');
      item.textContent = point;
      points.appendChild(item);
    });
  }

  setText('[data-copy="angles-hook"]', angles.hook);
  setText('[data-copy="angles-blurb"]', angles.blurb);
  setText('[data-copy="angles-caption"]', angles.caption);

  setText('[data-copy="footer-framing"]', footer.framing);
  setText('[data-copy="footer-disclaimer"]', hero.disclaimer);

  const citation = document.querySelector('[data-copy="footer-citation"]');
  if (citation) {
    citation.textContent = `${footer.citation} `;
    citation.appendChild(citeBook(footer.bookTitle, footer.bookUrl));
    citation.appendChild(document.createTextNode(` ${footer.citationTail}`));
  }
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
    { rootMargin: '-30% 0px -55% 0px', threshold: [0.1, 0.3, 0.6] },
  );

  sections.forEach((section) => observer.observe(section));
}

function buildSymptomBlock(container, mode, onSingle, onCombination) {
  const heading = document.createElement('p');
  heading.className = 'block-label';
  heading.textContent = 'Enter Prodrome Symptoms Here';
  container.appendChild(heading);

  const chipList = document.createElement('div');
  chipList.className = 'chip-list';
  chipList.setAttribute('role', 'group');
  chipList.setAttribute('aria-label', `Prodrome symptoms, ${MODE_LABELS[mode]}`);
  container.appendChild(chipList);

  const chips = SYMPTOMS.map((symptom) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.dataset.symptomId = symptom.id;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = symptom.label;
    button.addEventListener('click', () => onSingle(symptom.id));
    chipList.appendChild(button);
    return button;
  });

  const combination = document.createElement('div');
  combination.className = 'combination-block';
  container.appendChild(combination);

  const comboHeading = document.createElement('p');
  comboHeading.className = 'block-label';
  comboHeading.textContent = 'Combinations of Prodromes';
  combination.appendChild(comboHeading);

  const comboHint = document.createElement('p');
  comboHint.className = 'block-hint';
  comboHint.textContent = 'Click all experienced for each attack';
  combination.appendChild(comboHint);

  const checkRow = document.createElement('div');
  checkRow.className = 'check-row';
  combination.appendChild(checkRow);

  const boxes = SYMPTOMS.map((symptom) => {
    const label = document.createElement('label');
    label.className = 'check-chip';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = symptom.id;
    input.addEventListener('change', () => onCombination());

    const text = document.createElement('span');
    text.textContent = symptom.label;

    label.append(input, text);
    checkRow.appendChild(label);
    return input;
  });

  return { chips, boxes };
}

function initSimulator(scene) {
  const readoutList = document.querySelector('[data-readout]');
  const detail = document.querySelector('[data-sim-detail]');
  const hook = document.querySelector('#sim-heading');
  const triggers = Array.from(document.querySelectorAll('[data-accordion-trigger]'));
  if (!triggers.length) return;

  const blocks = new Map();
  let openMode = null;

  const clearReadout = (message) => {
    if (!readoutList) return;
    readoutList.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'readout-empty';
    empty.textContent = message;
    readoutList.appendChild(empty);
    if (detail) detail.textContent = '';
  };

  const appendReadout = (id) => {
    if (!readoutList) return;
    readoutList.querySelector('.readout-empty')?.remove();
    if (readoutList.querySelector(`[data-readout-id="${id}"]`)) return;
    const line = document.createElement('p');
    line.className = 'readout-line';
    line.dataset.readoutId = id;
    if (id === AURA_SYMPTOM.id) line.classList.add('readout-line--aura');
    line.textContent = readout(id);
    readoutList.appendChild(line);
  };

  const fire = (ids, { instant = false } = {}) => {
    const block = blocks.get(openMode);
    if (!ids.length) {
      clearReadout('Choose a symptom to follow the force through the brain.');
      scene?.clearActive();
      return;
    }

    const beamIds = openMode === 'aura' ? [...ids, AURA_SYMPTOM.id] : [...ids];

    if (hook) hook.textContent = MODE_LABELS[openMode] ?? '';
    clearReadout(instant ? '' : 'The force enters the brain…');
    if (detail) {
      detail.textContent = ids.length === 1 ? getSymptom(ids[0])?.detail ?? '' : '';
    }

    if (!scene) {
      beamIds.forEach(appendReadout);
      return;
    }
    scene.revealSymptoms(beamIds, { instant, onCross: appendReadout });
    if (block) safeStore({ mode: openMode, ids });
  };

  const currentSelection = (mode) => {
    const block = blocks.get(mode);
    if (!block) return [];
    const checked = block.boxes.filter((box) => box.checked).map((box) => box.value);
    if (checked.length) return checked;
    const pressed = block.chips.find((chip) => chip.getAttribute('aria-pressed') === 'true');
    return pressed ? [pressed.dataset.symptomId] : [];
  };

  const selectSingle = (mode, id) => {
    const block = blocks.get(mode);
    if (!block) return;
    block.boxes.forEach((box) => {
      box.checked = false;
    });
    block.chips.forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.symptomId === id));
    });
    fire([id]);
  };

  const selectCombination = (mode) => {
    const block = blocks.get(mode);
    if (!block) return;
    block.chips.forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    fire(currentSelection(mode));
  };

  document.querySelectorAll('[data-symptom-block]').forEach((container) => {
    const mode = container.dataset.symptomBlock;
    blocks.set(
      mode,
      buildSymptomBlock(
        container,
        mode,
        (id) => selectSingle(mode, id),
        () => selectCombination(mode),
      ),
    );
  });

  const setOpen = (mode, { restore = false } = {}) => {
    openMode = mode;

    triggers.forEach((trigger) => {
      const target = trigger.dataset.accordionTrigger;
      const isOpen = target === mode;
      trigger.setAttribute('aria-expanded', String(isOpen));
      const panel = document.querySelector(`[data-accordion-panel="${target}"]`);
      if (panel) panel.hidden = !isOpen;
    });

    if (!mode) {
      scene?.clearActive();
      if (hook) hook.textContent = 'No symptom selected';
      clearReadout('Open a section above and choose a symptom.');
      return;
    }

    if (hook) hook.textContent = MODE_LABELS[mode] ?? '';

    if (restore) return;

    // Switching migraine type starts the reader from a clean slate.
    const block = blocks.get(mode);
    block?.chips.forEach((chip) => chip.setAttribute('aria-pressed', 'false'));
    block?.boxes.forEach((box) => {
      box.checked = false;
    });
    scene?.clearActive();
    clearReadout('Choose a symptom to follow the force through the brain.');
    if (detail) detail.textContent = '';
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const target = trigger.dataset.accordionTrigger;
      setOpen(openMode === target ? null : target);
    });
  });

  setOpen(null);

  const stored = safeRead();
  if (stored?.mode && blocks.has(stored.mode) && Array.isArray(stored.ids) && stored.ids.length) {
    const valid = stored.ids.filter((id) => SYMPTOMS.some((symptom) => symptom.id === id));
    if (valid.length) {
      setOpen(stored.mode, { restore: true });
      const block = blocks.get(stored.mode);
      if (valid.length === 1) {
        block?.chips.forEach((chip) => {
          chip.setAttribute('aria-pressed', String(chip.dataset.symptomId === valid[0]));
        });
      } else {
        block?.boxes.forEach((box) => {
          box.checked = valid.includes(box.value);
        });
      }
      // Restored state appears already resolved rather than replaying on load.
      fire(valid, { instant: true });
    }
  }
}

function initReference(scene) {
  const list = document.querySelector('[data-reference-list]');
  const name = document.querySelector('[data-reference-name]');
  const detail = document.querySelector('[data-reference-detail]');
  const calloutLabel = document.querySelector('[data-callout-label]');
  const calloutCaption = document.querySelector('[data-callout-caption]');
  const nucleus = document.querySelector('#reference-callout .nucleus-zoom');
  if (!list) return;

  const select = (id, options = {}) => {
    const symptom = getSymptom(id);
    const structure = symptom && getStructure(symptom.structureId);
    if (!symptom || !structure) return;

    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.symptomId === id));
    });

    // The chip already names the structure, so the panel updates at once here and
    // the line runs alongside it rather than gating the text.
    scene?.revealSymptoms([id], { instant: Boolean(options.instant) });

    if (name) name.textContent = readout(id);
    if (detail) detail.textContent = symptom.detail;
    if (calloutLabel) {
      calloutLabel.textContent = `Inside the ${structure.aka ?? structure.name}`;
    }
    if (calloutCaption) {
      calloutCaption.textContent = `${symptom.label}: the theory’s angle of force through the ${structure.name.toLowerCase()}.`;
    }
    if (nucleus) {
      nucleus.style.setProperty('--beam-angle', CALLOUT_ANGLES[id] ?? '-28deg');
    }
  };

  const buttons = BEAM_DEFS.map((symptom) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    button.dataset.symptomId = symptom.id;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = `${symptom.label} — ${getStructure(symptom.structureId)?.name ?? ''}`;
    button.addEventListener('click', () => select(symptom.id));
    button.addEventListener('keydown', (event) => {
      const index = buttons.indexOf(button);
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      if (next !== null) {
        event.preventDefault();
        buttons[next].focus();
      }
    });
    list.appendChild(button);
    return button;
  });

  select(BEAM_DEFS[0].id, { instant: true });
}

function initAnglesModule(anglesScene) {
  const playButton = document.querySelector('[data-play-sequence]');
  const showAllButton = document.querySelector('[data-show-all]');
  const status = document.querySelector('[data-sequence-status]');
  if (!anglesScene) return;

  playButton?.addEventListener('click', async () => {
    playButton.disabled = true;
    if (status) status.textContent = 'The force enters at each angle in turn.';
    const completed = await anglesScene.playSequence(BEAM_SEQUENCE, {
      onCross: (id) => {
        if (status) status.textContent = readout(id);
      },
    });
    if (completed && status) {
      status.textContent = 'Every angle has struck. The pineal is reached from its own upper-posterior direction.';
    }
    playButton.disabled = false;
  });

  showAllButton?.addEventListener('click', () => {
    anglesScene.showAllBeams();
    if (status) status.textContent = 'Five angles, four targets: every path the force can take.';
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
  initSimulator(scenes.simulator);
  initReference(scenes.structures);
  initAnglesModule(scenes.angles);
  initReducedMotionListener(Object.values(scenes), motionQuery);
}
