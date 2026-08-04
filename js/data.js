// Anatomy is keyed separately from symptoms: two symptoms (mood, gut motility)
// share the lateral tuberal nucleus, so a symptom owns the angle and points at a
// structure rather than being one.

const LATERAL_TUBERAL_DETAIL =
  'The word "nucleus" in these areas is an anatomical term meaning a distinct cluster of specialized cells. There\'s good reason to believe these areas relate to both mood alterations and gut motility. See On the Other Side of Migraine by this author for a complete description and rationale for all of the concepts presented here.';

export const STRUCTURES = [
  {
    id: 'lateral-tuberal',
    name: 'Lateral tuberal nucleus',
    aka: 'Mystery Spot',
    position: [0.06, -0.19, 0.05],
  },
  {
    id: 'paraventricular',
    name: 'Paraventricular nucleus',
    position: [0.03, -0.12, 0.02],
  },
  {
    id: 'suprachiasmatic',
    name: 'Suprachiasmatic nucleus',
    position: [0.14, -0.22, 0.02],
  },
  {
    id: 'pineal',
    name: 'Pineal gland',
    position: [-0.28, 0.05, 0],
    special: true,
  },
];

export const SYMPTOMS = [
  {
    id: 'mood',
    label: 'Mood Alterations',
    structureId: 'lateral-tuberal',
    beamDir: [0.501, 0.852, -0.15],
    detail: LATERAL_TUBERAL_DETAIL,
  },
  {
    id: 'gut',
    label: 'Gut Motility',
    structureId: 'lateral-tuberal',
    // 24 degrees off the mood angle, through the same nucleus, so the two read as
    // distinct strikes on one target.
    beamDir: [0.614, 0.753, 0.238],
    detail: LATERAL_TUBERAL_DETAIL,
  },
  {
    id: 'fluid',
    label: 'Fluid Balance',
    structureId: 'paraventricular',
    beamDir: [0.205, 0.973, -0.102],
    detail:
      'Close within the neural neighborhood is a region associated with fluid balance. These areas are almost "next door" to one another.',
  },
  {
    id: 'wake',
    label: 'Wakefulness',
    structureId: 'suprachiasmatic',
    beamDir: [0.704, 0.704, -0.101],
    detail:
      'Just down the block in the neural neighborhood is an area linked to wakefulness—particularly symptoms that often seem opposite to alertness.',
  },
];

// Not selectable in the simulator: the aura beam is added automatically to every
// selection in the "with aura" mode, and appears on its own in the reference list.
export const AURA_SYMPTOM = {
  id: 'aura',
  label: 'Visual Aura',
  structureId: 'pineal',
  beamDir: [-0.612, 0.764, -0.204],
  detail:
    'The pineal body (gland) is a notable site within the migraine prodrome zone. Historically, it has been linked to sleep-wake cycles. More recently, it has been placed on the zone map as a key site associated with the most common type of visual migraine aura. In the old map days, an uncharted course might be labeled "here be dragons." In the pineal-body chart area, we can now say, "here be microcrystals." This helps explain the distinctive, consistent experience of the most common visual aura: the scintillating scotoma. If your visual aura takes this form, the pineal body is the likely associated site.',
};

export const BEAM_DEFS = [...SYMPTOMS, AURA_SYMPTOM];

export const SYMPTOM_IDS = SYMPTOMS.map((symptom) => symptom.id);

export const BEAM_SEQUENCE = [...SYMPTOM_IDS, AURA_SYMPTOM.id];

export const PAGE_COPY = {
  hero: {
    eyebrow: 'Migraine Companion: Energy Impact Simulator',
    title: 'Welcome to the Neural Neighborhood of Migraine',
    thesis:
      'Migraine can begin when an energy force enters the deep-brain Migraine Prodrome Zone at a specific angle. Different angles reach different neural clusters, and each cluster answers with its own warning symptom — arriving well before the severe migraine pain begins.',
    disclaimer: 'Always seek medical consultation concerning all headache and prodrome symptoms.',
  },
  prodromeZone: {
    title: 'The Migraine Prodrome Zone',
    hook: 'A newly identified brain region where the beginning of the migraine launches.',
    blurb:
      'Currently migraine research has recognized certain prodrome symptoms. Major ones are changes in mood, fluid balance, gut motility, and alert status. An educated search for those regions in the brain revealed this zone. There are specialized neural clusters for specific actions located in the hypothalamus, thalamus, and pineal body = the Migraine Prodrome Zone. They sit close together, deep beneath the cortex — near neighbors in a very small neighborhood.',
    caption:
      'The Migraine Prodrome Zone: thalamus, hypothalamus, and pineal body, the deep-brain crossroads where an attack begins.',
  },
  pineal: {
    title: 'Pineal Body (Gland)',
    points: ['Circadian rhythm and wakefulness', 'Microcrystals and visual aura'],
    blurb:
      'Established migraine research recognizes sleep disturbance, difficulty sleeping, fatigue, yawning, and alertness changes before migraine onset. Because the pineal gland helps time melatonin rhythms, it is a natural site for circadian disruption; however, more so than changes in sleep pattern, a new theory emerges tying in the discovery of microcrystals to the migraine visual aura pattern.',
    theory:
      'In this theory, a force angle strikes the pineal and stimulates the pineal microcrystals in their hexagon shape with sharp edges to create the visual hallucination. For full details of this original new theory, see',
    bookTitle: 'On the Other Side of Migraine',
    caption:
      'The pineal body times melatonin — and, struck at its own distinct angle, sets off the visual aura.',
  },
  angles: {
    hook: 'Many possible warning symptoms via prodromes.',
    blurb:
      'The theory proposes that an energy force enters the Migraine Prodrome Zone at different angles, with each angle emphasizing a different deep-brain target. The target is related to the various symptoms.',
    caption:
      'The theory: different force angles select different deep-brain targets, shaping the expression of different warning signs before migraine.',
  },
};

export function getStructure(id) {
  return STRUCTURES.find((structure) => structure.id === id);
}

export function getSymptom(id) {
  return BEAM_DEFS.find((symptom) => symptom.id === id);
}

export function getBeamTarget(id) {
  const symptom = getSymptom(id);
  return symptom ? getStructure(symptom.structureId) : undefined;
}

// "Mood Alterations / Lateral tuberal nucleus, "Mystery Spot""
export function readout(id) {
  const symptom = getSymptom(id);
  const structure = symptom && getStructure(symptom.structureId);
  if (!symptom || !structure) return '';
  const aka = structure.aka ? `, “${structure.aka}”` : '';
  return `${symptom.label} / ${structure.name}${aka}`;
}
