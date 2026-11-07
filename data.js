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
    perks: ['Strike hits +15% harder', 'Heal 6% HP on every kill', '+25 max HP, +3 per level, +2 DEF', 'Foundry Wrench: Power Strike'],
    perk: 'Brawler: Strike hits +15% harder and every kill heals 6% of your HP. +25 max HP, plus 3 more every level, and +2 DEF. Starts with a Foundry Wrench (melee, Power Strike).',
    desc: 'Twelve years on the casting floor before the Directorate came. Strong back, short temper.' },
  { id: 'runner', name: 'Market Runner', attrs: { agi: 2 }, start: { smoke: 1, gear: { ranged: 'slugpistol' } },
    perks: ['First hit of every fight crits', '+2 SPD, +10% dodge', '+35% escape', 'Slug Pistol and a smoke'],
    perk: 'Ambusher: your first hit of every fight is a critical. +2 SPD, +10% dodge and +35% escape chance. Starts with a Slug Pistol and a smoke canister.',
    desc: 'Grew up moving goods past checkpoints. Knows every gap in every fence.' },
  { id: 'clerk', name: 'Defector Clerk', attrs: { int: 2 }, start: { ion: 1, gear: { gadget: 'datapad' } },
    perks: ['Always see the next enemy move', 'Skills recharge 1 turn faster', 'Items and stims +25%', '+1 implant slot, +25% on INT checks', 'Datapad: items +15% more'],
    perk: 'Insider: always see the enemy\u2019s next move, skills recharge a turn faster, and items and stims work 25% better. +25% on Intellect checks and one extra implant slot. Starts with a Directorate Datapad (items +15% more).',
    desc: 'Filed the arrest orders for two years. Still remembers the passwords.' },
  { id: 'preacher', name: 'Street Preacher', attrs: { cha: 2 }, start: { credits: 40 }, follower: true,
    perks: ['A follower fights beside you, and hits hard', '+2 Resolve per boss', '+15% credits, 15% off the market', '+40 credits'],
    perk: 'Voice: a follower walks into every raid with you, and everyone at your side hits two-thirds harder. +2 Resolve from every boss, +15% credits and 15% off at the market.',
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
  intimidate:{ name: 'Intimidate',      short: 'Scare a human off', cd: 99, desc: 'Once per sector. A human enemy may run. If not, its ATK drops 25% for the fight, up to 40% with high CHA. Bosses never run, so a boss just loses the ATK.', from: 'CHA 3' },
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
  // added in v5: more mid and deep-game pieces. Tier 6 shows up once an operative is deep enough.
  needler:  { slot: 'ranged', tier: 2, name: 'Flechette Needler',     type: 'pistol',  atk: 6,  cost: 190,  req: { agi: 2 }, crit: 0.08, desc: 'Fires a fan of steel slivers. +8% crit.' },
  rivetgun: { slot: 'ranged', tier: 3, name: 'Rivet Gun',             type: 'heavy',   atk: 9,  cost: 340,  req: { str: 4 }, desc: 'Foundry tool, barely modified. Adds STR to ATK like a melee weapon.' },
  smartgun: { slot: 'ranged', tier: 4, name: 'Tracking Smartgun',     type: 'tech',    atk: 13, cost: 620,  req: { int: 5 }, desc: 'Ignores half of armour, +50% against droids. The rounds argue with gravity.' },
  railcarbine:{ slot: 'ranged', tier: 6, name: 'Rail Carbine',        type: 'carbine', atk: 20, cost: 1350, req: { agi: 6 }, crit: 0.06, desc: 'Lift-port security issue. +6% crit.' },
  wardenrifle:{ slot: 'ranged', tier: 6, name: 'Warden-Pattern Rifle', type: 'rifle',  atk: 21, cost: 1500, req: { agi: 7 }, crit: 0.16, desc: '+16% crit chance. Built to hit things on the far side of an orbit.' },
  pipe:     { slot: 'melee', tier: 1, name: 'Lead Pipe',              type: 'melee', atk: 3,  cost: 60,  desc: 'Plumbing, repurposed.' },
  cleaver:  { slot: 'melee', tier: 3, name: 'Ration Cleaver',         type: 'melee', atk: 7,  cost: 300, req: { agi: 4 }, crit: 0.08, desc: 'From the depot kitchens. +8% crit.' },
  arcblade: { slot: 'melee', tier: 5, name: 'Arc Blade',              type: 'melee', atk: 12, cost: 880, req: { int: 5 }, droid: 0.4, desc: 'A charged edge. +40% against droids.' },
  breacher: { slot: 'melee', tier: 6, name: 'Hydraulic Breacher',     type: 'melee', atk: 17, cost: 1400, req: { str: 8 }, spd: -1, desc: '\u22121 SPD. Opens blast doors and the people behind them.' },
  respirator:{ slot: 'head', tier: 2, name: 'Smog Respirator',        def: 1, cost: 110, spd: 1, desc: '+1 SPD. You stop coughing. You start running.' },
  wardenhelm:{ slot: 'head', tier: 6, name: 'Warden-Pattern Helm',    def: 6, cost: 1000, req: { str: 5 }, crit: 0.04, desc: 'Targeting glass in the visor. +4% crit.' },
  smuggler: { slot: 'chest', tier: 3, name: 'Smuggler\u2019s Duster', def: 4, cost: 320, req: { agi: 3 }, spd: 1, desc: '+1 SPD. Pockets inside the pockets.' },
  wardenplate:{ slot: 'chest', tier: 6, name: 'Warden-Pattern Plate', def: 13, cost: 1450, req: { str: 7 }, spd: -1, desc: '\u22121 SPD. Frigate marine armour, still warm.' },
  mag:      { slot: 'legs', tier: 4, name: 'Mag-Boots',               def: 3, cost: 480, req: { agi: 4 }, spd: 1, desc: '+1 SPD. Grip on any deck, at any angle.' },
  wardenlegs:{ slot: 'legs', tier: 6, name: 'Warden-Pattern Greaves', def: 6, cost: 1000, req: { str: 6 }, desc: 'Armoured to the boot.' },
  medkit:   { slot: 'gadget', tier: 3, name: 'Trauma Kit',            cost: 360, stimBoost: 0.8, desc: 'Stims heal 80% more.' },
  bandolier:{ slot: 'gadget', tier: 4, name: 'Combat Bandolier',      cost: 520, carry: 2, desc: 'Carry 2 more of each item.' },
  // boss uniques: fixed stats and a signature effect. Bosses always drop theirs.
  halvekpistol: { slot: 'ranged', tier: 3, unique: 'halvek', name: 'Halvek\u2019s Service Pistol', type: 'pistol', atk: 11, cost: 600, crit: 0.08, bonuses: [['crit', 4]], desc: 'Critical hits cut every skill cooldown by 1.' },
  vanepistol:   { slot: 'ranged', tier: 5, unique: 'vane', name: 'Vane\u2019s Ornate Pistol', type: 'pistol', atk: 17, cost: 1200, crit: 0.1, bonuses: [['human', 20]], desc: 'Aimed Shot always crits.' },
  braskhammer:  { slot: 'melee', tier: 4, unique: 'brask', name: 'Brask\u2019s Hammer Fist', type: 'melee', atk: 11, cost: 800, bonuses: [['healkill', 4]], desc: 'Power Strike stuns for a turn.' },
  crucibleplate:{ slot: 'chest', tier: 4, unique: 'crucible', name: 'Crucible Core Plate', def: 9, cost: 900, bonuses: [['hp', 10]], desc: 'Your Strikes set enemies Burning. Burning enemies take +25% damage.' },
  crawlertreads:{ slot: 'legs', tier: 4, unique: 'crawler', name: 'Crawler Tread Greaves', def: 4, cost: 800, bonuses: [['resist', 25]], desc: 'You can\u2019t be set Burning. Furnace vents and snipers deal half.' },
  kellkey:      { slot: 'gadget', tier: 3, unique: 'kell', name: 'Kell\u2019s Cell Key', cost: 700, bonuses: [['credits', 10]], desc: 'Intimidate takes 40% of a boss\u2019s ATK instead of 25%, and works on beasts.' },
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
export const UPGRADE_MAX = 8;      // +1 .. +8 (the late bench levels come with threat and the later districts)
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
  warder:   { name: 'Shield and prod', mult: 0.4, desc: 'The prod comes round the shield: striking it costs you 40% of its ATK.' },
  hale:     { name: 'Heat suit', status: { burn: 2 }, desc: 'His suit runs at furnace heat: striking him sets you Burning.' },
};

export const ITEMS = {
  stim:    { name: 'Med Stim',       short: 'Heal 40%, stop bleeding', cost: 20, desc: 'Restore 40% max HP (+10% per INT).' },
  thermal: { name: 'Thermal Charge', short: 'Big blast, ignores armour', cost: 35, desc: 'Heavy damage that ignores armour.' },
  ion:     { name: 'Ion Pulse',      short: 'Stun 1 turn (droids 3)', cost: 30, desc: 'Stun 1 turn. Droids: stun 3 turns and damage.' },
  smoke:   { name: 'Smoke Canister', short: '70% escape; drop most of this raid\u2019s loot', cost: 25, desc: '70% chance to escape back to town. If it fails, the fight goes on and the canister is spent. Escaping drops most of the credits picked up this raid (65% to 75%, by sector).' },
};

// Implants: installed at the clinic, lost on death. Slots: 2, +1 at INT 4 and INT 8.
export const IMPLANTS = [
  { id: 'reflex',  name: 'Reflex Booster',       cost: 150, desc: '+3 SPD.' },
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
  { id: 'corpsman', name: 'Black-Bag Corpsman', cost: 130, desc: 'Stims heal 25% more.' },
  { id: 'driver', name: 'Getaway Driver',       cost: 140, desc: '+15% chance to escape a fight.' },
  { id: 'lining', name: 'Reinforced Lining',    cost: 160, desc: '+2 DEF.' },
  { id: 'quarter', name: 'Quartermaster',       cost: 200, desc: 'One free stim at the start of every raid.' },
  { id: 'route',  name: 'Smuggler\u2019s Route', cost: 240, desc: 'Leaving a raid early costs 15% less.' },
  { id: 'broker', name: 'Contraband Broker',    cost: 260, desc: 'Contraband offers show four pieces instead of three.' },
  { id: 'informant', name: 'Street Informant',  cost: 280, desc: 'Shows the enemy\u2019s next two moves.' },
  { id: 'favour', name: 'Marrow\u2019s Favour', cost: 300, desc: 'Everything at the market costs 10% less.' },
  { id: 'ripper', name: 'Back-Alley Ripper',    cost: 320, desc: 'One more implant slot.' },
];
export const MOD_STEP = 1.25; // each mod an operative buys makes the next one this much dearer

// ---------- permanent progression (Resolve; survives death) ----------
// Drones: one per operative, chosen at creation. They can't be shot down, and die only with their operative.
// ranks: the drone's strength at rank 1 to 5. Resolve buys ranks; ranks 3 and 5 add an ability.
export const DRONES = {
  hornet: { name: 'Hornet', role: 'Attack', what: 'Fires after each of your turns.', effect: (v) => `Shots add up to ${v}% of your ATK a turn, ignoring armour.`, ranks: [10, 18, 27, 36, 48],
    abilities: { 3: { name: 'Finisher', desc: 'Double damage to enemies under 30% HP.' }, 5: { name: 'Marker', desc: '10% chance a turn to leave the enemy Exposed.' } } },
  aegis: { name: 'Aegis', role: 'Shield', what: 'Soaks part of every hit.', effect: (v) => `Blocks ${v}% of attack damage.`, ranks: [9, 15, 21, 28, 36],
    abilities: { 3: { name: 'Intercept', desc: '8% chance to stop an attack outright.' }, 5: { name: 'Feedback', desc: 'A stopped attack zaps the enemy for your ATK.' } } },
  mender: { name: 'Mender', role: 'Healing', what: 'Patches you up mid-fight.', effect: (v) => `Heals ${v}% of max HP a turn.`, ranks: [1.5, 2.5, 3.5, 4.5, 5.5],
    abilities: { 3: { name: 'Coagulant', desc: '25% chance a turn to stop bleeding and burns.' }, 5: { name: 'Emergency', desc: 'Once a fight, heals 15% when you fall under 25% HP.' } } },
  magpie: { name: 'Magpie', role: 'Tech', what: 'Uses gear it finds, for free.', effect: (v) => `${v}% chance a turn to use a free thermal, ion pulse or stim.`, ranks: [3, 5, 7, 9, 12],
    abilities: { 3: { name: 'Scavenger', desc: '15% chance to find an item after a fight.' }, 5: { name: 'Overdrive', desc: 'Its thermals and ion pulses hit 50% harder.' } } },
};
export const DRONE_ORDER = ['hornet', 'aegis', 'mender', 'magpie'];
export const DRONE_MAX_RANK = 5;
export const DRONE_UPGRADE = [5, 8, 13, 18]; // Resolve to reach rank 2, 3, 4 and 5
export const DRONE_DAMAGE = 0.1; // chance of being knocked out each time a sector is cleared
export const TRAINING = {
  hp:  { label: 'Endurance',    stat: 'Max HP', per: 8, max: 20, note: 'Scar tissue and stubbornness.' },
  atk: { label: 'Marksmanship', stat: 'ATK',    per: 2, max: 20, note: 'Range time behind the slag heaps.' },
  def: { label: 'Grit',         stat: 'DEF',    per: 1, max: 20, note: 'Knowing which cover holds.' },
  spd: { label: 'Reflexes',     stat: 'SPD',    per: 1, max: 20, note: 'Dodge, crit and escape odds.' },
};
// Upgrades for the whole cell. Each level costs its own Resolve and lifts the benefit; `v` is what the rules read.
export const CELL = [
  { id: 'stash', name: 'Hidden Stash', levels: [
    { cost: 4, v: 30, desc: 'New operatives start with +30 credits.' }, { cost: 6, v: 60, desc: 'New operatives start with +60 credits.' },
    { cost: 10, v: 120, desc: 'New operatives start with +120 credits.' }, { cost: 16, v: 240, desc: 'New operatives start with +240 credits.' }] },
  { id: 'kit', name: 'Field Kit', levels: [
    { cost: 4, v: [1, 0], desc: 'New operatives start with +1 Med Stim.' }, { cost: 6, v: [1, 1], desc: 'New operatives start with +1 Med Stim and +1 Thermal Charge.' },
    { cost: 9, v: [2, 1], desc: 'New operatives start with +2 Med Stims and +1 Thermal Charge.' }, { cost: 14, v: [2, 2], desc: 'New operatives start with +2 Med Stims and +2 Thermal Charges.' }] },
  { id: 'cache', name: 'Weapons Cache', levels: [
    { cost: 5, v: 1, desc: 'New operatives start with a Shock Baton.' }, { cost: 7, v: 2, desc: 'New operatives start with a Shock Baton and a Salvaged Carbine.' }] },
  { id: 'ledger', name: 'Doc\u2019s Ledger', levels: [
    { cost: 4, v: 0.15, desc: 'Clinic treatment costs 15% less.' }, { cost: 6, v: 0.3, desc: 'Clinic treatment costs 30% less.' },
    { cost: 9, v: 0.5, desc: 'Clinic treatment costs half.' }, { cost: 14, v: 0.65, desc: 'Clinic treatment costs 65% less.' }] },
  { id: 'mentor', name: 'Old Hand', levels: [
    { cost: 7, v: 1, desc: 'New operatives get +1 attribute point at creation.' }, { cost: 14, v: 2, desc: 'New operatives get +2 attribute points at creation.' }, { cost: 22, v: 3, desc: 'New operatives get +3 attribute points at creation.' }] },
  { id: 'heirloom', name: 'Heirloom', levels: [{ cost: 11, v: 1, desc: 'When an operative dies, choose one piece of their gear to pass on to the next.' }] },
  { id: 'lockup1', name: 'Lockup Shelving', levels: [{ cost: 7, v: 1, desc: 'The Lockup holds 2 more pieces.' }] },
  { id: 'lockup2', name: 'False Floor', levels: [{ cost: 14, v: 1, desc: 'The Lockup holds 2 more pieces again.' }] },
];
// What an upgrade bought before levels existed is worth this level.
export const CELL_LEGACY = { stash: 2, kit: 2, cache: 2, ledger: 3, mentor: 1 };

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

  // small ground bots: cheap to build, cheap to field, sent ahead of the real troops
  smallbot: { name: 'Sentry Walker', tags: ['droid'], hp: 11, atk: 5, def: 0, spd: 6, cr: [4, 7], xp: 4,
    intents: { attack: 6, heavy: 1 }, line: 'A knee-high walker stomps out of a side door, gun arm twitching.' },
  bulwark: { name: 'Bulwark Bot', tags: ['droid', 'armored'], hp: 16, atk: 5, def: 3, spd: 3, cr: [6, 10], xp: 6,
    intents: { attack: 4, guard: 3, heavy: 1 }, line: 'A squat bot shuffles forward behind a dented shield.' },
  spotweld: { name: 'Spot Welder', tags: ['droid'], hp: 12, atk: 6, def: 1, spd: 6, cr: [5, 8], xp: 5,
    intents: { attack: 5, heavy: 1 }, line: 'A foundry walker trundles at you, its welding tip already white.' },
  slagrunt: { name: 'Slag Runt', tags: ['droid', 'armored'], hp: 18, atk: 7, def: 2, spd: 3, cr: [6, 10], xp: 7,
    intents: { attack: 4, heavy: 2 }, line: 'A hunched little furnace on legs. Its grate glows brighter as it nears.' },
  cuffbot: { name: 'Cuff Bot', tags: ['droid'], hp: 14, atk: 6, def: 1, spd: 6, cr: [5, 8], xp: 6,
    intents: { attack: 5, heavy: 1 }, line: 'A restraint bot clicks up the corridor, cuffs snapping open and shut.' },
  gasbot: { name: 'Gas Bot', tags: ['droid'], hp: 13, atk: 5, def: 0, spd: 5, cr: [6, 9], xp: 6,
    intents: { attack: 5, heavy: 1 }, line: 'A small tank on legs wheezes green vapour from its nozzle.' },
  mortarbot: { name: 'Mortar Bot', tags: ['droid'], hp: 15, atk: 9, def: 1, spd: 2, cr: [10, 14], xp: 8,
    intents: { attack: 3, heavy: 3 }, line: 'A stubby walker plants its feet and tilts the tube on its back.' },
  deckbot: { name: 'Deck Bot', tags: ['droid'], hp: 13, atk: 7, def: 1, spd: 8, cr: [8, 12], xp: 6,
    intents: { attack: 6, heavy: 1 }, line: 'A white maintenance bot scuttles along the deck with a rivet gun raised.' },

  // each district's own people, in place of some of the Garrison's loaned roster
  stoker:  { name: 'Furnace Stoker', tags: ['human'], hp: 18, atk: 7, def: 1, spd: 5, cr: [6, 10], xp: 7,
    intents: { attack: 5, heavy: 2 }, line: 'A stoker turns from the firebox with a shovel full of live coals.' },
  hookbot: { name: 'Crane Hook Droid', tags: ['droid', 'armored'], hp: 28, atk: 7, def: 4, spd: 3, cr: [10, 16], xp: 10,
    intents: { attack: 4, heavy: 2, repair: 1 }, line: 'A hook droid drops off the overhead rail, its hook swinging ahead of it.' },
  castguard: { name: 'Casting Guard', tags: ['human', 'armored'], hp: 36, atk: 12, def: 5, spd: 4, cr: [16, 24], xp: 15,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'A casting guard in scorched plate racks a slug rifle.' },
  warder:  { name: 'Block Warder', tags: ['human', 'armored'], hp: 30, atk: 7, def: 4, spd: 3, cr: [10, 16], xp: 10,
    intents: { attack: 4, heavy: 2, guard: 2 }, line: 'A warder steps out behind a riot shield, shock prod crackling.' },
  orderly: { name: 'Ward Orderly', tags: ['human'], hp: 17, atk: 6, def: 0, spd: 6, cr: [7, 11], xp: 7,
    intents: { attack: 5, heavy: 1 }, line: 'An orderly in a stained smock thumbs the cap off an injector.' },
  customs: { name: 'Customs Enforcer', tags: ['human'], hp: 22, atk: 10, def: 2, spd: 6, cr: [14, 20], xp: 11,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: '\u201cDeclare that.\u201d A customs enforcer levels a carbine at your chest.' },
  tetherdrone: { name: 'Tether Drone', tags: ['droid'], hp: 14, atk: 5, def: 1, spd: 8, cr: [5, 9], xp: 6,
    intents: { attack: 5, heavy: 1 }, line: 'A tether drone rises off the pad, trailing a weighted line.' },
  exo:     { name: 'Cargo Exo', tags: ['human', 'armored'], hp: 38, atk: 11, def: 5, spd: 3, cr: [16, 24], xp: 15,
    intents: { attack: 3, heavy: 3, guard: 1 }, line: 'A loader in a cargo exoskeleton clanks round the stack, fists raised.' },

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
  // Base stats follow each boss's place in its own district (first, second, third, last). The district's offset and the
  // engine's level growth already make a later district's bosses hit harder, so these aren't scaled for it again.
  dray:    { name: 'Colonel Marrick Dray', tags: ['boss', 'human'], hp: 135, atk: 16, def: 6, spd: 6, cr: [180, 230], xp: 75,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Colonel Dray waits on the Spire steps, sabre at his side. \u201CStand up straight.\u201D' },
  slagmother: { name: 'The Slagmother', tags: ['boss', 'droid', 'armored'], hp: 145, atk: 16, def: 8, spd: 2, cr: [190, 240], xp: 80,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A bell rings on the ladle track. The Slagmother swings its ladle round to face you.' },
  hale:    { name: 'Chief Engineer Corvin Hale', tags: ['boss', 'human'], hp: 150, atk: 18, def: 6, spd: 7, cr: [240, 300], xp: 95,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Hale lifts his visor. \u201CYou\u2019re the fault I\u2019ve been chasing all quarter.\u201D' },
  restraint: { name: 'The Restraint Engine', tags: ['boss', 'droid', 'armored'], hp: 125, atk: 14, def: 7, spd: 2, cr: [130, 170], xp: 60,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A cage on legs fills the corridor. \u201CPlease remain still. Restraint is for your safety.\u201D' },
  voight:  { name: 'Dr. Ansel Voight', tags: ['boss', 'human'], hp: 135, atk: 16, def: 5, spd: 7, cr: [180, 230], xp: 75,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Dr. Voight looks up from a steel tray. \u201CSit. We\u2019ll start with your shift.\u201D' },
  venn:    { name: 'Magistrate Orla Venn', tags: ['boss', 'human'], hp: 150, atk: 18, def: 7, spd: 6, cr: [240, 300], xp: 95,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Magistrate Venn does not rise from the bench. \u201CThe accused will approach.\u201D' },
  pell:    { name: 'Customs Chief Pell', tags: ['boss', 'human'], hp: 90, atk: 11, def: 4, spd: 5, cr: [100, 130], xp: 45,
    intents: { attack: 4, heavy: 2, guard: 1 }, line: 'Chief Pell runs a scanner over you and frowns at it. \u201CAnything to declare?\u201D' },
  gantry:  { name: 'The Gantry Walker', tags: ['boss', 'droid', 'armored'], hp: 130, atk: 15, def: 7, spd: 2, cr: [150, 190], xp: 65,
    intents: { attack: 3, heavy: 3, repair: 1 }, line: 'A cargo walker steps off the gantry, hook swinging. The cab radio crackles. \u201CSorry.\u201D' },
  imre:    { name: 'Director Saul Imre', tags: ['boss', 'human'], hp: 160, atk: 19, def: 7, spd: 9, cr: [300, 360], xp: 110,
    intents: { attack: 3, heavy: 2, guard: 2 }, line: 'Director Imre stands at the glass with his back to you. \u201CCome and look at it first.\u201D' },
};

export const INTENTS = {
  attack: { label: 'Taking aim',              tone: 'warn',   tip: 'Normal attack.' },
  heavy:  { label: 'Charging a heavy strike', tone: 'danger', tip: 'x2.2 damage. Defend to cut it to about a third.' },
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
  rest:   { desc: 'Patch up: heal 30% of max HP and stop any bleeding or burns.' },
  cells:  { desc: 'Free a prisoner. They fight beside you until you leave.' },
  cargo:  { desc: 'A big haul of credits, but the next enemy is alerted.' },
  boss:   { desc: 'The sector boss. No way around it.', fight: true },
  // v5 rooms: rarer doors that show up on every map.
  bounty: { desc: 'A marked officer with a price on their head: a veteran fight that pays +60% credits.', fight: true },
  vault:  { desc: 'A strongroom. INT to crack it clean for a big haul; fumble it and the trap bites.' },
  medbay: { desc: 'A field medic station: heal 20% and grab a stim.' },
  locker: { desc: 'A sealed weapons locker: one piece of gear, rare or better.' },
  bench:  { desc: 'An unattended workbench: +1 upgrade on one of your pieces, free.' },
  fence:  { desc: 'A smuggler\u2019s stash: pick a piece of contraband.' },
};
// Extra doors every map can roll, by weight (the map's own rooms weigh 1 to 5 each).
export const EXTRA_ROOMS = { bounty: 0.6, vault: 0.6, medbay: 0.5, locker: 0.35, bench: 0.35, fence: 0.3 };
export const EXTRA_ROOM_NAMES = { bounty: 'Marked Officer', vault: 'Strongroom', medbay: 'Field Medic Station', locker: 'Weapons Locker', bench: 'Machinist\u2019s Bench', fence: 'Smuggler\u2019s Stash' };
// Sector conditions: rolled for every sector after the first, shown on the route screen. They change how the floor plays.
export const SECTOR_CONDS = [
  { id: 'none',     name: 'Clear Floor',     weight: 5, desc: 'Nothing unusual on this level.' },
  { id: 'blackout', name: 'Blackout',        weight: 1.5, desc: 'The lights are down. Enemies start every fight Exposed for 1 turn; +15% XP.' },
  { id: 'toxic',    name: 'Coolant Leak',    weight: 1.2, desc: 'The air bites. You lose 4% max HP after every fight here, but everything pays +25%.' },
  { id: 'patrol',   name: 'Double Patrols',  weight: 1.2, desc: 'Enemies +15% HP. They also carry +30% credits.' },
  { id: 'supplies', name: 'Supply Depot',    weight: 1.2, desc: 'Supply and rest rooms are more common, and rests heal 40%.' },
  { id: 'hunters',  name: 'Hunter Squad',    weight: 1, desc: 'A quarter of regular fights are veterans, and veterans drop gear more often.' },
  { id: 'derelict', name: 'Derelict Wing',   weight: 1.2, desc: 'Half-abandoned. Enemies \u221210% ATK and side corridors are more common.' },
  { id: 'lockdown', name: 'Sealed Bulkheads', weight: 0.8, desc: 'Fewer ways around: every door is a fight, but each pays +20% credits and XP.' },
];

// ---------- maps ----------
// pool: [enemy id, sector it first appears]. unlock: deepest sector reached anywhere.
// level: extra enemy levels. events: chance of an event after a fight. theme: stage backdrop.
// Enemies from the Garrison's roster picked up the habits of whichever district they were sent to.
export const MAP_VARIANT_IDS = ['probe', 'officer', 'hound', 'riot', 'marksman', 'interrogator', 'shock', 'sentinel'];
export const MAP_VARIANT = {
  foundry: { prefix: 'Soot-Caked', atk: 1.06, hp: 0.95 },
  detention: { prefix: 'Block', def: 1, hp: 0.95 },
  port: { prefix: 'Vacuum-Rated', hp: 1.08, spd: -1 },
};
export const MAPS = [
  { id: 'garrison', name: 'Directorate Garrison', unlock: {}, offset: 0, level: 0, credits: 1, xp: 1, events: 0.3, theme: 'garrison',
    mechanic: { id: 'alarm', name: 'Alarm', desc: 'Long fights and botched checks raise it. Each level: enemies +6% ATK, you +5% credits. Rest rooms lower it.' },
    rooms: { fight: 5, elite: 2, event: 2, supply: 1, rest: 1 },
    roomNames: { fight: 'Guard Post', elite: 'Armoury', event: 'Side Corridor', supply: 'Quartermaster', rest: 'Abandoned Bunk' },
    desc: 'Checkpoints, barracks and the regime\u2019s soldiers. The straight fight.',
    sectors: ['Outer Checkpoint', 'Barracks Ring', 'Motor Pool', 'Comms Spire', 'Warden\u2019s Gate', 'Ration Depot', 'Armoury Row', 'Reactor Annex', 'Archive Vault', 'Siege Hangar', 'Officers\u2019 Deck', 'Signal Core', 'Chancery Halls', 'Inner Keep', 'Supervisor\u2019s Spire', 'Parade Ground', 'Commandant\u2019s Wing', 'Strategy Room', 'Bunker Stairs', 'Command Bunker'],
    pool: [['patrol', 1], ['probe', 1], ['officer', 1], ['smallbot', 1], ['hound', 2], ['bulwark', 2], ['riot', 3], ['marksman', 6], ['interrogator', 7], ['shock', 8], ['sentinel', 11]],
    bosses: ['halvek', 'crawler', 'dray', 'ostrane'] },
  { id: 'foundry', name: 'Foundry Works', unlock: { garrison: 5 }, offset: 4, level: 0, credits: 1.1, xp: 0.9, events: 0.3, theme: 'foundry',
    mechanic: { id: 'vents', name: 'Furnace vents', desc: 'Every 3 turns the vents blast the floor: 10% of your max HP, 12% of the enemy\u2019s (6% for droids). Defend on vent turns to take none.' },
    rooms: { fight: 4, elite: 2, event: 2, supply: 3, rest: 1 },
    roomNames: { fight: 'Assembly Line', elite: 'Heavy Press', event: 'Catwalks', supply: 'Scrap Heap', rest: 'Cooling Room' },
    desc: 'The occupied foundry. Heat, machines and overtime. More droids, more credits.',
    sectors: ['Slag Yard', 'Conveyor Hall', 'Casting Floor', 'Smelter Gantry', 'Foreman\u2019s Office', 'Coolant Tunnels', 'Ore Crusher', 'Pattern Shop', 'Shipping Bay', 'Furnace Core', 'Rolling Mill', 'Quench Pits', 'Tapping Floor', 'Blast Furnace', 'Control Booth', 'Ladle Track', 'Furnace Heart', 'Turbine Hall', 'Reactor Catwalk', 'Engineer\u2019s Gallery'],
    pool: [['welder', 1], ['probe', 1], ['foreman', 1], ['spotweld', 1], ['stoker', 2], ['slagrunt', 2], ['loader', 3], ['hookbot', 5], ['slagger', 6], ['castguard', 9], ['sentinel', 10]],
    bosses: ['brask', 'crucible', 'slagmother', 'hale'] },
  { id: 'detention', name: 'Detention Complex', unlock: { garrison: 10, foundry: 5 }, offset: 8, level: 0, credits: 1.15, xp: 1.15, events: 0.5, theme: 'detention',
    mechanic: { id: 'allies', name: 'Prisoners', desc: 'Freed prisoners fight beside you (up to 2), hitting for 30% of your ATK each turn. Enemies sometimes shoot them instead of you. Bring them home for +1 Resolve each.' },
    rooms: { fight: 4, elite: 1, event: 3, cells: 2, rest: 1 },
    roomNames: { fight: 'Guard Station', elite: 'Interrogation Room', event: 'Corridor', cells: 'Cell Block', rest: 'Laundry' },
    desc: 'Where the yard\u2019s people disappear. More prisoners, more choices, more Resolve.',
    sectors: ['Intake', 'Holding Pens', 'Processing', 'Cell Block A', 'Warden\u2019s Office', 'Isolation Wing', 'Infirmary', 'Cell Block C', 'Records Room', 'Interrogation Suite', 'Yard Gallery', 'Solitary', 'Transfer Dock', 'Deep Cells', 'Warden\u2019s Tower', 'Tribunal Wing', 'Sentencing Hall', 'Magistrate\u2019s Archive', 'Gallows Court', 'High Court'],
    pool: [['jailer', 1], ['officer', 1], ['orderly', 1], ['cuffbot', 1], ['sedation', 2], ['gasbot', 2], ['warder', 3], ['interrogator', 4], ['marksman', 6], ['shock', 8], ['sentinel', 11]],
    bosses: ['kell', 'restraint', 'voight', 'venn'] },
  { id: 'port', name: 'Orbital Lift Port', unlock: { garrison: 15, foundry: 10, detention: 5 }, offset: 12, level: 0, credits: 1.2, xp: 1.2, events: 0.25, theme: 'port',
    mechanic: { id: 'snipers', name: 'Tower snipers', desc: 'Open landing pads. Each turn there is a 20% chance a tower sniper hits you for 8% of max HP unless you Defend.' },
    rooms: { fight: 4, elite: 3, event: 1, cargo: 3, rest: 1 },
    roomNames: { fight: 'Checkpoint', elite: 'Security Office', event: 'Crew Lounge', cargo: 'Cargo Stack', rest: 'Maintenance Bay' },
    desc: 'The regime\u2019s lifeline off-world. Elite guards and rich cargo.',
    sectors: ['Cargo Gate', 'Customs Hall', 'Fuel Depot', 'Landing Pad 3', 'Tower Base', 'Container Stacks', 'Lift Shaft', 'Hangar Deck', 'Crew Quarters', 'Control Tower', 'Tether Anchor', 'Gantry Ring', 'Flight Ops', 'Command Deck', 'The Lift', 'Tether Climb', 'Upper Lift', 'Cloud Station', 'Director\u2019s Lounge', 'Observation Deck'],
    pool: [['dockguard', 1], ['tetherdrone', 1], ['deckbot', 1], ['gunner', 2], ['mortarbot', 2], ['customs', 3], ['exo', 4], ['sentinel', 6]],
    bosses: ['pell', 'gantry', 'vane', 'imre'] },
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
      { label: 'Buy two stims (30 cr)', cost: { credits: 33 }, win: { items: { stim: 2 }, text: '\u201CPleasure doing business.\u201D' } },
      { label: 'Talk them into a discount', check: { attr: 'cha', base: 0.3, per: 0.1 },
        win: { items: { stim: 1, ion: 1 }, text: '\u201CFor the yard, then. Just this once.\u201D' }, lose: { text: '\u201CNice try.\u201D The vent cover slides shut.' } },
      { label: 'Wave them off', win: { text: 'You don\u2019t need more friends like that.' } },
    ] },
  // v5 events
  { id: 'deadguard', maps: 'any', text: 'A guard lies slumped against the wall, very still. A keycard and a sidearm are still on the belt.',
    options: [
      { label: 'Take the keycard', check: { attr: 'agi', base: 0.45, per: 0.08 },
        win: { next: 'stunned', credits: [6, 12], text: 'You lift it clean. The next door opens before anyone knows you\u2019re there.' }, lose: { next: 'alerted', text: 'The \u201Ccorpse\u201D grabs your wrist and yells. Not dead. Just asleep.' } },
      { label: 'Check the pockets', win: { credits: [10, 18], text: 'Pay chits and a half-eaten ration bar.' } },
      { label: 'Leave them be', win: { text: 'Let sleeping guards lie.' } },
    ] },
  { id: 'informant', maps: 'any', text: 'A nervous clerk in a Directorate jacket waves you into a supply closet. \u201CI can tell you what\u2019s ahead. For a price.\u201D',
    options: [
      { label: 'Pay for the tip', cost: { credits: 28 }, win: { next: 'weakened', text: '\u201CThe next one\u2019s running a fever. Sloppy.\u201D They\u2019re right: the next enemy starts hurt.' } },
      { label: 'Lean on them', check: { attr: 'str', base: 0.35, per: 0.1 },
        win: { next: 'weakened', resolve: 1, text: 'They talk fast. Then they offer to keep talking, to the cell.' }, lose: { next: 'alerted', text: 'They hit a panic button under the shelf.' } },
      { label: 'Decline', win: { text: 'Informants inform on everyone.' } },
    ] },
  { id: 'vending', maps: 'any', text: 'A Directorate vending terminal hums in an alcove, stocked with field stims behind cracked glass.',
    options: [
      { label: 'Hack it', check: { attr: 'int', base: 0.4, per: 0.1 },
        win: { items: { stim: 2 }, text: 'It dispenses two stims and a receipt thanking you for your loyalty.' }, lose: { hp: -0.08, text: 'It shocks you, then dispenses nothing, then thanks you for your loyalty.' } },
      { label: 'Smash the glass', check: { attr: 'str', base: 0.5, per: 0.08 },
        win: { items: { stim: 1, thermal: 1 }, next: 'alerted', text: 'You grab what you can. The crash echoes down the hall.' }, lose: { hp: -0.1, next: 'alerted', text: 'Reinforced glass. Your knuckles disagree with the design.' } },
      { label: 'Walk past', win: { text: 'Loyalty has its rewards. Not today.' } },
    ] },
  { id: 'drone', maps: 'any', text: 'A surveillance drone drifts around the corner, sweeping its lens across the corridor.',
    options: [
      { label: 'Shoot it down', check: { attr: 'agi', base: 0.45, per: 0.08 },
        win: { credits: [8, 14], text: 'One shot. It drops, and its salvage is worth something.' }, lose: { next: 'alerted', text: 'You miss. It doesn\u2019t. Your face is on a screen somewhere now.' } },
      { label: 'Reprogram it', check: { attr: 'int', base: 0.3, per: 0.1 },
        win: { next: 'stunned', attrs: { int: 1 }, text: 'It loops a recording of an empty corridor and flies off to report nothing.' }, lose: { next: 'alerted', text: 'It squeals and flees.' } },
      { label: 'Duck into a vent', win: { hp: -0.04, text: 'Sharp edges, but it never sees you.' } },
    ] },
  { id: 'chapel', maps: 'any', text: 'A forgotten prayer niche, scratched into a wall. Someone keeps candles burning here.',
    options: [
      { label: 'Sit for a moment', win: { hp: 0.15, text: 'Quiet. The candles smell of tallow and home.' } },
      { label: 'Leave an offering', cost: { credits: 17 }, win: { resolve: 1, hp: 0.1, text: 'A note tucked behind the candle reads: \u201CThey know about you. Keep going.\u201D' } },
      { label: 'Move on', win: { text: 'Faith is for later.' } },
    ] },
  { id: 'rival', maps: 'any', text: 'Another resistance runner, from a cell you don\u2019t know, is looting the same corridor. They freeze.',
    options: [
      { label: 'Split the haul', check: { attr: 'cha', base: 0.45, per: 0.08 },
        win: { credits: [12, 20], items: { smoke: 1 }, text: 'You share what you find and a smoke canister for the road.' }, lose: { credits: [4, 8], text: 'They take the best of it and leave you the scraps.' } },
      { label: 'Recruit them', check: { attr: 'cha', base: 0.3, per: 0.1 },
        win: { ally: 1, text: '\u201CFine. Your cell, my rules.\u201D They fall in behind you.' }, lose: { text: 'They shake their head and slip away.' } },
      { label: 'Let them go', win: { resolve: 1, text: 'Every cell matters. They nod as they pass.' } },
    ] },
  { id: 'propaganda', maps: ['garrison', 'detention', 'port'], text: 'A propaganda screen loops the Supervisor\u2019s face over and over. Its maintenance hatch is open.',
    options: [
      { label: 'Hijack the broadcast', check: { attr: 'int', base: 0.3, per: 0.1 },
        win: { resolve: 2, next: 'alerted', text: 'For thirty seconds the whole complex sees the cell\u2019s mark. Then the sirens.' }, lose: { next: 'alerted', hp: -0.06, text: 'The hatch sparks and the screen dies loudly.' } },
      { label: 'Smash it', win: { attrs: { str: 1 }, next: 'alerted', text: 'Satisfying. Noisy, but satisfying.' } },
      { label: 'Ignore it', win: { text: 'You\u2019ve seen the face enough.' } },
    ] },
  { id: 'crucible', maps: ['foundry'], text: 'A crucible of molten slag hangs over the walkway, chain creaking. A patrol is about to pass beneath it.',
    options: [
      { label: 'Drop it on them', check: { attr: 'int', base: 0.4, per: 0.1 },
        win: { credits: [15, 25], next: 'weakened', text: 'The release lever gives. The patrol stops being a patrol.' }, lose: { hp: -0.1, text: 'The lever jams. A spatter of slag finds your sleeve.' } },
      { label: 'Wait for them to pass', win: { text: 'They pass. The crucible keeps creaking.' } },
    ] },
  { id: 'riot', maps: ['detention'], text: 'A yard riot is brewing. The prisoners are looking at you, waiting to see what you\u2019ll do.',
    options: [
      { label: 'Start it', check: { attr: 'cha', base: 0.4, per: 0.1 },
        win: { resolve: 2, next: 'stunned', text: 'The yard erupts. Every guard in the block runs the other way from you.' }, lose: { hp: -0.12, text: 'It starts, and it does not care whose side you\u2019re on.' } },
      { label: 'Slip through in the noise', win: { next: 'stunned', text: 'Nobody watches the door during a riot.' } },
    ] },
  { id: 'fuel', maps: ['port'], text: 'A fuel bowser stands unattended next to a parked customs skiff.',
    options: [
      { label: 'Siphon and sell it on', check: { attr: 'int', base: 0.4, per: 0.08 },
        win: { credits: [20, 32], text: 'A contact in the docks pays well for clean fuel.' }, lose: { hp: -0.08, text: 'You get a mouthful of it.' } },
      { label: 'Rig it to blow', check: { attr: 'int', base: 0.3, per: 0.1 },
        win: { resolve: 1, next: 'weakened', text: 'The skiff burns. The next post is still choking on the smoke.' }, lose: { next: 'alerted', text: 'The fuse fizzles. Someone shouts.' } },
      { label: 'Leave it', win: { text: 'Fuel fires are hard to explain.' } },
    ] },
  { id: 'gambler', maps: 'any', text: 'A bored guard flips a coin over and over. \u201CCall it,\u201D they say, not looking up. \u201CDouble or nothing.\u201D',
    options: [
      { label: 'Call it (25 credits)', cost: { credits: 28 }, check: { attr: 'cha', base: 0.5, per: 0 },
        win: { cash: 50, text: 'Heads. They pay up and wave you through.' }, lose: { text: 'Tails. They pocket it and laugh.' } },
      { label: 'Knock them out', check: { attr: 'str', base: 0.45, per: 0.08 },
        win: { credits: [6, 10], text: 'Down they go, and so does the coin.' }, lose: { next: 'alerted', text: 'They dodge and reach for the radio.' } },
      { label: 'Walk away', win: { text: 'The house always wins.' } },
    ] },
  { id: 'surgeon', maps: ['detention', 'garrison'], text: 'A surgeon in a blood-flecked Directorate coat is drinking alone. \u201CI patch up whoever comes through that door,\u201D she says.',
    options: [
      { label: 'Let her patch you up', cost: { credits: 33 }, win: { heal: 'full', text: 'She works fast and doesn\u2019t ask questions.' } },
      { label: 'Ask about the implants', check: { attr: 'int', base: 0.35, per: 0.1 },
        win: { attrs: { int: 1 }, hp: 0.1, text: 'She shows you a trick with a nerve block. Useful.' }, lose: { text: '\u201CNot for you.\u201D' } },
      { label: 'Leave', win: { text: 'Some doctors are better avoided.' } },
    ] },
];

// ---------- status effects (on you or the enemy) ----------
export const STATUSES = {
  bleed:   { name: 'Bleeding', short: 'BLEED', desc: 'Loses 6% of max HP at the end of each round.', bad: true },
  burn:    { name: 'Burning',  short: 'BURN',  desc: 'Loses 8% of max HP at the end of each round.', bad: true },
  shaken:  { name: 'Shaken',   short: 'SHAKEN', desc: 'Deals 25% less damage.', bad: true },
  exposed: { name: 'Exposed',  short: 'EXPOSED', desc: 'Takes 25% more damage.', bad: true },
  pinned:  { name: 'Pinned',   short: 'PINNED', desc: 'Can\u2019t Run.', bad: true },
};

// ---------- enemy signature moves ----------
// Shown as the enemy's intent before it happens. Defending halves the damage and blocks the status.
export const SPECIALS = {
  spotweld: { name: 'Weld burn',      mult: 0.5, status: { burn: 2 }, tip: 'Sets you Burning. Defend to block it.' },
  slagrunt: { name: 'Slag spit',      mult: 0.6, status: { burn: 2 }, tip: 'Sets you Burning. Defend to block it.' },
  cuffbot:  { name: 'Restraints',     mult: 0.4, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend to block it.' },
  gasbot:   { name: 'Sedative gas',   mult: 0.3, status: { exposed: 2 }, tip: 'Leaves you Exposed. Defend to block it.' },
  deckbot:  { name: 'Rivet burst',    mult: 0.5, status: { bleed: 2 }, tip: 'Leaves you Bleeding. Defend to block it.' },
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
  stoker:   { name: 'Live coals',     mult: 0.6, status: { burn: 2 }, tip: 'A shovel of coals. Sets you Burning. Defend to block it.' },
  hookbot:  { name: 'Hook snag',      mult: 0.8, status: { bleed: 2 }, tip: 'Leaves you Bleeding. Defend to block it.' },
  castguard:{ name: 'Slug round',     mult: 1.2, status: { shaken: 2 }, tip: 'A heavy slug. Leaves you Shaken. Defend to block it.' },
  warder:   { name: 'Prod and shove', mult: 0.7, status: { shaken: 2 }, tip: 'Leaves you Shaken. Defend to block it.' },
  orderly:  { name: 'Injector',       mult: 0.4, status: { exposed: 2 }, tip: 'Your limbs go heavy: Exposed for 2 turns. Defend to block it.' },
  customs:  { name: 'Carbine burst',  mult: 1.0, status: { bleed: 2 }, tip: 'Leaves you Bleeding. Defend to block it.' },
  tetherdrone: { name: 'Cable lash',  mult: 0.5, status: { bleed: 2 }, tip: 'A weighted line. Leaves you Bleeding. Defend to block it.' },
  exo:      { name: 'Power slam',     mult: 1.4, status: { shaken: 2 }, tip: 'Servo-driven fists. Leaves you Shaken. Defend.' },
  dray:     { name: 'Firing party',   mult: 1.2, status: { shaken: 2 }, tip: 'Dray drops his sabre like a flag. Defend.' },
  slagmother: { name: 'Slag splash',  mult: 1.0, status: { burn: 3 }, tip: 'Burning for 3 turns. Defend to block it.' },
  hale:     { name: 'Cutting arc',    mult: 1.1, status: { burn: 2 }, tip: 'A plasma arc. Burning for 2 turns. Defend to block it.' },
  restraint:{ name: 'Cuff launcher',  mult: 0.8, status: { exposed: 3 }, tip: 'Cuffed: Exposed for 3 turns. Defend to block it.' },
  voight:   { name: 'Syringe dart',   mult: 0.7, status: { shaken: 3 }, tip: 'A sedative dart. Shaken for 3 turns. Defend to block it.' },
  venn:     { name: 'Gavel',          mult: 1.3, status: { shaken: 2 }, tip: 'The gavel-mace comes down. Shaken. Defend.' },
  pell:     { name: 'Stamped',        mult: 0.8, status: { exposed: 2 }, tip: 'The stamp baton marks you. Exposed for 2 turns. Defend.' },
  gantry:   { name: 'Hook rake',      mult: 1.1, status: { bleed: 3 }, tip: 'Bleeding for 3 turns. Defend to block it.' },
  imre:     { name: 'Director\u2019s mark', mult: 1.3, status: { exposed: 2, shaken: 2 }, tip: 'Exposed and Shaken. Defend to block it.' },
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
// short and he: how the engine's own lines name the boss (he, she or it). noRun: [why Run is blocked, the chip's tip] once a phase takes Run away for good.
export const BOSS_INFO = {
  halvek:   { epithet: 'Keeper of the Gate',        phase2: 'Halvek tears off his gloves. \u201CEnough paperwork.\u201D', short: 'Halvek', he: 'he' },
  crawler:  { epithet: 'Siege Engine, Mark IV',      phase2: 'The crawler vents its coolant and redlines every gun.', short: 'The crawler', he: 'it' },
  ostrane:  { epithet: 'Supervisor of Kessa Yard',  phase2: 'Ostrane finally puts the datapad down.', short: 'Ostrane', he: 'she' },
  brask:    { epithet: 'Overseer of the Casting Floor', phase2: 'Brask roars and wades in swinging.', short: 'Brask', he: 'he' },
  crucible: { epithet: 'The Furnace Walks',          phase2: 'The Crucible\u2019s core goes white-hot.', short: 'The Crucible', he: 'it' },
  kell:     { epithet: 'Warden of the Deep Cells',   phase2: 'Kell takes off her glasses. Her eyes are worse.', short: 'Kell', he: 'she',
    noRun: ['She threw away the keys', 'She threw away her keys. No Run for the rest of the fight.'] },
  vane:     { epithet: 'Master of the Lift',         phase2: 'Vane calls in the tower guns.', short: 'Vane', he: 'he' },
  dray:     { epithet: 'Commandant of the Garrison', phase2: 'Dray unbuckles his greatcoat and draws the sabre.', short: 'Dray', he: 'he',
    noRun: ['The guard is turned out', 'The guard is turned out on the steps. No Run for the rest of the fight.'] },
  slagmother: { epithet: 'Keeper of the Ladle Track', phase2: 'Both crane arms lock. The ladle glows white.', short: 'The Slagmother', he: 'it' },
  hale:     { epithet: 'Chief Engineer of the Works', phase2: 'Hale drops his visor. The lance burns blue.', short: 'Hale', he: 'he' },
  restraint:{ epithet: 'Riot Pattern, Block Issue',  phase2: 'Every cuff on the Restraint Engine snaps open at once.', short: 'The Engine', he: 'it',
    noRun: ['Lockdown', 'Lockdown. No Run for the rest of the fight.'] },
  voight:   { epithet: 'Chief Interrogator',         phase2: 'Voight pulls on a second pair of gloves.', short: 'Voight', he: 'he' },
  venn:     { epithet: 'Magistrate of the High Court', phase2: 'Venn stands. Nobody in this court has seen her stand.', short: 'Venn', he: 'she',
    noRun: ['The court is sealed', 'The doors of the court are sealed. No Run for the rest of the fight.'] },
  pell:     { epithet: 'Chief of Customs',           phase2: 'Pell puts the scanner away and takes the baton in both hands.', short: 'Pell', he: 'he' },
  gantry:   { epithet: 'Cargo Walker, Gantry Ring',  phase2: 'The Gantry Walker drops its load and turns all the way round.', short: 'The Walker', he: 'it' },
  imre:     { epithet: 'Director of the Orbital Lift', phase2: 'Imre turns away from the glass at last.', short: 'Imre', he: 'he',
    noRun: ['The deck is sealed', 'The observation deck is sealed. No Run for the rest of the fight.'] },
};

// Rules for the bosses' signature moves. Names, tips and lines are in lore.js; docs/LORE.md has the design.
// Moves in order: the first plays animation sig1, the second sig2. Numbers stated in lore.js tips must match these.
// from: the HP mark at which a move opens (100 = from the start). until: the mark at which it stops.
// count: enemy turns from the telegraph to it going off. turns: how long it then lasts. mult: damage. guard: what Defend leaves.
// rate: chance of starting a move when one is open and off cooldown. cd: planned turns between moves.
// notes: what changes at each HP mark, shown under the boss's line.
export const BOSS_KIT = {
  halvek: { rate: 0.4, cd: 2,
    moves: { shutter: { from: 75, count: 1, turns: 2 }, confiscate: { from: 100, until: 50, count: 1, mult: 1, guard: 0.5 } },
    notes: { 75: 'Gatehouse Shutter opens up.', 50: 'ATK +20%. No more Confiscation.', 25: 'The shutter stays down: no Run. Execution order every third turn.' } },
  crawler: { rate: 0.4, cd: 2,
    moves: { anchor: { from: 75, count: 1, mult: 1.6, guard: 0.5, pin: 2, belly: 1.3 }, siege: { from: 50, count: 2, mult: 2.8, guard: 0.35, jam: 0.1 } },
    notes: { 75: 'Hull breached: DEF \u22121. Anchor Stomp opens up.', 50: 'ATK +20%. Siege Round opens up. No more self-repair.', 25: 'The key-holder panics: fires every turn, but 25% of plain shots go wide.' } },
  crucible: { rate: 0.4, cd: 2,
    moves: { roll: { from: 75, count: 2, mult: 2, guard: 0.5, open: 1.5, choke: 0.12 }, floor: { from: 100, count: 1, turns: 3, cost: 0.05 } },
    notes: { 75: 'Glowing: Strikes burn for 3 turns. Roll Call opens up.', 50: 'ATK +20%. Slag Floor lasts 4 turns.', 25: 'Roll Call every other turn. No more self-repair. It takes +15% damage.' } },
  brask: { rate: 0.4, cd: 2,
    moves: { overtime: { from: 75, count: 1, mult: 0.7, hits: 2, guard: 0.5, winded: 2, self: 0.03 }, front: { from: 100, until: 50, count: 1, turns: 2 } },
    notes: { 75: 'Overtime opens up.', 50: 'ATK +20%. No more workers in front.', 25: 'Overtime every other turn, and he no longer gets winded. It costs him 3% HP a time.' } },
  kell: { rate: 0.4, cd: 2,
    moves: { count: { from: 75, count: 1, turns: 2, shaken: 2 }, lights: { from: 50, count: 1, turns: 2, miss: 0.25 } },
    notes: { 75: 'Count Time opens up.', 50: 'ATK +20%. Lights Out opens up.', 25: 'She throws away her keys: no Run. Solitary twice as often.' } },
  vane: { rate: 0.4, cd: 2,
    moves: { crane: { from: 100, count: 2, mult: 2.5, guard: 0.5, wreck: 2 }, salute: { from: 75, until: 25, count: 1, mult: 1.6, guard: 0.5, parry: 0.5 } },
    notes: { 75: 'Officer\u2019s Salute opens up.', 50: 'ATK +20%. Tower snipers: 40% per turn.', 25: 'Coat off: no more Salute. Container Drop every third turn. Plain fire is two shots at x0.7.' } },
  ostrane: { rate: 0.4, cd: 2,
    moves: { redact: { from: 75, count: 1, turns: 2, cut: 0.5 }, audit: { from: 50, count: 2, base: 1, per: 0.4, max: 3, guard: 0.5 } },
    notes: { 75: 'Redact opens up.', 50: 'ATK +20%, SPD +2. Final Audit opens up.', 25: 'Final Audit on a 1-turn count, every third turn.' } },
  // The nine added with twenty sectors. Same mechanics by id, each boss with a pair of its own.
  dray: { rate: 0.4, cd: 2,
    moves: { front: { from: 100, until: 50, count: 1, turns: 2 }, salute: { from: 75, count: 1, mult: 1.6, guard: 0.5, parry: 0.5 } },
    notes: { 75: 'The Colonel\u2019s Draw opens up.', 50: 'ATK +20%. No more conscripts in front.', 25: 'The guard is turned out: no Run. The Colonel\u2019s Draw every third turn.' } },
  slagmother: { rate: 0.4, cd: 2,
    moves: { floor: { from: 100, count: 1, turns: 3, cost: 0.05 }, overtime: { from: 75, until: 25, count: 1, mult: 0.8, hits: 2, guard: 0.5, winded: 2, self: 0.03 } },
    notes: { 75: 'Both Arms opens up.', 50: 'ATK +20%. No more self-repair. Ladle Pour lasts 4 turns.', 25: 'An arm buckles: DEF \u22123, no more Both Arms. Ladle Pour every third turn.' } },
  hale: { rate: 0.4, cd: 2,
    moves: { siege: { from: 100, count: 2, mult: 2.6, guard: 0.35, jam: 0.1 }, roll: { from: 75, count: 2, mult: 2, guard: 0.5, open: 1.5, choke: 0.12 } },
    notes: { 75: 'Vent Cycle opens up.', 50: 'ATK +20%, SPD +2.', 25: 'Suit breached: he takes +15% damage. Lance Charge every third turn.' } },
  restraint: { rate: 0.4, cd: 2,
    moves: { anchor: { from: 100, count: 1, mult: 1.6, guard: 0.5, pin: 2, belly: 1.3 }, shutter: { from: 75, count: 1, turns: 2 } },
    notes: { 75: 'Cage Down opens up.', 50: 'ATK +20%. No more self-repair.', 25: 'Lockdown: no Run, no more Cage Down. Clamp Arms every third turn.' } },
  voight: { rate: 0.4, cd: 2,
    moves: { redact: { from: 75, count: 1, turns: 2, cut: 0.5 }, lights: { from: 50, count: 1, turns: 2, miss: 0.25 } },
    notes: { 75: 'Nerve Block opens up.', 50: 'ATK +20%. Gas Cloud opens up.', 25: 'Syringe darts twice as often. Nerve Block every third turn.' } },
  venn: { rate: 0.4, cd: 2,
    moves: { count: { from: 100, count: 1, turns: 2, shaken: 2 }, audit: { from: 75, count: 2, base: 1, per: 0.4, max: 3, guard: 0.5 } },
    notes: { 75: 'Sentence opens up.', 50: 'ATK +20%, DEF +2.', 25: 'The court is sealed: no Run. Sentence every third turn.' } },
  pell: { rate: 0.4, cd: 2,
    moves: { confiscate: { from: 100, until: 25, count: 1, mult: 1, guard: 0.5 }, crane: { from: 75, count: 2, mult: 2.2, guard: 0.5, wreck: 2 } },
    notes: { 75: 'Crate Drop opens up.', 50: 'ATK +20%. Tower snipers: 30% per turn.', 25: 'No more Seizures. Tower snipers: 45% per turn.' } },
  gantry: { rate: 0.4, cd: 2,
    moves: { anchor: { from: 100, count: 1, mult: 1.6, guard: 0.5, pin: 2, belly: 1.3 }, overtime: { from: 75, count: 1, mult: 0.8, hits: 2, guard: 0.5, winded: 2, self: 0.03 } },
    notes: { 75: 'Hook Swing opens up.', 50: 'ATK +20%. No more self-repair.', 25: 'Hydraulics failing: a quarter of plain shots go wide. Mag Clamp every third turn.' } },
  imre: { rate: 0.4, cd: 2,
    moves: { shutter: { from: 100, count: 1, turns: 2 }, siege: { from: 75, count: 2, mult: 2.8, guard: 0.35, jam: 0.1 } },
    notes: { 75: 'Station Strike opens up.', 50: 'ATK +20%, SPD +2. Tower snipers: 40% per turn.', 25: 'The deck is sealed: no Run, no more Shield Projector. Station Strike every fourth turn. Plain fire is two shots at x0.7.' } },
};

// ---------- contraband: run perks drafted after fights. Kept until the operative dies. ----------
// Up to 3 copies of each piece to start, raised one at a time for credits up to 99, and every copy stacks. The first copy gives per; each further copy adds r times what the last one added,
// so stacks keep paying forever but level off (E.perkValue). add: the value before any copies. whole: rounded, for turns and flat stats.
export const PERKS = [
  { id: 'hollow',    name: 'Hollow-Points',      rare: false, add: 1.6, per: 0.15, dp: 2, desc: 'Critical hits deal x{v} instead of x1.6.' },
  { id: 'dressing',  name: 'Field Dressing',     rare: false, per: 1.5, desc: 'Heal {v}% of max HP at the start of every fight.' },
  { id: 'chit',      name: 'Lucky Chit',         rare: false, per: 5, desc: '+{v}% credits from everything.' },
  { id: 'serrated',  name: 'Serrated Rounds',    rare: false, per: 8, desc: 'Your attacks have a {v}% chance to cause Bleeding.' },
  { id: 'incendiary',name: 'Incendiary Mix',     rare: false, per: 1, r: 0.8, whole: true, desc: 'Thermal charges also set the target Burning for {v} turns.' },
  { id: 'steady',    name: 'Steady Hands',       rare: false, add: 50, per: 15, desc: 'Defending boosts your next shot by +{v}% instead of +50%.' },
  { id: 'secondwind',name: 'Second Wind',        rare: false, per: 1.5, desc: 'Defending also heals {v}% of max HP.' },
  { id: 'scavenger', name: 'Scavenger',          rare: false, per: 6, desc: '{v}% chance to find an item after each fight.' },
  { id: 'spotter',   name: 'Spotter',            rare: false, per: 1, r: 0.8, whole: true, desc: 'Enemies start every fight Exposed for {v} turns.' },
  { id: 'thick',     name: 'Thick Skin',         rare: false, per: 1, r: 0.7, whole: true, desc: 'Status effects on you last {v} turn(s) less.' },
  { id: 'ambush',    name: 'Ambusher',           rare: true,  per: 15, desc: 'Your first attack in every fight deals +{v}% damage.' },
  { id: 'deadman',   name: 'Dead Man\u2019s Switch', rare: true, per: 5, desc: 'Once per raid, survive a killing blow with {v}% of max HP.' },
  { id: 'grudge',    name: 'Grudge',             rare: true,  per: 6, desc: '+{v}% damage against elites and bosses.' },
  { id: 'quickdraw', name: 'Quickdraw',          rare: true,  per: 1, r: 0.8, whole: true, desc: 'Killing an enemy cuts all skill cooldowns by {v}.' },
  { id: 'capacitor', name: 'Ion Capacitor',      rare: true,  per: 12, desc: 'Ion pulses stun 1 turn longer. Overload deals +{v}%.' },
  { id: 'reputation',name: 'Reputation',         rare: true,  per: 1, r: 0.8, whole: true, desc: 'Human enemies start every fight Shaken for {v} turns.' },
  { id: 'adrenal',   name: 'Adrenal Spike',      rare: false, per: 12, desc: '+{v}% damage while you are below 35% HP.' },
  { id: 'tithe',     name: 'Blood Tithe',        rare: false, per: 1.5, desc: 'Every kill heals {v}% of max HP.' },
  { id: 'ironlung',  name: 'Iron Lung',          rare: false, per: 3, desc: '+{v}% max HP.' },
  { id: 'tripwire',  name: 'Tripwire Kit',       rare: false, per: 1, r: 0.8, whole: true, desc: 'Enemies start every fight Bleeding for {v} turns.' },
  { id: 'padding',   name: 'Kevlar Padding',     rare: false, per: 1, r: 0.9, whole: true, desc: '+{v} DEF.' },
  { id: 'coupdegrace', name: 'Coup de Gr\u00E2ce', rare: true, per: 15, desc: '+{v}% damage against enemies below 30% HP.' },
  { id: 'ghost',     name: 'Ghost Protocol',     rare: true,  per: 3, desc: '+{v}% chance to dodge every attack.' },
  { id: 'warpaint',  name: 'War Paint',          rare: true,  per: 1, r: 0.7, whole: true, desc: 'Every enemy starts every fight Shaken and Exposed for {v} turn(s).' },
];

// ---------- contracts: optional jobs from the cell. Rewards are permanent Resolve and credits. ----------
// kind: kill (tag on map), sector (reach sector on map), boss (beat any boss on map), allies (bring prisoners home), haul (extract carrying credits)
export const CONTRACTS = [
  { kind: 'kill',   tag: 'droid', n: 6,  text: 'Scrap {n} droids in the {map}' },
  { kind: 'kill',   tag: 'human', n: 6,  text: 'Take down {n} Directorate personnel in the {map}' },
  { kind: 'kill',   tag: 'elite', n: 2,  text: 'Defeat {n} veterans in the {map}' },
  { kind: 'sector', n: 4,           text: 'Clear sector {n} in the {map}' },
  { kind: 'sector', n: 7,           text: 'Clear sector {n} in the {map}' },
  { kind: 'boss',   n: 1,           text: 'Bring down a boss in the {map}' },
  { kind: 'allies', n: 2,           text: 'Bring {n} freed prisoners home', map: 'detention' },
  { kind: 'haul',   n: 300,         text: 'Extract carrying at least {n} credits' },
];

// ---------- threat levels: unlocked by liberating maps (beating their sector 15 boss) ----------
// Each level starts from sector 1: insertion points are earned separately at every threat level (E.insertionsAt).
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
  { id: 'coward', name: 'Cowardly', tags: ['human'], desc: 'Runs when below 20% HP (you get half its credits).', mods: { hp: 0.9 }, flee: true,
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

// ---------- Downtime: the after-curfew side of the yard ----------
// Permanent marks an operative can earn in orbit. Five exist; an operative can hold all five.
export const MARKS = {
  hardened: { name: 'Pressure-hardened', desc: '+10% max HP. You stopped flinching at hull alarms.', hp: 0.1 },
  reckoning: { name: 'Dead Reckoning', desc: '+8% crit chance. Lead the target, every time.', crit: 0.08 },
  blockade: { name: 'Blockade Runner', desc: '+15% chance to escape a fight. Nobody catches you twice.', escape: 0.15 },
  salvage: { name: 'Salvage Rights', desc: '+12% credits from everything. You know what sells.', credits: 0.12 },
  coldblood: { name: 'Cold-blooded', desc: '+1 SPD and +1 DEF. Vacuum calm.', spd: 1, def: 1 },
};
// The cell's shuttle. Levels are bought with the operative's credits; cell upgrades with Resolve and survive death.
export const SHIP_PARTS = {
  hull: { name: 'Hull plating', per: 15, base: 40, desc: 'Hull points per level.', cost: [120, 260, 480] },
  guns: { name: 'Rail cannons', per: 3, base: 8, desc: 'Damage per level.', cost: [140, 300, 540] },
  shields: { name: 'Deflector', per: 2, base: 1, desc: 'Damage absorbed from every hit, per level.', cost: [110, 240, 450] },
  engines: { name: 'Drive tuning', per: 0.08, base: 0.1, desc: 'Evade chance and jump odds, per level.', cost: [130, 280, 500] },
};
export const SHIP_CELL = [
  { id: 'ejector', name: 'Ejection pod', cost: 11, desc: 'When the shuttle is destroyed, the pilot has a 50% chance to drift home alive. Once per operative.' },
  { id: 'targeting', name: 'Targeting array', cost: 9, desc: 'Rail cannons crit (x1.6) 20% of the time.' },
  { id: 'salvager', name: 'Salvage claw', cost: 7, desc: 'Orbit wins pay 25% more credits.' },
];
// Enemy ships by run tier. mark: chance a win grants a Mark.
export const ORBIT_TIERS = [
  { id: 'low', name: 'Low orbit', ship: 'cutter', shipName: 'Patrol Cutter', hull: 40, atk: 8, shield: 1, evade: 0.1, credits: [70, 130], mark: 0, refit: 1, desc: 'A customs cutter on a lazy loop. Credits, no glory.', fx: ['fire', 'fire', 'volley', 'repair'] },
  { id: 'mid', name: 'The blockade line', ship: 'corvette', shipName: 'Customs Corvette', hull: 70, atk: 11, shield: 2, evade: 0.15, credits: [160, 280], mark: 0.4, refit: 3, after: 'low', desc: 'A corvette that shoots first. A real chance of a Mark.', fx: ['fire', 'volley', 'fire', 'lock', 'repair'] },
  { id: 'high', name: 'The Warden\u2019s watch', ship: 'frigate', shipName: 'Blockade Frigate', hull: 100, atk: 15, shield: 2, evade: 0.12, credits: [320, 520], mark: 1, refit: 8, after: 'mid', desc: 'The frigate that owns the lift corridor. A Mark if you live; the pilot if you don\u2019t.', fx: ['fire', 'lock', 'volley', 'fire', 'volley', 'repair'] },
];
// The cell's first flight: a lame cutter limping home, and a tug on standby if it goes wrong.
export const ORBIT_SHAKEDOWN = { shipName: 'Limping Cutter', hull: 26, atk: 6, shield: 0, evade: 0.05, credits: [50, 80], desc: 'Shakedown flight. A damaged cutter on its way to the yards. If the shuttle goes down, Sable\u2019s tug tows you home: this is the only run that can\u2019t kill you.' };
export const ORBIT_INTENTS = { fire: { label: 'Firing', desc: 'A normal volley.' }, volley: { label: 'Full broadside', desc: 'x1.8 damage. Evade it.' }, lock: { label: 'Target lock', desc: 'Its next shot cannot miss and ignores half your deflector.' }, repair: { label: 'Damage control', desc: 'It repairs 15% of its hull. Hit it hard now.' } };
// Ventures: the cell's money working while operatives die. Ticked after every raid.
export const VENTURES = [
  { id: 'stall', name: 'Lantern house share', rate: 0.06, bust: 0.04, loss: 0.25, min: 50, cap: 500, unlock: 0, desc: 'A quiet cut of the Lantern\u2019s take. +6% per raid; a 4% chance per raid that a Directorate inspection costs a quarter of it. Holds up to 500.' },
  { id: 'consignment', name: 'Marrow\u2019s consignment', rate: 0.12, bust: 0.1, loss: 0.4, min: 100, cap: 1500, unlock: 5, desc: 'Marrow moves your goods through the market. +12% per raid; a 10% chance per raid that a raid on the stall costs 40% of it. Holds up to 1,500.' },
  { id: 'bond', name: 'Smuggler\u2019s bond', rate: 0.18, bust: 0.14, loss: 0.5, min: 150, cap: 3000, unlock: 10, desc: 'A share in a lift-corridor run. +18% per raid; a 14% chance per raid that a ship is seized and half the stake goes with it. Holds up to 3,000.' },
];
// The Lantern: a tenement-basement bar that opens after curfew.
export const BAR = {
  bartender: { id: 'keg7', name: 'KEG-7', desc: 'A loader droid somebody bolted a bar towel onto. Pours straight and says nothing.' },
  // One drink per raid. It lasts until you come home. hp, crit, credits and tech are fractions; atk, def and spd are flat.
  menu: [
    { id: 'gin', name: 'Foundry Gin', cost: 6, atk: 2, effect: '+2 ATK', desc: 'Clear, sharp and made somewhere it shouldn\u2019t be.' },
    { id: 'stout', name: 'Rivet Stout', cost: 6, hp: 0.06, effect: '+6% max HP', desc: 'Thick enough to count as a meal.' },
    { id: 'whisky', name: 'Tin Whisky', cost: 7, def: 1, effect: '+1 DEF', desc: 'You stop noticing the small hits. And the big ones, for a bit.' },
    { id: 'fizz', name: 'Static Fizz', cost: 7, spd: 3, effect: '+3 SPD', desc: 'Tastes like a battery. Works like one too.' },
    { id: 'sour', name: 'Marksman\u2019s Sour', cost: 8, crit: 0.05, effect: '+5% crit', desc: 'Steadies the hand. Nobody knows why.' },
    { id: 'rum', name: 'Smuggler\u2019s Rum', cost: 8, credits: 0.1, effect: '+10% credits', desc: 'Puts you in the mood to check every pocket.' },
    { id: 'tonic', name: 'Clerk\u2019s Tonic', cost: 8, tech: 0.15, effect: 'Items +15%', desc: 'Bitter, bright and very good with instructions.' },
  ],
};

// ---------- Feats: cell-wide achievements with small permanent buffs ----------
// Each feat has four tiers. buff: what every tier adds (shrinking: the per array is multiplied by [1, .8, .6, .4]).
// Kinds: atk (all damage), ranged, melee (that attack's damage), hp, crit, dodge, escape, credits, xp, stim (stim healing),
// all as fractions of 1. resolve: Resolve paid on reaching tiers 3 and 4. Enemy-type feats are generated from ENEMIES.
export const FEAT_FALLOFF = [0.6, 0.5, 0.4, 0.35, 0.3, 0.25]; // six tiers, a bit stronger than the old four (0.5, 0.4, 0.3, 0.2). Balance pending.
export const FEATS = [
  { id: 'kills', group: 'Combat', name: 'Bodies in the yard', desc: 'Enemies put down.', tiers: [10, 100, 500, 1000], buff: 'atk', per: 0.01, resolve: [0, 0, 1, 2] },
  { id: 'bosses', group: 'Combat', name: 'Heads on the wall', desc: 'Bosses beaten.', tiers: [1, 5, 15, 30], buff: 'hp', per: 0.02, resolve: [0, 1, 2, 3] },
  { id: 'elites', group: 'Combat', name: 'Veteran hunter', desc: 'Veterans beaten.', tiers: [1, 10, 50, 100], buff: 'crit', per: 0.005, resolve: [0, 0, 1, 2] },
  { id: 'crits', group: 'Combat', name: 'Clean hits', desc: 'Critical hits landed.', tiers: [10, 100, 500, 1000], buff: 'crit', per: 0.005 },
  { id: 'shots', group: 'Combat', name: 'Rounds down range', desc: 'Shots that hit.', tiers: [25, 250, 1000, 2500], buff: 'ranged', per: 0.01 },
  { id: 'strikes', group: 'Combat', name: 'Close work', desc: 'Strikes that hit.', tiers: [25, 250, 1000, 2500], buff: 'melee', per: 0.01 },
  { id: 'skills', group: 'Combat', name: 'Tricks of the trade', desc: 'Skills used.', tiers: [10, 100, 500, 1000], buff: 'xp', per: 0.02 },
  { id: 'dodges', group: 'Combat', name: 'Not today', desc: 'Attacks dodged.', tiers: [10, 50, 200, 500], buff: 'dodge', per: 0.005 },
  { id: 'stims', group: 'Combat', name: 'Field medicine', desc: 'Stims used.', tiers: [5, 25, 100, 250], buff: 'stim', per: 0.03 },
  { id: 'sectors', group: 'Raids', name: 'Deeper', desc: 'Sectors cleared.', tiers: [5, 25, 100, 250], buff: 'xp', per: 0.02, resolve: [0, 0, 1, 2] },
  { id: 'extractions', group: 'Raids', name: 'Came back', desc: 'Raids extracted from.', tiers: [1, 10, 50, 100], buff: 'credits', per: 0.01, resolve: [0, 0, 1, 2] },
  { id: 'events', group: 'Raids', name: 'Something in the corridor', desc: 'Events resolved.', tiers: [5, 25, 100, 250], buff: 'xp', per: 0.02 },
  { id: 'contraband', group: 'Raids', name: 'Pockets full', desc: 'Contraband taken.', tiers: [5, 25, 100, 250], buff: 'hp', per: 0.01 },
  { id: 'freed', group: 'Raids', name: 'Open doors', desc: 'Prisoners brought home.', tiers: [1, 10, 50, 100], buff: 'escape', per: 0.01, resolve: [0, 1, 2, 3] },
  { id: 'credits', group: 'Raids', name: 'Paid in full', desc: 'Credits earned, all sources.', tiers: [1000, 10000, 50000, 200000], buff: 'credits', per: 0.01 },
  { id: 'fallen', group: 'The cell', name: 'The wall remembers', desc: 'Operatives lost.', tiers: [1, 10, 50, 100], buff: 'hp', per: 0.02, resolve: [0, 1, 2, 3] },
  { id: 'upgrades', group: 'The cell', name: 'Marrow\u2019s best customer', desc: 'Gear upgrades bought.', tiers: [5, 25, 100, 250], buff: 'escape', per: 0.01 },
  { id: 'orbit', group: 'After curfew', name: 'Blockade pilot', desc: 'Orbit runs won.', tiers: [1, 5, 15, 30], buff: 'credits', per: 0.01, resolve: [0, 1, 2, 3] },
  { id: 'spins', group: 'After curfew', name: 'Regular at the Wheel', desc: 'Spins.', tiers: [10, 50, 200, 500], buff: 'xp', per: 0.01 },
  { id: 'drinks', group: 'After curfew', name: 'Tab at the Lantern', desc: 'Rounds bought.', tiers: [5, 25, 100, 250], buff: 'hp', per: 0.01 },
];
export const ENEMY_FEAT_TIERS = [1, 10, 50, 100, 250, 500], BOSS_FEAT_TIERS = [1, 3, 10, 25, 50, 100];
// Every achievement runs to six tiers: the last two ask for 2.5 and 5 times the old top, and pay Resolve where the old top did.
for (const f of FEATS) {
  const top = f.tiers[f.tiers.length - 1];
  f.tiers = [...f.tiers, Math.round(top * 2.5), top * 5];
  if (f.resolve) { const r = f.resolve[f.resolve.length - 1]; f.resolve = [...f.resolve, r + 1, r + 2]; }
}
