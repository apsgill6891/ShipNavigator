// js/ecdis.js — ECDIS Electronic Chart Display & Information System
// Canvas-based nautical chart: TSS, lighthouses, buoys, own ship, traffic

const NM = 1852; // metres per nautical mile

// ── Embedded TSS lane definitions per location ───────────────────────────────
// Lanes are arrays of [x, z] waypoints; separation zones listed separately.
// Colours follow ECDIS standard: magenta for TSS boundaries, grey for sep zone.
const TSS_DATA = {
  singapore_strait: {
    lanes: [
      { name: 'SG Eastbound',  dir: 90,  color: '#cc44ff',
        boundary: [[-22000,-1800],[22000,-1800],[ 22000,-200],[-22000,-200]] },
      { name: 'SG Westbound',  dir: 270, color: '#cc44ff',
        boundary: [[-22000, 200],[22000, 200],[ 22000,1800],[-22000,1800]] },
    ],
    sepZone: { boundary: [[-22000,-200],[22000,-200],[22000,200],[-22000,200]] },
    lighthouses: [
      { x: 20000, z: -2600, name: 'Horsburgh Lt', char: 'Fl(4)25s', range: 22 },
      { x:-20000, z:  2200, name: 'Sultan Shoal', char: 'Fl 10s',   range: 15 },
    ],
  },
  dover_strait: {
    lanes: [
      { name: 'NE Traffic',  dir: 45,  color: '#cc44ff',
        boundary: [[-25000,-3000],[25000,-3000],[25000,-600],[-25000,-600]] },
      { name: 'SW Traffic',  dir: 225, color: '#cc44ff',
        boundary: [[-25000, 600],[25000, 600],[25000,3000],[-25000,3000]] },
    ],
    sepZone: { boundary: [[-25000,-600],[25000,-600],[25000,600],[-25000,600]] },
    lighthouses: [
      { x: 0,     z:-20000, name: 'South Foreland', char: 'Fl 3.5s', range: 20 },
      { x:-10000, z: 18000, name: 'Cap Gris-Nez',   char: 'Fl 5s',   range: 22 },
    ],
  },
  english_channel: {
    lanes: [
      { name: 'NE Lane', dir: 60,  color: '#cc44ff',
        boundary: [[-25000,-4000],[25000,-4000],[25000,-800],[-25000,-800]] },
      { name: 'SW Lane', dir: 240, color: '#cc44ff',
        boundary: [[-25000, 800],[25000, 800],[25000,4000],[-25000,4000]] },
    ],
    sepZone: { boundary: [[-25000,-800],[25000,-800],[25000,800],[-25000,800]] },
    lighthouses: [
      { x:-15000, z:-8000, name: 'Start Point', char: 'Fl(3) 10s', range: 25 },
    ],
  },
  suez_canal: {
    lanes: [
      { name: 'Northbound', dir: 0,   color: '#cc44ff',
        boundary: [[-800,-80000],[-800,80000],[0,80000],[0,-80000]] },
      { name: 'Southbound', dir: 180, color: '#cc44ff',
        boundary: [[0,-80000],[0,80000],[800,80000],[800,-80000]] },
    ],
    sepZone: { boundary: [[-100,-80000],[-100,80000],[100,80000],[100,-80000]] },
    lighthouses: [
      { x:  3000, z: 0,    name: 'El Ballah Sig Stn', char: 'Oc 3s', range: 10 },
      { x: -3000, z:-30000,name: 'El Qantara Lt',      char: 'Fl 5s', range: 12 },
    ],
  },
  panama_canal: {
    lanes: [
      { name: 'N Traffic', dir: 0,   color: '#cc44ff',
        boundary: [[-400,-80000],[-400,80000],[0,80000],[0,-80000]] },
      { name: 'S Traffic', dir: 180, color: '#cc44ff',
        boundary: [[0,-80000],[0,80000],[400,80000],[400,-80000]] },
    ],
    sepZone: { boundary: [[-60,-80000],[-60,80000],[60,80000],[60,-80000]] },
    lighthouses: [
      { x: 2000, z: 0, name: 'Miraflores Sig', char: 'Fl 4s', range: 10 },
    ],
  },
  strait_of_hormuz: {
    lanes: [
      { name: 'Inbound',   dir: 295, color: '#cc44ff',
        boundary: [[-25000,-4000],[25000,-4000],[25000,-800],[-25000,-800]] },
      { name: 'Outbound',  dir: 115, color: '#cc44ff',
        boundary: [[-25000, 800],[25000, 800],[25000,4000],[-25000,4000]] },
    ],
    sepZone: { boundary: [[-25000,-800],[25000,-800],[25000,800],[-25000,800]] },
    lighthouses: [
      { x:-12000, z:-8000, name: 'Quoin Is Lt',  char: 'Fl(2) 10s', range: 18 },
      { x: 14000, z: 6000, name: 'Musandam Lt',  char: 'Fl 5s',     range: 22 },
    ],
  },
  malacca_strait: {
    lanes: [
      { name: 'NW Bound', dir: 315, color: '#cc44ff',
        boundary: [[-25000,-5000],[25000,-5000],[25000,-1000],[-25000,-1000]] },
      { name: 'SE Bound', dir: 135, color: '#cc44ff',
        boundary: [[-25000,1000],[25000,1000],[25000,5000],[-25000,5000]] },
    ],
    sepZone: { boundary: [[-25000,-1000],[25000,-1000],[25000,1000],[-25000,1000]] },
    lighthouses: [
      { x: 0, z:-10000, name: 'Pulo Pisang',   char: 'Fl(3) 15s', range: 20 },
      { x: 0, z: 10000, name: 'One Fathom Bk', char: 'Fl 3s',     range: 15 },
    ],
  },
};

// ── Traffic category colours (ECDIS AIS standard-ish) ────────────────────────
const TYPE_COLOR = {
  cargo: '#4488ff', tanker: '#ff8800', container: '#00ccff',
  lng: '#88ff88', bulk: '#ff88cc', ferry: '#ffffff', naval: '#888888', tug: '#ffcc00',
};

// ─────────────────────────────────────────────────────────────────────────────
export class ECDISSystem {
  constructor() {
    this._canvas   = null;
    this._ctx      = null;
    this._location = null;
    this._range    = 6 * NM;   // metres half-width of chart (6 nm default)
    this._northUp  = false;    // true = north up, false = heading up
    this._ownShip  = null;
    this._traffic  = [];
    this._tss      = null;
    this._rangeIdx = 3;        // index into range table
    this._RANGES   = [0.5 * NM, 1 * NM, 2 * NM, 3 * NM, 6 * NM, 12 * NM, 24 * NM];
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  init(canvasId, location) {
    this._canvas   = document.getElementById(canvasId);
    if (!this._canvas) return;
    this._ctx      = this._canvas.getContext('2d');
    this._location = location;
    this._tss      = TSS_DATA[location.id] || null;
  }

  setLocation(location) {
    this._location = location;
    this._tss      = TSS_DATA[location.id] || null;
  }

  rangeUp()   { this._rangeIdx = Math.min(this._rangeIdx + 1, this._RANGES.length - 1); this._range = this._RANGES[this._rangeIdx]; }
  rangeDown() { this._rangeIdx = Math.max(this._rangeIdx - 1, 0);                        this._range = this._RANGES[this._rangeIdx]; }
  toggleNorthUp() { this._northUp = !this._northUp; }

  // ── Update (called each frame) ────────────────────────────────────────────
  update(ownShip, trafficShips) {
    this._ownShip = ownShip;
    this._traffic = trafficShips;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const cv = this._canvas;
    if (!cv || !this._ownShip) return;
    const ctx = this._ctx;
    const W = cv.width, H = cv.height;
    const cx = W / 2, cy = H / 2;

    // Scale: pixels per metre
    const scale = Math.min(W, H) / 2 / this._range;

    // Rotation angle for heading-up mode
    const rotAngle = this._northUp ? 0 : -(this._ownShip.heading * Math.PI / 180);

    // ── Background ──
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(0, 0, W, H);

    // ── Helper: world → canvas ──
    const ox = this._ownShip.position.x;
    const oz = this._ownShip.position.z;
    const toCanvas = (wx, wz) => {
      const dx = (wx - ox) * scale;
      const dz = (wz - oz) * scale;
      const cosR = Math.cos(rotAngle), sinR = Math.sin(rotAngle);
      return {
        x: cx + dx * cosR - dz * sinR,
        y: cy + dx * sinR + dz * cosR,
      };
    };

    // ── Range rings ──
    ctx.strokeStyle = '#1a3050';
    ctx.lineWidth = 1;
    const numRings = 3;
    for (let r = 1; r <= numRings; r++) {
      const rPx = (this._range / numRings) * r * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.stroke();
      // Range label
      ctx.fillStyle = '#2a5070';
      ctx.font = '9px Courier New';
      const rNM = ((this._range / numRings) * r / NM).toFixed(1);
      ctx.fillText(rNM + 'nm', cx + 4, cy - rPx + 10);
    }

    // ── Depth shading (simple gradient) ──
    if (this._location) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.5);
      grad.addColorStop(0, 'rgba(0,50,100,0.25)');
      grad.addColorStop(1, 'rgba(0,20,50,0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── TSS lanes ──
    if (this._tss) {
      // Separation zone (grey fill)
      if (this._tss.sepZone) {
        ctx.fillStyle = 'rgba(80,60,0,0.35)';
        ctx.strokeStyle = '#806030';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const pts = this._tss.sepZone.boundary;
        const p0 = toCanvas(pts[0][0], pts[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; i++) {
          const p = toCanvas(pts[i][0], pts[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Traffic lanes (magenta outline + direction arrow)
      for (const lane of this._tss.lanes) {
        const pts = lane.boundary;
        // Dashed boundary lines
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#cc44ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const p0 = toCanvas(pts[0][0], pts[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < pts.length; i++) {
          const p = toCanvas(pts[i][0], pts[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Lane direction arrow (magenta) near centre of lane
        const mc = toCanvas(
          (pts[0][0] + pts[2][0]) / 2,
          (pts[0][1] + pts[2][1]) / 2
        );
        if (mc.x > 0 && mc.x < W && mc.y > 0 && mc.y < H) {
          const dirRad = (lane.dir * Math.PI / 180) + rotAngle;
          const alen = 22;
          ctx.save();
          ctx.translate(mc.x, mc.y);
          ctx.rotate(dirRad);
          ctx.fillStyle = '#cc44ff';
          ctx.beginPath();
          ctx.moveTo(0, -alen);
          ctx.lineTo(6, 4);
          ctx.lineTo(-6, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // Lane name label
          ctx.fillStyle = '#aa33dd';
          ctx.font = '8px Courier New';
          ctx.fillText(lane.name, mc.x + 10, mc.y);
        }
      }
    }

    // ── Land masses ──
    if (this._location) {
      for (const lt of this._location.terrain) {
        if (!lt.outline || lt.outline.length < 3) continue;
        ctx.fillStyle = lt.color
          ? '#' + lt.color.toString(16).padStart(6, '0').replace(/^0x/i, '')
          : '#2a5a2a';
        // Convert color number to CSS hex
        const hexColor = '#' + (lt.color & 0xFFFFFF).toString(16).padStart(6, '0');
        ctx.fillStyle = hexColor;
        ctx.strokeStyle = '#4a8a4a';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        const p0 = toCanvas(lt.outline[0][0], lt.outline[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < lt.outline.length; i++) {
          const p = toCanvas(lt.outline[i][0], lt.outline[i][1]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // ── Buoys ──
    if (this._location) {
      const buoyColors = {
        port: '#ff2200', stbd: '#00cc44', N: '#eeeeee', S: '#ffff00',
        E: '#eeeeee', W: '#ffff00', safe: '#ff3366', danger: '#eeeeee',
        isolated: '#eeeeee', special: '#ffcc00',
      };
      for (const b of this._location.buoys) {
        const bp = toCanvas(b.x, b.z);
        if (bp.x < -20 || bp.x > W + 20 || bp.y < -20 || bp.y > H + 20) continue;
        const col = buoyColors[b.type] || '#ffffff';
        ctx.fillStyle = col;
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (b.label) {
          ctx.fillStyle = col;
          ctx.font = '8px Courier New';
          ctx.fillText(b.label, bp.x + 4, bp.y - 3);
        }
        if (b.racon) {
          ctx.strokeStyle = '#ffff00';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bp.x, bp.y, 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // ── Lighthouses ──
    if (this._tss && this._tss.lighthouses) {
      for (const lh of this._tss.lighthouses) {
        const lp = toCanvas(lh.x, lh.z);
        if (lp.x < -20 || lp.x > W + 20 || lp.y < -20 || lp.y > H + 20) continue;
        // Star / flare symbol
        ctx.save();
        ctx.translate(lp.x, lp.y);
        ctx.fillStyle = '#ffff88';
        ctx.strokeStyle = '#ffdd00';
        ctx.lineWidth = 1;
        // Draw 6-pointed star
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * 60 - 90) * Math.PI / 180;
          const r = i % 2 === 0 ? 6 : 3;
          i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                  : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        // Sector arc (pale yellow)
        ctx.strokeStyle = 'rgba(255,255,100,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, lh.range * NM * scale, 0, Math.PI * 2);
        ctx.stroke();
        // Label
        ctx.fillStyle = '#ffee88';
        ctx.font = 'bold 8px Courier New';
        ctx.fillText(lh.name, lp.x + 8, lp.y - 4);
        ctx.fillStyle = '#aaa';
        ctx.font = '7px Courier New';
        ctx.fillText(lh.char, lp.x + 8, lp.y + 6);
      }
    }

    // ── Traffic ships (AIS-style triangles) ──
    for (const ts of this._traffic) {
      const tp = toCanvas(ts.position.x, ts.position.z);
      if (tp.x < -20 || tp.x > W + 20 || tp.y < -20 || tp.y > H + 20) continue;
      const col = TYPE_COLOR[ts.type] || '#aaaaaa';
      const hdgRad = (ts.heading * Math.PI / 180) + rotAngle;
      ctx.save();
      ctx.translate(tp.x, tp.y);
      ctx.rotate(hdgRad);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Heading vector
      const vecLen = ts.speed * NM / 3600 * 360 * scale; // 6-minute vector
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tp.x, tp.y);
      ctx.lineTo(
        tp.x + vecLen * Math.sin(hdgRad),
        tp.y - vecLen * Math.cos(hdgRad)
      );
      ctx.stroke();

      // Name label (if close enough)
      if (Math.abs(tp.x - cx) < W * 0.4 && Math.abs(tp.y - cy) < H * 0.4) {
        ctx.fillStyle = col;
        ctx.font = '8px Courier New';
        ctx.fillText(ts.name, tp.x + 6, tp.y - 4);
      }
    }

    // ── Own ship (white filled triangle, larger) ──
    const hdgRad = (this._ownShip.heading * Math.PI / 180) + rotAngle;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(hdgRad);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Own ship heading vector (6-minute)
    const ownVecLen = this._ownShip.speed * NM / 3600 * 360 * scale;
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + ownVecLen * Math.sin(hdgRad),
      cy - ownVecLen * Math.cos(hdgRad)
    );
    ctx.stroke();

    // ── Compass rose (top-right) ──
    this._drawCompassRose(ctx, W - 36, 36, 28, rotAngle);

    // ── Scale bar (bottom) ──
    this._drawScaleBar(ctx, W, H, scale);

    // ── Range readout (top-left) ──
    ctx.fillStyle = '#00cc88';
    ctx.font = 'bold 10px Courier New';
    const rngNM = (this._range / NM).toFixed(1);
    ctx.fillText(`RNG ${rngNM}nm`, 6, 14);
    ctx.fillStyle = '#4a8080';
    ctx.font = '9px Courier New';
    ctx.fillText(this._northUp ? 'N-UP' : 'HDG-UP', 6, 26);

    // ── Location name ──
    if (this._location) {
      ctx.fillStyle = '#aabbcc';
      ctx.font = '9px Courier New';
      ctx.fillText(this._location.name, 6, H - 20);
    }
  }

  // ── Compass rose ─────────────────────────────────────────────────────────
  _drawCompassRose(ctx, cx, cy, r, rotAngle) {
    const dirs = ['N','E','S','W'];
    ctx.save();
    ctx.translate(cx, cy);
    // Outer circle
    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    // Cardinal ticks
    for (let i = 0; i < 8; i++) {
      const a = i * 45 * Math.PI / 180 - rotAngle;
      const inner = i % 2 === 0 ? r * 0.55 : r * 0.7;
      ctx.strokeStyle = i % 2 === 0 ? '#aabbcc' : '#445566';
      ctx.lineWidth = i % 2 === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * inner, -Math.cos(a) * inner);
      ctx.lineTo(Math.sin(a) * r,     -Math.cos(a) * r);
      ctx.stroke();
    }
    // Cardinal letters
    ctx.fillStyle = '#88bbcc';
    ctx.font = 'bold 9px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    dirs.forEach((d, i) => {
      const a = i * 90 * Math.PI / 180 - rotAngle;
      ctx.fillText(d, Math.sin(a) * r * 0.38, -Math.cos(a) * r * 0.38);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // ── Scale bar ─────────────────────────────────────────────────────────────
  _drawScaleBar(ctx, W, H, scale) {
    // Target a 1 or 2 nm scale bar
    let barNM = 1;
    const barPx = barNM * NM * scale;
    if (barPx < 30) barNM = 2;
    if (barPx > 120) barNM = 0.5;
    const finalPx = barNM * NM * scale;
    const bx = W / 2 - finalPx / 2;
    const by = H - 12;
    ctx.strokeStyle = '#aabbcc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + finalPx, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + finalPx, by - 4); ctx.lineTo(bx + finalPx, by + 4);
    ctx.stroke();
    ctx.fillStyle = '#aabbcc';
    ctx.font = '8px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(`${barNM} nm`, bx + finalPx / 2, by - 5);
    ctx.textAlign = 'left';
  }
}
