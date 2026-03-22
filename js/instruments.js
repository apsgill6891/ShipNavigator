// js/instruments.js — Bridge Instrument System

export class InstrumentSystem {
  constructor() {
    this.data = {
      // Navigation
      heading:       0,    // gyro, degrees
      magHeading:    0,    // magnetic compass
      rudderAngle:   0,    // degrees (-35 to +35)
      rot:           0,    // rate of turn, deg/min
      speedLog:      0,    // speed through water (STW), knots
      speedOG:       0,    // speed over ground (SOG), knots
      courseOG:      0,    // course over ground (COG), degrees
      lat:           1.29, // decimal degrees
      lon:         103.85,
      // Depth
      depthKeel:    28.0,  // metres below keel
      depthSurface: 28.5,
      // Environmental
      windSpeedTrue: 12,   // knots
      windDirTrue:   45,   // degrees
      windSpeedRel:  14,   // knots (relative)
      windDirRel:    35,   // degrees relative
      airTemp:       28,   // °C
      seaTemp:       26,   // °C
      pressure:    1012,   // hPa
      humidity:      75,   // %
      visibility:    10,   // nm
      waveHeight:     0.8, // m
      wavePeriod:     7,   // s
      swellHeight:    0.5, // m
      swellDir:       180, // degrees
      // Engine
      engineRpm:       0,
      shaftRpm:        0,
      propPitch:       0,  // % for CPP
      engineOrder:   'STOP',
      engineResponse:'STOP',
      fuelConsumption: 0,  // t/day
      // Electrical / Nav aids
      echoSounderAlarm: false,
      gpsMode:       'FIX',
      aisTargets:    0,
    };

    // Simulated noise / variation
    this._noise = {};
    this._lastUpdate = 0;
    this._depthProfile = 28; // base depth for current location
  }

  setLocation(location) {
    this._depthProfile = location.depth || 30;
    // Set lat/lon roughly per location
    const lls = {
      singapore_strait: [1.29, 103.85],
      dover_strait:     [51.05, 1.30],
      suez_canal:       [30.50, 32.35],
      panama_canal:     [9.10, -79.65],
      gibraltar:        [35.97, -5.48],
      bosphorus:        [41.12, 29.08],
      malacca:          [3.20, 101.40],
      hormuz:           [26.50, 56.50],
      kiel_canal:       [53.90, 9.80],
      open_ocean:       [45.00, -30.00],
      rotterdam:        [51.97, 3.98],
      lombok:           [-8.50, 115.75],
      english_channel:  [49.50, -4.50],
      corinth:          [37.91, 22.98],
      torres:           [-10.50, 142.20],
    };
    const ll = lls[location.id] || [0, 0];
    this.data.lat = ll[0];
    this.data.lon = ll[1];
  }

  update(ownShip, weather, dt) {
    const d = this.data;
    const s = ownShip;

    // Navigation
    d.heading    = s.heading;
    d.magHeading = (s.heading + (1.5 + this._n('mag', 0.2))) % 360;
    d.rudderAngle= s.rudderAngle;
    d.rot        = s.rot;
    d.speedLog   = s.speed + this._n('spd', 0.1);
    d.speedOG    = s.speed + weather.current.speed * Math.cos(
      (s.heading - weather.current.direction) * Math.PI / 180
    ) + this._n('sog', 0.05);
    d.courseOG   = (s.heading + this._n('cog', 0.3) + 360) % 360;

    // Update GPS position
    const metersPerDegLat = 111111;
    const metersPerDegLon = 111111 * Math.cos(d.lat * Math.PI / 180);
    const dx = s.velocity.x * dt;  // metres east
    const dz = s.velocity.z * dt;  // metres south
    d.lat -= dz / metersPerDegLat;
    d.lon += dx / metersPerDegLon;

    // Depth (varies with noise + trend)
    d.depthKeel    = Math.max(3, this._depthProfile + this._n('depth', 2) * Math.sin(Date.now() * 0.00001));
    d.depthSurface = d.depthKeel + 0.5;

    // Wind
    d.windSpeedTrue = weather.windSpeed;
    d.windDirTrue   = weather.windDirection;
    // Relative wind
    const relAngle = (weather.windDirection - s.heading + 360) % 360;
    const relAngleRad = relAngle * Math.PI / 180;
    const wx = weather.windSpeed * Math.sin(relAngleRad) - 0;
    const wy = weather.windSpeed * Math.cos(relAngleRad) - s.speed;
    d.windSpeedRel = Math.sqrt(wx * wx + wy * wy);
    d.windDirRel   = (Math.atan2(wx, wy) * 180 / Math.PI + 360) % 360;

    // Environmental
    d.airTemp    = weather.airTemp  + this._n('airT', 0.1);
    d.seaTemp    = weather.seaTemp  + this._n('seaT', 0.05);
    d.pressure   = weather.pressure + this._n('pres', 0.2);
    d.humidity   = weather.humidity + this._n('hum',  0.3);
    d.visibility = weather.visibility;
    d.waveHeight = weather.waveHeight;

    // Engine
    d.engineOrder    = s.engineOrder;
    d.engineResponse = s.engineResponse;
    d.engineRpm      = s.rpm;
    d.shaftRpm       = s.rpm;
    d.fuelConsumption= s.speed > 0 ? s.speed * 2.5 : 0.8; // crude estimate t/day
    d.aisTargets     = ownShip.aisTargetCount || 0;

    // Alarms
    d.echoSounderAlarm = d.depthKeel < 5;
  }

  _n(key, scale) {
    if (!this._noise[key]) this._noise[key] = 0;
    this._noise[key] += (Math.random() - 0.5) * 0.1;
    this._noise[key] *= 0.98;
    return this._noise[key] * scale;
  }

  formatLat(lat) {
    const d = Math.abs(lat) | 0;
    const m = (Math.abs(lat) - d) * 60;
    return `${d}°${m.toFixed(3)}'${lat >= 0 ? 'N' : 'S'}`;
  }

  formatLon(lon) {
    const d = Math.abs(lon) | 0;
    const m = (Math.abs(lon) - d) * 60;
    return `${String(d).padStart(3, '0')}°${m.toFixed(3)}'${lon >= 0 ? 'E' : 'W'}`;
  }

  formatHeading(h) {
    return String(Math.round((h + 360) % 360)).padStart(3, '0') + '°';
  }

  formatSpeed(s) {
    return s.toFixed(1);
  }

  render() {
    const d = this.data;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set('inst-gyro',        this.formatHeading(d.heading));
    set('inst-mag',         this.formatHeading(d.magHeading));
    set('inst-rudder',      (d.rudderAngle >= 0 ? `${d.rudderAngle.toFixed(0)}° STBD` : `${Math.abs(d.rudderAngle).toFixed(0)}° PORT`));
    set('inst-rot',         (d.rot >= 0 ? '+' : '') + d.rot.toFixed(1) + '°/min');
    set('inst-stw',         d.speedLog.toFixed(1) + ' kn');
    set('inst-sog',         d.speedOG.toFixed(1)  + ' kn');
    set('inst-cog',         this.formatHeading(d.courseOG));
    set('inst-lat',         this.formatLat(d.lat));
    set('inst-lon',         this.formatLon(d.lon));
    set('inst-depth-keel',  d.depthKeel.toFixed(1) + ' m');
    set('inst-depth-surf',  d.depthSurface.toFixed(1) + ' m');
    set('inst-wind-true',   d.windSpeedTrue.toFixed(1) + ' kn / ' + this.formatHeading(d.windDirTrue));
    set('inst-wind-rel',    d.windSpeedRel.toFixed(1)  + ' kn / ' + this.formatHeading(d.windDirRel));
    set('inst-air-temp',    d.airTemp.toFixed(1) + ' °C');
    set('inst-sea-temp',    d.seaTemp.toFixed(1) + ' °C');
    set('inst-pressure',    d.pressure.toFixed(0) + ' hPa');
    set('inst-humidity',    d.humidity.toFixed(0) + ' %');
    set('inst-vis',         d.visibility.toFixed(1) + ' nm');
    set('inst-wave',        d.waveHeight.toFixed(1) + ' m @ ' + d.wavePeriod.toFixed(0) + 's');
    set('inst-eng-order',   d.engineOrder.replace(/_/g,' '));
    set('inst-eng-resp',    d.engineResponse.replace(/_/g,' '));
    set('inst-rpm',         d.engineRpm.toFixed(0) + ' rpm');
    set('inst-fuel',        d.fuelConsumption.toFixed(1) + ' t/day');
    set('inst-ais',         d.aisTargets + ' targets');

    // Rudder indicator graphic
    this._renderRudderIndicator(d.rudderAngle);
    this._renderWindrose(d.windDirRel, d.windSpeedRel);

    // Echo sounder alarm
    const ea = document.getElementById('echo-alarm');
    if (ea) ea.classList.toggle('alarm-active', d.echoSounderAlarm);
  }

  _renderRudderIndicator(angle) {
    const canvas = document.getElementById('rudder-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, 36, Math.PI, 2 * Math.PI);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Scale marks
    for (let a = -35; a <= 35; a += 5) {
      const rad = (a / 35) * (Math.PI / 2) + Math.PI * 1.5;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const len = (a % 10 === 0) ? 10 : 6;
      ctx.beginPath();
      ctx.moveTo(cx + cos * 36, cy + sin * 36);
      ctx.lineTo(cx + cos * (36 - len), cy + sin * (36 - len));
      ctx.strokeStyle = '#556';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Needle
    const rad = (angle / 35) * (Math.PI / 2) + Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * 30, cy + Math.sin(rad) * 30);
    ctx.strokeStyle = angle > 5 ? '#0ff' : angle < -5 ? '#f80' : '#0f0';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Centre dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#888';
    ctx.fill();
  }

  _renderWindrose(relDir, speed) {
    const canvas = document.getElementById('windrose-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 6;
    ctx.clearRect(0, 0, w, h);

    // Circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Cardinal points
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    dirs.forEach((d, i) => {
      const a = (i * 45 - 90) * Math.PI / 180;
      ctx.fillStyle = '#446';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d, cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    });

    // Arrow for relative wind direction
    const arrowRad = (relDir - 90) * Math.PI / 180;
    const arrowLen = r * 0.65;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(arrowRad) * arrowLen, cy + Math.sin(arrowRad) * arrowLen);
    ctx.strokeStyle = '#0af';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Arrowhead
    const ax = cx + Math.cos(arrowRad) * arrowLen;
    const ay = cy + Math.sin(arrowRad) * arrowLen;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(arrowRad - 0.4) * 8, ay - Math.sin(arrowRad - 0.4) * 8);
    ctx.lineTo(ax - Math.cos(arrowRad + 0.4) * 8, ay - Math.sin(arrowRad + 0.4) * 8);
    ctx.closePath();
    ctx.fillStyle = '#0af';
    ctx.fill();

    // Speed label
    ctx.fillStyle = '#0af';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(speed.toFixed(0) + 'kn', cx, cy + r + 2);
  }
}
