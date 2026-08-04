export const STRUCTURES = [
  {
    id: 'prodrome-zone',
    name: 'The Prodrome Zone',
    nickname: 'Orientation point',
    symptom: 'Deep-brain crossroads for the theory',
    hook: 'A small deep-brain crossroads where the migraine theory begins.',
    caption:
      'This companion\'s "Prodrome Zone": thalamus, hypothalamus, and pineal region shown as the orientation point for the theory.',
    blurb:
      'Established migraine science recognizes prodrome symptoms such as sleepiness, cravings, mood shifts, yawning, light sensitivity, or a sense that something is coming. Those symptoms overlap with functions influenced by deep-brain systems, including sensory filtering, circadian timing, and autonomic regulation. In this theory, migraine begins when an energy force enters this deep-brain region at a particular angle.',
    position: [-0.08, -0.03, 0],
    noBeam: true,
  },
  {
    id: 'lateral-tuberal',
    name: 'Lateral tuberal nucleus',
    nickname: 'Mystery Spot',
    symptom: 'Mood and the broad prodrome',
    hook:
      'A tiny hypothalamic marker for the uneasy "something is coming" feeling before migraine.',
    caption:
      'The "Mystery Spot" marks the theory\'s hypothesized angle for irritability and broad prodrome changes.',
    blurb:
      'Established migraine science recognizes mood change, irritability, fatigue, cravings, thirst, yawning, and other whole-body shifts as prodrome symptoms. The hypothalamus is often discussed in migraine research because it helps regulate internal body state and communicates with emotion-linked circuits. In this theory, one angle of the migraine-initiating energy force passes through this marker and helps explain a hard-to-name change in mood, patience, and inner balance.',
    position: [0.06, -0.19, 0.05],
    beamDir: [0.501, 0.852, -0.15],
    noBeam: false,
  },
  {
    id: 'paraventricular',
    name: 'Paraventricular nucleus',
    nickname: 'PVN',
    symptom: 'Thirst, urination, and fluid balance',
    hook:
      'A tiny hypothalamic hub where the brain helps tune thirst, urine, and body-fluid balance.',
    caption:
      'The PVN helps regulate body fluids; in this theory, its angle-strike may cue thirst or urination prodrome.',
    blurb:
      'Established science links thirst and urination changes to fluid regulation, with vasopressin as one important hormone in that system. The PVN contributes to this regulation, but it is only one part of a wider body-fluid network. In this theory, an angled migraine-initiating energy force affects the PVN and produces sensations such as unusual thirst, frequent urination, or perceived fluid shifts before migraine onset.',
    position: [0.03, -0.12, 0.02],
    beamDir: [0.205, 0.973, -0.102],
    noBeam: false,
  },
  {
    id: 'suprachiasmatic',
    name: 'Suprachiasmatic nucleus',
    nickname: 'SCN',
    symptom: 'Sleep-wake timing and alertness',
    hook: 'The brain\'s tiny timekeeper, sitting just above the crossing of the optic nerves.',
    caption:
      'The SCN keeps circadian time; in this theory, its disturbance may explain sleep and wakefulness changes before migraine.',
    blurb:
      'Established migraine science recognizes fatigue, difficulty sleeping, and alertness changes during the prodrome, sometimes hours or days before migraine onset. The hypothalamus is a reasonable region to highlight for sleep-wake symptoms, but current science does not prove that one prodrome symptom maps cleanly to the SCN alone. In this theory, an angled energy force may disturb the SCN area and produce wakefulness, insomnia, listlessness, or circadian disruption before the attack.',
    position: [0.14, -0.22, 0.02],
    beamDir: [0.704, 0.704, -0.101],
    noBeam: false,
  },
  {
    id: 'pineal',
    name: 'Pineal gland',
    nickname: 'Special angle',
    symptom: 'Melatonin timing and wakefulness',
    hook:
      'A tiny night-clock sits deep behind the thalamus, where sleep timing meets a special angle in the model.',
    caption:
      'The pineal gland marks melatonin timing: established circadian biology, plus the special-angle migraine theory.',
    blurb:
      'Established migraine science recognizes sleep disturbance, difficulty sleeping, fatigue, yawning, and alertness changes before migraine onset. Because the pineal gland helps time melatonin rhythms, it is a reasonable educational marker for circadian disruption, though not proof that the pineal gland initiates migraine. In this theory, a distinct upper-posterior force angle strikes the pineal and disrupts melatonin or circadian signaling, producing pre-migraine wakefulness.',
    position: [-0.28, 0.05, 0],
    beamDir: [-0.612, 0.764, -0.204],
    noBeam: false,
    special: true,
  },
  {
    id: 'angles-of-force',
    name: 'The Different Angles of Force',
    nickname: 'Capstone',
    symptom: 'One hidden crossing, many possible warnings',
    hook: 'One hidden crossing, many possible warnings.',
    caption:
      'The theory: different force angles select different deep-brain targets, shaping different warning signs before migraine.',
    blurb:
      'Established migraine prodrome can include sleep changes, fatigue, mood shifts, hunger, thirst, frequent urination, and, for some people, later visual aura. The theory proposes that an energy force enters the Prodrome Zone at different angles, with each angle emphasizing a different deep-brain target.',
    position: [-0.02, -0.08, 0],
    noBeam: true,
  },
];

export const STRUCTURE_IDS = [
  'lateral-tuberal',
  'paraventricular',
  'suprachiasmatic',
  'pineal',
];

export const STRUCTURE_SEQUENCE = [
  'lateral-tuberal',
  'paraventricular',
  'suprachiasmatic',
  'pineal',
];

export function getStructure(id) {
  return STRUCTURES.find((structure) => structure.id === id);
}

export function getSelectableStructures() {
  return STRUCTURE_IDS.map((id) => getStructure(id));
}
