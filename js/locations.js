// js/locations.js — World Locations & Ship Types
// Coordinate system: 1 unit = 1 metre, Y=up, X=East, Z=South (negative Z = North)
// Origin = channel centre of each location

export const SHIP_TYPES = [
  { id: 'cargo',     name: 'General Cargo Vessel',    loa: 140, beam: 22, draft: 8,  maxSpeed: 14, bridgeHeight: 16, color: 0x778899, turnRate: 8.5,  steeringLag: 9,  engineLag: 50,  stopDistNM: 1.5,  bridgeZOffset: 0.22  },
  { id: 'tanker',    name: 'VLCC Tanker',             loa: 320, beam: 58, draft: 20, maxSpeed: 15, bridgeHeight: 22, color: 0x556b7a, turnRate: 5.5,  steeringLag: 16, engineLag: 100, stopDistNM: 4.0,  bridgeZOffset: 0.35  },
  { id: 'container', name: 'Container Ship (ULCV)',   loa: 400, beam: 62, draft: 16, maxSpeed: 22, bridgeHeight: 40, color: 0x4a6a8a, turnRate: 9.8,  steeringLag: 12, engineLag: 70,  stopDistNM: 5.0,  bridgeZOffset: 0.30  },
  { id: 'lng',       name: 'LNG Carrier',             loa: 290, beam: 48, draft: 12, maxSpeed: 19, bridgeHeight: 28, color: 0x8a9aaa, turnRate: 7.0,  steeringLag: 12, engineLag: 80,  stopDistNM: 3.2,  bridgeZOffset: 0.28  },
  { id: 'bulk',      name: 'Bulk Carrier (Capesize)', loa: 280, beam: 45, draft: 18, maxSpeed: 14, bridgeHeight: 20, color: 0x6a7a6a, turnRate: 6.8,  steeringLag: 14, engineLag: 85,  stopDistNM: 2.8,  bridgeZOffset: 0.25  },
  { id: 'ferry',     name: 'High-Speed Ferry',        loa: 80,  beam: 14, draft: 3,  maxSpeed: 28, bridgeHeight: 12, color: 0xffffff, turnRate: 9.0,  steeringLag: 3,  engineLag: 12,  stopDistNM: 0.35, bridgeZOffset: 0.05  },
  { id: 'naval',     name: 'Naval Frigate',           loa: 135, beam: 16, draft: 6,  maxSpeed: 30, bridgeHeight: 18, color: 0x888888, turnRate: 6.0,  steeringLag: 4,  engineLag: 8,   stopDistNM: 0.5,  bridgeZOffset: 0.02  },
  { id: 'tug',       name: 'Ocean Tug',               loa: 45,  beam: 12, draft: 5,  maxSpeed: 12, bridgeHeight: 8,  color: 0xff4400, turnRate: 14.0, steeringLag: 2,  engineLag: 5,   stopDistNM: 0.15, bridgeZOffset: -0.05 },
];

// ── Buoy helpers ─────────────────────────────────────────────────────────────
// type: 'port'|'stbd'|'N'|'S'|'E'|'W'|'safe'|'danger'|'special'|'isolated'
// region: 'A' (Europe/Asia) or 'B' (Americas)
function buoy(x, z, type, label = '', racon = false) {
  return { x, z, type, label, racon };
}

// ── Land-mass helpers ─────────────────────────────────────────────────────────
// outline: array of [x, z] pairs forming a closed polygon (metres)
function land(outline, height = 40, color = 0x3d6b3d, name = '') {
  return { outline, height, color, name };
}

// ── Traffic helpers ───────────────────────────────────────────────────────────
function ship(x, z, hdg, spd, type, name, callsign) {
  return { x, z, hdg, spd, type, name, callsign };
}

// =============================================================================
// LOCATIONS
// =============================================================================
export const LOCATIONS = [

  // ── 1. SINGAPORE STRAIT ────────────────────────────────────────────────────
  {
    id: 'singapore_strait',
    name: 'Singapore Strait',
    description: 'One of the world\'s busiest waterways — TSS in force, tide ~1.5 kn.',
    region: 'IALA_A',
    startHeading: 90,
    startSpeed: 12,
    startPos: { x: -3000, z: 0 },
    bridgeHeight: 18,
    channelWidth: 3700,
    current: { speed: 1.5, direction: 90 },
    depth: 28,
    maxSpeed: 12,
    tss: true,

    terrain: [
      // Singapore island — north bank
      land([[-20000,-2500],[ 20000,-2500],[ 20000,-18000],[-20000,-18000]], 35, 0x3a7a3a, 'Singapore Island'),
      // City buildings hint (darker higher blocks)
      land([[ -5000,-3000],[ 5000,-3000],[ 5000,-5000],[-5000,-5000]],  80, 0x888888, 'City'),
      // Batam / Indonesia — south bank
      land([[-20000, 2500],[ 20000, 2500],[ 20000, 16000],[-20000, 16000]], 30, 0x4a8a3a, 'Batam'),
      // Small islands mid-channel
      land([[-1200, -200],[- 900, -200],[-900, 200],[-1200, 200]], 8, 0x5a8a4a, 'Lazarus Is.'),
      land([[ 500, -100],[ 800, -100],[ 800, 100],[ 500, 100]],   6, 0x5a8a4a, 'Sisters Is.'),
    ],

    buoys: [
      buoy(-8000, -1850, 'stbd', 'SG-1', false),
      buoy(-5000, -1850, 'stbd', 'SG-3', false),
      buoy(-2000, -1850, 'stbd', 'SG-5', true),
      buoy( 1000, -1850, 'stbd', 'SG-7', false),
      buoy( 4000, -1850, 'stbd', 'SG-9', false),
      buoy(-8000,  1850, 'port', 'SG-2', false),
      buoy(-5000,  1850, 'port', 'SG-4', false),
      buoy(-2000,  1850, 'port', 'SG-6', false),
      buoy( 1000,  1850, 'port', 'SG-8', false),
      buoy( 4000,  1850, 'port', 'SG-10',false),
      buoy(-3500,  4000, 'N',    'NB',   false),
      buoy( 2000, -4000, 'S',    'SB',   false),
      buoy(    0,     0, 'safe', 'CL',   true ),
    ],

    traffic: [
      ship(-10000, -600, 90, 14, 'container', 'EVER GIVEN',    'VRRA2'),
      ship(-6000,  700,  90, 11, 'tanker',    'ATLANTIC OAK',  'C6XY3'),
      ship( 5000, -400,  270, 13, 'bulk',     'PACIFIC HOPE',  'VRXB6'),
      ship( 8000,  300,  90, 10, 'cargo',     'SEA PHOENIX',   '9VDK5'),
      ship(-2000, -900,  95, 8,  'tug',       'HARBOUR KING',  '9V2343'),
      ship( 12000, 600,  270,12, 'lng',       'GAS VENUS',     'HKMM2'),
    ],
  },

  // ── 2. DOVER STRAIT ────────────────────────────────────────────────────────
  {
    id: 'dover_strait',
    name: 'Dover Strait',
    description: 'Busiest shipping lane. TSS, cross-Channel ferries, 600+ ships/day.',
    region: 'IALA_A',
    startHeading: 45,
    startSpeed: 12,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 18,
    channelWidth: 32000,
    current: { speed: 2.0, direction: 45 },
    depth: 35,
    maxSpeed: 15,
    tss: true,

    terrain: [
      land([[-30000,-16000],[30000,-16000],[30000,-40000],[-30000,-40000]], 80, 0xf5f5dc, 'White Cliffs of Dover'),
      land([[-30000,-16000],[30000,-16000],[30000,-16800],[-30000,-16800]], 120, 0xffffff, 'Chalk Cliffs'),
      land([[-30000, 18000],[30000, 18000],[30000, 40000],[-30000, 40000]], 50, 0x5a8a3a, 'Cap Gris-Nez, France'),
    ],

    buoys: [
      buoy(-8000,-8000, 'stbd', 'DW-1', true),
      buoy( 0,   -8000, 'stbd', 'DW-3', false),
      buoy( 8000,-8000, 'stbd', 'DW-5', false),
      buoy(-8000, 8000, 'port', 'DW-2', false),
      buoy( 0,    8000, 'port', 'DW-4', false),
      buoy( 8000, 8000, 'port', 'DW-6', false),
      buoy(    0,    0, 'safe', 'CS',   true),
    ],

    traffic: [
      ship(-15000,-5000, 45, 16, 'container','MSC OSCAR',    'VRRA8'),
      ship(-10000, 5000, 45, 12, 'tanker',   'MARE NOSTRUM', '9HY23'),
      ship(  5000,-5000, 225,18, 'ferry',    'P&O SPIRIT',   'GBFR2'),
      ship( 12000, 3000, 225,12, 'cargo',    'NORTH STAR',   'OYJD3'),
    ],
  },

  // ── 3. SUEZ CANAL ──────────────────────────────────────────────────────────
  {
    id: 'suez_canal',
    name: 'Suez Canal',
    description: '193 km single-lane canal. Speed 14 kn max. Convoy system in operation.',
    region: 'IALA_A',
    startHeading: 0,
    startSpeed: 8,
    startPos: { x: 0, z: 5000 },
    bridgeHeight: 20,
    channelWidth: 300,
    current: { speed: 0, direction: 0 },
    depth: 24,
    maxSpeed: 14,
    tss: false,

    terrain: [
      land([[-250,-30000],[-500,-30000],[-500,30000],[-250,30000]], 15, 0xe8d5a3, 'Sinai Peninsula'),
      land([[ 250,-30000],[ 500,-30000],[ 500,30000],[ 250,30000]], 15, 0xe8d5a3, 'Egypt'),
      land([[-250,-30000],[250,-30000],[250,30000],[-250,30000]],    -2, 0x2255aa, 'Canal Water'),
    ],

    buoys: [
      buoy(-120,  3000, 'stbd', 'S-1', false),
      buoy(-120,  0,    'stbd', 'S-3', false),
      buoy(-120, -3000, 'stbd', 'S-5', false),
      buoy( 120,  3000, 'port', 'S-2', false),
      buoy( 120,  0,    'port', 'S-4', false),
      buoy( 120, -3000, 'port', 'S-6', false),
    ],

    traffic: [
      ship(0, -8000, 0,  8, 'tanker',    'SUEZ STAR',     'V7XY1'),
      ship(0, -4000, 0,  8, 'container', 'EVER FORWARD',  'VRRA9'),
      ship(0,  6000, 180,8, 'bulk',      'NILE CARRIER',  'SUA23'),
    ],
  },

  // ── 4. PANAMA CANAL ────────────────────────────────────────────────────────
  {
    id: 'panama_canal',
    name: 'Panama Canal',
    description: 'Transit through the Panama Canal locks. Panamax & Neopanamax lanes.',
    region: 'IALA_B',
    startHeading: 135,
    startSpeed: 6,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 18,
    channelWidth: 55,
    current: { speed: 0.5, direction: 180 },
    depth: 15,
    maxSpeed: 8,
    tss: false,

    terrain: [
      land([[-500,-30000],[-5000,-30000],[-5000,30000],[-500,30000]], 60, 0x2d6a2d, 'Panama West'),
      land([[ 500,-30000],[ 5000,-30000],[ 5000,30000],[ 500,30000]], 60, 0x2d6a2d, 'Panama East'),
      land([[-500,-30000],[500,-30000],[500,30000],[-500,30000]],       3, 0x4a8a4a, 'Canal Zone'),
    ],

    buoys: [
      buoy(-25, 2000, 'stbd', 'PC-1', false),
      buoy(-25,    0, 'stbd', 'PC-3', false),
      buoy(-25,-2000, 'stbd', 'PC-5', false),
      buoy( 25, 2000, 'port', 'PC-2', false),
      buoy( 25,    0, 'port', 'PC-4', false),
      buoy( 25,-2000, 'port', 'PC-6', false),
    ],

    traffic: [
      ship(0, -3000, 135, 6, 'cargo',     'GATUN TRADER', 'HP2345'),
      ship(0,  4000, 315, 6, 'container', 'PACIFIC ACE',  'WDF123'),
    ],
  },

  // ── 5. STRAIT OF GIBRALTAR ─────────────────────────────────────────────────
  {
    id: 'gibraltar',
    name: 'Strait of Gibraltar',
    description: 'Atlantic-Mediterranean gateway. Strong E-W current up to 4 kn.',
    region: 'IALA_A',
    startHeading: 90,
    startSpeed: 12,
    startPos: { x: -5000, z: 0 },
    bridgeHeight: 18,
    channelWidth: 14300,
    current: { speed: 3.0, direction: 90 },
    depth: 300,
    maxSpeed: 15,
    tss: true,

    terrain: [
      land([[-25000,-7150],[25000,-7150],[25000,-25000],[-25000,-25000]], 40, 0x8a8a6a, 'Spain'),
      land([[ -1000,-7150],[  1500,-7150],[1500,-10000],[-1000,-10000]], 425, 0x888888, 'Rock of Gibraltar'),
      land([[-25000, 7150],[25000, 7150],[25000, 25000],[-25000, 25000]], 35, 0xaa9966, 'Morocco'),
      land([[ -3000, 7150],[  3000, 7150],[3000, 12000],[-3000, 12000]], 200, 0x998866, 'Jebel Moussa'),
    ],

    buoys: [
      buoy(-8000,-3500, 'stbd', 'GIB-W', true),
      buoy(    0,-3500, 'stbd', 'GIB-C', false),
      buoy( 8000,-3500, 'stbd', 'GIB-E', false),
      buoy(-8000, 3500, 'port', 'GIB-1', false),
      buoy(    0, 3500, 'port', 'GIB-2', false),
      buoy( 8000, 3500, 'port', 'GIB-3', false),
      buoy( 1000,    0, 'safe', 'MID',   true),
    ],

    traffic: [
      ship(-15000,-2000, 90, 16, 'container','IBERIA STAR',  'EARX2'),
      ship(  5000, 2000, 270,14, 'tanker',   'MARE MEDIUS',  'IBRX8'),
      ship(-8000,  1000, 95, 12, 'cargo',    'ANDALUCIA',    'EAZM4'),
    ],
  },

  // ── 6. BOSPHORUS ───────────────────────────────────────────────────────────
  {
    id: 'bosphorus',
    name: 'Bosphorus (Istanbul Strait)',
    description: 'Sinuous 31 km strait through Istanbul. Strong 4–6 kn southward current.',
    region: 'IALA_A',
    startHeading: 180,
    startSpeed: 8,
    startPos: { x: 0, z: -10000 },
    bridgeHeight: 18,
    channelWidth: 700,
    current: { speed: 4.5, direction: 180 },
    depth: 36,
    maxSpeed: 10,
    tss: false,

    terrain: [
      land([[-800,-30000],[-3000,-30000],[-3000,30000],[-800,30000]], 80, 0x888888, 'Istanbul European Side'),
      land([[ 800,-30000],[ 3000,-30000],[ 3000,30000],[ 800,30000]], 70, 0x886644, 'Istanbul Asian Side'),
      land([[-600,-5000],[-1500,-5000],[-1500,-8000],[-600,-8000]],  120, 0x778866, 'Topkapi Palace Area'),
    ],

    buoys: [
      buoy(-350,  5000, 'stbd', 'BOS-1', false),
      buoy(-350,  0,    'stbd', 'BOS-3', false),
      buoy(-350, -5000, 'stbd', 'BOS-5', false),
      buoy( 350,  5000, 'port', 'BOS-2', false),
      buoy( 350,  0,    'port', 'BOS-4', false),
      buoy( 350, -5000, 'port', 'BOS-6', false),
    ],

    traffic: [
      ship(0, -15000, 180, 8, 'tanker', 'BLACK SEA EAGLE', 'TCRT3'),
      ship(0,   5000, 0,   9, 'cargo',  'ISTANBUL TRADER', 'TC234'),
    ],
  },

  // ── 7. MALACCA STRAIT ──────────────────────────────────────────────────────
  {
    id: 'malacca',
    name: 'Malacca Strait',
    description: 'Key Asian shipping lane. TSS, shallow draft limit 25 m. Piracy watch.',
    region: 'IALA_A',
    startHeading: 315,
    startSpeed: 14,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 20,
    channelWidth: 8000,
    current: { speed: 1.0, direction: 315 },
    depth: 27,
    maxSpeed: 14,
    tss: true,

    terrain: [
      land([[-20000,-4000],[20000,-4000],[20000,-20000],[-20000,-20000]], 40, 0x3a7a3a, 'Malay Peninsula'),
      land([[-20000, 4000],[20000, 4000],[20000, 18000],[-20000, 18000]], 35, 0x4a8a3a, 'Sumatra'),
    ],

    buoys: [
      buoy(-6000,-2000, 'stbd', 'MAL-1', true),
      buoy(-3000,-2000, 'stbd', 'MAL-3', false),
      buoy(    0,-2000, 'stbd', 'MAL-5', false),
      buoy(-6000, 2000, 'port', 'MAL-2', false),
      buoy(-3000, 2000, 'port', 'MAL-4', false),
      buoy(    0, 2000, 'port', 'MAL-6', false),
    ],

    traffic: [
      ship(-12000,-1000, 315,14, 'tanker',   'ASIA GLORY',   '9MXA1'),
      ship(  5000, 1000, 135,12, 'container','MAERSK KLANG', 'VRVA3'),
      ship( -8000, 500,  315,11, 'bulk',     'PENANG PRIDE', '9MXB7'),
    ],
  },

  // ── 8. HORMUZ ──────────────────────────────────────────────────────────────
  {
    id: 'hormuz',
    name: 'Strait of Hormuz',
    description: 'World\'s most critical oil chokepoint. TSS, US 5th Fleet patrols.',
    region: 'IALA_A',
    startHeading: 90,
    startSpeed: 14,
    startPos: { x: -5000, z: 0 },
    bridgeHeight: 22,
    channelWidth: 50000,
    current: { speed: 1.5, direction: 90 },
    depth: 80,
    maxSpeed: 15,
    tss: true,

    terrain: [
      land([[-30000,-25000],[30000,-25000],[30000,-50000],[-30000,-50000]], 50, 0xd4b896, 'Iran'),
      land([[-30000, 25000],[30000, 25000],[30000, 50000],[-30000, 50000]], 40, 0xd4b896, 'Oman'),
    ],

    buoys: [
      buoy(-10000,-12000, 'stbd', 'HRM-1', true),
      buoy(   0,  -12000, 'stbd', 'HRM-3', false),
      buoy(-10000, 12000, 'port', 'HRM-2', false),
      buoy(   0,   12000, 'port', 'HRM-4', false),
    ],

    traffic: [
      ship(-20000,-8000, 90, 16, 'tanker', 'IRAN CRUDE 1',  'EPZZ1'),
      ship( 10000, 8000, 270,15, 'tanker', 'GULF ENDEAVOUR','A4AB3'),
      ship(-15000,-6000, 90, 14, 'tanker', 'HORMUZ GIANT',  'EPXA2'),
    ],
  },

  // ── 9. KIEL CANAL ──────────────────────────────────────────────────────────
  {
    id: 'kiel_canal',
    name: 'Kiel Canal (Nord-Ostsee-Kanal)',
    description: 'Busiest artificial waterway, 98 km long. Speed 8 kn, pilot required.',
    region: 'IALA_A',
    startHeading: 270,
    startSpeed: 7,
    startPos: { x: 5000, z: 0 },
    bridgeHeight: 14,
    channelWidth: 162,
    current: { speed: 0, direction: 0 },
    depth: 11,
    maxSpeed: 8,
    tss: false,

    terrain: [
      land([[-100,-30000],[-400,-30000],[-400,30000],[-100,30000]], 20, 0x5a8a3a, 'Germany North'),
      land([[ 100,-30000],[ 400,-30000],[ 400,30000],[ 100,30000]], 20, 0x5a8a3a, 'Germany South'),
    ],

    buoys: [
      buoy(-80, 2000, 'stbd', 'KC-1', false),
      buoy(-80,    0, 'stbd', 'KC-3', false),
      buoy(-80,-2000, 'stbd', 'KC-5', false),
      buoy( 80, 2000, 'port', 'KC-2', false),
      buoy( 80,    0, 'port', 'KC-4', false),
      buoy( 80,-2000, 'port', 'KC-6', false),
    ],

    traffic: [
      ship( 8000, 0, 270, 7, 'cargo',  'ELBE TRADER',   'DBZZ1'),
      ship(-5000, 0,  90, 7, 'tanker', 'NORD PIONEER',  'DBAB4'),
    ],
  },

  // ── 10. OPEN OCEAN (Atlantic) ───────────────────────────────────────────────
  {
    id: 'open_ocean',
    name: 'North Atlantic — Open Ocean',
    description: 'Deep sea passage. Practice ROR in crossing and overtaking situations.',
    region: 'IALA_A',
    startHeading: 270,
    startSpeed: 15,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 22,
    channelWidth: 9999999,
    current: { speed: 1.0, direction: 315 },
    depth: 3800,
    maxSpeed: 22,
    tss: false,

    terrain: [],

    buoys: [
      buoy(0, 0, 'safe', 'ODAS', false),
    ],

    traffic: [
      ship(-20000,-5000, 270,16, 'container','ATLANTIC ARROW','VRCD3'),
      ship(  5000, 8000, 315,14, 'tanker',   'OCEAN PRINCE',  'C6BX8'),
      ship(-10000, 3000, 180,12, 'bulk',     'SEA FALCON',    '9HZA2'),
      ship( 15000,-8000, 240,18, 'cargo',    'POLAR STAR',    'OJFP3'),
    ],
  },

  // ── 11. PORT APPROACH (Rotterdam) ──────────────────────────────────────────
  {
    id: 'rotterdam',
    name: 'Rotterdam Europoort Approach',
    description: 'Maasvlakte approach. VTS Rotterdam, pilot boarding ground.',
    region: 'IALA_A',
    startHeading: 90,
    startSpeed: 10,
    startPos: { x: -8000, z: 0 },
    bridgeHeight: 18,
    channelWidth: 600,
    current: { speed: 1.0, direction: 90 },
    depth: 22,
    maxSpeed: 10,
    tss: true,

    terrain: [
      land([[-30000,-300],[30000,-300],[30000,-5000],[-30000,-5000]], 10, 0x7a9a6a, 'Netherlands North'),
      land([[-30000, 300],[30000, 300],[30000,  5000],[-30000,  5000]], 8, 0x7a9a6a, 'Netherlands South'),
      land([[ 10000,-300],[20000,-300],[20000,-800],[ 10000,-800]],    25, 0x888888, 'Maasvlakte Terminal'),
    ],

    buoys: [
      buoy(-15000,-280, 'stbd', 'MW-1', true),
      buoy(-10000,-280, 'stbd', 'MW-3', false),
      buoy( -5000,-280, 'stbd', 'MW-5', false),
      buoy(     0,-280, 'stbd', 'MW-7', false),
      buoy(-15000, 280, 'port', 'MW-2', false),
      buoy(-10000, 280, 'port', 'MW-4', false),
      buoy( -5000, 280, 'port', 'MW-6', false),
      buoy(     0, 280, 'port', 'MW-8', false),
      buoy( -7500,   0, 'safe', 'MAS',  true),
    ],

    traffic: [
      ship(-20000,-150, 90, 10, 'container','MSC ROTTERDAM','PCDX2'),
      ship( 5000,   150,270, 10,'tanker',   'EUROPOORT 1', 'PCAB3'),
      ship(-12000, -100, 90,  8,'cargo',    'RHINE TRADER','PAXY1'),
    ],
  },

  // ── 12. LOMBOK STRAIT ──────────────────────────────────────────────────────
  {
    id: 'lombok',
    name: 'Lombok Strait',
    description: 'Indonesia archipelagic passage. Avoids Malacca for VLCCs & large tankers.',
    region: 'IALA_A',
    startHeading: 0,
    startSpeed: 14,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 22,
    channelWidth: 40000,
    current: { speed: 2.5, direction: 0 },
    depth: 250,
    maxSpeed: 15,
    tss: false,

    terrain: [
      land([[-23000,-30000],[-30000,-30000],[-30000,30000],[-23000,30000]], 55, 0x3a7a3a, 'Bali'),
      land([[ 23000,-30000],[ 30000,-30000],[ 30000,30000],[ 23000,30000]], 60, 0x3a7a3a, 'Lombok'),
    ],

    buoys: [],

    traffic: [
      ship(-15000, 5000, 0, 14, 'tanker', 'LOMBOK GIANT',   'PKCX1'),
      ship( 10000,-8000, 180,15,'tanker', 'JAVA SEA KING',  'PKBZ3'),
    ],
  },

  // ── 13. ENGLISH CHANNEL (West) ─────────────────────────────────────────────
  {
    id: 'english_channel',
    name: 'English Channel (Western Approaches)',
    description: 'Outbound from UK. Traffic separation, strong tidal streams.',
    region: 'IALA_A',
    startHeading: 225,
    startSpeed: 14,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 18,
    channelWidth: 110000,
    current: { speed: 3.0, direction: 270 },
    depth: 75,
    maxSpeed: 15,
    tss: true,

    terrain: [
      land([[-60000,-55000],[60000,-55000],[60000,-80000],[-60000,-80000]], 60, 0x5a8a4a, 'England'),
      land([[-60000, 55000],[60000, 55000],[60000, 80000],[-60000, 80000]], 55, 0x4a7a3a, 'Brittany, France'),
    ],

    buoys: [
      buoy(-10000,-28000, 'stbd', 'CS-1', false),
      buoy(     0,-28000, 'stbd', 'CS-3', true),
      buoy( 10000,-28000, 'stbd', 'CS-5', false),
      buoy(-10000, 28000, 'port', 'CS-2', false),
      buoy(     0, 28000, 'port', 'CS-4', false),
      buoy( 10000, 28000, 'port', 'CS-6', false),
    ],

    traffic: [
      ship(-20000,-14000, 225,16, 'container','CELTIC STAR',  'MNSW2'),
      ship( 15000, 12000, 45, 14, 'tanker',   'CHANNEL QUEEN','FRAW3'),
      ship(  5000,-10000, 225,18, 'ferry',    'BRITTANY F.',  'FNRX9'),
    ],
  },

  // ── 14. CORINTH CANAL ──────────────────────────────────────────────────────
  {
    id: 'corinth',
    name: 'Corinth Canal',
    description: 'World\'s narrowest deep-sea canal (24.6 m wide). Very slow, single track.',
    region: 'IALA_A',
    startHeading: 90,
    startSpeed: 3,
    startPos: { x: -2000, z: 0 },
    bridgeHeight: 10,
    channelWidth: 24,
    current: { speed: 0.2, direction: 90 },
    depth: 8,
    maxSpeed: 4,
    tss: false,

    terrain: [
      land([[-6000, -12],[6000,-12],[6000,-50000],[-6000,-50000]],  80, 0xcc9966, 'Greece North'),
      land([[-6000,  12],[6000, 12],[6000, 50000],[-6000, 50000]],  80, 0xcc9966, 'Greece South'),
    ],

    buoys: [
      buoy(-8, 500, 'stbd', 'CC-1', false),
      buoy(-8,   0, 'stbd', 'CC-3', false),
      buoy(-8,-500, 'stbd', 'CC-5', false),
      buoy( 8, 500, 'port', 'CC-2', false),
      buoy( 8,   0, 'port', 'CC-4', false),
      buoy( 8,-500, 'port', 'CC-6', false),
    ],

    traffic: [
      ship(3000, 0, 270, 3, 'ferry', 'POSEIDON EXPRESS', 'SVGR8'),
    ],
  },

  // ── 15. TORRES STRAIT ──────────────────────────────────────────────────────
  {
    id: 'torres',
    name: 'Torres Strait',
    description: 'Between Australia and PNG. Compulsory Pilot. Shoals, reefs, coral.',
    region: 'IALA_A',
    startHeading: 270,
    startSpeed: 10,
    startPos: { x: 0, z: 0 },
    bridgeHeight: 18,
    channelWidth: 4500,
    current: { speed: 2.0, direction: 270 },
    depth: 12,
    maxSpeed: 10,
    tss: false,

    terrain: [
      land([[-30000,-2250],[30000,-2250],[30000,-20000],[-30000,-20000]], 30, 0x8a8a5a, 'Queensland, Australia'),
      land([[-30000, 2250],[30000, 2250],[30000, 20000],[-30000, 20000]], 25, 0x3a7a3a, 'Papua New Guinea'),
      land([[ -5000, -600],[  -3000,-600],[-3000, 600], [-5000,  600]], 4, 0xc8b878, 'Coral Reef/Shoal 1'),
      land([[  2000, -800],[   4000,-800],[ 4000, 800], [  2000,  800]], 3, 0xc8b878, 'Coral Reef/Shoal 2'),
    ],

    buoys: [
      buoy(-8000,-1100, 'stbd', 'TS-1', true),
      buoy(-4000,-1100, 'stbd', 'TS-3', false),
      buoy(    0,-1100, 'stbd', 'TS-5', false),
      buoy(-8000, 1100, 'port', 'TS-2', false),
      buoy(-4000, 1100, 'port', 'TS-4', false),
      buoy(    0, 1100, 'port', 'TS-6', false),
      buoy(-3500,  600, 'N',   'TN',   false),
      buoy( 3000, -600, 'S',   'TS',   false),
    ],

    traffic: [
      ship(-15000,-600, 270,10, 'container','CORAL SEA',    'VHZB3'),
      ship(  8000, 600, 90, 10, 'bulk',     'AUSTRALIA SKY','VHXA8'),
    ],
  },
];
