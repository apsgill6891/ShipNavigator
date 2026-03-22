// js/radar.js — ARPA Radar System

const RANGE_OPTIONS = [0.5, 1.5, 3, 6, 12, 24, 48, 96]; // nautical miles
const NM = 1852; // metres per nautical mile

export class RadarSystem {
  constructor() {
    this.canvas       = null;
    this.ctx          = null;
    this.rangeIdx     = 2;        // default 3 nm
    this.northUp      = true;
    this.trailLength  = 8;        // number of previous positions
    this.cursorBearing= null;
    this.cursorRange  = null;
    this.acquiredTargets = new Map(); // id -> ARPATarget
    this.ownHeading   = 0;
    this.ownSpeed     = 0;
    this.ownPos       = { x: 0, z: 0 };
    this.scanAngle    = 0;        // rotating sweep line
    this._lastScan    = 0;
    this._echoes      = [];       // persistent blips
    this._scanPeriod  = 2.5;      // seconds per revolution
    this.onTargetUpdate = null;   // callback
    this._pulsePhase  = 0;
    this._clickHandler = null;
  }

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.canvas.addEventListener('click', (e) => this._onClick(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
  }

  get range() { return RANGE_OPTIONS[this.rangeIdx]; }

  rangeUp()   { this.rangeIdx = Math.min(RANGE_OPTIONS.length - 1, this.rangeIdx + 1); }
  rangeDown() { this.rangeIdx = Math.max(0, this.rangeIdx - 1); }
  toggleNorthUp() { this.northUp = !this.northUp; }

  // ── Update ──────────────────────────────────────────────────────────────────
  update(ownShip, otherShips, dt) {
    this.ownHeading = ownShip.heading;
    this.ownSpeed   = ownShip.speed;
    this.ownPos     = { x: ownShip.position.x, z: ownShip.position.z };

    // Advance scan
    this.scanAngle = (this.scanAngle + (360 / this._scanPeriod) * dt) % 360;
    this._pulsePhase = (this._pulsePhase + dt * 2) % 1;

    // Update ARPA tracks
    for (const ship of otherShips) {
      this._updateTrack(ship);
    }

    // Remove stale tracks
    const now = Date.now();
    for (const [id, trk] of this.acquiredTargets) {
      if (now - trk.lastSeen > 60000) this.acquiredTargets.delete(id);
    }

    // Notify
    if (this.onTargetUpdate) this.onTargetUpdate([...this.acquiredTargets.values()]);
  }

  _updateTrack(ship) {
    const dx = ship.position.x - this.ownPos.x;
    const dz = ship.position.z - this.ownPos.z;
    const rangeM = Math.sqrt(dx * dx + dz * dz);
    const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const rangeNM = rangeM / NM;

    if (rangeNM > this.range * 1.5) return; // beyond display

    let trk = this.acquiredTargets.get(ship.id);
    if (!trk) {
      trk = {
        id: ship.id,
        name: ship.name,
        callsign: ship.callsign,
        type: ship.type,
        positions: [],
        heading: ship.heading,
        speed: ship.speed,
        bearing: 0,
        range: 0,
        cpa: 0,
        tcpa: 0,
        lastSeen: 0,
        acquired: false,
        lost: false,
      };
      this.acquiredTargets.set(ship.id, trk);
    }

    trk.bearing = bearing;
    trk.range   = rangeNM;
    trk.heading = ship.heading;
    trk.speed   = ship.speed;
    trk.lastSeen = Date.now();
    trk.acquired = true;
    trk.positions.push({ x: dx, z: dz, t: Date.now() });
    if (trk.positions.length > 20) trk.positions.shift();

    // ARPA CPA/TCPA calculation
    this._calcCPATCPA(trk, ship);
  }

  _calcCPATCPA(trk, ship) {
    // Own ship velocity vector (m/s)
    const ownVx = this.ownSpeed * NM / 3600 * Math.sin(this.ownHeading * Math.PI / 180);
    const ownVz = -this.ownSpeed * NM / 3600 * Math.cos(this.ownHeading * Math.PI / 180);
    // Target velocity
    const tgtVx = ship.speed * NM / 3600 * Math.sin(ship.heading * Math.PI / 180);
    const tgtVz = -ship.speed * NM / 3600 * Math.cos(ship.heading * Math.PI / 180);
    // Relative position
    const rx = ship.position.x - this.ownPos.x;
    const rz = ship.position.z - this.ownPos.z;
    // Relative velocity
    const vx = tgtVx - ownVx;
    const vz = tgtVz - ownVz;

    const vv = vx * vx + vz * vz;
    if (vv < 0.0001) { trk.cpa = trk.range; trk.tcpa = 999; return; }
    const tcpaSec = -(rx * vx + rz * vz) / vv;
    const cpaX = rx + vx * tcpaSec;
    const cpaZ = rz + vz * tcpaSec;
    trk.cpa  = Math.sqrt(cpaX * cpaX + cpaZ * cpaZ) / NM;
    trk.tcpa = Math.max(0, tcpaSec / 60); // minutes
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  render() {
    if (!this.ctx) return;
    const c = this.canvas;
    const ctx = this.ctx;
    const w = c.width, h = c.height;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 4; // pixel radius

    // Background
    ctx.fillStyle = '#000a00';
    ctx.fillRect(0, 0, w, h);

    // Circular mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Sweep glow
    this._renderSweep(ctx, cx, cy, R);

    // Range rings
    this._renderRings(ctx, cx, cy, R);

    // Bearing lines (every 30°)
    this._renderBearingLines(ctx, cx, cy, R);

    // Targets / blips
    this._renderTargets(ctx, cx, cy, R);

    // Cursor
    if (this.cursorBearing !== null) {
      this._renderCursor(ctx, cx, cy, R);
    }

    ctx.restore();

    // Outer ring & labels
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#1a4a1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Heading line (own ship)
    const hdgRad = this._bearingToCanvas(0);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(hdgRad) * R, cy - Math.cos(hdgRad) * R);
    ctx.strokeStyle = 'rgba(0,200,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Own ship dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00ff00';
    ctx.fill();

    // Range label
    ctx.fillStyle = '#0a0';
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Range: ${this.range} nm`, w - 4, 14);
    ctx.fillText(this.northUp ? 'N-UP' : 'H-UP', w - 4, 28);

    // Cursor readout
    if (this.cursorBearing !== null) {
      ctx.fillStyle = '#0f0';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`BRG: ${String(Math.round(this.cursorBearing)).padStart(3,'0')}° RNG: ${this.cursorRange.toFixed(2)} nm`, 4, 14);
    }
  }

  _bearingToCanvas(bearing) {
    // In north-up mode: bearing is from north = standard
    // In head-up: subtract own heading
    const b = this.northUp ? bearing : (bearing - this.ownHeading + 360) % 360;
    return b * Math.PI / 180;
  }

  _renderSweep(ctx, cx, cy, R) {
    const sweepRad = this._bearingToCanvas(this.scanAngle);
    const gradient = ctx.createConicalGradient
      ? null // not standard
      : null;

    // Simulated sweep: rotating bright line + trailing glow
    const trailLength = Math.PI / 3;
    for (let i = 0; i < 30; i++) {
      const alpha = (1 - i / 30) * 0.15;
      const a = sweepRad - (i / 30) * trailLength;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R);
      ctx.strokeStyle = `rgba(0,${Math.round(180 + 75 * (1 - i/30))},0,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  _renderRings(ctx, cx, cy, R) {
    const numRings = 4;
    for (let i = 1; i <= numRings; i++) {
      const r = (i / numRings) * R;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,100,0,0.5)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Range label on ring
      const ringNM = (this.range / numRings) * i;
      ctx.fillStyle = 'rgba(0,180,0,0.7)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ringNM.toFixed(ringNM < 1 ? 1 : 0) + ' nm', cx + r + 2, cy);
    }
  }

  _renderBearingLines(ctx, cx, cy, R) {
    for (let b = 0; b < 360; b += 30) {
      const rad = this._bearingToCanvas(b) ;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(rad) * (R * 0.85), cy - Math.cos(rad) * (R * 0.85));
      ctx.lineTo(cx + Math.sin(rad) * R, cy - Math.cos(rad) * R);
      ctx.strokeStyle = 'rgba(0,120,0,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Label
      ctx.fillStyle = 'rgba(0,200,0,0.6)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lx = cx + Math.sin(rad) * (R - 12);
      const ly = cy - Math.cos(rad) * (R - 12);
      ctx.fillText(b === 0 ? 'N' : String(b), lx, ly);
    }
    ctx.textBaseline = 'alphabetic';
  }

  _renderTargets(ctx, cx, cy, R) {
    const rangeM = this.range * NM;

    for (const trk of this.acquiredTargets.values()) {
      const dx = trk.positions.length > 0 ? trk.positions[trk.positions.length - 1].x : 0;
      const dz = trk.positions.length > 0 ? trk.positions[trk.positions.length - 1].z : 0;
      if (Math.sqrt(dx * dx + dz * dz) > rangeM) continue;

      const px = cx + (dx / rangeM) * R;
      const py = cy - (dz / rangeM) * R; // z-south = positive down on screen

      // Trail dots
      ctx.fillStyle = 'rgba(0,160,0,0.4)';
      for (let i = 0; i < trk.positions.length - 1 && i < this.trailLength; i++) {
        const tp = trk.positions[trk.positions.length - 2 - i];
        const tx = cx + (tp.x / rangeM) * R;
        const ty = cy - (tp.z / rangeM) * R;
        ctx.beginPath();
        ctx.arc(tx, ty, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Blip
      const isDanger = trk.cpa < 0.5 && trk.tcpa < 30 && trk.tcpa > 0;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = isDanger ? '#ff4400' : '#00ff44';
      ctx.fill();

      // Vector line (speed vector, scaled to 6 minutes ahead)
      const vecScale = 6 / 60; // 6-min vector
      const vecX = trk.speed * NM / 3600 * Math.sin(trk.heading * Math.PI / 180) * vecScale * 60;
      const vecZ = -trk.speed * NM / 3600 * Math.cos(trk.heading * Math.PI / 180) * vecScale * 60;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + (vecX / rangeM) * R, py - (vecZ / rangeM) * R);
      ctx.strokeStyle = isDanger ? '#ff8800' : '#00cc44';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#0f0';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      const label = trk.name.length > 10 ? trk.name.slice(0, 10) : trk.name;
      ctx.fillText(label, px + 6, py - 2);
      ctx.fillText(`${trk.speed.toFixed(0)}kn`, px + 6, py + 8);

      // CPA ring if danger
      if (isDanger) {
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff4400';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  _renderCursor(ctx, cx, cy, R) {
    const rad = this._bearingToCanvas(this.cursorBearing);
    const distPx = (this.cursorRange / this.range) * R;
    const mx = cx + Math.sin(rad) * distPx;
    const my = cy - Math.cos(rad) * distPx;
    // Crosshair
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx - 8, my); ctx.lineTo(mx + 8, my);
    ctx.moveTo(mx, my - 8); ctx.lineTo(mx, my + 8);
    ctx.stroke();
  }

  _onClick(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const R  = Math.min(this.canvas.width, this.canvas.height) / 2 - 4;
    const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width) - cx;
    const my = (e.clientY - rect.top)  * (this.canvas.height / rect.height) - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist > R) return;

    // Bearing in N-up from click
    let bearing = (Math.atan2(mx, -my) * 180 / Math.PI + 360) % 360;
    if (!this.northUp) bearing = (bearing + this.ownHeading) % 360;
    const range  = (dist / R) * this.range;

    this.cursorBearing = bearing;
    this.cursorRange   = range;
  }

  _onMouseMove(e) {
    // same as click for live cursor
    this._onClick(e);
  }

  // ── ARPA target data for sidebar ────────────────────────────────────────────
  getARPAList() {
    const list = [...this.acquiredTargets.values()];
    list.sort((a, b) => a.range - b.range);
    return list.slice(0, 8); // top 8 by range
  }

  renderARPAList() {
    const el = document.getElementById('arpa-list');
    if (!el) return;
    const list = this.getARPAList();
    if (!list.length) { el.innerHTML = '<div class="arpa-no-targets">No ARPA targets</div>'; return; }
    el.innerHTML = list.map(t => {
      const danger = t.cpa < 0.5 && t.tcpa < 30 && t.tcpa > 0;
      const cls = danger ? 'arpa-target arpa-danger' : 'arpa-target';
      const tcpaStr = t.tcpa > 500 ? '—' : t.tcpa.toFixed(0) + 'm';
      return `<div class="${cls}">
        <span class="arpa-name">${t.name.slice(0,12)}</span>
        <span class="arpa-data">BRG ${String(Math.round(t.bearing)).padStart(3,'0')}° ${t.range.toFixed(1)}nm</span>
        <span class="arpa-data">${t.speed.toFixed(0)}kn HDG ${String(Math.round(t.heading)).padStart(3,'0')}°</span>
        <span class="arpa-cpa ${danger ? 'cpa-danger':''}" >CPA ${t.cpa.toFixed(2)}nm TCPA ${tcpaStr}</span>
      </div>`;
    }).join('');
  }
}
