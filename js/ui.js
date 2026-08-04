import {
  AURA_SYMPTOM,
  BEAM_DEFS,
  BEAM_SEQUENCE,
  PAGE_COPY,
  SYMPTOMS,
  angleBetween,
  getStructure,
  getSymptom,
  pinealClearance,
  readout,
} from './data.js';

const STORAGE_KEY = 'migraine-companion:last-selection';

const MODE_LABELS = {
  'no-aura': 'Migraine without Aura',
  aura: 'Migraine with Aura',
};

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

// The callout draws the real beam vector, viewed sagittally: model +X (anterior) runs
// right and +Y (superior) runs up, so a CSS rotation is the screen-space bearing of the
// projected direction. The stated number is the elevation above the axial plane, which
// is a property of the vector itself rather than of this projection.
function calloutGeometry(beamDir) {
  const [x, y] = beamDir;
  const bearing = (Math.atan2(-y, x) * 180) / Math.PI;
  const elevation = (Math.asin(Math.abs(y)) * 180) / Math.PI;
  return { angle: `${bearing.toFixed(1)}deg`, elevation: `${elevation.toFixed(1)}°` };
}

const sign = (value) => `${value < 0 ? '\u2212' : '+'}${Math.abs(value).toFixed(3)}`;

// Every figure here already exists in data.js or falls out of the geometry. Surfacing
// them is the honest version of looking advanced: the reader can check the model rather
// than take it on trust. The clearance row in particular turns the author's one hard
// constraint from an invisible promise into something they can watch hold.
function buildHud(container, symptomId) {
  const symptom = getSymptom(symptomId);
  const structure = symptom && getStructure(symptom.structureId);
  container.replaceChildren();
  if (!symptom || !structure) return;

  const rows = [];
  rows.push(['TARGET', `${structure.name}${structure.aka ? `  ·  “${structure.aka}”` : ''}`]);
  rows.push(['POSITION', structure.position.map((v, i) => `${'xyz'[i]} ${sign(v)}`).join('   ')]);
  rows.push(['VECTOR', `\u27e8 ${symptom.beamDir.map(sign).join(', ')} \u27e9`]);

  const elevation = (Math.asin(Math.abs(symptom.beamDir[1])) * 180) / Math.PI;
  const entry = [`${elevation.toFixed(1)}° from axial`];
  // The two lateral tuberal symptoms are deliberately spread through one nucleus, so the
  // separation is worth stating where it applies.
  const sibling = BEAM_DEFS.find(
    (other) => other.id !== symptom.id && other.structureId === symptom.structureId,
  );
  if (sibling) {
    entry.push(`${angleBetween(symptom.id, sibling.id).toFixed(1)}° from the ${sibling.label.toLowerCase()} path`);
  }
  rows.push(['ENTRY', entry.join('  ·  ')]);

  const clearance = pinealClearance(symptomId);
  if (clearance) {
    rows.push([
      'PINEAL',
      clearance.struck
        ? 'struck directly — this is the aura path'
        : `clearance ${clearance.distance.toFixed(3)} against a gland half-extent of ${clearance.halfExtent} — no contact`,
    ]);
  }

  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'hud-row';
    const key = document.createElement('span');
    key.className = 'hud-key';
    key.textContent = label;
    const readoutValue = document.createElement('span');
    readoutValue.className = 'hud-value';
    readoutValue.textContent = value;
    if (label === 'PINEAL') row.classList.add(clearance?.struck ? 'hud-row--struck' : 'hud-row--clear');
    row.append(key, readoutValue);
    container.appendChild(row);
  });
}

// One builder for both chip groups. Roving tabindex keeps a group of controls to a
// single tab stop, with the arrow keys moving inside it.
function buildChipGroup(list, items, { single, label, onSelect }) {
  list.setAttribute('role', single ? 'radiogroup' : 'group');
  list.setAttribute('aria-label', label);

  const stateAttribute = single ? 'aria-checked' : 'aria-pressed';

  const focus = (index) => {
    buttons.forEach((button, i) => button.setAttribute('tabindex', i === index ? '0' : '-1'));
    buttons[index].focus();
    if (single) onSelect(items[index].id);
  };

  const buttons = items.map((item, index) => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.type = 'button';
    if (single) button.setAttribute('role', 'radio');
    button.dataset.symptomId = item.id;
    button.setAttribute(stateAttribute, 'false');
    button.setAttribute('tabindex', index === 0 ? '0' : '-1');
    button.textContent = item.label;
    button.addEventListener('click', () => onSelect(item.id));
    button.addEventListener('keydown', (event) => {
      const last = buttons.length - 1;
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + last) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;
      if (next === null) return;
      event.preventDefault();
      focus(next);
    });
    list.appendChild(button);
    return button;
  });

  return {
    buttons,
    // Marks the selected chips and moves the group's single tab stop onto the first of
    // them, so tabbing back in lands on the current choice.
    setSelected(ids) {
      let tabStop = -1;
      buttons.forEach((button, index) => {
        const on = ids.includes(button.dataset.symptomId);
        button.setAttribute(stateAttribute, String(on));
        if (on && tabStop < 0) tabStop = index;
      });
      const stop = tabStop < 0 ? 0 : tabStop;
      buttons.forEach((button, index) => button.setAttribute('tabindex', index === stop ? '0' : '-1'));
    },
  };
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
  container.appendChild(chipList);

  const group = buildChipGroup(chipList, SYMPTOMS, {
    single: false,
    label: `Prodrome symptoms, ${MODE_LABELS[mode]}`,
    onSelect: onSingle,
  });
  const chips = group.buttons;

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

  return { chips, boxes, group };
}

function initSimulator(scene) {
  const readoutList = document.querySelector('[data-readout]');
  const detail = document.querySelector('[data-sim-detail]');
  const hud = document.querySelector('[data-sim-hud]');
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
    detail?.replaceChildren();
    hud?.replaceChildren();
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
    // The measurements follow the force: they describe whichever path just landed.
    if (hud) buildHud(hud, id);
  };

  // Selecting more than one symptom used to empty this panel, so the most engaged action
  // available returned the least information. Several symptoms can share a nucleus, so the
  // panel describes each distinct structure the selection reaches, once.
  const setDetail = (ids) => {
    if (!detail) return;
    detail.replaceChildren();

    const seen = new Set();
    const structures = [];
    ids.forEach((id) => {
      const symptom = getSymptom(id);
      if (!symptom || seen.has(symptom.structureId)) return;
      seen.add(symptom.structureId);
      structures.push({ structure: getStructure(symptom.structureId), detail: symptom.detail });
    });

    structures.forEach((entry) => {
      if (structures.length > 1) {
        const name = document.createElement('p');
        name.className = 'detail-structure';
        name.textContent = entry.structure?.name ?? '';
        detail.appendChild(name);
      }
      const body = document.createElement('p');
      body.textContent = entry.detail;
      detail.appendChild(body);
    });
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
    setDetail(beamIds);

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
    block.group.setSelected([id]);
    fire([id]);
  };

  const selectCombination = (mode) => {
    const block = blocks.get(mode);
    if (!block) return;
    block.group.setSelected([]);
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
    block?.group.setSelected([]);
    block?.boxes.forEach((box) => {
      box.checked = false;
    });
    scene?.clearActive();
    clearReadout('Choose a symptom to follow the force through the brain.');
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const target = trigger.dataset.accordionTrigger;
      setOpen(openMode === target ? null : target);
    });
  });

  setOpen(null);

  // The scene is shared, so scrolling back to this section restates its selection
  // rather than leaving the previous section's beams on screen.
  const reapply = () => {
    if (!openMode) {
      scene?.clearActive();
      return;
    }
    const ids = currentSelection(openMode);
    if (ids.length) fire(ids, { instant: true });
    else scene?.clearActive();
  };

  const stored = safeRead();
  if (stored?.mode && blocks.has(stored.mode) && Array.isArray(stored.ids) && stored.ids.length) {
    const valid = stored.ids.filter((id) => SYMPTOMS.some((symptom) => symptom.id === id));
    if (valid.length) {
      setOpen(stored.mode, { restore: true });
      const block = blocks.get(stored.mode);
      if (valid.length === 1) {
        block?.group.setSelected(valid);
      } else {
        block?.boxes.forEach((box) => {
          box.checked = valid.includes(box.value);
        });
      }
      // Restored state appears already resolved rather than replaying on load.
      fire(valid, { instant: true });
    }
  }

  return reapply;
}

function initReference(scene) {
  const list = document.querySelector('[data-reference-list]');
  const name = document.querySelector('[data-reference-name]');
  const detail = document.querySelector('[data-reference-detail]');
  const calloutLabel = document.querySelector('[data-callout-label]');
  const calloutCaption = document.querySelector('[data-callout-caption]');
  const calloutAngle = document.querySelector('[data-callout-angle]');
  const hud = document.querySelector('[data-reference-hud]');
  const nucleus = document.querySelector('#reference-callout .nucleus-zoom');
  if (!list) return;

  const select = (id, options = {}) => {
    const symptom = getSymptom(id);
    const structure = symptom && getStructure(symptom.structureId);
    if (!symptom || !structure) return;

    group.setSelected([id]);

    // The chip already names the structure, so the panel updates at once here and
    // the line runs alongside it rather than gating the text.
    scene?.revealSymptoms([id], { instant: Boolean(options.instant) });

    const { angle, elevation } = calloutGeometry(symptom.beamDir);

    if (name) name.textContent = readout(id);
    if (detail) detail.textContent = symptom.detail;
    if (calloutLabel) {
      calloutLabel.textContent = `Inside the ${structure.aka ?? structure.name}`;
    }
    if (calloutCaption) {
      calloutCaption.textContent = `${symptom.label}: the theory’s angle of force through the ${structure.name.toLowerCase()}.`;
    }
    if (calloutAngle) {
      calloutAngle.textContent = `${elevation} from axial`;
    }
    if (hud) buildHud(hud, id);
    if (nucleus) {
      nucleus.style.setProperty('--beam-angle', angle);
    }
  };

  const group = buildChipGroup(
    list,
    BEAM_DEFS.map((symptom) => ({
      id: symptom.id,
      label: `${symptom.label} — ${getStructure(symptom.structureId)?.name ?? ''}`,
    })),
    { single: true, label: 'Prodrome Zone structures', onSelect: select },
  );

  select(BEAM_DEFS[0].id, { instant: true });

  return () => {
    const current = group.buttons.find((b) => b.getAttribute('aria-checked') === 'true');
    select(current?.dataset.symptomId ?? BEAM_DEFS[0].id, { instant: true });
  };
}

const SEQUENCE_COMPLETE =
  'Every angle has struck. The pineal is reached from its own upper-posterior direction.';

function initAnglesModule(anglesScene, motionQuery) {
  const playButton = document.querySelector('[data-play-sequence]');
  const showAllButton = document.querySelector('[data-show-all]');
  const status = document.querySelector('[data-sequence-status]');
  if (!anglesScene) return;

  let playing = false;
  let step = 0;
  let shown = null;

  const setStatus = (text) => {
    if (status) status.textContent = text;
  };

  // With reduced motion there is nothing to play, so the button steps one angle at a
  // time instead. That keeps it a different action from "Show all" and keeps its status
  // line true — it never claims a sequence ran.
  const stepped = () => motionQuery.matches;

  const resetLabel = () => {
    if (!playButton) return;
    playButton.textContent = stepped() ? 'Next angle' : 'Play sequence';
  };

  const stepOnce = () => {
    const id = BEAM_SEQUENCE[step];
    shown = { kind: 'single', id };
    anglesScene.showSingleAngle(id);
    setStatus(readout(id));
    step += 1;
    if (step >= BEAM_SEQUENCE.length) {
      step = 0;
      setStatus(`${readout(id)} — ${SEQUENCE_COMPLETE}`);
    }
  };

  const play = async () => {
    playing = true;
    if (playButton) playButton.textContent = 'Stop';
    setStatus('The force enters at each angle in turn.');
    const completed = await anglesScene.playSequence(BEAM_SEQUENCE, { onCross: (id) => setStatus(readout(id)) });
    if (completed) setStatus(SEQUENCE_COMPLETE);
    playing = false;
    resetLabel();
  };

  playButton?.addEventListener('click', () => {
    if (stepped()) {
      stepOnce();
      return;
    }
    if (playing) {
      anglesScene.cancelSequence();
      setStatus('Stopped.');
      return;
    }
    play();
  });

  showAllButton?.addEventListener('click', () => {
    if (playing) anglesScene.cancelSequence();
    step = 0;
    shown = { kind: 'all' };
    anglesScene.showAllBeams();
    setStatus('Five angles, four targets: every path the force can take.');
  });

  resetLabel();
  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', () => {
      step = 0;
      resetLabel();
    });
  }

  // Scrolling away hands the model to another section; coming back restores whatever
  // this one was last showing rather than silently emptying it.
  return () => {
    if (playing) return;
    if (shown?.kind === 'all') anglesScene.showAllBeams();
    else if (shown?.kind === 'single') anglesScene.showSingleAngle(shown.id);
  };
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
  const restateSimulator = initSimulator(scenes.simulator);
  const restateStructures = initReference(scenes.structures);
  const restateAngles = initAnglesModule(scenes.angles, motionQuery);
  initReducedMotionListener([scenes.overview], motionQuery);

  // One scene serves every section, so the section the reader has scrolled to restates
  // itself as the model is handed over.
  const stageHandlers = {
    simulator: restateSimulator,
    structures: restateStructures,
    'angles-of-force': restateAngles,
  };

  return {
    onStageChange: (id) => stageHandlers[id]?.(),
  };
}
