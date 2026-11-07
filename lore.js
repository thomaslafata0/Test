// Cinder Cell: story text. Pure data and small pure functions, no imports, no DOM.
// The story bible and the boss move design are in docs/LORE.md.
//
// Placeholders, filled by fill():
//   {n}     number of operatives dead, as digits
//   {ops}   the same in words that read right: "no operatives", "1 operative", "47 operatives"
//   {name}  the operative's first name
//
// rng is any function returning 0 <= x < 1, the same shape the engine uses. Default Math.random.

const pickOne = (list, rng) => {
  const r = typeof rng === 'function' ? rng() : Math.random();
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
};

const countOf = (n) => Math.max(0, Math.floor(Number(n)) || 0);

// Fills {n}, {ops} and {name}. Placeholders with no value stay readable: {name} becomes "operative".
export function fill(line, { n = 0, name = 'operative' } = {}) {
  const c = countOf(n);
  const ops = c === 0 ? 'no operatives' : c === 1 ? '1 operative' : `${c} operatives`;
  return String(line).split('{n}').join(String(c)).split('{ops}').join(ops).split('{name}').join(name);
}

// ---------- the opening line for a new operative ----------
// n = operatives dead so far. Read it from the feat counter (see docs/LORE.md), since meta.fallen stops at 12.
export const FALLEN = [
  { min: 0, max: 0, lines: [
    'No names on the wall yet. Cass leaves a space at the top and says nothing about it.',
    'The safehouse wall is bare. Someone has to go on it first, or be the first to stay off it.',
    'Nobody has gone through the gate for this cell. Nobody can tell you what is behind it.',
    'No one has died for the cell yet. Cass looks at you as if that is about to change.',
  ] },
  { min: 1, max: 1, lines: [
    'One name on the wall, the paint still wet. Yours goes under it, or it doesn\u2019t.',
    'You step over the body of the operative before you. Maybe you will be the one to make it out.',
    'One operative went through that gate and left you a route. It stops where they did.',
    'The jacket has one neat hole in it. Its last owner is the only name on the wall.',
  ] },
  { min: 2, max: 5, lines: [
    '{n} names on the wall. You knew at least one of them well enough to nod to.',
    '{n} operatives went through the gate. The routes they left you are short, and they are good.',
    'Cass still knows {n} faces by heart, without looking at the wall.',
    'You step over the {n} operatives before you. Still few enough to learn their names.',
  ] },
  { min: 6, max: 20, lines: [
    '{n} operatives so far. Cass has stopped saying their names at the door.',
    'You walk past {n} names on the wall. Somebody has started keeping them in straight lines.',
    '{n} dead, and every patrol rota you carry cost one of them. Read it twice.',
    'Doc Ilse has stitched {n} operatives who never came back. She lays out a clean tray.',
  ] },
  { min: 21, max: 99, lines: [
    'You step over the bodies of the {n} operatives before you. Maybe you will be the one to make it out.',
    '{n} operatives have gone ahead of you. The gate crew have stopped asking who sent you.',
    'The wall holds {n} names now. Marrow sells you a coat that fits one of them.',
    'Cass reads you the route. {n} operatives paid for it, one door at a time.',
    '{n} names, and the paint never quite dries. Pick a spot you could live with.',
  ] },
  { min: 100, max: Infinity, lines: [
    '{n} operatives. The wall ran out of room, so Cass started on the ceiling.',
    'You step over {n} bodies to reach the gate. It looks very ordinary from here.',
    '{n} operatives gone ahead. Someone in the yard is alive tonight because of them.',
    'The kid by the fire can recite all {n} names. Asks how you spell yours.',
    'You step over the bodies of the {n} operatives before you. Someone has to be the one.',
  ] },
];

export function fallenLine(n, rng) {
  const c = countOf(n);
  const tier = FALLEN.find((t) => c >= t.min && c <= t.max) || FALLEN[0];
  return fill(pickOne(tier.lines, rng), { n: c });
}

// ---------- what each boss's moves are called, in the shape of D.SPECIALS tips ----------
// The rules are D.BOSS_KIT in data.js and sigTurn in engine.js. Tips state true numbers: change them together.
// Filled by E.sigInfo: {t} turns it lasts, {x} current multiplier, {act} the action named. tipNext: the intent once the first stage is over.
export const BOSS_MOVES = {
  halvek: {
    shutter: {
      name: 'Gatehouse Shutter',
      tip: 'For 2 turns shots through the bars deal half and you can\u2019t Run. Strike still reaches.',
    },
    confiscate: {
      name: 'Confiscation',
      tip: 'He takes a stim, or another item, until he goes down. Strike now to stop him, or use it first.',
    },
  },
  crawler: {
    anchor: {
      name: 'Anchor Stomp',
      tip: 'x1.6, then pinned 2 turns: no Run. Defend blocks the pin. Strike the belly now for +30%.',
    },
    siege: {
      name: 'Siege Round',
      tip: 'A x2.8 shell. Ion pulse, or 10% of its HP in damage first, jams it. Defend takes about a third.',
    },
  },
  crucible: {
    roll: {
      name: 'Roll Call',
      tip: 'The core is open: +50% damage. Deal 12% of its HP now to choke the blast and stagger it.',
      tipNext: 'Heat blast, x2. Defend halves it.',
    },
    floor: {
      name: 'Slag Floor',
      tip: 'For {t} turns every Strike costs 5% of your max HP on top of the burn. Shoot until it cools.',
    },
  },
  brask: {
    overtime: {
      name: 'Overtime',
      tip: 'Two hits at x0.7, then he is winded and Exposed for 2 turns. Defend, then make him pay.',
      tipLate: 'Two hits at x0.7, and he won\u2019t get winded now. It costs him 3% HP. Defend.',
    },
    front: {
      name: 'Shift in Front',
      tip: 'For 2 turns shots deal half. Hold your fire throughout for +1 Resolve on the kill. Intimidate clears them.',
    },
  },
  kell: {
    count: {
      name: 'Count Time',
      tip: 'Freed prisoners freeze for 2 turns. Alone, you are Shaken 2 unless you Defend. Intimidate breaks it.',
    },
    lights: {
      name: 'Lights Out',
      tip: 'For 2 turns you can\u2019t read her and shots miss 25% of the time. A scanner still can. Strike can\u2019t miss.',
    },
  },
  vane: {
    crane: { name: 'Container Drop', tip: 'A x2.5 container from above. Smoke clears you, even if it fails. Defend only halves it.' },
    salute: {
      name: 'Officer\u2019s Salute',
      tip: 'His next shot is a sure crit, x1.6. Shoot back and yours is too. Strikes are parried for half. Or Defend.',
    },
  },
  ostrane: {
    redact: {
      name: 'Redact',
      tip: '{act} deals half for 2 turns, or locks if it is a skill. Do something else.',
    },
    audit: { name: 'Final Audit', tip: 'x{x} right now: x1 plus 0.4 per item you used this fight, up to x3. Defend halves it.' },
  },
  // A move reused by another boss can carry its own words for what the engine says:
  // fail (countered or jammed), ion (siege stopped by an ion pulse), charge (roll's second turn), winded and late (overtime's
  // aftermath), blocked (why Run is shut while a shutter is up), chip (the label of a lasting effect), who (who stands in front).
  dray: {
    front: {
      name: 'Conscripts Forward', chip: 'Conscripts', who: 'the conscripts',
      tip: 'For 2 turns shots deal half. Hold your fire throughout for +1 Resolve on the kill. Intimidate clears them.',
      fail: 'The conscripts break and run. Dray doesn\u2019t waste a bullet on them.',
    },
    salute: {
      name: 'The Colonel\u2019s Draw',
      tip: 'His next shot is a sure crit, x1.6. Shoot back and yours is too. The sabre parries Strikes for half. Or Defend.',
    },
  },
  slagmother: {
    floor: { name: 'Ladle Pour', tip: 'For {t} turns every Strike costs 5% of your max HP on top of the burn. Shoot until it cools.' },
    overtime: {
      name: 'Both Arms',
      tip: 'Two swings at x0.8, then it sways to catch the ladle, Exposed for 2 turns. Defend, then hit it.',
      winded: 'It sways to catch the ladle: Exposed.',
    },
  },
  hale: {
    siege: {
      name: 'Lance Charge',
      tip: 'A x2.6 plasma thrust. Ion pulse, or 10% of his HP in damage first, shorts it. Defend takes about a third.',
      fail: 'Your fire knocks the lance aside. The charge earths into the floor.',
      ion: 'The ion pulse shorts the lance coil. Hale swears inside his visor.',
    },
    roll: {
      name: 'Vent Cycle',
      tip: 'His suit vents open: +50% damage. Deal 12% of his HP now to choke the blast and stagger him.',
      tipNext: 'Heat blast, x2. Defend halves it.',
      fail: 'You hit the open vents. The heat backs up and Hale staggers.',
      charge: 'The vents glow white. A blast is coming.',
    },
  },
  restraint: {
    anchor: {
      name: 'Clamp Arms',
      tip: 'x1.6, then clamped 2 turns: no Run. Defend blocks the clamp. Strike the joints now for +30%.',
    },
    shutter: {
      name: 'Cage Down', chip: 'Cage', blocked: 'The cage is down',
      tip: 'For 2 turns shots through the bars deal half and you can\u2019t Run. Strike still reaches.',
    },
  },
  voight: {
    redact: { name: 'Nerve Block', tip: '{act} deals half for 2 turns, or locks if it is a skill. Do something else.' },
    lights: {
      name: 'Gas Cloud', chip: 'Gas',
      tip: 'For 2 turns you can\u2019t read him and shots miss 25% of the time. A scanner still can. Strike can\u2019t miss.',
    },
  },
  venn: {
    count: {
      name: 'Order in Court', chip: 'Order',
      tip: 'Freed prisoners freeze for 2 turns. Alone, you are Shaken 2 unless you Defend. Intimidate breaks it.',
      fail: 'You shout her down. The prisoners hear someone louder than the bench.',
    },
    audit: { name: 'Sentence', tip: 'x{x} right now: x1 plus 0.4 per item you used this fight, up to x3. Defend halves it.' },
  },
  pell: {
    confiscate: {
      name: 'Seized',
      tip: 'He seizes a stim, or another item, until he goes down. Strike now to stop him, or use it first.',
      fail: 'You knock the scanner out of his hand. Nothing gets logged.',
    },
    crane: { name: 'Crate Drop', tip: 'A x2.2 crate off the customs crane. Smoke clears you, even if it fails. Defend only halves it.' },
  },
  gantry: {
    anchor: {
      name: 'Mag Clamp',
      tip: 'x1.6, then clamped 2 turns: no Run. Defend blocks the clamp. Strike the cab now for +30%.',
    },
    overtime: {
      name: 'Hook Swing',
      tip: 'Two hits at x0.8, then it rocks on its legs, Exposed for 2 turns. Defend, then hit it.',
      winded: 'It rocks back on its legs: Exposed.',
    },
  },
  imre: {
    shutter: {
      name: 'Shield Projector', chip: 'Shield', blocked: 'His shield is up',
      tip: 'For 2 turns the shield halves your shots and you can\u2019t Run. Strike gets inside it.',
    },
    siege: {
      name: 'Station Strike',
      tip: 'A x2.8 strike called down the cable. Ion pulse, or 10% of his HP first, breaks the uplink. Defend takes a third.',
      fail: 'Your fire knocks the uplink off his wrist. The strike never comes.',
      ion: 'The ion pulse scrambles the uplink. Far above, a gun goes quiet.',
    },
  },
};

// ---------- boss dialogue ----------
// Keys: intro (pick one, a later meeting), firstIntro (beats, in order), phase[75|50|25] (pick one),
// taunt (the boss, when the player is low), playerLow (the operative's own head, when low),
// signature[moveId] (pick one), defeat (pick one), firstDefeat (beats, in order), victoryNote (one string).
// byMap[mapId] overrides any of those keys on that map (no boss fights on two maps now, so none uses it). byBackground (Ostrane only) is one extra line per class.
// Bosses come back because nobody stays to check: defeat lines end with them dragged out, never confirmed dead.
export const BOSS_SCRIPT = {
  halvek: {
    intro: [
      '\u201CYou people never stay to check.\u201D Halvek\u2019s collar hides the stitches.',
      'Halvek looks at the gate log, then at you. \u201CThe last one got this far as well.\u201D',
      '\u201CSecond shift, same gate.\u201D Halvek buttons his gloves. \u201CLet\u2019s keep this short.\u201D',
    ],
    firstIntro: [
      'Warden Halvek steps out of the gatehouse, buttoning his gloves. \u201CAnother one.\u201D',
      '\u201CName, number, business at the gate. Skip it. I know the business.\u201D',
    ],
    phase: {
      75: [
        'Halvek checks his watch. \u201CYou\u2019re making me late for the count.\u201D',
        '\u201CGate crew, hold your fire. I\u2019ll sign for this one myself.\u201D',
      ],
      50: [
        'Halvek tears off his gloves. \u201CEnough paperwork.\u201D',
        'Gloves on the ground. \u201COff the record, then.\u201D',
      ],
      25: [
        'Blood on his collar. He straightens it. \u201CClose the gate. Close it now.\u201D',
        '\u201CThree years on this gate. You think you\u2019re the worst of it?\u201D',
      ],
    },
    taunt: [
      '\u201CSit down before you fall down. It saves me a form.\u201D',
      '\u201CI\u2019ve written this report before. Same words.\u201D',
      '\u201CYou\u2019re shaking. They all shake around now.\u201D',
    ],
    playerLow: [
      'Your pulse is loud. The gate is twenty paces away and it may as well be a mile.',
      'Your hand is slick on the grip. Somewhere behind the wall a shift bell rings.',
      'They told you this gate kills people. You thought you had understood that.',
    ],
    signature: {
      shutter: [
        '\u201CDrop the shutter. Nobody leaves until I say.\u201D',
        'A chain rattles. Halvek hauls the gatehouse shutter down.',
      ],
      confiscate: [
        '\u201CContraband. I\u2019ll take that.\u201D',
        '\u201CYou\u2019ll get a receipt. They always get a receipt.\u201D',
      ],
    },
    defeat: [
      'Halvek sits down against the gate, gloves in his lap. His crew drags him inside.',
      '\u201CLog it,\u201D Halvek says to nobody, and goes over.',
      'The gate crew pull him back behind the shutter. No one stays to argue.',
    ],
    firstDefeat: [
      'Halvek goes down against the gatehouse wall. A clipboard slides out of his coat.',
      '\u201CRead it,\u201D he says. \u201CYou won\u2019t like it. I don\u2019t.\u201D',
      'Arrest orders, signed and stamped, dated next month. Two hundred. The name lines are blank.',
      'The number comes first. Somebody fills in the people later.',
    ],
    victoryNote: 'Arrest orders get signed before anyone\u2019s name is on them. Who sets the number?',
  },

  crawler: {
    intro: [
      'Six legs find the floor. The loudspeaker clicks on. \u201CCLEAR THE ROUTE.\u201D',
      'Fresh plate on the hull, the welds still bright. \u201CTHIS VEHICLE DOES NOT STOP.\u201D',
      'The turret swings before the rest of it. A hull number, painted over an older one.',
    ],
    firstIntro: [
      'The floor shakes. A six-legged siege crawler turns its guns on you.',
      'A loudspeaker, flat and recorded. \u201CCLEAR THE ROUTE. THIS VEHICLE DOES NOT STOP.\u201D',
    ],
    phase: {
      75: [
        'The loudspeaker cuts out. Under the static, someone is breathing fast.',
        '\u201CWARNING. HULL BREACH. CONTINUE ADVANCE.\u201D',
      ],
      50: [
        'The crawler vents its coolant and redlines every gun.',
        '\u201CALL GUNS RELEASED.\u201D A person, behind the recording: \u201COh no. No, no.\u201D',
      ],
      25: [
        'A voice on the speaker, no recording in it. \u201CI can\u2019t stop it. Get away from the front.\u201D',
        '\u201CWho\u2019s out there? Is that the yard?\u201D Then the guns again.',
      ],
    },
    taunt: [
      '\u201CTARGET DEGRADED. CONTINUE ADVANCE.\u201D',
      '\u201CCLEAR THE ROUTE.\u201D The voice behind it, quietly: \u201CPlease move.\u201D',
      '\u201CCIVIL NOTICE. THE ROUTE WILL BE CLEARED.\u201D',
    ],
    playerLow: [
      'The ground jumps with every step it takes. You are counting legs instead of breathing.',
      'Smoke in your eyes. You keep a wall at your back so you can feel it coming.',
      'The gun tracks you with no hurry at all. It has never had to hurry.',
    ],
    signature: {
      anchor: [
        'The front legs rise. \u201CSTAND CLEAR OF THE LEGS.\u201D',
        'The hull rears up and its shadow finds you.',
      ],
      siege: [
        '\u201CSIEGE ROUND. BREECH LOADING.\u201D',
        'The turret stops tracking. Something heavy slides into the breech.',
      ],
    },
    defeat: [
      'Its legs fold one at a time. The speaker repeats a word until the battery gives out.',
      'The crawler settles in a cloud of coolant. The hatch stays shut.',
      'A repair crew is already on the channel. You have minutes before this one walks again.',
    ],
    firstDefeat: [
      'The crawler drops on its belly in the Siege Hangar. Eleven empty bays behind it.',
      'Two taps on the hatch, from inside. The hatch is welded from the outside.',
      'You cut it. A yard worker in a shift jacket, a firing key chained to one wrist.',
      '\u201CRegs want a person on the key. It takes your name off the list. For a while.\u201D',
    ],
    victoryNote: 'Every crawler has a yard worker welded inside. There is a list, and the key keeps you off it.',
  },

  ostrane: {
    intro: [
      'Ostrane stands at the window with her datapad. \u201CYou are on time. Your predecessors were not.\u201D',
      'Ostrane does not look up. \u201CI was recorded dead on a Tuesday. It took a morning to correct.\u201D',
      '\u201CYour cell has a new face. The figures do not change.\u201D',
    ],
    firstIntro: [
      'Supervisor Ostrane doesn\u2019t look up from her datapad. \u201CI read your file. All of them.\u201D',
      'She scrolls once. \u201CYour cell has lost {ops} to reach this room. I have the receipts.\u201D',
    ],
    phase: {
      75: [
        'She makes a note without looking. \u201CNoted.\u201D',
        '\u201CAbove last quarter\u2019s average. I will adjust.\u201D',
      ],
      50: [
        'Ostrane finally puts the datapad down.',
        '\u201CVery well.\u201D She sets the datapad down, square to the edge, and stands.',
      ],
      25: [
        'Her voice has not changed. \u201CYou understand this alters nothing in the ledger.\u201D',
        '\u201CStop a moment and consider the arithmetic.\u201D She is bleeding and has not noticed.',
      ],
    },
    taunt: [
      '\u201CYour heart rate is in your file. It was always going to be this.\u201D',
      '\u201CYou are at the average. Operatives fall within two further exchanges.\u201D',
      '\u201CDo not stop on my account. I am still counting.\u201D',
    ],
    playerLow: [
      'She knows what you\u2019ll do next. You try to stop knowing it too.',
      'Your own file is on that screen. You wonder how it ends, then you stop wondering.',
      'You have never once heard her breathe. You can hear yourself well enough.',
    ],
    signature: {
      redact: [
        '\u201CStruck from the record.\u201D The stylus flicks once.',
        '\u201CYou rely on that. It is in your file. I have removed it.\u201D',
      ],
      audit: [
        '\u201CLet us total what you have spent.\u201D',
        'She turns the screen toward you. \u201CFinal audit.\u201D',
      ],
    },
    defeat: [
      'Ostrane goes down on one knee and picks up the datapad before she falls.',
      '\u201CRecorded,\u201D she says, and her guards take her by the arms.',
      'A clerk is at her elbow with a stretcher and a stylus. She signs something on the way out.',
    ],
    firstDefeat: [
      'Ostrane sits on her own office floor, back straight, datapad in her lap.',
      '\u201CRead it. You have earned the access.\u201D The yard\u2019s whole roster, in order. You find {name}.',
      'A collection date beside it, ninety days from the notice. It falls next month.',
      '\u201CYour handler recruits from my list. Everyone on that wall had a date. It is a sensible system.\u201D',
    ],
    victoryNote: 'Every operative\u2019s name comes off Ostrane\u2019s roster. Cass recruits from the list.',
    byBackground: {
      foundry: '\u201CTwelve years on the casting floor. You came up short eleven times. I kept that for later.\u201D',
      runner: '\u201CYou moved goods past my checkpoints for years. I allowed it. You were useful to count.\u201D',
      clerk: '\u201CYou filed for me for two years. I know your handwriting. You filed your own notice.\u201D',
      preacher: '\u201CPeople listen when you talk. Seventeen of them are in my book because they did.\u201D',
    },
  },

  brask: {
    intro: [
      '\u201CThey said you\u2019d finished me. Docked me a day\u2019s pay for it.\u201D Brask slaps the hammer fist.',
      'Brask grins across the casting floor. \u201CLast one came in short as well.\u201D',
      '\u201CBack on shift!\u201D He bangs the fist against a rail. \u201CYou people make good overtime.\u201D',
    ],
    firstIntro: [
      'Overseer Brask cracks his knuckles. \u201CQuota\u2019s short. You\u2019ll make it up.\u201D',
      'An old foundry apron under the coat. \u201CTwenty years on this floor. I know what you weigh.\u201D',
    ],
    phase: {
      75: [
        '\u201CThat\u2019s it! Now we\u2019re working!\u201D',
        'Brask spits on the hammer fist. \u201CLine speed up, lads.\u201D',
      ],
      50: ['Brask roars and wades in swinging.', '\u201COff the clock now, you hear? This part\u2019s for me.\u201D'],
      25: [
        'Brask is laughing and it sounds wrong. \u201CTwenty years. You know what they pay?\u201D',
        '\u201CShift\u2019s not over! Shift\u2019s never over!\u201D',
      ],
    },
    taunt: [
      '\u201CTired already? I\u2019ve done doubles with a broken arm.\u201D',
      '\u201CLook at you. Light. You wouldn\u2019t make a day\u2019s weight.\u201D',
      '\u201CLie down. I\u2019ll put you in the book as a half-shift.\u201D',
    ],
    playerLow: [
      'The heat has got into your teeth. You can\u2019t tell which of the noises is you.',
      'Your arm has stopped answering. The line keeps running behind him.',
      'You count the steps back to the Cooling Room. Too many.',
    ],
    signature: {
      overtime: ['\u201COvertime!\u201D', '\u201CDouble shift, no breaks! Come on!\u201D'],
      front: [
        'Brask\u2019s whistle shrieks. \u201CYou lot, in front. Now.\u201D',
        'Workers file in ahead of him, eyes on the floor. \u201CGo on. Shoot through them.\u201D',
      ],
    },
    defeat: [
      'Brask hits the floor like a dropped ingot. Two foremen haul him off by the apron.',
      '\u201CPut it in the book,\u201D Brask wheezes. \u201CSay I was short.\u201D',
      'He is still laughing when they carry him out, and nobody on the line looks up.',
    ],
    firstDefeat: [
      'Brask is on his back, breathing steam. The whole shift has stopped to watch.',
      '\u201CYou know how it goes?\u201D A wet laugh. \u201CEvery ton we come up short, a name goes in the book.\u201D',
      '\u201CAsk anyone who\u2019s been short. Steel\u2019s the excuse. The book\u2019s the job.\u201D',
      'He holds up a split black thumb. \u201CI wrote my own brother down. Made the number. Got the coat.\u201D',
    ],
    victoryNote: 'The foundry pays its shortfall in people. One ton short, one name in the book.',
  },

  crucible: {
    intro: [
      'The furnace door opens. A tape crackles somewhere inside the plates. \u201CShift four, you\u2019re late.\u201D',
      'Its casing has been welded shut again, the seams still orange. It walks anyway.',
      'The heat arrives first, then the tape. \u201CStep up to the line and answer your name.\u201D',
    ],
    firstIntro: [
      'The furnace door opens and the Crucible walks out of it.',
      'A whistle in its chest, then an old man on tape. \u201CShift four. Answer your name.\u201D',
    ],
    phase: {
      75: [
        'The tape skips. \u201CShift four. Shift four. Shift four.\u201D',
        'The plates on its arms start to glow along their edges.',
      ],
      50: ['The Crucible\u2019s core goes white-hot.', 'The tape speeds up. Names run into one another.'],
      25: [
        'The tape slows to a crawl. \u201C{name}. Answer your name, {name}.\u201D',
        'Plates sag off its shoulder. It keeps walking, and the roll keeps running.',
      ],
    },
    taunt: [
      '\u201CMarked absent,\u201D says the tape, kindly, like a man reading out a pay slip.',
      '\u201CFinal call. Final call for shift four.\u201D',
      'It stops an arm\u2019s length away. The tape waits for you to answer.',
    ],
    playerLow: [
      'You have started listening for your name. That frightens you more than the heat.',
      'The air is too hot to pull in. You take small sips of it.',
      'You can smell your own hair. There\u2019s no time to do anything about it.',
    ],
    signature: {
      roll: [
        'Its chest plates swing open. \u201CShift four. Answer your name.\u201D',
        'The core glares through open plates. The tape reads on, name after name.',
      ],
      floor: [
        'One arm tips like a ladle. Slag runs out across the floor.',
        '\u201CMind the floor, shift four,\u201D says the tape, gently.',
      ],
    },
    defeat: [
      'The Crucible kneels and its core gutters down. The tape keeps going for a while.',
      'It falls forward and the floor smokes around it. They will pour it a new chest by morning.',
      'The tape winds down mid-name. Somewhere below, a furnace door starts to close.',
    ],
    firstDefeat: [
      'The Crucible is down, chest split. A tape spool turns in the glow, scorched at one edge.',
      'You pull it. The yard\u2019s old shift caller, cut up and spliced, one name at a time.',
      'This quarter\u2019s transfers, every one of them, read out so the floor can hear.',
      'Ninety days\u2019 notice. Near the end of the reel, the old man says {name}.',
    ],
    victoryNote: 'The Crucible reads out the transfer list. Every operative who has heard the reel is on it.',
  },

  kell: {
    intro: [
      '\u201CThey stitched me up downstairs. I do ask them to be tidy.\u201D Kell makes a small mark on a chart.',
      'Warden Kell wipes her glasses. \u201CMind the step. Someone always forgets it.\u201D',
      '\u201CI kept your friend\u2019s bed made. It\u2019s yours if you\u2019d like it.\u201D',
    ],
    firstIntro: [
      'Warden Kell closes the cell door behind you. \u201CWe have a bed ready.\u201D',
      'She checks a chart, then you. \u201CNo allergies. You will want to lie down soon.\u201D',
    ],
    phase: {
      75: [
        '\u201CDeep breath, please.\u201D Kell doesn\u2019t raise her voice. She never has.',
        '\u201CThat was unkind. I will note it, and we will carry on.\u201D',
      ],
      50: [
        'Kell takes off her glasses. Her eyes are worse.',
        '\u201CFour thousand people have slept in my beds. You will not be the difficult one.\u201D',
      ],
      25: [
        'Kell drops her keys down a floor drain. \u201CThere. Now neither of us is late for anything.\u201D',
        '\u201CStay with me. I don\u2019t lose people. Ask anyone.\u201D',
      ],
    },
    taunt: [
      '\u201CYou\u2019re very pale. Let me get someone.\u201D',
      '\u201CIt\u2019s all right. You can stop now. There\u2019s a clean bed.\u201D',
      '\u201CYou\u2019ll feel so much better when you stop.\u201D',
    ],
    playerLow: [
      'The lights hum. For a moment a clean bed sounds fine, and that scares you.',
      'Someone in a cell is counting under their breath. You try to count with them.',
      'Your vision has narrowed to her glasses. She has not blinked.',
    ],
    signature: {
      count: [
        '\u201CCount time. Everybody on your feet.\u201D',
        'Keys ring twice against the bars. Down the block, everyone stops moving.',
      ],
      lights: [
        '\u201CLights out. Try to sleep.\u201D',
        'A breaker snaps. Her voice is closer now. \u201CAlmost done.\u201D',
      ],
    },
    defeat: [
      'Kell folds her glasses before she falls. The guards carry her as if she might break.',
      '\u201CSomeone will need to do the evening meds,\u201D Kell says, and her head goes down.',
      'She sits on the edge of a bunk, hand to her side. \u201CGo on. I\u2019ll see myself to the Infirmary.\u201D',
    ],
    firstDefeat: [
      'Kell lies on a made bed she got to by herself. Her chart has slipped to the floor.',
      'You pick it up. Weights. Teeth. Lung capacity. Every prisoner on the block, checked weekly.',
      '\u201CNobody dies here,\u201D she says. \u201CI make sure of it. They must arrive in good condition.\u201D',
      'Arrive. She sees you hear the word, and shuts her eyes. \u201CAsk at the port.\u201D',
    ],
    victoryNote: 'The people who vanish into Detention are alive. Someone is keeping them fit to travel.',
  },

  vane: {
    intro: [
      'Vane adjusts a cuff. \u201CThey told me you had killed me. I was sorry to miss it.\u201D',
      '\u201CBack on my pad. Do wipe your boots, this is a working port.\u201D',
      'Vane lifts the ornate pistol in polite greeting. \u201CThe yard does keep sending them.\u201D',
    ],
    firstIntro: [
      'Commodore Vane lowers his macrobinoculars. \u201CYou\u2019re a long way from the yard.\u201D',
      '\u201CStay for the departure. They are very punctual, and you may never see another.\u201D',
    ],
    phase: {
      75: [
        'Vane brushes at a scorch mark. \u201CI had this coat made on the station.\u201D',
        '\u201CA good arm. One does wonder who taught you to use it.\u201D',
      ],
      50: ['Vane calls in the tower guns.', '\u201CTower, this is the Commodore. Fire when convenient.\u201D'],
      25: [
        'Vane throws his coat off the pad. For the first time he looks like a soldier.',
        'The smile is gone. \u201CDo you know what a berth costs? You have no idea what you\u2019ve done.\u201D',
      ],
    },
    taunt: [
      '\u201CSteady, now. One does like a clean finish.\u201D',
      '\u201CYou\u2019re listing badly. I\u2019d have you scrapped.\u201D',
      '\u201CNo shame in it. Most of your town ends up on my pad one way or another.\u201D',
    ],
    playerLow: [
      'The wind off the pad goes right through you. High above, the cable hums.',
      'Somewhere a tower scope is finding you again. You stop pretending it isn\u2019t.',
      'You taste fuel and blood. The lift keeps climbing behind him.',
    ],
    signature: {
      crane: [
        '\u201CClear the pad, if you please. Crane three, release.\u201D',
        'Vane\u2019s gloved hand drops like a flag. Above you, a clamp lets go.',
      ],
      salute: [
        'Vane turns side-on and lifts his pistol. \u201CShall we? As officers.\u201D',
        '\u201COne shot each. Do try to be worth it.\u201D',
      ],
    },
    defeat: [
      'Vane folds over the railing. His tower crew reach him before you can.',
      '\u201CBill the yard,\u201D Vane says through his teeth, as they carry him to a skiff.',
      'The ornate pistol skids across the pad. A customs skiff lifts him clear under covering fire.',
    ],
    firstDefeat: [
      'Vane sits against a cargo clamp, coat ruined, still trying to fix his cuff.',
      '\u201CYou\u2019ve seen the manifests. Confiscated goods, Kessa Yard.\u201D He laughs, and it costs him.',
      'Behind him a container stands open. Air holes in the steel. Forty bunks. A water line.',
      '\u201CSold on arrival, every head. Best freight there is. It loads itself.\u201D',
    ],
    victoryNote: 'The lift carries people. Confiscated goods is the manifest\u2019s word for them. They go up alive.',
  },

  dray: {
    intro: [
      '\u201COn your feet, recruit. You fell over last time as well.\u201D His medals have been polished.',
      'Dray checks his revolver, chamber by chamber. \u201CSame steps. Same result.\u201D',
      '\u201CThe surgeons say I am not to exert myself.\u201D He draws the sabre anyway.',
    ],
    firstIntro: [
      'Colonel Dray waits on the Spire steps, sabre at his side. \u201CStand up straight.\u201D',
      '\u201CI took this yard in a night. Three years on, it still sends me children.\u201D',
    ],
    phase: {
      75: [
        '\u201CBetter. Somebody taught you to keep your feet.\u201D',
        'Dray touches a medal, as if he is counting them. \u201CAgain.\u201D',
      ],
      50: [
        'Dray unbuckles his greatcoat and draws the sabre.',
        '\u201CVery well. As we did it at the gate.\u201D',
      ],
      25: [
        '\u201CTurn out the guard! Nobody leaves these steps.\u201D',
        'Blood on the greatcoat. He does a button up over it. \u201CI was patient at the gate too.\u201D',
      ],
    },
    taunt: [
      '\u201CDown you go. They always go down on the third step.\u201D',
      '\u201CBreathe, recruit. It is nearly over, one way or the other.\u201D',
      '\u201CI have buried better soldiers than you. I did not visit them either.\u201D',
    ],
    playerLow: [
      'Your boots slip on the Spire steps. Every one of them was cut for marching.',
      'Down on the parade ground someone is counting a drill. You lose count with them.',
      'The sabre catches the floodlight. You have stopped watching the revolver.',
    ],
    signature: {
      front: [
        '\u201CConscripts, front rank!\u201D Yard faces, holding rifles they have never fired.',
        'He pushes a boy in a yard jacket ahead of him. \u201CShoot through him, then.\u201D',
      ],
      salute: [
        'Dray brings the sabre up to his face, then the revolver. \u201CProperly, now.\u201D',
        '\u201COne each. As officers do it.\u201D',
      ],
    },
    defeat: [
      'Dray goes down on one knee and stays there. His aides carry him into the Spire.',
      '\u201CNote the time,\u201D Dray says, and his chin drops onto his medals.',
      'The guard drag him up the steps by his greatcoat. The sabre stays behind.',
    ],
    firstDefeat: [
      'Dray sits on the Spire steps, sabre across his knees. He looks very old.',
      '\u201CWe could have come through the gate on the first day. The order said wait.\u201D',
      '\u201CLet them shut the doors, it said. Count who stays inside.\u201D',
      '\u201CEveryone who held that floor for eleven days was on the first roster.\u201D',
    ],
    victoryNote: 'The garrison waited eleven days on purpose, to count who held the floor. They were the first roster.',
  },

  slagmother: {
    intro: [
      'The bell on the ladle track rings twice. The Slagmother\u2019s ladle is full again.',
      'New plates on its crane arms, bolted over the scorch marks. It still pours.',
      'The track bell rings. The shift on the floor below steps back without looking up.',
    ],
    firstIntro: [
      'A bell rings on the ladle track. The Slagmother swings its ladle round to face you.',
      'The shift calls it Mother. It carries steel off the floor, and it never brings any back.',
    ],
    phase: {
      75: [
        'The ladle tilts a degree. The track bell starts ringing and does not stop.',
        'One crane arm drags along the rail, throwing sparks. It doesn\u2019t slow down.',
      ],
      50: [
        'Both crane arms lock. The ladle glows white.',
        'It holds the ladle level, and the heat comes off it like a wall.',
      ],
      25: [
        'A crane arm folds at the elbow. The ladle hangs off the other one, still pouring.',
        'The bell gives out. The Slagmother keeps to the track without it.',
      ],
    },
    taunt: [
      'It waits above you, ladle tipped, for you to stop moving.',
      'The bell rings once, slowly, the way it rings at the end of a shift.',
      'The ladle swings low. The heat presses on your face like a hand.',
    ],
    playerLow: [
      'Your lungs are full of the smell of hot metal. You take the air in small sips.',
      'You are watching the ladle instead of the arms. You know that is a mistake.',
      'The floor below has gone quiet. The shift is waiting to see if you get up.',
    ],
    signature: {
      floor: [
        'The ladle tips. A sheet of slag runs out across the walkway.',
        'The bell rings three times. Everyone on the floor below knows what that means.',
      ],
      overtime: [
        'Both arms swing at once, the ladle riding between them.',
        'The crane arms open wide, then come together.',
      ],
    },
    defeat: [
      'The Slagmother tips forward and the ladle pours out across the track. A crew is on the way.',
      'Its arms fold and the bell rings once. The shift on the floor goes back to work.',
      'It settles on its rail, ladle cooling to grey. By morning it will be pouring again.',
    ],
    firstDefeat: [
      'The Slagmother sags on its rail and the ladle spills across the walkway.',
      'Not slag. Good steel, bright and clean. This morning\u2019s best castings.',
      'Its run log is on the cab panel. Most days, nothing. Some days, a full ladle to the slag pit.',
      'Those are the days the shift came close to its number. It takes the difference and pours it away.',
    ],
    victoryNote: 'When the shift gets close to its number, the Slagmother pours the difference into the slag pit.',
  },

  hale: {
    intro: [
      '\u201CBack again. You\u2019re a recurring fault.\u201D Hale taps his visor. \u201CI log those.\u201D',
      'A fresh patch on the chest of Hale\u2019s heat suit. \u201CThey rated it for worse than you.\u201D',
      '\u201CThe gallery runs at ninety-one percent uptime. You\u2019re the nine.\u201D',
    ],
    firstIntro: [
      'Hale lifts his visor. \u201CYou\u2019re the fault I\u2019ve been chasing all quarter.\u201D',
      'Through the gallery glass behind him, every furnace in the Works burns low and even.',
    ],
    phase: {
      75: [
        '\u201CTolerable. I\u2019ve had worse from a cracked flue.\u201D',
        'Hale checks a gauge on his wrist. \u201CRunning warm. Fine.\u201D',
      ],
      50: [
        'Hale drops his visor. The lance burns blue.',
        '\u201CFull output, then. You\u2019ll be the first thing in the Works that gets it.\u201D',
      ],
      25: [
        'A seam on the heat suit splits and steam pours out. \u201CI\u2019ll have to revise that rating.\u201D',
        '\u201CDo you know how hard it is to run a works at a third? Exactly a third?\u201D',
      ],
    },
    taunt: [
      '\u201CYou\u2019re losing pressure. I can hear it from here.\u201D',
      '\u201CShut down. It\u2019s the efficient thing.\u201D',
      '\u201CI\u2019ve seen gaskets fail slower than you.\u201D',
    ],
    playerLow: [
      'Sweat runs into your eyes and dries before it reaches your chin.',
      'Your hands won\u2019t stop shaking. The furnaces behind the glass don\u2019t flicker once.',
      'You can\u2019t tell the roar in your ears from the roar of the Works.',
    ],
    signature: {
      siege: [
        'The lance hums and climbs in pitch. \u201CStand still. It\u2019s cleaner.\u201D',
        'Hale sets his feet and braces the lance like a drill.',
      ],
      roll: [
        '\u201CVenting.\u201D The panels on his back open and the heat pours out.',
        'Steam bursts from every seam of the heat suit. The vents glow.',
      ],
    },
    defeat: [
      'Hale goes down hissing steam. Two techs drag him away from the glass.',
      '\u201CLog it as a fault,\u201D Hale says through the visor, and stops moving.',
      'His crew haul him out by the suit straps. Behind him, the dials don\u2019t move.',
    ],
    firstDefeat: [
      'Hale is down on the gallery floor, visor cracked. Behind him, one board, one dial per furnace.',
      'Every dial is set below a third. He watches you see it. \u201CI set them every morning.\u201D',
      '\u201CA number comes down the cable at six. How many names they want. I make the steel short by that.\u201D',
      '\u201CBest casters in the system. They were never going to make it. That was the job.\u201D',
    ],
    victoryNote: 'The furnaces are held below a third on purpose. The lift sends down how many names it wants.',
  },

  restraint: {
    intro: [
      '\u201CPlease remain still.\u201D The cage on its back is new. The recording is the same.',
      'Fresh welds on the cage door. Someone inside it coughs.',
      '\u201CRestraint is for your safety. Please do not touch the bars.\u201D',
    ],
    firstIntro: [
      'A cage on legs fills the corridor. \u201CPlease remain still. Restraint is for your safety.\u201D',
      'Inside the cage, behind the bars, somebody in a prison smock has a hand on a lever.',
    ],
    phase: {
      75: [
        '\u201CThank you for your patience.\u201D The person inside is pressed against the bars.',
        'The recording skips. Under it, quietly: \u201CI\u2019m sorry. I have to.\u201D',
      ],
      50: [
        'Every cuff on the Restraint Engine snaps open at once.',
        '\u201CRestraint level raised. Please lie face down.\u201D Inside, someone is crying.',
      ],
      25: [
        '\u201CLockdown. Lockdown.\u201D The voice inside: \u201CI can\u2019t open it. It won\u2019t let me.\u201D',
        'The prisoner inside shouts over the recording. \u201CThe joints! Go for the joints!\u201D',
      ],
    },
    taunt: [
      '\u201CYou have been restrained. Please wait to be collected.\u201D',
      '\u201CPlease stop resisting. Resistance is noted on your file.\u201D',
      'The voice inside, barely: \u201CStay down. It stops when you stay down.\u201D',
    ],
    playerLow: [
      'Cuffs hang off you like jewellery. You can\u2019t remember them all landing.',
      'You can hear the person in the cage breathing as hard as you are.',
      'A cell door stands open behind you. For a moment it looks like somewhere to sit.',
    ],
    signature: {
      anchor: [
        '\u201CPlease extend your arms.\u201D The clamps open wide.',
        'Both clamp arms reach for you, slow and very sure.',
      ],
      shutter: [
        '\u201CSecuring.\u201D Bars slam down round the whole machine.',
        'The cage drops to the floor. \u201CPlease step back from the bars.\u201D',
      ],
    },
    defeat: [
      'The Engine folds onto its cage. Guards drag it to the repair bay, prisoner and all.',
      '\u201CThank you for your cooperation,\u201D says the recording, and the legs give out.',
      'It sinks to the floor. The prisoner inside doesn\u2019t try the door. It is welded shut.',
    ],
    firstDefeat: [
      'The Restraint Engine slumps against the wall of the Interrogation Suite. Two taps on the bars.',
      'You cut the cage door. The prisoner on the lever has a Cell Block C number inked on one hand.',
      '\u201CThey come round with two offers. The lever, or the lift. Nobody\u2019s been back from the lift.\u201D',
      '\u201CSo I took the lever. Tell my sister I took the lever.\u201D',
    ],
    victoryNote: 'Prisoners are offered the lever in the Engine or the lift. Everyone fears the lift more.',
  },

  voight: {
    intro: [
      '\u201CYou again. Sit. I kept your chair warm.\u201D Voight lays out a fresh tray.',
      'Voight\u2019s gas mask hangs round his neck. \u201CThey sewed me up. I took notes.\u201D',
      '\u201CLast time you didn\u2019t give me a single name. Let\u2019s see about today.\u201D',
    ],
    firstIntro: [
      'Dr. Voight looks up from a steel tray. \u201CSit. We\u2019ll start with your shift.\u201D',
      '\u201CDon\u2019t worry. I never ask what you know. Only who you know.\u201D',
    ],
    phase: {
      75: [
        '\u201CInteresting.\u201D He writes something down. \u201CGo on.\u201D',
        'Voight pulls the mask up over his face. His voice comes out flat and close.',
      ],
      50: [
        'Voight pulls on a second pair of gloves.',
        '\u201CVery well. We\u2019ll do this the long way.\u201D',
      ],
      25: [
        'Voight laughs into the mask. \u201CNobody has ever made me hurry before.\u201D',
        '\u201CGive me one name and you can walk out. One. Anyone.\u201D',
      ],
    },
    taunt: [
      '\u201CTell me who taught you that, and I\u2019ll let you sit down.\u201D',
      '\u201CA name. Any name. It all stops for a name.\u201D',
      '\u201CYour hands are shaking. Mine never do.\u201D',
    ],
    playerLow: [
      'Names come into your head, people from the yard. You hold on to them.',
      'The tray rattles every time you move. You stop moving as much.',
      'The gas smells sweet. You try not to like it.',
    ],
    signature: {
      redact: [
        '\u201CHold still. This only takes the feeling.\u201D',
        'The syringe gun hisses. Something goes cold and quiet.',
      ],
      lights: [
        'Voight drops a canister and the room fills with grey.',
        '\u201CBreathe normally,\u201D says the mask, somewhere in the gas.',
      ],
    },
    defeat: [
      'Voight goes down across his tray. His orderlies carry him out, holding his hands.',
      '\u201CWrite that down,\u201D Voight says to nobody, and the mask fogs over.',
      'His orderlies have him on a gurney before you can reach him. He waves.',
    ],
    firstDefeat: [
      'Voight is on the floor of the Tower, mask off, picking glass out of his glove.',
      'His file box has spilled. No questions in it. Only names, in other people\u2019s handwriting.',
      '\u201CNobody comes here for what they know. They come to give me names. Each name buys a week.\u201D',
      '\u201CThat is how the roster stays full. You fill it for us, in here.\u201D',
    ],
    victoryNote: 'Interrogation isn\u2019t for answers. Prisoners trade names for weeks, and that keeps the roster full.',
  },

  venn: {
    intro: [
      '\u201CThe accused returns. The court notes it has sentenced you once already.\u201D',
      'Venn settles her collar over a fresh scar. \u201CThe court does not recognise your last verdict.\u201D',
      '\u201CBe seated, or be made to sit. The court is indifferent.\u201D',
    ],
    firstIntro: [
      'Magistrate Venn does not rise from the bench. \u201CThe accused will approach.\u201D',
      '\u201CThe court has your cell\u2019s record. {ops} heard so far. All sentenced. All served.\u201D',
    ],
    phase: {
      75: [
        '\u201CObjection noted, and overruled.\u201D',
        'Venn brings the gavel-mace down on the bench. The wood splits. \u201COrder.\u201D',
      ],
      50: [
        'Venn stands. Nobody in this court has seen her stand.',
        '\u201CThe court will hear this matter in person.\u201D',
      ],
      25: [
        '\u201CSeal the doors. This court does not adjourn.\u201D',
        'Blood runs down the armoured collar. Her voice doesn\u2019t change. \u201CThe sentence stands.\u201D',
      ],
    },
    taunt: [
      '\u201CThe accused may stop resisting at any time. It will not affect the verdict.\u201D',
      '\u201CThe court finds you tired.\u201D',
      '\u201CKneel. It is customary, at the end.\u201D',
    ],
    playerLow: [
      'The court is silent. Every bench is full of people who won\u2019t look at you.',
      'Your knees want to fold. The floor before the bench is worn into two dips.',
      'You can hear the gavel even when it isn\u2019t falling.',
    ],
    signature: {
      count: [
        '\u201COrder in court!\u201D Every prisoner on the benches goes still.',
        'The gavel comes down once. Nobody in the room breathes.',
      ],
      audit: [
        '\u201CThe court will now consider what you have spent.\u201D',
        'Venn lifts the gavel-mace high. \u201CSentence.\u201D',
      ],
    },
    defeat: [
      'Venn falls back against the bench. Her clerks carry her out through the robing door.',
      '\u201CThe verdict stands,\u201D Venn says, and her ushers take her by the arms.',
      'Her ushers carry her out. The court rises as she passes, out of habit.',
    ],
    firstDefeat: [
      'Venn sits on the steps of her own bench, collar undone, the gavel in her lap.',
      '\u201CYou want the sentence. Here it is.\u201D A ledger page: the yard\u2019s quarter, a column of numbers.',
      '\u201CA raider killed on our ground is a sentence served. It comes off the yard\u2019s number.\u201D',
      '\u201CSo far, {ops}. Your handler does this sum as well. Ask for how long.\u201D',
    ],
    victoryNote: 'A dead raider counts as a sentence served. Each operative spared someone in the yard. Cass knows.',
  },

  pell: {
    intro: [
      '\u201CYou again. You never declare anything.\u201D Pell\u2019s nose has been set crooked.',
      'Pell stamps a form without reading it. \u201CSecond offence. There is a fee.\u201D',
      '\u201CThe surgeon billed customs for me. I have billed you.\u201D',
    ],
    firstIntro: [
      'Chief Pell runs a scanner over you and frowns at it. \u201CAnything to declare?\u201D',
      '\u201CWeapons. Contraband. Yard goods without a stamp. You are all three.\u201D',
    ],
    phase: {
      75: [
        '\u201CThat is assault on an officer of customs. There is a form for it.\u201D',
        'Pell wipes his scanner on his sleeve. \u201CStill reading you. Still guilty.\u201D',
      ],
      50: [
        'Pell puts the scanner away and takes the baton in both hands.',
        '\u201CTower, this is customs. I need a second stamp down here.\u201D',
      ],
      25: [
        '\u201CI just stamp them! I don\u2019t load them!\u201D His voice cracks.',
        'Pell is sweating through his collar. \u201CTower! Somebody! I\u2019m only customs!\u201D',
      ],
    },
    taunt: [
      '\u201CDeclared: one raider, damaged. No value.\u201D',
      '\u201CLie still. I need you flat for the scanner.\u201D',
      '\u201CNobody leaves the port without a stamp. You will get yours.\u201D',
    ],
    playerLow: [
      'The wind off the pad pushes you sideways. You let it, for a second.',
      'There is a queue of crates behind him, all stamped. You can\u2019t stop looking at them.',
      'You can taste the stamp ink. You don\u2019t remember being hit in the mouth.',
    ],
    signature: {
      confiscate: [
        '\u201CThat is undeclared. Seized.\u201D',
        'Pell\u2019s hand shoots out. \u201CContraband. I will need to keep that.\u201D',
      ],
      crane: [
        '\u201CCrane four, drop the inspection lot.\u201D A crate swings out overhead.',
        'Pell waves his baton at the crane cab. Something huge lets go above you.',
      ],
    },
    defeat: [
      'Pell sits down hard on a crate. His deputies carry him into the tower base.',
      '\u201CMark it damaged in transit,\u201D Pell wheezes, and passes out.',
      'Customs officers drag him off by the belt. His stamp rolls away across the pad.',
    ],
    firstDefeat: [
      'Pell is on his back by the crate queue. His scanner is still on, pointed at a crate.',
      'The screen shows heat. Forty warm shapes lying in rows, in a crate stamped Kessa Yard.',
      '\u201CIt reads for contraband. It reads warm. They all read warm.\u201D He won\u2019t look at it.',
      '\u201CI don\u2019t open them. Nobody opens them. You stamp it and it goes up.\u201D',
    ],
    victoryNote: 'The yard crates read warm on the customs scanner. Pell stamps them anyway. Nobody opens them.',
  },

  gantry: {
    intro: [
      'The Walker swings off the gantry. The cab radio: \u201CNot you again. Please just go home.\u201D',
      'A new hook on the arm, the paint still tacky. \u201CSorry. Sorry about this.\u201D',
      'The radio clicks on. \u201CThey patched it overnight. They always patch it.\u201D',
    ],
    firstIntro: [
      'A cargo walker steps off the gantry, hook swinging. The cab radio crackles. \u201CSorry.\u201D',
      '\u201CLoad coming over. Mind your head.\u201D The voice is from the yard. You can tell.',
    ],
    phase: {
      75: [
        '\u201CIt\u2019s taking the controls back. That one wasn\u2019t me.\u201D',
        'The hook swings wide. The radio: \u201CGet under the arm. It can\u2019t see under the arm.\u201D',
      ],
      50: [
        'The Gantry Walker drops its load and turns all the way round.',
        '\u201COverride. Override.\u201D The driver: \u201CIt\u2019s locked me out. It\u2019s all it now.\u201D',
      ],
      25: [
        'Fluid sprays from a knee. On the radio: \u201CKeep going. I\u2019ve got nine days anyway.\u201D',
        '\u201CHit the cab! I\u2019ll duck! Just hit the cab!\u201D',
      ],
    },
    taunt: [
      '\u201CStay down, please. It stops if you stay down.\u201D',
      '\u201CLOAD SECURED,\u201D says the Walker, in a voice that isn\u2019t the driver\u2019s.',
      'The radio, very quietly: \u201CI\u2019m so sorry. Please don\u2019t get up.\u201D',
    ],
    playerLow: [
      'The wind under the gantry is cold. The cable sings above you.',
      'The hook goes past your head close enough to hear. You count to two.',
      'Somebody on the radio is praying. It might be the driver. It might be you.',
    ],
    signature: {
      anchor: [
        'The magnetic clamp hums and swings for you. \u201CSorry. Sorry.\u201D',
        '\u201CCLAMPING.\u201D Your belt buckle drags toward the arm.',
      ],
      overtime: [
        'Hook and clamp swing together. The radio: \u201CWatch it!\u201D',
        '\u201CIt\u2019s doing the double. Get down!\u201D',
      ],
    },
    defeat: [
      'The Walker sits down on its haunches. The cab stays shut till the tower crew arrive.',
      '\u201CThanks,\u201D says the radio, as the Walker topples. A tower crew is already running.',
      'It folds up under the gantry. You can hear the driver breathing on the radio.',
    ],
    firstDefeat: [
      'The Walker goes over at the foot of the Control Tower. Two taps on the cab door.',
      'The driver climbs out and looks straight up at the cable, and keeps looking.',
      '\u201CKey\u2019s good for a year. Then you\u2019re freight like anyone. I\u2019ve got nine days.\u201D',
      'They walk off across the pad without asking which way the gate is.',
    ],
    victoryNote: 'The Walker\u2019s key buys a year off the list. Then its drivers go up the lift as freight too.',
  },

  // The last boss of the game. His scene is where the through-line ends: they are alive, the lift is the road, and it stops.
  imre: {
    intro: [
      '\u201CBack at the top. Few people see it twice.\u201D Imre does not turn round.',
      'A new seam in the white armour. \u201CThe surgeons up here are very good.\u201D',
      '\u201CYou came the long way again. The cable is quicker. Ask anyone in the ledger.\u201D',
    ],
    firstIntro: [
      'Director Imre stands at the glass with his back to you. \u201CCome and look at it first.\u201D',
      'Far below, Kessa Yard is a smudge of furnace light. \u201CThat is all of it. It is very small.\u201D',
      '\u201CI have run this cable for twenty years. Nobody has come up it uninvited. Until you.\u201D',
    ],
    phase: {
      75: [
        '\u201CGood. I wanted to see what the yard makes now.\u201D',
        'Imre glances at a scorch on his shield arm. \u201CNobody has marked this armour before.\u201D',
      ],
      50: [
        'Imre turns away from the glass at last.',
        '\u201CVery well. Let us not pretend this is a negotiation.\u201D',
      ],
      25: [
        '\u201CSeal the deck.\u201D The shield gutters out on his arm. He does not look at it.',
        '\u201CIf I fall, the cable stops. Think about who is at the top of it.\u201D',
      ],
    },
    taunt: [
      '\u201CLie still. You can see the whole yard from the floor too.\u201D',
      '\u201CYou are very tired. Everyone from the yard is tired. It is how we know them.\u201D',
      '\u201CThere is no shame in it. Everyone ends up on the cable.\u201D',
    ],
    playerLow: [
      'Through the glass the yard is so small you could cover it with your hand.',
      'Your blood is bright on the white deck. Somebody will have to clean it.',
      'The cable hums under your feet. Somewhere up it, people are listening to it too.',
    ],
    signature: {
      shutter: [
        'A disc of light opens off his forearm. \u201CShall we be civil?\u201D',
        'The shield projector hums up. Your sights slide off it.',
      ],
      siege: [
        'Imre touches his wrist. \u201CStation, this is the deck. One round, please.\u201D',
        'Something far up the cable turns to look at you.',
      ],
    },
    defeat: [
      'Imre kneels on the white deck. His staff carry him to the station car.',
      '\u201CBring the car down,\u201D Imre says, very calmly, and his guard lift him into it.',
      'His guards have him in a lift car before you reach the glass. It climbs.',
    ],
    firstDefeat: [
      'Imre sits against the glass with the whole yard behind him. He looks smaller than it.',
      '\u201CThe ledger is in the case. Ostrane writes it, I keep it.\u201D Every name taken, alive, and where.',
      'On the first page, a column of your cell\u2019s dead, headed Paid.',
      '\u201CStop the cable and nobody else goes up. Nobody comes back down. They are all up there.\u201D',
      'You find the brake. It takes both hands. Far above you, a lift car stops and waits.',
    ],
    victoryNote: 'Everyone taken is alive, and the ledger says where. The lift is the only road to them.',
  },
};

const lookup = (id, key, map) => {
  const s = BOSS_SCRIPT[id];
  if (!s) return undefined;
  const walk = (root) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), root);
  const own = map && s.byMap && s.byMap[map] ? walk(s.byMap[map]) : undefined;
  return own !== undefined ? own : walk(s);
};

// Every line for a key, filled, as an array. Use for beats: firstIntro, firstDefeat.
// Keys can be dotted: 'phase.50', 'signature.shutter', 'byBackground.clerk'. opts: { map, n, name }.
export function bossLines(id, key, opts = {}) {
  const v = lookup(id, key, opts.map);
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((l) => fill(l, opts));
}

// One line for a key, filled and picked with opts.rng. Returns '' when the boss has no such line.
export function bossLine(id, key, opts = {}) {
  const v = bossLines(id, key, opts);
  return v.length ? pickOne(v, opts.rng) : '';
}

// ---------- arriving at a map, and at each of its three areas ----------
export const MAP_INTROS = {
  garrison: {
    arrive: 'Floodlights and wet concrete. The gate crew are changing shift, and they are not hurrying.',
    bands: [
      'The outer ring: checkpoints, bunks, a motor pool. Soldiers who would rather be elsewhere.',
      'Ration Depot and Armoury Row. They eat better than the yard, and they are better armed than you.',
      'Carpet on the Officers\u2019 Deck. Every door in the Chancery has a number on it, and so does everyone.',
    ],
  },
  foundry: {
    arrive: 'The Works is the only thing in town still making noise after dusk. It never stops.',
    bands: [
      'Slag Yard and Conveyor Hall. The forced shift keeps its eyes on the line as you go past.',
      'Half the furnaces down here are banked low. The shift still gets docked for the shortfall.',
      'The air stops being air around the Quench Pits. Above it all, one small lit window.',
    ],
  },
  detention: {
    arrive: 'Intake has a clean floor and a long bench. Everyone from the yard knows someone who sat here.',
    bands: [
      'Holding Pens and Cell Block A. People look up when you pass, then look back at the door.',
      'Isolation, the Infirmary, Records. Nobody in the files is marked dead. You check twice.',
      'Past Solitary, the Transfer Dock. The beds are clean. Somebody wants these people healthy.',
    ],
  },
  port: {
    arrive: 'Open pads and a hard wind. The cable goes up into the smog and you can\u2019t see where it ends.',
    bands: [
      'Customs Hall and the Fuel Depot. There\u2019s a queue of crates, each one stamped Kessa Yard.',
      'The Container Stacks. Air holes drilled in the steel. None of the customs forms mention it.',
      'Tether Anchor, Gantry Ring, Flight Ops. Everything up here is on a timetable, and it is on time.',
    ],
  },
};

// 0, 1 or 2. Sublevels past 15 stay in the last band.
export function areaBand(sector) {
  const s = Math.max(1, Math.floor(Number(sector)) || 1);
  return s <= 5 ? 0 : s <= 10 ? 1 : 2;
}

// With a sector: the line for its area. Without one: the arrival line.
export function mapIntro(mapId, sector) {
  const m = MAP_INTROS[mapId];
  if (!m) return '';
  return sector === undefined ? m.arrive : m.bands[areaBand(sector)];
}

// ---------- codex ----------
// text: sentences, to be joined with a space. hint: what the locked entry shows.
// unlock.kind: start | fallen (n) | boss (id, optional map) | bossRepeat (n: same boss beaten n times) | ending.
export const CODEX = [
  { id: 'yard', title: 'Kessa Yard', unlock: { kind: 'start' }, hint: 'Known from the start.', text: [
    'A freight and foundry town at the foot of the orbital lift.',
    'It cast the anchor plates that hold the cable down, and for sixty years the shift bell ran everyone\u2019s day.',
    'People here say \u201Cbefore\u201D and don\u2019t need to finish the sentence.',
  ] },
  { id: 'name', title: 'The Name', unlock: { kind: 'start' }, hint: 'Known from the start.', text: [
    'A cinder cell is the brick chamber under a furnace where the ash gets raked to cool.',
    'It is too hot to search and too filthy to bother with, so that is where the first meeting was held.',
    'Six people came. Cass is the only one still in the yard.',
  ] },
  { id: 'wall', title: 'The Wall', unlock: { kind: 'fallen', n: 1 }, hint: 'Lose an operative.', text: [
    'Every operative\u2019s name goes on the safehouse wall in foundry paint.',
    'Cass does it personally, and does it the same night.',
    'Nobody has ever seen Cass read it, and nobody has ever seen Cass get one wrong.',
  ] },
  { id: 'ilse', title: 'Whoever Comes Through',
    unlock: { kind: 'bossRepeat', n: 2 }, hint: 'Beat the same boss twice.',
    text: [
    'You don\u2019t stay to check, because you can\u2019t, and they drag their officers out through the back.',
    'Directorate surgeons will patch up nearly anything, and a Warden back on shift costs less than a new one.',
    'Doc Ilse trained one of those surgeons. She won\u2019t say which, and she won\u2019t say she\u2019s sorry.',
  ] },
  { id: 'night', title: 'The Night at the Gate', unlock: { kind: 'fallen', n: 3 }, hint: 'Lose 3 operatives.', text: [
    'They came with paper first: a supervision order over an unpaid debt on the lift contract.',
    'The casting floor shut the doors and held out for eleven days.',
    'On the twelfth, siege crawlers came through the gate, and by morning the shift bell was ringing again.',
  ] },
  { id: 'ninety', title: 'Ninety Days', unlock: { kind: 'fallen', n: 10 }, hint: 'Lose 10 operatives.', text: [
    'There\u2019s a shift locker in the yard with a tally of days scratched in the door. It stops at ninety.',
    'Nobody in the yard will tell you what that number means, unless you ask them after dark.',
  ] },
  { id: 'marrow', title: 'Marrow\u2019s Stock', unlock: { kind: 'fallen', n: 20 }, hint: 'Lose 20 operatives.', text: [
    'Marrow asks no questions about his stock, because he already knows the answers.',
    'Boots with the name scratched out, a wedding ring in a tray of washers, tools with a family\u2019s initials.',
    'He says that if he stopped selling it, the Directorate would sell it instead.',
  ] },
  { id: 'signed', title: 'Signed in Advance',
    unlock: { kind: 'boss', id: 'halvek' }, hint: 'Beat Warden Halvek.',
    text: [
    'Arrest orders come down from the Spire in bundles, signed and dated, with the names left blank.',
    'Sector wardens fill them in as needed.',
    'The charge doesn\u2019t matter, and the clerks have stopped pretending to read it.',
  ] },
  { id: 'short', title: 'Short', unlock: { kind: 'boss', id: 'brask' }, hint: 'Beat Overseer Brask.', text: [
    'The quota has doubled since the occupation, and the Works has never once met it.',
    'For every ton short, a name goes in the overseer\u2019s book.',
    'The shift gets to choose the name, and most shifts do.',
  ] },
  { id: 'fit', title: 'Fit to Travel', unlock: { kind: 'boss', id: 'kell' }, hint: 'Beat Warden Kell.', text: [
    'Nobody at Kessa Yard has been marked dead in the Detention records for two years.',
    'They eat twice a day and see a doctor every week. Kell is proud of that, and she means it.',
    'A body in good health is worth more at the far end of the trip.',
  ] },
  { id: 'goods', title: 'Confiscated Goods', unlock: { kind: 'boss', id: 'vane' }, hint: 'Beat Commodore Vane.', text: [
    'Forty bunks to a container and a water line down the middle.',
    'The manifest gives weight, port of origin and condition on loading.',
    'The word for them on every form is goods. Vane\u2019s bonus is paid per unit delivered alive.',
  ] },
  { id: 'key', title: 'The Key-Holder', unlock: { kind: 'boss', id: 'crawler' }, hint: 'Beat a Siege Crawler.', text: [
    'Directorate regulations say a siege engine must have a person on the firing key.',
    'So they weld one in, someone from the yard with a date coming up, and the machine does the rest.',
    'You get a year off the list. They all take it.',
  ] },
  { id: 'reel', title: 'The Reel', unlock: { kind: 'boss', id: 'crucible' }, hint: 'Beat the Crucible.', text: [
    'The old shift caller read the roll on the casting floor for thirty years.',
    'His voice is still on the tapes, so they cut it up and use it to read the transfer list.',
    'Foundry hands say they can tell when it has been spliced. They say it\u2019s worse when they can\u2019t.',
  ] },
  { id: 'booth', title: 'The Control Booth',
    unlock: { kind: 'boss', id: 'hale', map: 'foundry' }, hint: 'Clear the Foundry Works.',
    text: [
    'One chair, and one dial per furnace, all of them set below a third.',
    'The shortfall the yard is punished for gets set here each morning, to a number that comes down the cable.',
    'Some of the best casters in the system, and they were never going to make their number.',
  ] },
  { id: 'roster', title: 'The Roster',
    unlock: { kind: 'boss', id: 'ostrane', map: 'garrison' }, hint: 'Clear the Directorate Garrison.',
    text: [
    'Everyone in the yard is on it, in the order they will be collected.',
    'When your name comes up, you get a notice and ninety days. Most people go on working.',
    'A few of them go and find a wiry stranger smoking outside a safehouse.',
  ] },
  { id: 'cass', title: 'Cass',
    unlock: { kind: 'boss', id: 'ostrane', map: 'garrison' }, hint: 'Clear the Directorate Garrison.',
    text: [
    '\u201CI never took anyone who had time left. You were already gone, and I only change where.\u201D',
    '\u201CA defector gets me the list, the dispatcher gets me the dates, and I go and knock.\u201D',
    '\u201CHate me for it after, like plenty on that wall did.\u201D',
  ] },
  { id: 'paid', title: 'Paid',
    unlock: { kind: 'boss', id: 'venn', map: 'detention' }, hint: 'Clear the Detention Complex.',
    text: [
    'A raider killed on Directorate ground comes off the yard\u2019s number for the quarter.',
    'Cass found that line in a stolen audit in the first year, and has told nobody.',
    'Somewhere in the yard there\u2019s a neighbour for every name on that wall, still going to work.',
  ] },
  { id: 'ledger', title: 'The Ledger',
    unlock: { kind: 'boss', id: 'imre', map: 'port' }, hint: 'Clear the Orbital Lift Port.',
    text: [
    'Ostrane wrote it on paper, because paper can\u2019t be sliced, and Director Imre kept it at the top of the lift.',
    'Every person ever lifted out of Kessa Yard is in it, with the place they were sold to and the price.',
    'Juno, who flew the lift before they tore off her patch, has started marking routes in the margins.',
  ] },
  { id: 'pilot', title: 'Grounded', unlock: { kind: 'fallen', n: 40 }, hint: 'Lose 40 operatives.', text: [
    'Juno drinks at the Lantern and won\u2019t look up at the cable.',
    'She flew lift cars for nine years, and one day she asked why a load of steel needed a water line.',
    'They took her licence and left her alive, which she takes as an insult.',
  ] },
  { id: 'dawn', title: 'Dawn', unlock: { kind: 'ending' }, hint: 'Free all four districts.', text: [
    'The furnaces are cold and the cells are empty, and nobody has come for a name in weeks.',
    'Cass has stopped painting, and people from the yard come in to read the wall.',
    'The ledger is open on the safehouse table, and the shuttle in the old shaft is being refitted.',
    'There are a lot of people still up there.',
  ] },
];

// ctx: { fallen, beaten: ['halvek', 'crawler:foundry', ...], bossRepeat: highest beats of one boss, ending }.
// A beaten entry of 'crawler:foundry' also counts as beating 'crawler'.
export function codexUnlocked(entry, ctx = {}) {
  const u = entry.unlock, beaten = ctx.beaten || [];
  if (u.kind === 'start') return true;
  if (u.kind === 'fallen') return countOf(ctx.fallen) >= u.n;
  if (u.kind === 'bossRepeat') return countOf(ctx.bossRepeat) >= u.n;
  if (u.kind === 'ending') return !!ctx.ending;
  if (u.kind === 'boss') {
    if (u.map) return beaten.includes(`${u.id}:${u.map}`);
    return beaten.some((b) => b === u.id || b.startsWith(`${u.id}:`));
  }
  return false;
}
