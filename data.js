// All game content lives here. Rename anything in this file to re-theme the game;
// the engine only refers to ids, never to display names.

export const SETTING = {
  title: 'Cinder Cell',
  town: 'Kessa Yard',
  faction: 'the Directorate',
  dungeon: 'Directorate Garrison',
  currency: 'credits',
  cur: 'cr',
  meta: 'Resolve',
  intro: [
    'Three years ago the Directorate took the foundry at Kessa Yard. Since then the quotas have doubled, the curfew has moved to dusk, and people who ask questions stop coming to work.',
    'The cell is small: a back-room medic, a fence with a stall in the market, and whoever is willing to walk through the garrison gate tonight.',
    'Every operative who goes in alone either comes back with credits or does not come back. What survives them is Resolve: the training, the routes and the nerve they leave to the next one.',
  ],
};

export const OPERATIVE_NAMES = [
  'Tamsin Rook', 'Oren Vale', 'Kel Ashby', 'Marrow Dace', 'Ysolde Kett', 'Brann Holloway',
  'Imra Sol', 'Dex Calloway', 'Nell Varga', 'Corin Mace', 'Halla Brisk', 'Juno Petrick',
  'Sefa Orrin', 'Wick Tallis', 'Lio Granger', 'Rhea Okonedo', 'Pell Stroud', 'Vida Maren',
];

// Sector names repeat with a "Sublevel" prefix past the end of the list.
export const SECTORS = [
  'Outer Checkpoint', 'Barracks Ring', 'Motor Pool', 'Comms Spire', 'Warden\u2019s Gate',
  'Ration Depot', 'Detention Level', 'Reactor Annex', 'Archive Vault', 'Siege Hangar',
  'Officers\u2019 Deck', 'Interrogation Wing', 'Signal Core', 'Directorate Chancery', 'Supervisor\u2019s Spire',
];

export const BASE_STATS = { hp: 40, atk: 6, def: 2, spd: 5 };

// Permanent training bought with Resolve. Survives death.
export const TRAINING = {
  hp:  { label: 'Endurance',    stat: 'Max HP', per: 8, max: 15, note: 'Scar tissue and stubbornness.' },
  atk: { label: 'Marksmanship', stat: 'ATK',    per: 2, max: 15, note: 'Range time behind the slag heaps.' },
  def: { label: 'Grit',         stat: 'DEF',    per: 1, max: 15, note: 'Knowing which cover holds.' },
  spd: { label: 'Reflexes',     stat: 'SPD',    per: 1, max: 15, note: 'Dodge, crit and escape odds.' },
};

// intents: weights for what the enemy does next. attack / heavy (telegraphed, x2.2) / guard / repair
export const ENEMIES = [
  { id: 'patrol', name: 'Patrol Trooper', min: 1, hp: 18, atk: 6, def: 1, spd: 4, cr: [6, 10], xp: 6,
    intents: { attack: 6, heavy: 1, guard: 1 }, line: 'A trooper rounds the corner, rifle already raised.' },
  { id: 'probe', name: 'Sentry Probe', tags: ['droid'], min: 1, hp: 13, atk: 5, def: 0, spd: 8, cr: [4, 8], xp: 5,
    intents: { attack: 5, heavy: 1 }, line: 'A sentry probe drops from the ceiling rail, lens glowing.' },
  { id: 'officer', name: 'Compliance Officer', min: 1, hp: 15, atk: 4, def: 0, spd: 5, cr: [12, 18], xp: 5,
    intents: { attack: 4, guard: 2 }, line: '\u201CPapers. Now.\u201D The officer\u2019s hand drifts to a sidearm.' },
  { id: 'hound', name: 'Security Hound', min: 2, hp: 17, atk: 7, def: 0, spd: 10, cr: [5, 9], xp: 7,
    intents: { attack: 5, heavy: 2 }, line: 'Claws on grating. A collared hound comes low and fast.' },
  { id: 'riot', name: 'Riot Enforcer', tags: ['armored'], min: 3, hp: 28, atk: 7, def: 4, spd: 3, cr: [10, 16], xp: 10,
    intents: { attack: 4, heavy: 2, guard: 2 }, line: 'An enforcer locks a shock-shield into place across the corridor.' },
  { id: 'loader', name: 'Rigged Loader Droid', tags: ['droid', 'armored'], min: 4, hp: 32, atk: 9, def: 3, spd: 2, cr: [8, 14], xp: 11,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A cargo loader, its safety governor ripped out, swings toward you.' },
  { id: 'marksman', name: 'Garrison Marksman', min: 6, hp: 20, atk: 11, def: 1, spd: 7, cr: [14, 20], xp: 12,
    intents: { attack: 3, heavy: 2, guard: 1 }, line: 'A red dot settles on your chest from the catwalk above.' },
  { id: 'interrogator', name: 'Directorate Interrogator', min: 7, hp: 26, atk: 9, def: 2, spd: 6, cr: [24, 34], xp: 13,
    intents: { attack: 3, heavy: 2, guard: 1 }, line: 'Grey coat, gloved hands. \u201CYou could make this easy.\u201D' },
  { id: 'shock', name: 'Shock Trooper', tags: ['armored'], min: 8, hp: 36, atk: 11, def: 5, spd: 5, cr: [16, 24], xp: 15,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Black armour, no insignia. Shock troopers don\u2019t take prisoners.' },
  { id: 'sentinel', name: 'Sentinel Droid', tags: ['droid', 'armored'], min: 11, hp: 44, atk: 12, def: 6, spd: 4, cr: [18, 26], xp: 17,
    intents: { attack: 3, heavy: 2, repair: 1 }, line: 'A sentinel unfolds from its alcove, three meters of plated steel.' },
];

// One boss guards the last fight of every 5th sector.
export const BOSSES = [
  { id: 'halvek', name: 'Sector Warden Halvek', tags: ['boss'], hp: 75, atk: 9, def: 3, spd: 5, cr: [70, 90], xp: 35,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Warden Halvek steps out of the gatehouse, buttoning his gloves. \u201CAnother one.\u201D' },
  { id: 'crawler', name: 'Siege Crawler', tags: ['boss', 'droid', 'armored'], hp: 125, atk: 14, def: 7, spd: 2, cr: [130, 170], xp: 60,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'The hangar floor shakes. A six-legged siege crawler turns its guns on you.' },
  { id: 'ostrane', name: 'Supervisor Ostrane', tags: ['boss'], hp: 150, atk: 18, def: 6, spd: 9, cr: [220, 280], xp: 90,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Supervisor Ostrane doesn\u2019t look up from her datapad. \u201CI read your file. All of them.\u201D' },
];

export const INTENTS = {
  attack: { label: 'Taking aim',              tone: 'warn',   tip: 'Normal attack.' },
  heavy:  { label: 'Charging a heavy strike', tone: 'danger', tip: 'x2.2 damage. Defend to cut it to a quarter.' },
  guard:  { label: 'Bracing behind cover',    tone: 'calm',   tip: 'Your attacks deal half. A free turn to heal or set up.' },
  repair: { label: 'Running self-repair',     tone: 'calm',   tip: 'Will restore 15% HP. Hit it hard now.' },
};

export const WEAPONS = [
  { id: 'holdout',  name: 'Holdout Pistol',      atk: 0,  cost: 0,   desc: 'Fits in a boot. Not much else to say.' },
  { id: 'carbine',  name: 'Salvaged Carbine',    atk: 3,  cost: 60,  desc: 'Rebuilt from three broken ones.' },
  { id: 'scatter',  name: 'Foundry Scattergun',  atk: 6,  cost: 160, desc: 'Ugly, loud, effective.' },
  { id: 'longbore', name: 'Longbore Rifle',      atk: 9,  cost: 320, crit: 0.1, desc: '+10% crit chance.' },
  { id: 'repeater', name: 'Ion-Bored Repeater',  atk: 14, cost: 620, desc: 'Stolen from a garrison armoury.' },
];

export const ARMOR = [
  { id: 'none',    name: 'Work Coveralls',       def: 0,  cost: 0,   desc: 'Foundry-issue. Smells like slag.' },
  { id: 'vest',    name: 'Padded Vest',          def: 2,  cost: 50,  desc: 'Layered cloth and luck.' },
  { id: 'plates',  name: 'Plated Jacket',        def: 4,  cost: 140, desc: 'Hull scrap sewn into canvas.' },
  { id: 'trooper', name: 'Stripped Trooper Plate', def: 7, cost: 300, spd: -1, desc: '\u22121 SPD. Paint scraped off.' },
  { id: 'weave',   name: 'Ballistic Weave',      def: 10, cost: 600, desc: 'Officer-grade. Light and quiet.' },
];

export const ITEMS = {
  stim:    { name: 'Med Stim',        cost: 20, desc: 'Restore 40% max HP.' },
  thermal: { name: 'Thermal Charge',  cost: 35, desc: 'Heavy damage that ignores armour.' },
  ion:     { name: 'Ion Pulse',       cost: 30, desc: 'Stun 1 turn. Droids: stun 3 turns and damage.' },
  smoke:   { name: 'Smoke Canister',  cost: 25, desc: 'Guaranteed escape back to town.' },
};

// One-time purchases that last until the operative dies.
export const UPGRADES = [
  { id: 'belt',   name: 'Bandolier',             cost: 70,  desc: 'Carry 3 more of each item.' },
  { id: 'reflex', name: 'Reflex Wiring',         cost: 120, desc: '+2 SPD.' },
  { id: 'medic',  name: 'Field Medic Contact',   cost: 150, desc: 'Heal 15% max HP after every fight.' },
  { id: 'drill',  name: 'Close-Quarters Drill',  cost: 180, desc: '+2 ATK.' },
  { id: 'fence',  name: 'Fence Network',         cost: 220, desc: '+25% credits from enemies.' },
];

export const EVENT_TEXT = {
  cache: 'A supply locker sits half-hidden behind a ventilation grate. The lock looks cheap.',
  sympathizer: 'A maintenance worker catches your eye, taps the wall twice and nods at a utility closet.',
  console: 'An unattended security terminal, still logged in. Somebody stepped away for a smoke.',
  prisoner: 'Behind a holding-cell door, a prisoner looks up. The release panel is right there.',
};
