// js/shipModels.js — Realistic 3D Ship Model Builder
import * as THREE from 'three';

// ── Helper materials cache ────────────────────────────────────────────────────
// Use MeshPhongMaterial for all surfaces — gives specular highlights and
// looks dramatically better under directional/fill lighting.
const MAT = {};
function mat(hex, shininess = 25) {
  if (!MAT[hex]) MAT[hex] = new THREE.MeshPhongMaterial({ color: hex, shininess });
  return MAT[hex];
}
// Transparent glass variant (kept as Lambert — no specular needed)
function glassMat(hex, opacity = 0.35) {
  return new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity, side: THREE.DoubleSide });
}

// ── Common hull builder ───────────────────────────────────────────────────────
// Ship local coords: -Z = bow (forward), +Z = stern, +X = starboard, +Y = up
// After build, group.position.y = -draft*0.55 so waterline is at y≈0

function hull(g, loa, beam, draft, hullHex, redHex = 0x8B0000) {
  const h  = mat(hullHex);
  const r  = mat(redHex);

  const bowLen  = loa * 0.15;
  const bodyLen = loa * 0.72;
  const stnLen  = loa * 0.13;

  // ── Main body ──
  const bodyGeo = new THREE.BoxGeometry(beam, draft, bodyLen);
  const body = new THREE.Mesh(bodyGeo, h);
  body.position.set(0, draft / 2, stnLen / 2 - stnLen / 2);  // centered
  g.add(body);

  // Anti-fouling red (lower 45% of hull)
  const redGeo = new THREE.BoxGeometry(beam - 0.5, draft * 0.45, bodyLen - 0.5);
  const red = new THREE.Mesh(redGeo, r);
  red.position.set(0, draft * 0.225, 0);
  g.add(red);

  // ── Bow (CylinderGeometry: 4 segments = square → diamond cross-section when rotated 45°) ──
  // radiusTop (aft, large) = beam/2; radiusBottom (bow tip) = small
  const bGeo = new THREE.CylinderGeometry(beam / 2, 0.8, bowLen, 4, 1);
  bGeo.rotateX(Math.PI / 2);   // height → Z-axis
  bGeo.rotateY(Math.PI / 4);   // rotate 45° → V-bow cross-section
  const bow = new THREE.Mesh(bGeo, h);
  bow.position.set(0, draft * 0.5, -(bodyLen / 2 + bowLen / 2));
  g.add(bow);

  const bRedGeo = new THREE.CylinderGeometry((beam - 0.5) / 2, 0.4, bowLen, 4, 1);
  bRedGeo.rotateX(Math.PI / 2);
  bRedGeo.rotateY(Math.PI / 4);
  const bowRed = new THREE.Mesh(bRedGeo, r);
  bowRed.position.set(0, draft * 0.225, -(bodyLen / 2 + bowLen / 2));
  g.add(bowRed);

  // ── Stern (squared-off transom) ──
  const stGeo = new THREE.BoxGeometry(beam, draft, stnLen);
  const stern = new THREE.Mesh(stGeo, h);
  stern.position.set(0, draft / 2, bodyLen / 2 + stnLen / 2);
  g.add(stern);

  const stRedGeo = new THREE.BoxGeometry(beam - 0.5, draft * 0.45, stnLen - 0.3);
  const sternRed = new THREE.Mesh(stRedGeo, r);
  sternRed.position.set(0, draft * 0.225, bodyLen / 2 + stnLen / 2);
  g.add(sternRed);

  // ── Deck (weathered steel plate — medium olive-grey, realistic for commercial ships) ──
  const dkGeo = new THREE.BoxGeometry(beam - 1, 0.6, loa * 0.87);
  const dk = new THREE.Mesh(dkGeo, mat(0x4a4a3a, 15));
  dk.position.set(0, draft + 0.3, 0);
  g.add(dk);

  // ── Bulwark (thin side rails) ──
  const bwGeo = new THREE.BoxGeometry(0.4, 1.2, loa * 0.8);
  const bwP = new THREE.Mesh(bwGeo, mat(0x5a5a4a)); // port bulwark
  const bwS = new THREE.Mesh(bwGeo, mat(0x5a5a4a)); // stbd bulwark
  bwP.position.set(-(beam / 2 - 0.2), draft + 1.2, 0);
  bwS.position.set( (beam / 2 - 0.2), draft + 1.2, 0);
  g.add(bwP); g.add(bwS);
}

// ── Superstructure block helper ───────────────────────────────────────────────
function ss(g, w, h, d, x, y, z, hex = 0xddddd0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat(hex));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ── Cylinder helper ───────────────────────────────────────────────────────────
function cyl(g, rTop, rBot, h, seg, x, y, z, hex = 0x222222) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  const m = new THREE.Mesh(geo, mat(hex));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ── Mast ──────────────────────────────────────────────────────────────────────
function mast(g, x, y, z, height, hex = 0x999999) {
  cyl(g, 0.25, 0.3, height, 6, x, y + height / 2, z, hex);
  // Yard arm
  const yard = new THREE.BoxGeometry(height * 0.4, 0.3, 0.3);
  const ym = new THREE.Mesh(yard, mat(hex));
  ym.position.set(x, y + height * 0.85, z);
  g.add(ym);
}

// ── Navigation lights ─────────────────────────────────────────────────────────
function navLights(g, loa, beam, draft, bridgeH) {
  const ptLight = (col, x, y, z, intensity = 1.0, dist = 500) => {
    const geo = new THREE.SphereGeometry(0.35, 6, 6);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col }));
    m.position.set(x, y, z);
    g.add(m);
    const pl = new THREE.PointLight(col, intensity, dist);
    pl.position.set(x, y, z);
    g.add(pl);
  };

  const deckY = draft + 0.5;
  ptLight(0xffffff, 0, deckY + bridgeH + 4, -loa * 0.05, 1.0, 800); // masthead
  ptLight(0xffffff, 0, deckY + bridgeH + 1, -loa * 0.02, 0.7, 600); // 2nd masthead (>50m)
  ptLight(0xff2200, -beam / 2 + 0.5, deckY + bridgeH * 0.55, -loa * 0.05, 0.8, 500); // port red
  ptLight(0x00ff44,  beam / 2 - 0.5, deckY + bridgeH * 0.55, -loa * 0.05, 0.8, 500); // stbd green
  ptLight(0xffffff, 0, deckY + bridgeH * 0.5, loa * 0.48, 0.6, 400); // stern white
}

// ═════════════════════════════════════════════════════════════════════════════
// SHIP TYPE BUILDERS
// =============================================================================

function buildCargo(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex);
  const deckY = draft + 0.6;

  if (!deckOnly) {
    // Superstructure (aft, ~20-35% from stern)
    const ssZ = loa * 0.22;
    ss(g, beam * 0.55, bh * 0.55, loa * 0.13, 0, deckY + bh * 0.28, ssZ, 0xddddcc);
    ss(g, beam * 0.45, bh * 0.25, loa * 0.10, 0, deckY + bh * 0.68, ssZ, 0xddddcc);
    ss(g, beam * 0.35, bh * 0.15, loa * 0.08, 0, deckY + bh * 0.85, ssZ, 0xddddcc);

    // Funnel (behind superstructure)
    cyl(g, bh * 0.06, bh * 0.08, bh * 0.35, 10, 0, deckY + bh + bh * 0.17, ssZ + loa * 0.07, 0x111111);
    cyl(g, bh * 0.055, bh * 0.055, 0.8, 10, 0, deckY + bh + bh * 0.35, ssZ + loa * 0.07, 0xdd2200); // company band
  }

  // Cargo hatches + cranes
  for (let i = 0; i < 4; i++) {
    const hz = -loa * 0.35 + i * loa * 0.15;
    ss(g, beam * 0.55, 0.8, loa * 0.1, 0, deckY + 0.4, hz, 0x444444); // hatch cover
    // Crane
    if (i < 3) {
      cyl(g, 0.4, 0.5, bh * 0.45, 6, beam * 0.2, deckY + bh * 0.23, hz + loa * 0.06, 0xaaaaaa);
      const jib = new THREE.BoxGeometry(0.4, bh * 0.35, 0.4);
      const jm = new THREE.Mesh(jib, mat(0xaaaaaa));
      jm.rotation.z = 0.4;
      jm.position.set(beam * 0.2 + bh * 0.07, deckY + bh * 0.58, hz + loa * 0.06);
      g.add(jm);
    }
  }

  // Foremast
  mast(g, 0, deckY, -loa * 0.38, bh * 0.9);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildTanker(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex);
  const deckY = draft + 0.6;

  if (!deckOnly) {
    // Superstructure / accommodation block - far aft
    const ssZ = loa * 0.44;
    ss(g, beam * 0.6,  bh * 0.6,  loa * 0.1, 0, deckY + bh * 0.3,  ssZ, 0xddddcc);
    ss(g, beam * 0.5,  bh * 0.25, loa * 0.09, 0, deckY + bh * 0.72, ssZ, 0xddddcc);
    ss(g, beam * 0.4,  bh * 0.18, loa * 0.07, 0, deckY + bh * 0.88, ssZ, 0xddddcc);

    // Funnel (distinctive tanker funnel)
    cyl(g, bh * 0.05, bh * 0.07, bh * 0.4, 10, 0, deckY + bh + bh * 0.2, ssZ + loa * 0.06, 0x222222);
  }

  // Cargo pipe manifold (centre deck, mid-ship)
  for (let i = 0; i < 5; i++) {
    const pz = -loa * 0.35 + i * loa * 0.17;
    ss(g, beam * 0.12, 1.5, loa * 0.02, 0, deckY + 0.75, pz, 0x888888); // crossover pipe
    ss(g, beam * 0.6,  0.4, loa * 0.01, 0, deckY + 0.2,  pz, 0x666666); // manifold base
  }

  // Longitudinal pipe (port & stbd)
  ss(g, 0.6, 1.0, loa * 0.8, -(beam / 2 - 2), deckY + 0.5, 0, 0x777777);
  ss(g, 0.6, 1.0, loa * 0.8,  (beam / 2 - 2), deckY + 0.5, 0, 0x777777);

  // Foremast
  mast(g, 0, deckY, -loa * 0.4, bh * 0.7);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildContainer(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex);
  const deckY = draft + 0.6;

  // Stacked containers on deck (bow to mid-ship)
  const containerColors = [0x226644, 0xcc3300, 0x3355aa, 0xccaa00, 0x884422, 0x558833, 0x446688, 0xaa4433];

  if (deckOnly) {
    // Bridge-facing layout: fuller top-deck coverage with central sight corridor,
    // visually closer to a real "looking over container stacks" bridge view.
    const slotLen = 12.2;
    const cols = Math.floor((beam - 4) / 2.5);
    const centerGapCols = 2; // leave central lane toward horizon/mast

    for (let slot = 0; slot < 20; slot++) {
      const sz = -loa * 0.44 + slot * slotLen;
      if (sz > loa * 0.30) break;

      // Higher near stacks with slight taper toward far end
      const rowsPerSlot = slot < 6 ? 3 : slot < 13 ? 2 : 1;
      for (let row = 0; row < rowsPerSlot; row++) {
        for (let col = 0; col < cols; col++) {
          const centerLeft = Math.floor(cols / 2) - Math.floor(centerGapCols / 2);
          const centerRight = centerLeft + centerGapCols - 1;
          if (col >= centerLeft && col <= centerRight) continue;
          const cx = -(cols - 1) * 1.25 + col * 2.5;
          const cy = deckY + 1.3 + row * 2.6;
          const hexIdx = (slot + row + col) % containerColors.length;
          ss(g, 2.4, 2.5, slotLen - 0.3, cx, cy, sz, containerColors[hexIdx]);
        }
      }
    }

    // Two elevated mid-fore stacks as in typical bridge-front reference photos
    ss(g, beam * 0.22, 8.0, loa * 0.075, -beam * 0.19, deckY + 6.4, -loa * 0.14, 0x7b4a3a);
    ss(g, beam * 0.22, 8.0, loa * 0.075,  beam * 0.19, deckY + 6.4, -loa * 0.14, 0x5f4b64);
  } else {
    const rowsPerSlot = 7; // vertical stacks
    const slotLen = 13;    // metres per slot (20ft container)
    const cols = Math.floor((beam - 4) / 2.5);
    for (let slot = 0; slot < 14; slot++) {
      const sz = -loa * 0.4 + slot * slotLen;
      if (sz > loa * 0.25) break; // don't place in superstructure area
      for (let row = 0; row < rowsPerSlot; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = -(cols - 1) * 1.25 + col * 2.5;
          const cy = deckY + 1.3 + row * 2.6;
          const hexIdx = (slot + row + col) % containerColors.length;
          ss(g, 2.4, 2.5, slotLen - 0.3, cx, cy, sz, containerColors[hexIdx]);
        }
      }
    }
  }

  if (!deckOnly) {
    // Superstructure (very aft, very tall)
    const ssZ = loa * 0.44;
    ss(g, beam * 0.55, bh * 0.4,  loa * 0.08, 0, deckY + bh * 0.2,  ssZ, 0xddddcc);
    ss(g, beam * 0.45, bh * 0.3,  loa * 0.07, 0, deckY + bh * 0.55, ssZ, 0xddddcc);
    ss(g, beam * 0.38, bh * 0.18, loa * 0.06, 0, deckY + bh * 0.77, ssZ, 0xddddcc);

    // Funnel (large, distinctive)
    cyl(g, bh * 0.07, bh * 0.10, bh * 0.45, 12, 0, deckY + bh + bh * 0.22, ssZ + loa * 0.05, 0x111111);
    cyl(g, bh * 0.065, bh * 0.065, 1.5, 12, 0, deckY + bh + bh * 0.44, ssZ + loa * 0.05, 0x0033aa); // blue band
  }

  // Foremast (visible above containers)
  mast(g, 0, deckY, -loa * 0.42, bh * 1.1);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildLNG(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex);
  const deckY = draft + 0.6;

  // 4 Moss-type spherical LNG tanks (iconic shape)
  const tankR = beam * 0.38;
  const tankPositions = [-loa * 0.35, -loa * 0.15, loa * 0.05, loa * 0.22];
  tankPositions.forEach((tz, i) => {
    const sGeo = new THREE.SphereGeometry(tankR, 16, 12);
    const tank = new THREE.Mesh(sGeo, mat(0xddddee));
    tank.position.set(0, deckY + tankR * 0.8, tz);
    g.add(tank);
    // Tank support skirt
    cyl(g, tankR * 0.5, tankR * 0.6, draft * 0.5, 12, 0, deckY + 0.25, tz, 0x888888);
  });

  if (!deckOnly) {
    // Superstructure (aft)
    const ssZ = loa * 0.43;
    ss(g, beam * 0.55, bh * 0.55, loa * 0.1, 0, deckY + bh * 0.27, ssZ, 0xddddcc);
    ss(g, beam * 0.45, bh * 0.25, loa * 0.08, 0, deckY + bh * 0.68, ssZ, 0xddddcc);

    // Funnel
    cyl(g, bh * 0.05, bh * 0.07, bh * 0.38, 10, 0, deckY + bh + bh * 0.19, ssZ + loa * 0.06, 0x222222);
    cyl(g, bh * 0.05, bh * 0.05, 1.2, 10, 0, deckY + bh + bh * 0.38, ssZ + loa * 0.06, 0x00aa66); // green band
  }

  // Foremast
  mast(g, 0, deckY, -loa * 0.41, bh * 0.9);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildBulk(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex);
  const deckY = draft + 0.6;

  // Cargo hold hatches (raised covers)
  const nHatches = 7;
  for (let i = 0; i < nHatches; i++) {
    const hz = -loa * 0.38 + i * (loa * 0.72 / nHatches);
    ss(g, beam * 0.6, 1.2, loa * 0.08, 0, deckY + 0.6, hz, 0x445544); // hatch top
    ss(g, beam * 0.7, 0.6, loa * 0.095, 0, deckY + 0.3, hz, 0x334433); // hatch coaming
  }

  // 2 cargo cranes (deck cranes at hatches 2 and 5)
  [1, 4].forEach(idx => {
    const hz = -loa * 0.38 + idx * (loa * 0.72 / nHatches);
    cyl(g, 0.5, 0.6, bh * 0.5, 6, beam * 0.22, deckY + bh * 0.25, hz, 0xaaaaaa);
  });

  if (!deckOnly) {
    // Superstructure (aft)
    const ssZ = loa * 0.40;
    ss(g, beam * 0.55, bh * 0.5,  loa * 0.12, 0, deckY + bh * 0.25, ssZ, 0xddddcc);
    ss(g, beam * 0.44, bh * 0.25, loa * 0.10, 0, deckY + bh * 0.65, ssZ, 0xddddcc);

    // Funnel
    cyl(g, bh * 0.06, bh * 0.08, bh * 0.35, 10, 0, deckY + bh + bh * 0.17, ssZ + loa * 0.07, 0x222222);
  }

  // Foremast
  mast(g, 0, deckY, -loa * 0.41, bh * 0.85);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildFerry(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex || 0xffffff, 0x0055cc); // blue hull bottom

  const deckY = draft + 0.6;
  const nDecks = 5;
  const deckH  = 3.2;

  if (!deckOnly) {
    // Multi-deck superstructure (runs most of the length)
    for (let d = 0; d < nDecks; d++) {
      const w = d < 2 ? beam : beam - d * 1.5;
      const dLen = loa * (0.9 - d * 0.05);
      ss(g, w, deckH, dLen, 0, deckY + d * deckH + deckH / 2, 0, 0xeeeedd);
      // Windows hint (thin dark strip)
      ss(g, w + 0.1, deckH * 0.25, dLen + 0.1, 0, deckY + d * deckH + deckH * 0.65, 0, 0x334455);
    }

    // Funnel (usually twin)
    const fz = loa * 0.1;
    cyl(g, 1.2, 1.5, bh * 0.25, 12, -3, deckY + nDecks * deckH + bh * 0.12, fz, 0x222222);
    cyl(g, 1.2, 1.5, bh * 0.25, 12,  3, deckY + nDecks * deckH + bh * 0.12, fz, 0x222222);

    // Radar mast
    mast(g, 0, deckY + nDecks * deckH, 0, bh * 0.5);
  }

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildNaval(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex || 0x778899, 0x556677);

  const deckY = draft + 0.6;

  // Forecastle (raised bow deck) — always visible
  ss(g, beam - 1, 1.5, loa * 0.18, 0, deckY + 0.75, -loa * 0.35, 0x888899);

  // Gun turret (forward) — always visible
  cyl(g, beam * 0.12, beam * 0.14, 1.8, 16, 0, deckY + 0.9, -loa * 0.32, 0x778899);
  // Gun barrel
  const barrelGeo = new THREE.CylinderGeometry(0.2, 0.3, loa * 0.06, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, mat(0x667788));
  barrel.position.set(0, deckY + 2.5, -loa * 0.35);
  g.add(barrel);

  if (!deckOnly) {
    // Main superstructure (bridge island)
    const ssZ = 0;
    ss(g, beam * 0.5, bh * 0.5,  loa * 0.12, 0, deckY + bh * 0.25, ssZ, 0x889999);
    ss(g, beam * 0.4, bh * 0.25, loa * 0.10, 0, deckY + bh * 0.65, ssZ, 0x889999);

    // Radar mast (distinctive lattice approximation)
    mast(g, 0, deckY + bh, ssZ, bh * 0.6, 0x888888);

    // Funnel (low, at angle)
    cyl(g, bh * 0.04, bh * 0.06, bh * 0.2, 8, 0, deckY + bh + bh * 0.1, loa * 0.05, 0x444444);
  }

  // Stern helipad
  ss(g, beam - 3, 0.3, loa * 0.15, 0, deckY + 0.15, loa * 0.38, 0x445544);
  // Helipad circle
  const circGeo = new THREE.CircleGeometry(beam * 0.2, 20);
  const circ = new THREE.Mesh(circGeo, mat(0x334433));
  circ.rotation.x = -Math.PI / 2;
  circ.position.set(0, deckY + 0.32, loa * 0.38);
  g.add(circ);

  // Depth charge racks (aft)
  ss(g, beam * 0.3, 1.0, loa * 0.05, 0, deckY + 0.5, loa * 0.45, 0x666677);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

function buildTug(loa, beam, draft, bh, hullHex, deckOnly = false) {
  const g = new THREE.Group();
  hull(g, loa, beam, draft, hullHex || 0xff4400, 0x990000);

  const deckY = draft + 0.6;

  // Towing winch (aft) — always visible on deck
  ss(g, beam * 0.6, 1.8, loa * 0.18, 0, deckY + 0.9, loa * 0.3, 0x555555);
  cyl(g, beam * 0.12, beam * 0.14, 1.0, 12, 0, deckY + 1.8, loa * 0.3, 0x888888); // winch drum

  // Towing hook/bitt
  cyl(g, 0.4, 0.5, 2.0, 8, 0, deckY + 1.0, loa * 0.2, 0x666666);

  if (!deckOnly) {
    // High wheelhouse
    ss(g, beam * 0.65, bh * 0.55, loa * 0.2, 0, deckY + bh * 0.28, -loa * 0.05, 0xddddcc);
    ss(g, beam * 0.55, bh * 0.2,  loa * 0.18, 0, deckY + bh * 0.65, -loa * 0.05, 0xddddcc);

    // Short squat funnel
    cyl(g, bh * 0.1, bh * 0.12, bh * 0.3, 10, 0, deckY + bh + bh * 0.15, loa * 0.08, 0x111111);
    cyl(g, bh * 0.09, bh * 0.09, 0.8, 10,    0, deckY + bh + bh * 0.3,  loa * 0.08, 0xff4400); // orange band
  }

  // Rubber fenders (sides, forward) — always visible
  for (let side of [-1, 1]) {
    ss(g, 0.8, 2.5, loa * 0.4, side * (beam / 2 + 0.4), deckY + 1.25, -loa * 0.15, 0x222222);
  }

  // Foremast
  mast(g, 0, deckY + bh, -loa * 0.1, bh * 0.35);

  navLights(g, loa, beam, draft, bh);
  g.position.y = -draft * 0.55;
  return g;
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// =============================================================================

import { SHIP_TYPES } from './locations.js';

/**
 * Build a realistic 3D ship mesh group for the given type ID.
 * @param {string} typeId       - one of the SHIP_TYPES ids
 * @param {number} [overrideColor] - optional hex override
 * @param {boolean} [deckOnly]  - if true, omit superstructure (for own-ship foredeck view)
 * @returns {THREE.Group}
 */
export function buildShipMesh(typeId, overrideColor, deckOnly = false) {
  const type = SHIP_TYPES.find(t => t.id === typeId) || SHIP_TYPES[0];
  const { loa, beam, draft, bridgeHeight: bh, color } = type;
  const hullHex = overrideColor ?? color;

  switch (typeId) {
    case 'tanker':    return buildTanker(loa, beam, draft, bh, hullHex, deckOnly);
    case 'container': return buildContainer(loa, beam, draft, bh, hullHex, deckOnly);
    case 'lng':       return buildLNG(loa, beam, draft, bh, hullHex, deckOnly);
    case 'bulk':      return buildBulk(loa, beam, draft, bh, hullHex, deckOnly);
    case 'ferry':     return buildFerry(loa, beam, draft, bh, hullHex, deckOnly);
    case 'naval':     return buildNaval(loa, beam, draft, bh, hullHex, deckOnly);
    case 'tug':       return buildTug(loa, beam, draft, bh, hullHex, deckOnly);
    case 'cargo':
    default:          return buildCargo(loa, beam, draft, bh, hullHex, deckOnly);
  }
}

/**
 * Build the own-ship foredeck mesh — hull + deck furniture only, no superstructure.
 * Used for the player's first-person bridge view so solid SS walls don't block the forward view.
 */
export function buildForedeckMesh(typeId) {
  return buildShipMesh(typeId, undefined, true);
}

/**
 * Build a simplified (LOD) mesh for distant traffic ships — same function but
 * returns the same full model. In future this could return simpler geometry.
 */
export function buildTrafficShipMesh(typeId) {
  return buildShipMesh(typeId);
}
