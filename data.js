// All game content lives here. Rename anything in this file to re-theme the game;
// the engine only refers to ids, never to display names.

export const SETTING = {
  title: 'Cinder Cell',
  town: 'Kessa Yard',
  faction: 'the Directorate',
  currency: 'credits',
  cur: 'cr',
  meta: 'Resolve',
  intro: [
    'Three years ago the Directorate took the foundry at Kessa Yard. Since then the quotas have doubled, the curfew has moved to dusk, and people who ask questions stop coming to work.',
    'The cell is small: a back-room medic, a fence with a stall in the market, and whoever is willing to walk through the gate tonight.',
    'Every operative who goes in alone either comes back with credits or does not come back. What survives them is Resolve: the training, the routes and the nerve they leave to the next one.',
  ],
};

export const OPERATIVE_NAMES = [
  'Tamsin Rook', 'Oren Vale', 'Kel Ashby', 'Marrow Dace', 'Ysolde Kett', 'Brann Holloway',
  'Imra Sol', 'Dex Calloway', 'Nell Varga', 'Corin Mace', 'Halla Brisk', 'Juno Petrick',
  'Sefa Orrin', 'Wick Tallis', 'Lio Granger', 'Rhea Okonedo', 'Pell Stroud', 'Vida Maren',
];

// Base numbers before attributes, level, gear and training.
export const BASE_STATS = { hp: 34, atk: 6, def: 2, spd: 4 };

// ---------- attributes (per operative, lost on death) ----------
export const ATTRS = {
  str: { label: 'Strength',  short: 'STR', desc: '+1.5 max HP per point. Melee and heavy weapons get +0.6 ATK per point. Power Strike at 6. Forcing doors, carrying people.' },
  agi: { label: 'Agility',   short: 'AGI', desc: '+1 SPD, +1 ranged ATK, +2.5% dodge and +3.5% ranged crit per point. Escaping and sneaking past guards.' },
  int: { label: 'Intellect', short: 'INT', desc: 'Items work 10% better per point. Overload at 3. Slicing consoles. An extra implant slot at 4 and 8.' },
  cha: { label: 'Charisma',  short: 'CHA', desc: 'Prices 4% lower and credits 5% higher per point. Intimidate at 3. People and hounds may hesitate to attack (5.5% per point; half against bosses). Bluffing and rallying.' },
};
export const ATTR_START = 1, ATTR_POINTS = 4, ATTR_CREATE_MAX = 5, ATTR_MAX = 10;

export const BACKGROUNDS = [
  { id: 'foundry', name: 'Foundry Hand', attrs: { str: 2 }, start: { gear: { melee: 'wrench' } },
    perk: 'Tough: +15 max HP, plus 2 more every level, and +1 DEF. Starts with a Foundry Wrench (melee, Power Strike).',
    desc: 'Twelve years on the casting floor before the Directorate came. Strong back, short temper.' },
  { id: 'runner', name: 'Market Runner', attrs: { agi: 2 }, start: { smoke: 1, gear: { ranged: 'slugpistol' } },
    perk: 'Slippery: +25% escape chance, +1 SPD and +5% dodge. Starts with a Slug Pistol and a smoke canister.',
    desc: 'Grew up moving goods past checkpoints. Knows every gap in every fence.' },
  { id: 'clerk', name: 'Defector Clerk', attrs: { int: 2 }, start: { ion: 1, gear: { gadget: 'datapad' } },
    perk: 'Codes: +15% on Intellect checks and one extra implant slot. Starts with a Directorate Datapad (see the enemy\u2019s next move, items +15%).',
    desc: 'Filed the arrest orders for two years. Still remembers the passwords.' },
  { id: 'preacher', name: 'Street Preacher', attrs: { cha: 2 }, start: { credits: 40 }, follower: true,
    perk: 'Voice: +1 Resolve from every boss and 10% off at the market. A follower walks into every raid with you and fights at your side.',
    desc: 'People listen when they talk. The Directorate has noticed.' },
];

// ---------- skills (combat abilities beyond Attack / Defend / Run) ----------
// cd = your turns before it can be used again. Cooldowns carry over between fights and reset at each new sector.
export const SKILLS = {
  aimed:     { name: 'Aimed Shot',      short: 'x1.5 damage, +25% crit', cd: 3, desc: 'Uses your ranged weapon. x1.5 damage, +25% crit chance.', from: 'Pistols and rifles' },
  burst:     { name: 'Burst Fire',      short: '3 quick shots', cd: 2, desc: 'Three shots at 55% each. Shreds unarmoured targets, weak against armour.', from: 'Carbines' },
  blast:     { name: 'Scatter Blast',   short: 'Big spread, x2 vs unarmoured', cd: 2, desc: 'x1.4 damage, doubled against unarmoured targets.', from: 'Scatterguns and heavy weapons' },
  smash:     { name: 'Power Strike',    short: 'Melee: heavy hit, ignores \u00BD armour', cd: 3, desc: 'Uses your melee weapon. x1.6 damage plus 1 per STR, ignores half of armour and the enemy\u2019s cover.', from: 'Melee weapons, or STR 6' },
  overload:  { name: 'Overload',        short: 'Tech blast, stuns droids', cd: 4, desc: 'Tech burst: 6 + 5 per INT, ignores armour. Droids take double and are stunned.', from: 'Tech weapons, the Arc Coil, or INT 3' },
  suppress:  { name: 'Suppressing Fire', short: 'Pins it in cover', cd: 3, desc: '60% damage and pins the enemy: its next move is forced to be taking cover.', from: 'AGI 4' },
  intimidate:{ name: 'Intimidate',      short: 'Scare a human off', cd: 99, desc: 'Once per sector. A human enemy may run. If not, its ATK drops 25% for the fight.', from: 'CHA 3' },
};
export const WEAPON_SKILL = { pistol: 'aimed', rifle: 'aimed', carbine: 'burst', scatter: 'blast', heavy: 'blast', tech: 'overload' };
// Power Strike comes from any real melee weapon (not the starter knife) or STR 6.

// ---------- gear ----------
// Six slots. Every piece of gear is an item instance { base, rarity, level, bonuses, trait } built from a base below.
// slot: ranged | melee | head | chest | legs | gadget. tier 0 = starter (never sold), 1-5 = market tiers.
// atk: main stat of weapons. def: main stat of armour. req: minimum attributes to buy or equip.
// Melee weapons add +1 ATK per STR and ignore cover. Ranged weapons get AGI crit. Heavy ranged weapons also add STR.
export const SLOTS = {
  ranged: { name: 'Ranged weapon', short: 'Ranged', stat: 'atk', desc: 'Used by Shoot, Aimed Shot, Burst Fire, Scatter Blast and Suppressing Fire. AGI adds crit chance.' },
  melee:  { name: 'Melee weapon',  short: 'Melee',  stat: 'atk', desc: 'Used by Strike and Power Strike. +1 ATK per STR, and it ignores the enemy\u2019s cover.' },
  head:   { name: 'Helmet',        short: 'Head',   stat: 'def', desc: 'DEF. Bonuses lean to status resistance.' },
  chest:  { name: 'Chest armour',  short: 'Chest',  stat: 'def', desc: 'The biggest share of your DEF.' },
  legs:   { name: 'Leg armour',    short: 'Legs',   stat: 'def', desc: 'DEF and SPD. Heavy legs slow you down, light ones speed you up.' },
  gadget: { name: 'Gadget',        short: 'Gadget', stat: null,  desc: 'A utility piece. Optional.' },
};
export const SLOT_ORDER = ['ranged', 'melee', 'head', 'chest', 'legs', 'gadget'];

export const GEAR = {
  // ranged
  holdout:  { slot: 'ranged', tier: 0, name: 'Holdout Pistol',        type: 'pistol',  atk: 2,  cost: 0,    desc: 'Fits in a boot.' },
  slugpistol: { slot: 'ranged', tier: 0, name: 'Slug Pistol',         type: 'pistol',  atk: 4,  cost: 0,    crit: 0.05, desc: 'Cheap, reliable, easy to hide. Market Runner starting gear. +5% crit.' },
  carbine:  { slot: 'ranged', tier: 1, name: 'Salvaged Carbine',      type: 'carbine', atk: 4,  cost: 60,   desc: 'Rebuilt from three broken ones.' },
  scatter:  { slot: 'ranged', tier: 2, name: 'Foundry Scattergun',    type: 'scatter', atk: 7,  cost: 150,  req: { str: 3 }, desc: 'Ugly, loud, effective.' },
  longbore: { slot: 'ranged', tier: 2, name: 'Longbore Rifle',        type: 'rifle',   atk: 8,  cost: 250,  req: { agi: 3 }, crit: 0.1, desc: '+10% crit chance.' },
  sidearm:  { slot: 'ranged', tier: 3, name: 'Officer\u2019s Sidearm', type: 'pistol',  atk: 10, cost: 300,  req: { cha: 4 }, crit: 0.06, desc: 'Talked out of a quartermaster. +6% crit.' },
  arc:      { slot: 'ranged', tier: 3, name: 'Arc Projector',         type: 'tech',    atk: 10,  cost: 420,  req: { int: 5 }, desc: 'Ignores half of armour, +50% against droids.' },
  repeater: { slot: 'ranged', tier: 4, name: 'Ion-Bored Repeater',    type: 'carbine', atk: 14, cost: 560,  req: { str: 4 }, desc: 'Stolen from a garrison armoury.' },
  gilded:   { slot: 'ranged', tier: 4, name: 'Gilded Repeater',       type: 'carbine', atk: 15, cost: 640,  req: { cha: 6 }, desc: 'A gift from someone who owes you a favour.' },
  marksman: { slot: 'ranged', tier: 5, name: 'Directorate Long Rifle', type: 'rifle',  atk: 17, cost: 760,  req: { agi: 6 }, crit: 0.15, desc: '+15% crit chance. Officer issue.' },
  cannon:   { slot: 'ranged', tier: 5, name: 'Shoulder Cannon',       type: 'heavy',   atk: 17, cost: 1000, req: { str: 7 }, spd: -1, desc: '\u22121 SPD. Adds STR to ATK like a melee weapon.' },
  // melee
  wrench:   { slot: 'melee', tier: 0, name: 'Foundry Wrench',         type: 'melee', atk: 2,  cost: 0,   desc: 'Two kilos of steel and a grudge. Foundry Hand starting gear.' },
  knife:    { slot: 'melee', tier: 0, name: 'Kitchen Knife',          type: 'melee', atk: 0,  cost: 0,   noSkill: true, desc: 'From the canteen. Better than nothing, barely.' },
  baton:    { slot: 'melee', tier: 1, name: 'Shock Baton',            type: 'melee', atk: 2,  cost: 50,  desc: 'Stolen off a riot cop.' },
  shiv:     { slot: 'melee', tier: 2, name: 'Combat Knife',           type: 'melee', atk: 4,  cost: 140, req: { agi: 3 }, crit: 0.1, desc: 'Quick and quiet. +10% crit.' },
  prod:     { slot: 'melee', tier: 2, name: 'Shock Prod',             type: 'melee', atk: 4,  cost: 160, req: { int: 3 }, droid: 0.3, desc: 'Cattle prod, overvolted. +30% against droids.' },
  maul:     { slot: 'melee', tier: 3, name: 'Breaching Maul',         type: 'melee', atk: 7,  cost: 280, req: { str: 5 }, desc: 'For doors. And for people.' },
  sabre:    { slot: 'melee', tier: 4, name: 'Officer\u2019s Sabre',   type: 'melee', atk: 9,  cost: 500, req: { cha: 5 }, crit: 0.08, desc: 'Ceremonial, until it isn\u2019t. +8% crit.' },
  axe:      { slot: 'melee', tier: 4, name: 'Breaching Axe',          type: 'melee', atk: 10, cost: 520, req: { str: 6 }, desc: 'A fire axe with ambitions.' },
  hammer:   { slot: 'melee', tier: 5, name: 'Riveting Hammer',        type: 'melee', atk: 13, cost: 850, req: { str: 8 }, spd: -1, desc: '\u22121 SPD. Built for hull plate.' },
  // head
  cap:      { slot: 'head', tier: 0, name: 'Work Cap',                def: 0, cost: 0,   desc: 'Keeps the ash out of your eyes.' },
  hood:     { slot: 'head', tier: 1, name: 'Padded Hood',             def: 1, cost: 40,  desc: 'Quilted. Warm, at least.' },
  helmet:   { slot: 'head', tier: 2, name: 'Scrap Helmet',            def: 2, cost: 120, desc: 'A welder\u2019s mask with the glass knocked out.' },
  visor:    { slot: 'head', tier: 3, name: 'Sensor Visor',            def: 2, cost: 260, req: { int: 4 }, crit: 0.04, desc: 'Highlights weak points. +4% crit.' },
  officercap:{ slot: 'head', tier: 3, name: 'Officer\u2019s Cap',     def: 2, cost: 280, req: { cha: 4 }, noShaken: true, desc: 'Nobody shouts at the cap. Immune to Shaken.' },
  trooperhelm:{ slot: 'head', tier: 3, name: 'Trooper Helmet',        def: 3, cost: 300, req: { str: 3 }, desc: 'The visor\u2019s cracked. It still stops a round.' },
  blasthelm:{ slot: 'head', tier: 5, name: 'Blast Helmet',            def: 4, cost: 620, req: { str: 6 }, desc: 'Foundry rescue gear. Heavy as sin.' },
  // chest
  none:     { slot: 'chest', tier: 0, name: 'Work Coveralls',         def: 0, cost: 0,   desc: 'Foundry-issue. Smells like slag.' },
  vest:     { slot: 'chest', tier: 1, name: 'Padded Vest',            def: 2, cost: 50,  desc: 'Layered cloth and luck.' },
  plates:   { slot: 'chest', tier: 2, name: 'Plated Jacket',          def: 4, cost: 140, desc: 'Hull scrap sewn into canvas.' },
  trooper:  { slot: 'chest', tier: 3, name: 'Stripped Trooper Plate', def: 6, cost: 300, req: { str: 3 }, spd: -1, desc: '\u22121 SPD. Paint scraped off.' },
  coat:     { slot: 'chest', tier: 4, name: 'Officer\u2019s Greatcoat', def: 6, cost: 420, req: { cha: 4 }, desc: 'Lined with plate. Guards salute before they shoot.' },
  weave:    { slot: 'chest', tier: 4, name: 'Ballistic Weave',        def: 7, cost: 560, req: { agi: 4 }, desc: 'Officer-grade. Light and quiet.' },
  exo:      { slot: 'chest', tier: 5, name: 'Foundry Exo-Frame',      def: 10, cost: 950, req: { str: 6 }, spd: -2, desc: '\u22122 SPD. A loader rig cut down to size.' },
  // legs
  trousers: { slot: 'legs', tier: 0, name: 'Work Trousers',           def: 0, cost: 0,   desc: 'Patched at both knees.' },
  padded:   { slot: 'legs', tier: 1, name: 'Padded Trousers',         def: 1, cost: 40,  desc: 'Knee pads from the casting floor.' },
  runners:  { slot: 'legs', tier: 2, name: 'Runner\u2019s Greaves',   def: 1, cost: 150, req: { agi: 3 }, spd: 1, desc: '+1 SPD. Light shin plates and good boots.' },
  plated:   { slot: 'legs', tier: 2, name: 'Plated Leggings',         def: 2, cost: 130, desc: 'Sheet steel and leather straps.' },
  officerboots:{ slot: 'legs', tier: 3, name: 'Officer\u2019s Boots',  def: 2, cost: 260, req: { cha: 4 }, spd: 1, desc: '+1 SPD. Polished. Loud on purpose.' },
  trooperlegs:{ slot: 'legs', tier: 3, name: 'Trooper Greaves',       def: 3, cost: 280, req: { str: 3 }, desc: 'Armoured from hip to ankle.' },
  exolegs:  { slot: 'legs', tier: 5, name: 'Exo Leg Struts',          def: 4, cost: 640, req: { str: 6 }, spd: -1, desc: '\u22121 SPD. Hydraulic and very sure of itself.' },
  // gadgets (no main stat; they do one thing)
  datapad:  { slot: 'gadget', tier: 0, name: 'Directorate Datapad',     cost: 0, scan: true, techBoost: 0.15, desc: 'Still logged in. Shows the enemy\u2019s next move; items work 15% better. Defector Clerk starting gear.' },
  grenadebelt:{ slot: 'gadget', tier: 1, name: 'Grenade Belt',        cost: 120, carry: 1, desc: 'Carry 1 more of each item.' },
  injector: { slot: 'gadget', tier: 2, name: 'Stim Injector',         cost: 200, stimBoost: 0.5, desc: 'Stims heal 50% more.' },
  scanner:  { slot: 'gadget', tier: 2, name: 'Threat Scanner',        cost: 260, req: { int: 3 }, scan: true, desc: 'Shows the enemy\u2019s next two moves.' },
  coil:     { slot: 'gadget', tier: 3, name: 'Arc Coil',              cost: 380, req: { int: 4 }, overload: 0.2, desc: 'Grants Overload. Overload deals +20%.' },
  // boss uniques: fixed stats and a signature effect. Bosses always drop theirs.
  halvekpistol: { slot: 'ranged', tier: 3, unique: 'halvek', name: 'Halvek\u2019s Service Pistol', type: 'pistol', atk: 11, cost: 600, crit: 0.08, bonuses: [['crit', 4]], desc: 'Critical hits cut every skill cooldown by 1.' },
  vanepistol:   { slot: 'ranged', tier: 5, unique: 'vane', name: 'Vane\u2019s Ornate Pistol', type: 'pistol', atk: 17, cost: 1200, crit: 0.1, bonuses: [['human', 20]], desc: 'Aimed Shot always crits.' },
  braskhammer:  { slot: 'melee', tier: 4, unique: 'brask', name: 'Brask\u2019s Hammer Fist', type: 'melee', atk: 11, cost: 800, bonuses: [['healkill', 4]], desc: 'Power Strike stuns for a turn.' },
  crucibleplate:{ slot: 'chest', tier: 4, unique: 'crucible', name: 'Crucible Core Plate', def: 9, cost: 900, bonuses: [['hp', 10]], desc: 'Your Strikes set enemies Burning. Burning enemies take +25% damage.' },
  crawlertreads:{ slot: 'legs', tier: 4, unique: 'crawler', name: 'Crawler Tread Greaves', def: 4, cost: 800, bonuses: [['resist', 25]], desc: 'You can\u2019t be set Burning. Furnace vents and snipers deal half.' },
  kellkey:      { slot: 'gadget', tier: 3, unique: 'kell', name: 'Kell\u2019s Cell Key', cost: 700, bonuses: [['credits', 10]], desc: 'Intimidate works on bosses at full odds and on beasts.' },
  ostranepad:   { slot: 'gadget', tier: 5, unique: 'ostrane', name: 'Ostrane\u2019s Datapad', cost: 1100, scan: true, bonuses: [['cooldown', 25]], desc: 'Shows the enemy\u2019s next two moves. Your first hit each fight is a critical.' },
};
// Which unique each boss drops.
export const BOSS_UNIQUE = { halvek: 'halvekpistol', vane: 'vanepistol', brask: 'braskhammer', crucible: 'crucibleplate', crawler: 'crawlertreads', kell: 'kellkey', ostrane: 'ostranepad' };
// What a new operative starts wearing.
export const STARTER_GEAR = { ranged: 'holdout', melee: 'knife', head: 'cap', chest: 'none', legs: 'trousers', gadget: null };

// ---------- loot rarity ----------
// mult: main stat multiplier. bonuses: random bonuses rolled. price: market price multiplier. trait: Legendary special trait.
export const RARITY = {
  common:    { name: 'Common',    color: '#a3a7a4', mult: 1,    bonuses: 0, price: 1,   up: 1 },
  rare:      { name: 'Rare',      color: '#5ea6e8', mult: 1.2,  bonuses: 1, price: 1.6, up: 1.2 },
  elite:     { name: 'Elite',     color: '#b77be8', mult: 1.45, bonuses: 2, price: 2.6, up: 1.4 },
  legendary: { name: 'Legendary', color: '#e8b23a', mult: 1.75, bonuses: 2, price: 4.2, up: 1.6, trait: true },
  unique:    { name: 'Unique',    color: '#e8673a', mult: 1,    bonuses: 0, price: 1,   up: 1.6 },
};
export const RARITY_ORDER = ['common', 'rare', 'elite', 'legendary', 'unique'];
export const UPGRADE_MAX = 5;      // +1 .. +5
export const UPGRADE_STEP = 0.08;  // main stat per upgrade level

// Random bonuses. range [low, high] at tier 1; higher tiers roll up to +50% more. slots: which slots can roll it.
const W = ['ranged', 'melee'], A3 = ['head', 'chest', 'legs'];
export const BONUSES = {
  crit:     { label: '+{v}% crit chance',            range: [3, 6],   pct: true, slots: [...W, 'head', 'gadget'] },
  spd:      { label: '+{v} SPD',                     range: [1, 1],   slots: ['head', 'legs', 'gadget'] },
  def:      { label: '+{v} DEF',                     range: [1, 2],   slots: [...A3, 'gadget'] },
  hp:       { label: '+{v} max HP',                  range: [5, 10],  slots: [...A3] },
  bleed:    { label: '{v}% chance to cause Bleeding', range: [10, 18], pct: true, slots: [...W] },
  droid:    { label: '+{v}% damage vs droids',        range: [12, 25], pct: true, slots: [...W, 'gadget'] },
  human:    { label: '+{v}% damage vs humans',        range: [10, 20], pct: true, slots: [...W, 'gadget'] },
  healkill: { label: 'Heal {v}% of max HP on a kill', range: [3, 5],   pct: true, slots: [...W, 'chest', 'gadget'] },
  cooldown: { label: '{v}% chance a skill recharges a turn faster', range: [15, 25], pct: true, slots: [...W, 'head', 'gadget'] },
  resist:   { label: '{v}% chance to shrug off a status', range: [20, 35], pct: true, slots: [...A3, 'gadget'] },
  credits:  { label: '+{v}% credits',                range: [4, 8],   pct: true, slots: [...W, ...A3, 'gadget'] },
};
// Legendary traits, by slot group.
export const TRAITS = {
  executioner: { name: 'Executioner', group: 'weapon', desc: '+40% damage to enemies below 30% HP.' },
  stunner:     { name: 'Concussive',  group: 'weapon', desc: '12% chance a hit stuns the enemy for a turn.' },
  leech:       { name: 'Leeching',    group: 'weapon', desc: 'Heal 8% of the damage you deal with this weapon.' },
  reactive:    { name: 'Reactive',    group: 'armor',  desc: 'Attackers take 20% of the damage they deal you.' },
  bulwark:     { name: 'Bulwark',     group: 'armor',  desc: 'Defending blocks 65% of damage instead of 50%.' },
  stalwart:    { name: 'Stalwart',    group: 'armor',  desc: '+12% max HP.' },
  surplus:     { name: 'Surplus',     group: 'gadget', desc: 'Start every raid with +1 Med Stim (up to your carry limit).' },
  overcharge:  { name: 'Overcharged', group: 'gadget', desc: 'Thermal, ion and stims work 20% better.' },
};
// Enemies that punish melee: Strike and Power Strike trigger this.
export const MELEE_COUNTER = {
  riot:     { name: 'Riot shield', mult: 0.5, desc: 'Strikes against it are met with the shield: you take 50% of its ATK.' },
  crucible: { name: 'Molten hull', status: { burn: 2 }, desc: 'Striking it sets you Burning.' },
  hound:    { name: 'Snapping jaws', status: { bleed: 2 }, desc: 'Get close and it bites: striking it leaves you Bleeding.' },
  slagger:  { name: 'Slag spatter', status: { burn: 2 }, desc: 'Molten slag splashes back: striking it sets you Burning.' },
  shock:    { name: 'Shock baton', mult: 0.4, desc: 'Strikes against it are answered with a baton: you take 40% of its ATK.' },
  sentinel: { name: 'Arc field', mult: 0.4, desc: 'Its hull is live: striking it costs you 40% of its ATK.' },
  brask:    { name: 'Hammer fist', mult: 0.5, desc: 'Brask loves a brawl: strikes against him are met with 50% of his ATK.' },
};

export const ITEMS = {
  stim:    { name: 'Med Stim',       short: 'Heal 40%, stop bleeding', cost: 20, desc: 'Restore 40% max HP (+10% per INT).' },
  thermal: { name: 'Thermal Charge', short: 'Big blast, ignores armour', cost: 35, desc: 'Heavy damage that ignores armour.' },
  ion:     { name: 'Ion Pulse',      short: 'Stun 1 turn (droids 3)', cost: 30, desc: 'Stun 1 turn. Droids: stun 3 turns and damage.' },
  smoke:   { name: 'Smoke Canister', short: 'Escape; drop most of this raid\u2019s loot', cost: 25, desc: 'Guaranteed escape back to town, but you drop most of the credits picked up this raid (65% to 75%, by sector).' },
};

// Implants: installed at the clinic, lost on death. Slots: 2, +1 at INT 4 and INT 8.
export const IMPLANTS = [
  { id: 'reflex',  name: 'Reflex Booster',       cost: 150, desc: '+2 SPD.' },
  { id: 'dermal',  name: 'Subdermal Plating',    cost: 180, desc: '+3 DEF.' },
  { id: 'optic',   name: 'Targeting Optic',      cost: 160, desc: '+8% crit chance.' },
  { id: 'pain',    name: 'Pain Editor',          cost: 200, desc: '+20 max HP.' },
  { id: 'adrenal', name: 'Adrenal Pump',         cost: 220, desc: 'Once per fight, below 30% HP: heal 25%.' },
  { id: 'myomer',  name: 'Myomer Fibres',        cost: 240, desc: '+2 STR.' },
  { id: 'neural',  name: 'Neural Jack',          cost: 240, desc: '+2 INT.' },
  { id: 'voice',   name: 'Voice Modulator',      cost: 200, desc: '+2 CHA.' },
  { id: 'synapse', name: 'Synapse Accelerator',  cost: 320, desc: 'Skill cooldowns 1 turn shorter.' },
];

// Contacts and mods: one-time purchases for this operative.
export const UPGRADES = [
  { id: 'belt',   name: 'Bandolier',            cost: 70,  desc: 'Carry 3 more of each item.' },
  { id: 'medic',  name: 'Field Medic Contact',  cost: 150, desc: 'Heal 15% max HP after every fight.' },
  { id: 'drill',  name: 'Close-Quarters Drill', cost: 180, desc: '+2 ATK.' },
  { id: 'forger', name: 'Forged Papers',        cost: 200, desc: 'The first enemy in each sector is caught off guard (stunned 1 turn).' },
  { id: 'fence',  name: 'Fence Network',        cost: 220, desc: '+25% credits from enemies.' },
];

// ---------- permanent progression (Resolve; survives death) ----------
export const TRAINING = {
  hp:  { label: 'Endurance',    stat: 'Max HP', per: 8, max: 20, note: 'Scar tissue and stubbornness.' },
  atk: { label: 'Marksmanship', stat: 'ATK',    per: 2, max: 20, note: 'Range time behind the slag heaps.' },
  def: { label: 'Grit',         stat: 'DEF',    per: 1, max: 20, note: 'Knowing which cover holds.' },
  spd: { label: 'Reflexes',     stat: 'SPD',    per: 1, max: 20, note: 'Dodge, crit and escape odds.' },
};
export const CELL = [
  { id: 'stash',  name: 'Hidden Stash',   cost: 6,  desc: 'New operatives start with +60 credits.' },
  { id: 'kit',    name: 'Field Kit',      cost: 6,  desc: 'New operatives start with +1 Med Stim and +1 Thermal Charge.' },
  { id: 'cache',  name: 'Weapons Cache',  cost: 8,  desc: 'New operatives start with a Salvaged Carbine and a Shock Baton.' },
  { id: 'ledger', name: 'Doc\u2019s Ledger', cost: 8, desc: 'Clinic treatment costs half.' },
  { id: 'mentor', name: 'Old Hand',       cost: 12, desc: 'New operatives get +1 attribute point at creation.' },
  { id: 'heirloom', name: 'Heirloom',     cost: 10, desc: 'When an operative dies, choose one piece of their gear to pass on to the next.' },
];

// ---------- enemies ----------
// tags: human / beast / droid / armored / boss. intents: weights for the enemy's next move.
export const ENEMIES = {
  patrol:  { name: 'Patrol Trooper', tags: ['human'], hp: 18, atk: 6, def: 1, spd: 4, cr: [6, 10], xp: 6,
    intents: { attack: 6, heavy: 1, guard: 1 }, line: 'A trooper rounds the corner, rifle already raised.' },
  probe:   { name: 'Sentry Probe', tags: ['droid'], hp: 13, atk: 5, def: 0, spd: 8, cr: [4, 8], xp: 5,
    intents: { attack: 5, heavy: 1 }, line: 'A sentry probe drops from the ceiling rail, lens glowing.' },
  officer: { name: 'Compliance Officer', tags: ['human'], hp: 15, atk: 4, def: 0, spd: 5, cr: [12, 18], xp: 5,
    intents: { attack: 4, guard: 2 }, line: '\u201CPapers. Now.\u201D The officer\u2019s hand drifts to a sidearm.' },
  hound:   { name: 'Security Hound', tags: ['beast'], hp: 17, atk: 7, def: 0, spd: 10, cr: [5, 9], xp: 7,
    intents: { attack: 5, heavy: 2 }, line: 'Claws on grating. A collared hound comes low and fast.' },
  riot:    { name: 'Riot Enforcer', tags: ['human', 'armored'], hp: 28, atk: 7, def: 4, spd: 3, cr: [10, 16], xp: 10,
    intents: { attack: 4, heavy: 2, guard: 2 }, line: 'An enforcer locks a shock-shield into place across the corridor.' },
  loader:  { name: 'Rigged Loader Droid', tags: ['droid', 'armored'], hp: 32, atk: 9, def: 3, spd: 2, cr: [8, 14], xp: 11,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A cargo loader, its safety governor ripped out, swings toward you.' },
  marksman:{ name: 'Garrison Marksman', tags: ['human'], hp: 20, atk: 11, def: 1, spd: 7, cr: [14, 20], xp: 12,
    intents: { attack: 3, heavy: 2, guard: 1 }, line: 'A red dot settles on your chest from the catwalk above.' },
  interrogator: { name: 'Directorate Interrogator', tags: ['human'], hp: 26, atk: 9, def: 2, spd: 6, cr: [24, 34], xp: 13,
    intents: { attack: 3, heavy: 2, guard: 1 }, line: 'Grey coat, gloved hands. \u201CYou could make this easy.\u201D' },
  shock:   { name: 'Shock Trooper', tags: ['human', 'armored'], hp: 36, atk: 11, def: 5, spd: 5, cr: [16, 24], xp: 15,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Black armour, no insignia. Shock troopers don\u2019t take prisoners.' },
  sentinel:{ name: 'Sentinel Droid', tags: ['droid', 'armored'], hp: 44, atk: 12, def: 6, spd: 4, cr: [18, 26], xp: 17,
    intents: { attack: 3, heavy: 2, repair: 1 }, line: 'A sentinel unfolds from its alcove, three metres of plated steel.' },
  welder:  { name: 'Welding Drone', tags: ['droid'], hp: 15, atk: 7, def: 1, spd: 7, cr: [6, 10], xp: 7,
    intents: { attack: 5, heavy: 2 }, line: 'A welding drone peels off the assembly line, torch flaring white.' },
  foreman: { name: 'Shift Foreman', tags: ['human'], hp: 22, atk: 7, def: 2, spd: 4, cr: [14, 22], xp: 9,
    intents: { attack: 4, guard: 2, heavy: 1 }, line: '\u201CYou\u2019re off-shift, worker.\u201D The foreman unclips a shock-prod.' },
  slagger: { name: 'Slag Crusher', tags: ['droid', 'armored'], hp: 40, atk: 11, def: 6, spd: 2, cr: [12, 18], xp: 14,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A slag crusher grinds out of the furnace glow, jaws still red-hot.' },
  jailer:  { name: 'Cell Guard', tags: ['human'], hp: 22, atk: 7, def: 2, spd: 5, cr: [8, 12], xp: 8,
    intents: { attack: 5, guard: 2, heavy: 1 }, line: 'A cell guard looks up from the roster. Their keys jangle as they stand.' },
  sedation:{ name: 'Sedation Droid', tags: ['droid'], hp: 20, atk: 8, def: 1, spd: 6, cr: [8, 14], xp: 9,
    intents: { attack: 4, heavy: 1, repair: 1 }, line: 'A medical droid glides out of the infirmary, needles extending.' },
  dockguard: { name: 'Dock Sentry', tags: ['human', 'armored'], hp: 30, atk: 10, def: 5, spd: 5, cr: [16, 24], xp: 13,
    intents: { attack: 4, guard: 2, heavy: 1 }, line: 'A dock sentry in vacuum-rated armour brings a carbine to bear.' },
  gunner:  { name: 'Turret Gunner', tags: ['human'], hp: 24, atk: 14, def: 3, spd: 3, cr: [18, 26], xp: 14,
    intents: { attack: 3, heavy: 3, guard: 1 }, line: 'A gunner swings the emplaced cannon around. It\u2019s already spinning up.' },

  // bosses
  halvek:  { name: 'Sector Warden Halvek', tags: ['boss', 'human'], hp: 75, atk: 9, def: 3, spd: 5, cr: [70, 90], xp: 35,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Warden Halvek steps out of the gatehouse, buttoning his gloves. \u201CAnother one.\u201D' },
  crawler: { name: 'Siege Crawler', tags: ['boss', 'droid', 'armored'], hp: 125, atk: 14, def: 7, spd: 2, cr: [130, 170], xp: 60,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'The floor shakes. A six-legged siege crawler turns its guns on you.' },
  ostrane: { name: 'Supervisor Ostrane', tags: ['boss', 'human'], hp: 150, atk: 18, def: 6, spd: 9, cr: [220, 280], xp: 90,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Supervisor Ostrane doesn\u2019t look up from her datapad. \u201CI read your file. All of them.\u201D' },
  brask:   { name: 'Overseer Brask', tags: ['boss', 'human'], hp: 85, atk: 10, def: 4, spd: 4, cr: [90, 115], xp: 40,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Overseer Brask cracks his knuckles. \u201CQuota\u2019s short. You\u2019ll make it up.\u201D' },
  crucible:{ name: 'The Crucible', tags: ['boss', 'droid', 'armored'], hp: 130, atk: 15, def: 8, spd: 2, cr: [150, 190], xp: 65,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'The furnace door opens and the Crucible walks out of it.' },
  kell:    { name: 'Warden Sabine Kell', tags: ['boss', 'human'], hp: 90, atk: 11, def: 4, spd: 7, cr: [90, 120], xp: 45,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Warden Kell closes the cell door behind you. \u201CWe have a bed ready.\u201D' },
  vane:    { name: 'Port Commodore Vane', tags: ['boss', 'human'], hp: 140, atk: 17, def: 6, spd: 8, cr: [240, 300], xp: 95,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Commodore Vane lowers his macrobinoculars. \u201CYou\u2019re a long way from the yard.\u201D' },
};

export const INTENTS = {
  attack: { label: 'Taking aim',              tone: 'warn',   tip: 'Normal attack.' },
  heavy:  { label: 'Charging a heavy strike', tone: 'danger', tip: 'x2.2 damage. Defend to cut it to a quarter.' },
  guard:  { label: 'Bracing behind cover',    tone: 'calm',   tip: 'Your attacks deal half. A free turn to heal or set up.' },
  repair: { label: 'Running self-repair',     tone: 'calm',   tip: 'Will restore 15% HP. Hit it hard now.' },
};

// ---------- rooms ----------
// Each sector is three rooms. Between rooms you pick one of two doors; at least one is always a fight.
export const ROOMS = {
  fight:  { desc: 'A standard fight.', fight: true },
  elite:  { desc: 'A veteran enemy: tougher, double credits, +50% XP.', fight: true },
  event:  { desc: 'Something worth a look. Choices and consequences, no guaranteed fight.' },
  supply: { desc: 'Credits and maybe an item. No fight.' },
  rest:   { desc: 'Patch up: heal 30% of max HP.' },
  cells:  { desc: 'Free a prisoner. They fight beside you until you leave.' },
  cargo:  { desc: 'A big haul of credits, but the next enemy is alerted.' },
  boss:   { desc: 'The sector boss. No way around it.', fight: true },
};

// ---------- maps ----------
// pool: [enemy id, sector it first appears]. unlock: deepest sector reached anywhere.
// level: extra enemy levels. events: chance of an event after a fight. theme: stage backdrop.
export const MAPS = [
  { id: 'garrison', name: 'Directorate Garrison', unlock: 0, level: 0, credits: 1, xp: 1, events: 0.3, theme: 'garrison',
    mechanic: { id: 'alarm', name: 'Alarm', desc: 'Long fights, failed escapes and botched checks raise the alarm. Each level gives enemies +6% ATK and you +5% credits. It never drops on its own; rest rooms lower it.' },
    rooms: { fight: 5, elite: 2, event: 2, supply: 1, rest: 1 },
    roomNames: { fight: 'Guard Post', elite: 'Armoury', event: 'Side Corridor', supply: 'Quartermaster', rest: 'Abandoned Bunk' },
    desc: 'Checkpoints, barracks and the regime\u2019s soldiers. The straight fight.',
    sectors: ['Outer Checkpoint', 'Barracks Ring', 'Motor Pool', 'Comms Spire', 'Warden\u2019s Gate', 'Ration Depot', 'Armoury Row', 'Reactor Annex', 'Archive Vault', 'Siege Hangar', 'Officers\u2019 Deck', 'Signal Core', 'Chancery Halls', 'Inner Keep', 'Supervisor\u2019s Spire'],
    pool: [['patrol', 1], ['probe', 1], ['officer', 1], ['hound', 2], ['riot', 3], ['marksman', 6], ['interrogator', 7], ['shock', 8], ['sentinel', 11]],
    bosses: ['halvek', 'crawler', 'ostrane'] },
  { id: 'foundry', name: 'Foundry Works', unlock: 0, level: 0, credits: 1.25, xp: 0.9, events: 0.3, theme: 'foundry',
    mechanic: { id: 'vents', name: 'Furnace vents', desc: 'Every 3 turns the vents blast the floor: 10% of your max HP, 12% of the enemy\u2019s (6% for droids). Defend on vent turns to take none.' },
    rooms: { fight: 4, elite: 2, event: 2, supply: 3, rest: 1 },
    roomNames: { fight: 'Assembly Line', elite: 'Heavy Press', event: 'Catwalks', supply: 'Scrap Heap', rest: 'Cooling Room' },
    desc: 'The occupied foundry. Heat, machines and overtime. More droids, more credits.',
    sectors: ['Slag Yard', 'Conveyor Hall', 'Casting Floor', 'Smelter Gantry', 'Foreman\u2019s Office', 'Coolant Tunnels', 'Ore Crusher', 'Pattern Shop', 'Shipping Bay', 'Furnace Core', 'Rolling Mill', 'Quench Pits', 'Tapping Floor', 'Blast Furnace', 'Control Booth'],
    pool: [['welder', 1], ['probe', 1], ['foreman', 1], ['hound', 2], ['loader', 3], ['riot', 5], ['slagger', 6], ['shock', 9], ['sentinel', 10]],
    bosses: ['brask', 'crucible', 'crawler'] },
  { id: 'detention', name: 'Detention Complex', unlock: 5, level: 1, credits: 1, xp: 1.15, events: 0.5, theme: 'detention',
    mechanic: { id: 'allies', name: 'Prisoners', desc: 'Freed prisoners fight beside you (up to 2), hitting for 30% of your ATK each turn. Enemies sometimes shoot them instead of you. Bring them home for +1 Resolve each.' },
    rooms: { fight: 4, elite: 1, event: 3, cells: 2, rest: 1 },
    roomNames: { fight: 'Guard Station', elite: 'Interrogation Room', event: 'Corridor', cells: 'Cell Block', rest: 'Laundry' },
    desc: 'Where the yard\u2019s people disappear. More prisoners, more choices, more Resolve.',
    sectors: ['Intake', 'Holding Pens', 'Processing', 'Cell Block A', 'Warden\u2019s Office', 'Isolation Wing', 'Infirmary', 'Cell Block C', 'Records Room', 'Interrogation Suite', 'Yard Gallery', 'Solitary', 'Transfer Dock', 'Deep Cells', 'Warden\u2019s Tower'],
    pool: [['jailer', 1], ['officer', 1], ['hound', 1], ['sedation', 2], ['riot', 3], ['interrogator', 4], ['marksman', 6], ['shock', 8], ['sentinel', 11]],
    bosses: ['kell', 'crawler', 'ostrane'] },
  { id: 'port', name: 'Orbital Lift Port', unlock: 10, level: 0, credits: 1.5, xp: 1.2, events: 0.25, theme: 'port',
    mechanic: { id: 'snipers', name: 'Tower snipers', desc: 'Open landing pads. Each turn there is a 20% chance a tower sniper hits you for 8% of max HP unless you Defend.' },
    rooms: { fight: 4, elite: 3, event: 1, cargo: 3, rest: 1 },
    roomNames: { fight: 'Checkpoint', elite: 'Security Office', event: 'Crew Lounge', cargo: 'Cargo Stack', rest: 'Maintenance Bay' },
    desc: 'The regime\u2019s lifeline off-world. Elite guards and rich cargo.',
    sectors: ['Cargo Gate', 'Customs Hall', 'Fuel Depot', 'Landing Pad 3', 'Tower Base', 'Container Stacks', 'Lift Shaft', 'Hangar Deck', 'Crew Quarters', 'Control Tower', 'Tether Anchor', 'Gantry Ring', 'Flight Ops', 'Command Deck', 'The Lift'],
    pool: [['dockguard', 1], ['probe', 1], ['gunner', 2], ['marksman', 3], ['shock', 4], ['sentinel', 6]],
    bosses: ['vane', 'crawler', 'ostrane'] },
];

// ---------- events between fights ----------
// check: { attr, base, per } -> chance = base + per x attribute. Effects: credits [min,max] (x sector),
// hp (fraction of max HP, + or -), resolve, attrs { str: +1 }, items { stim: 1 }, next ('stunned' | 'alerted'), heal ('full').
export const EVENTS = [
  { id: 'cache', maps: 'any', text: 'A supply locker sits half-hidden behind a ventilation grate. The lock looks cheap.',
    options: [
      { label: 'Force it open', check: { attr: 'str', base: 0.35, per: 0.1 },
        win: { credits: [12, 22], text: 'The hinge gives. Ration chits and a credit chip.' }, lose: { hp: -0.12, text: 'The locker was rigged. A shock arcs up your arm.' } },
      { label: 'Pick the lock', check: { attr: 'int', base: 0.3, per: 0.1 },
        win: { credits: [8, 14], items: { stim: 1 }, text: 'Click. Credits and a med stim, neatly packed.' }, lose: { next: 'alerted', text: 'The lock chirps. Somewhere, an alert goes out.' } },
      { label: 'Leave it', win: { text: 'Not worth the risk. You move on.' } },
    ] },
  { id: 'sympathizer', maps: 'any', text: 'A maintenance worker catches your eye, taps the wall twice and nods at a utility closet.',
    options: [
      { label: 'Follow them', win: { hp: 0.3, text: 'They clean and bind your wounds without a word.' } },
      { label: 'Ask what they\u2019ve seen', check: { attr: 'cha', base: 0.35, per: 0.1 },
        win: { next: 'stunned', resolve: 1, text: '\u201CShift change in two minutes. They\u2019ll be looking the wrong way.\u201D' }, lose: { text: 'They shake their head and vanish into the closet.' } },
      { label: 'Keep moving', win: { text: 'You can\u2019t trust anyone in here.' } },
    ] },
  { id: 'console', maps: ['garrison', 'foundry', 'port'], text: 'An unattended security terminal, still logged in. Somebody stepped away for a smoke.',
    options: [
      { label: 'Slice the door controls', check: { attr: 'int', base: 0.35, per: 0.1 },
        win: { next: 'stunned', text: 'You loop the camera feed and trip the next door early.' }, lose: { next: 'alerted', text: 'Wrong sequence. An alarm starts to wail.' } },
      { label: 'Copy the patrol routes', check: { attr: 'int', base: 0.2, per: 0.08 },
        win: { resolve: 1, attrs: { int: 1 }, text: 'The routes go to the cell. You learn a thing or two about their systems.' }, lose: { next: 'alerted', text: 'Access denied. Then a lot of red text.' } },
      { label: 'Leave it alone', win: { text: 'Terminals have a way of remembering faces.' } },
    ] },
  { id: 'prisoner', maps: ['garrison', 'detention'], text: 'Behind a holding-cell door, a prisoner looks up. The release panel is right there.',
    options: [
      { label: 'Free them', win: { hp: -0.1, resolve: 1, ally: 1, attrs: { cha: 1 }, text: 'You take a graze covering their escape. Word will spread in the yard.' } },
      { label: 'Ask what they know first', check: { attr: 'cha', base: 0.4, per: 0.1 },
        win: { credits: [15, 25], resolve: 1, text: 'A hidden credit stash, a guard rotation, and a promise to tell the others.' }, lose: { next: 'alerted', text: 'They panic and start shouting.' } },
      { label: 'Leave them', win: { text: 'You tell yourself you\u2019ll come back.' } },
    ] },
  { id: 'cardgame', maps: 'any', text: 'Two off-duty guards are playing cards, rifles racked, a pile of pay chits on the table.',
    options: [
      { label: 'Rob them at gunpoint', check: { attr: 'str', base: 0.35, per: 0.1 },
        win: { credits: [20, 35], attrs: { str: 1, cha: -1 }, text: 'They hand it over. It gets easier every time, and you don\u2019t like that.' }, lose: { hp: -0.15, next: 'alerted', text: 'One of them goes for a rifle. You get out, barely.' } },
      { label: 'Slip past', check: { attr: 'agi', base: 0.45, per: 0.1 },
        win: { next: 'stunned', attrs: { agi: 1 }, text: 'Not a single head turns. You\u2019re getting good at this.' }, lose: { next: 'alerted', text: 'A chair scrapes. \u201CWho\u2019s there?\u201D' } },
      { label: 'Pose as an inspector', check: { attr: 'cha', base: 0.25, per: 0.1 },
        win: { credits: [10, 18], resolve: 1, text: '\u201CGambling on duty? I\u2019ll take that as evidence.\u201D They don\u2019t argue.' }, lose: { hp: -0.1, next: 'alerted', text: 'They ask for your badge number.' } },
    ] },
  { id: 'wounded', maps: ['garrison', 'port'], text: 'A wounded trooper, barely more than a kid, is slumped against the wall. He\u2019s reaching for his comm.',
    options: [
      { label: 'Take the comm and go', win: { next: 'stunned', text: 'You listen in on their channel for the next stretch.' } },
      { label: 'Patch him up', cost: { stim: 1 }, win: { resolve: 1, attrs: { cha: 1 }, text: 'He stares at you the whole time. Maybe he\u2019ll remember this.' } },
      { label: 'Make sure he stays quiet', win: { attrs: { str: 1, cha: -1 }, text: 'It\u2019s quiet. It stays with you.' } },
    ] },
  { id: 'steam', maps: ['foundry'], text: 'A coolant line has burst. The corridor ahead is a wall of scalding steam.',
    options: [
      { label: 'Push through', check: { attr: 'str', base: 0.4, per: 0.1 },
        win: { attrs: { str: 1 }, text: 'Lungs burning, you make it. You\u2019ve hauled worse.' }, lose: { hp: -0.18, text: 'The steam takes skin with it.' } },
      { label: 'Reroute the valves', check: { attr: 'int', base: 0.35, per: 0.1 },
        win: { credits: [10, 16], text: 'The steam dies down, and the bypass panel had a maintenance cashbox.' }, lose: { hp: -0.1, text: 'Wrong valve. A jet of steam catches your shoulder.' } },
      { label: 'Find another way', check: { attr: 'agi', base: 0.45, per: 0.1 },
        win: { text: 'Up through the cable trays and down the other side.' }, lose: { next: 'alerted', text: 'You drop right in front of a camera.' } },
    ] },
  { id: 'workers', maps: ['foundry'], text: 'Forced-shift workers watch you from the line. One whispers: the overseer keeps a strongbox two floors up.',
    options: [
      { label: 'Rally them', check: { attr: 'cha', base: 0.25, per: 0.1 },
        win: { resolve: 1, attrs: { cha: 1 }, next: 'stunned', text: 'Someone kills the line. In the chaos, nobody is watching you.' }, lose: { next: 'alerted', text: 'Most look away. Someone calls security.' } },
      { label: 'Go for the strongbox', win: { credits: [20, 30], text: 'You crack it with a pry bar. Quota bonuses, all of it.' } },
      { label: 'Keep your head down', win: { text: 'Not tonight.' } },
    ] },
  { id: 'interrogation', maps: ['detention'], text: 'Through the glass: an interrogation. The subject\u2019s face is one you know from the market.',
    options: [
      { label: 'Break in', check: { attr: 'str', base: 0.35, per: 0.1 },
        win: { resolve: 2, ally: 1, attrs: { cha: 1 }, text: 'The interrogator runs. They pick up his baton and follow you.' }, lose: { hp: -0.2, resolve: 1, text: 'You get them out, but not cleanly.' } },
      { label: 'Cut the power', check: { attr: 'int', base: 0.35, per: 0.1 },
        win: { resolve: 1, next: 'stunned', text: 'The lights die. When they come back, the chair is empty.' }, lose: { next: 'alerted', text: 'Backup generators kick in. So do the sirens.' } },
      { label: 'Walk on', win: { attrs: { cha: -1 }, text: 'You\u2019ll remember their face. They\u2019ll remember yours.' } },
    ] },
  { id: 'armory', maps: ['garrison', 'port'], text: 'An unlocked weapons locker. Somebody\u2019s going to be in trouble for this.',
    options: [
      { label: 'Take the charges', win: { items: { thermal: 2 }, text: 'Two thermal charges, still sealed.' } },
      { label: 'Strip it for parts', win: { credits: [12, 20], text: 'Firing pins and optics. Marrow will pay for these.' } },
    ] },
  { id: 'meddroid', maps: ['detention', 'port'], text: 'A medical droid stands idle in an empty infirmary, waiting for orders.',
    options: [
      { label: 'Reprogram it', check: { attr: 'int', base: 0.35, per: 0.1 },
        win: { heal: 'full', attrs: { int: 1 }, text: 'It patches you up, then politely forgets you exist.' }, lose: { hp: -0.15, text: 'It decides you\u2019re a patient. A violent one.' } },
      { label: 'Smash it for parts', win: { credits: [8, 14], items: { stim: 1 }, text: 'Its med reservoir still has a stim in it.' } },
    ] },
  { id: 'manifest', maps: ['port'], text: 'A cargo manifest on a dock terminal: \u201CConfiscated goods, Kessa Yard.\u201D It\u2019s due to lift in an hour.',
    options: [
      { label: 'Steal it back', check: { attr: 'agi', base: 0.35, per: 0.1 },
        win: { credits: [30, 45], text: 'You reroute two crates to a smuggler\u2019s berth.' }, lose: { next: 'alerted', hp: -0.1, text: 'A loader spots you between the stacks.' } },
      { label: 'Flag it for the cell', win: { resolve: 1, text: 'The yard will know where their things went.' } },
    ] },
  { id: 'smuggler', maps: 'any', text: 'A smuggler in a stolen maintenance uniform leans out of a vent. \u201CBuying or selling?\u201D',
    options: [
      { label: 'Buy two stims (30 cr)', cost: { credits: 30 }, win: { items: { stim: 2 }, text: '\u201CPleasure doing business.\u201D' } },
      { label: 'Talk them into a discount', check: { attr: 'cha', base: 0.3, per: 0.1 },
        win: { items: { stim: 1, ion: 1 }, text: '\u201CFor the yard, then. Just this once.\u201D' }, lose: { text: '\u201CNice try.\u201D The vent cover slides shut.' } },
      { label: 'Wave them off', win: { text: 'You don\u2019t need more friends like that.' } },
    ] },
];

// ---------- status effects (on you or the enemy) ----------
export const STATUSES = {
  bleed:   { name: 'Bleeding', short: 'BLEED', desc: 'Loses 6% of max HP at the end of each round.', bad: true },
  burn:    { name: 'Burning',  short: 'BURN',  desc: 'Loses 8% of max HP at the end of each round.', bad: true },
  shaken:  { name: 'Shaken',   short: 'SHAKEN', desc: 'Deals 25% less damage.', bad: true },
  exposed: { name: 'Exposed',  short: 'EXPOSED', desc: 'Takes 25% more damage.', bad: true },
};

// ---------- enemy signature moves ----------
// Shown as the enemy's intent before it happens. Defending halves the damage and blocks the status.
export const SPECIALS = {
  patrol:   { name: 'Flashbang',      mult: 0.6, status: { exposed: 2 }, tip: 'Light damage and leaves you Exposed. Defend to block it.' },
  probe:    { name: 'Target lock',    mult: 0.3, status: { exposed: 2 }, tip: 'Marks you: Exposed for 2 turns. Defend to block it.' },
  officer:  { name: 'Citation',       mult: 0.4, status: { shaken: 2 }, tip: '\u201CYou\u2019re under arrest.\u201D Leaves you Shaken. Defend to block it.' },
  hound:    { name: 'Savage bite',    mult: 1.1, status: { bleed: 3 }, tip: 'A real bite. Bleeding for 3 turns. Defend to block it.' },
  riot:     { name: 'Shield bash',    mult: 0.9, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend to block it.' },
  loader:   { name: 'Crush',          mult: 1.6, status: { shaken: 1 }, tip: 'Heavy crushing grip. Defend.' },
  marksman: { name: 'Called shot',    mult: 1.5, status: { bleed: 2 }, tip: 'Aimed at an artery. Defend to block the bleed.' },
  interrogator: { name: 'Pressure',   mult: 0.5, status: { shaken: 2, exposed: 2 }, tip: 'Knows exactly where to push. Shaken and Exposed. Defend.' },
  shock:    { name: 'Incendiary grenade', mult: 1.0, status: { burn: 2 }, tip: 'Sets you Burning. Defend to block it.' },
  sentinel: { name: 'Lockdown beam',  mult: 0.8, status: { exposed: 3 }, tip: 'Exposed for 3 turns. Defend to block it.' },
  welder:   { name: 'Torch sweep',    mult: 0.8, status: { burn: 2 }, tip: 'Sets you Burning. Defend to block it.' },
  foreman:  { name: 'Shock prod',     mult: 0.7, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend to block it.' },
  slagger:  { name: 'Slag spit',      mult: 0.9, status: { burn: 3 }, tip: 'Molten slag. Burning for 3 turns. Defend to block it.' },
  jailer:   { name: 'Baton strike',   mult: 0.8, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend to block it.' },
  sedation: { name: 'Sedative',       mult: 0.4, status: { shaken: 3 }, tip: 'Shaken for 3 turns. Defend to block it.' },
  dockguard:{ name: 'Mag-flare',      mult: 0.5, status: { exposed: 2 }, tip: 'Leaves you Exposed. Defend to block it.' },
  gunner:   { name: 'Shrapnel round', mult: 1.0, status: { bleed: 3 }, tip: 'Bleeding for 3 turns. Defend to block it.' },
  halvek:   { name: 'Execution order', mult: 1.2, status: { shaken: 2 }, tip: 'Halvek signals the guns. Defend.' },
  crawler:  { name: 'Flame sweep',    mult: 1.0, status: { burn: 3 }, tip: 'Burning for 3 turns. Defend to block it.' },
  ostrane:  { name: 'Your file',      mult: 0.6, status: { shaken: 3, exposed: 2 }, tip: 'She reads your weaknesses aloud. Defend.' },
  brask:    { name: 'Hammer fist',    mult: 1.3, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend.' },
  crucible: { name: 'Slag torrent',   mult: 1.0, status: { burn: 3 }, tip: 'Burning for 3 turns. Defend to block it.' },
  kell:     { name: 'Solitary',       mult: 0.7, status: { exposed: 3 }, tip: 'Exposed for 3 turns. Defend to block it.' },
  vane:     { name: 'Orbital spotter', mult: 1.3, status: { exposed: 2 }, tip: 'A spotter drone paints you. Defend.' },
};

// ---------- elite modifiers (one per elite) ----------
export const AFFIXES = {
  armoured:   { name: 'Armoured',   desc: '+4 DEF.' },
  berserk:    { name: 'Berserk',    desc: '+25% ATK, but 15% less HP.' },
  regenerating: { name: 'Regenerating', desc: 'Heals 6% of max HP each round.' },
  vampiric:   { name: 'Vampiric',   desc: 'Heals half the damage it deals.' },
  volatile:   { name: 'Volatile',   desc: 'Explodes when it dies: 15% of your max HP unless you Defended.' },
  relentless: { name: 'Relentless', desc: 'Never takes cover. Uses its signature move twice as often.' },
};

// ---------- bosses ----------
export const BOSS_INFO = {
  halvek:   { epithet: 'Keeper of the Gate',        phase2: 'Halvek tears off his gloves. \u201CEnough paperwork.\u201D' },
  crawler:  { epithet: 'Siege Engine, Mark IV',      phase2: 'The crawler vents its coolant and redlines every gun.' },
  ostrane:  { epithet: 'Supervisor of Kessa Yard',  phase2: 'Ostrane finally puts the datapad down.' },
  brask:    { epithet: 'Overseer of the Casting Floor', phase2: 'Brask roars and wades in swinging.' },
  crucible: { epithet: 'The Furnace Walks',          phase2: 'The Crucible\u2019s core goes white-hot.' },
  kell:     { epithet: 'Warden of the Deep Cells',   phase2: 'Kell takes off her glasses. Her eyes are worse.' },
  vane:     { epithet: 'Master of the Lift',         phase2: 'Vane calls in the tower guns.' },
};

// ---------- contraband: run perks drafted after elites and bosses. Kept until the operative dies. ----------
export const PERKS = [
  { id: 'hollow',    name: 'Hollow-Points',      rare: false, desc: 'Critical hits deal x2.2 instead of x1.6.' },
  { id: 'dressing',  name: 'Field Dressing',     rare: false, desc: 'Heal 6% of max HP at the start of every fight.' },
  { id: 'chit',      name: 'Lucky Chit',         rare: false, desc: '+20% credits from everything.' },
  { id: 'serrated',  name: 'Serrated Rounds',    rare: false, desc: 'Your attacks have a 30% chance to cause Bleeding.' },
  { id: 'incendiary',name: 'Incendiary Mix',     rare: false, desc: 'Thermal charges also set the target Burning for 3 turns.' },
  { id: 'steady',    name: 'Steady Hands',       rare: false, desc: 'Defending boosts your next shot by +100% instead of +50%.' },
  { id: 'secondwind',name: 'Second Wind',        rare: false, desc: 'Defending also heals 5% of max HP.' },
  { id: 'scavenger', name: 'Scavenger',          rare: false, desc: '35% chance to find an item after each fight.' },
  { id: 'spotter',   name: 'Spotter',            rare: false, desc: 'Enemies start every fight Exposed for 2 turns.' },
  { id: 'thick',     name: 'Thick Skin',         rare: false, desc: 'Status effects on you last 1 turn less.' },
  { id: 'ambush',    name: 'Ambusher',           rare: true,  desc: 'Your first attack in every fight deals +50% damage.' },
  { id: 'deadman',   name: 'Dead Man\u2019s Switch', rare: true, desc: 'Once per raid, survive a killing blow with 1 HP.' },
  { id: 'grudge',    name: 'Grudge',             rare: true,  desc: '+30% damage against elites and bosses.' },
  { id: 'quickdraw', name: 'Quickdraw',          rare: true,  desc: 'Killing an enemy cuts all skill cooldowns by 2.' },
  { id: 'capacitor', name: 'Ion Capacitor',      rare: true,  desc: 'Ion pulses stun 1 turn longer. Overload deals +30%.' },
  { id: 'reputation',name: 'Reputation',         rare: true,  desc: 'Human enemies start every fight Shaken for 2 turns.' },
];

// ---------- contracts: optional jobs from the cell. Rewards are permanent Resolve and credits. ----------
// kind: kill (tag on map), sector (reach sector on map), boss (beat any boss on map), allies (bring prisoners home), haul (extract carrying credits)
export const CONTRACTS = [
  { kind: 'kill',   tag: 'droid', n: 6,  text: 'Scrap {n} droids in the {map}' },
  { kind: 'kill',   tag: 'human', n: 6,  text: 'Take down {n} Directorate personnel in the {map}' },
  { kind: 'kill',   tag: 'elite', n: 2,  text: 'Defeat {n} veterans in the {map}' },
  { kind: 'sector', n: 4,           text: 'Reach sector {n} in the {map}' },
  { kind: 'sector', n: 7,           text: 'Reach sector {n} in the {map}' },
  { kind: 'boss',   n: 1,           text: 'Bring down a boss in the {map}' },
  { kind: 'allies', n: 2,           text: 'Bring {n} freed prisoners home', map: 'detention' },
  { kind: 'haul',   n: 300,         text: 'Extract carrying at least {n} credits' },
];

// ---------- threat levels: unlocked by liberating maps (beating their sector 15 boss) ----------
export const THREAT = [
  { name: 'Standard',  desc: 'The Directorate as it is.' },
  { name: 'Threat I',  desc: 'Enemies +12% HP and ATK. +15% credits.' },
  { name: 'Threat II', desc: 'Enemies +24% HP and ATK. +30% credits. +1 Resolve per boss.' },
  { name: 'Threat III',desc: 'Enemies +36% HP and ATK. +45% credits. +1 Resolve per boss and per 5 sectors.' },
  { name: 'Threat IV', desc: 'Enemies +48% HP and ATK, elites everywhere. +60% credits. +2 Resolve per boss.' },
];

// ---------- quirks: random personalities for regular enemies (same sprites, different name, stats and habits) ----------
// mods: hp/atk multipliers, def/spd additions. cr/xp: reward multipliers.
// Behaviours: miss (chance its attacks go wild), skip (chance it does nothing), sleepy (loses its first turn),
// firstGuard (opens by taking cover), noGuard, moreGuard, flee (runs below 40% HP), gamble (hits for x0.5 or x1.8),
// bleedOnHit, selfDamage (loses a share of max HP each round), bribable (much easier to Intimidate).
export const QUIRKS = [
  { id: 'drunk', name: 'Drunk', tags: ['human'], desc: '\u221220% ATK, +20% HP. A quarter of its shots go wild.', mods: { hp: 1.2, atk: 0.8 }, miss: 0.25,
    barks: ['\u201CIss... iss past curfew, citizen.\u201D', '\u201CWho moved the floor?\u201D', '\u201CI love you, man. Hands up.\u201D'],
    misses: ['shoots a streetlamp', 'fires at its own reflection', 'drops the rifle and apologises to it', 'salutes a vending machine'] },
  { id: 'lazy', name: 'Lazy', tags: ['human', 'beast'], desc: '\u221215% ATK, \u22122 SPD. Takes cover whenever it can.', mods: { atk: 0.85, spd: -2 }, moreGuard: true,
    barks: ['\u201CCan this wait until after my break?\u201D', 'It yawns at you.', '\u201CUgh. Paperwork.\u201D'] },
  { id: 'hungover', name: 'Hungover', tags: ['human'], desc: '\u221210% ATK. Opens the fight hiding from the light.', mods: { atk: 0.9 }, firstGuard: true,
    barks: ['\u201CNot so loud...\u201D', '\u201CWhy is it so bright in here.\u201D'] },
  { id: 'sleepy', name: 'Sleepy', tags: ['human'], desc: 'Loses its first turn waking up.', mods: {}, sleepy: true,
    barks: ['\u201CFive more minutes...\u201D', 'A snore echoes down the corridor.'] },
  { id: 'rookie', name: 'Overeager', tags: ['human'], desc: '+15% ATK, \u221225% HP. Never takes cover.', mods: { atk: 1.15, hp: 0.75 }, noGuard: true,
    barks: ['\u201CMy first arrest! Mum will be so proud.\u201D', '\u201CI\u2019ve practised this in the mirror!\u201D'] },
  { id: 'paranoid', name: 'Paranoid', tags: ['human'], desc: '+3 DEF. Ducks into cover a lot.', mods: { def: 3 }, moreGuard: true,
    barks: ['\u201CI knew it. I KNEW someone was there.\u201D', '\u201CThey said I was crazy.\u201D'] },
  { id: 'corrupt', name: 'Corrupt', tags: ['human'], desc: '+80% credits. Much easier to Intimidate.', mods: {}, cr: 1.8, bribable: true,
    barks: ['\u201CMaybe we can come to an... arrangement.\u201D', 'Its pockets jingle.'] },
  { id: 'coward', name: 'Cowardly', tags: ['human'], desc: 'Runs when below 40% HP (you get half its credits).', mods: { hp: 0.9 }, flee: true,
    barks: ['\u201CI don\u2019t get paid enough for this.\u201D', 'Its knees are visibly shaking.'] },
  { id: 'decorated', name: 'Decorated', tags: ['human'], desc: '+20% HP, +15% ATK. +50% XP, +20% credits.', mods: { hp: 1.2, atk: 1.15 }, xp: 1.5, cr: 1.2,
    barks: ['\u201CFourteen commendations. You\u2019ll be fifteen.\u201D', 'Its medals clink as it squares up.'] },
  { id: 'caffeinated', name: 'Caffeinated', tags: ['human'], desc: '+3 SPD, +10% ATK, \u221210% HP.', mods: { spd: 3, atk: 1.1, hp: 0.9 },
    barks: ['\u201CFive cups. FIVE. Let\u2019s GO.\u201D', 'It is vibrating slightly.'] },
  { id: 'gambler', name: 'Gambling', tags: ['human'], desc: 'Hits for half or nearly double. +30% credits.', mods: {}, gamble: true, cr: 1.3,
    barks: ['\u201CDouble or nothing, rebel.\u201D', 'It flips a coin before raising its weapon.'] },
  { id: 'rabid', name: 'Rabid', tags: ['beast'], desc: '+25% ATK, \u221215% HP. Its hits cause Bleeding.', mods: { atk: 1.25, hp: 0.85 }, bleedOnHit: true,
    barks: ['It foams at the mouth.', 'Its eyes are not right.'] },
  { id: 'pampered', name: 'Pampered', tags: ['beast'], desc: '+40% HP, \u221220% ATK.', mods: { hp: 1.4, atk: 0.8 },
    barks: ['It is wearing a little jacket.', 'Its collar has a name tag: \u201CPrincess.\u201D'] },
  { id: 'goodboy', name: 'Distracted', tags: ['beast'], desc: 'Loses its first turn sniffing something.', mods: {}, sleepy: true,
    barks: ['It wants belly rubs first.', 'It has found a very interesting smell.'] },
  { id: 'elderly', name: 'Elderly', tags: ['beast'], desc: '\u22123 SPD, \u221210% ATK, \u221220% XP.', mods: { spd: -3, atk: 0.9 }, xp: 0.8,
    barks: ['It is very old and very angry.', 'It wheezes, then growls.'] },
  { id: 'glitchy', name: 'Glitchy', tags: ['droid'], desc: '25% chance each turn to do nothing at all.', mods: {}, skip: 0.25,
    barks: ['\u201CERROR. ERROR. WELCOME TO KESSA YARD.\u201D', '\u201CHALT. HALT. HALT. HALT. HA\u2014\u201D'] },
  { id: 'outdated', name: 'Outdated', tags: ['droid'], desc: '\u221215% ATK, \u22121 DEF.', mods: { atk: 0.85, def: -1 },
    barks: ['Its screen reads: \u201CFIRMWARE v0.9 (BETA)\u201D.', 'It boots up with a startup jingle.'] },
  { id: 'overclocked', name: 'Overclocked', tags: ['droid'], desc: '+25% ATK, +2 SPD. Loses 5% HP every round.', mods: { atk: 1.25, spd: 2 }, selfDamage: 0.05,
    barks: ['Its fans are screaming.', 'Something inside it is glowing that shouldn\u2019t be.'] },
  { id: 'rusty', name: 'Rusty', tags: ['droid'], desc: '\u22122 DEF, \u22121 SPD, \u221210% HP.', mods: { def: -2, spd: -1, hp: 0.9 },
    barks: ['It squeaks with every step.', 'A bolt falls off it.'] },
  { id: 'polite', name: 'Polite', tags: ['droid'], desc: '\u221210% ATK, +20% XP.', mods: { atk: 0.9 }, xp: 1.2,
    barks: ['\u201CPardon me. You are under arrest. Thank you.\u201D', '\u201CPlease remain still while I shoot you.\u201D'] },
  { id: 'refurbished', name: 'Refurbished', tags: ['droid'], desc: '+25% HP, +1 DEF, \u221230% credits.', mods: { hp: 1.25, def: 1 }, cr: 0.7,
    barks: ['It still has the shop tag on.', 'Its paint is suspiciously fresh.'] },
];

// ---------- bulletins: a random rule for each raid ----------
export const BULLETINS = [
  { id: 'quiet',      name: 'Quiet Night',     weight: 4,   desc: 'Nothing unusual on the Directorate channels.' },
  { id: 'payday',     name: 'Payday',          weight: 2,   desc: 'Enemies carry +30% credits, but they\u2019re well fed: +10% HP.' },
  { id: 'party',      name: 'Staff Party',     weight: 1.5, desc: 'Most of the staff are drunk, hungover, asleep or gambling.' },
  { id: 'inspection', name: 'Inspection Day',  weight: 1.5, desc: 'Everyone is on their best behaviour: no quirks and more veterans, but +20% XP.' },
  { id: 'budget',     name: 'Budget Cuts',     weight: 1.5, desc: 'Every droid is rusty, glitchy or outdated. Enemies \u22121 DEF.' },
  { id: 'lockdown',   name: 'Lockdown',        weight: 1.5, desc: 'Enemies +10% ATK, but +25% credits for the trouble.' },
  { id: 'shift',      name: 'Shift Change',    weight: 1.5, desc: 'The first enemy in every sector is caught off guard.' },
];
