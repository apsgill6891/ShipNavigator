// js/main.js — Ship Navigator Simulator Core
import * as THREE from 'three';
import { Water }              from 'three/addons/objects/Water.js';
import { Sky }                from 'three/addons/objects/Sky.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { LOCATIONS, SHIP_TYPES } from './locations.js';
import { ROR_SCENARIOS, SOUND_SIGNALS } from './scenarios.js';
import { AudioSystem }        from './audio.js';
import { VHFSystem }          from './vhf.js';
import { RadarSystem }        from './radar.js';
import { InstrumentSystem }   from './instruments.js';
import { buildTrafficShipMesh, buildForedeckMesh } from './shipModels.js';
import { ECDISSystem }         from './ecdis.js';

const NM = 1852;

// ══════════════════════════════════════════════════════════════════════════════
// OWN SHIP
// ══════════════════════════════════════════════════════════════════════════════
class OwnShip {
  constructor(type) {
    this.type        = SHIP_TYPES.find(t => t.id === type) || SHIP_TYPES[0];
    this.position    = new THREE.Vector3(0, 0, 0); // bridge position
    this.heading     = 90;
    this.speed       = 0;
    this.rudderAngle = 0;  // -35 to +35
    this.rot         = 0;  // rate of turn deg/min
    this.rpm         = 0;
    this.velocity    = new THREE.Vector3();
    this.engineOrder  = 'STOP';
    this.engineResponse='STOP';
    this.aisTargetCount = 0;

    // Engine orders
    this._orders = ['FULL_ASTERN','HALF_ASTERN','SLOW_ASTERN','DEAD_SLOW_ASTERN','STOP',
                    'DEAD_SLOW_AHEAD','SLOW_AHEAD','HALF_AHEAD','FULL_AHEAD'];
    this._orderIdx  = 4; // STOP
    this._targetSpeed = 0;
    this._engineLag   = 0; // seconds lag
  }

  setEngineOrder(order) {
    const idx = this._orders.indexOf(order);
    if (idx < 0) return;
    this._orderIdx   = idx;
    this.engineOrder = order;
    this._engineLag  = 30; // 30s response lag
    const speedTable = {
      FULL_AHEAD: this.type.maxSpeed,
      HALF_AHEAD: this.type.maxSpeed * 0.6,
      SLOW_AHEAD: this.type.maxSpeed * 0.35,
      DEAD_SLOW_AHEAD: this.type.maxSpeed * 0.15,
      STOP: 0,
      DEAD_SLOW_ASTERN: -this.type.maxSpeed * 0.1,
      SLOW_ASTERN: -this.type.maxSpeed * 0.2,
      HALF_ASTERN: -this.type.maxSpeed * 0.35,
      FULL_ASTERN: -this.type.maxSpeed * 0.5,
    };
    this._targetSpeed = speedTable[order] || 0;
    this.engineResponse = order;
  }

  orderAhead()  { if (this._orderIdx < this._orders.length - 1) this.setEngineOrder(this._orders[this._orderIdx + 1]); }
  orderAstern() { if (this._orderIdx > 0)                       this.setEngineOrder(this._orders[this._orderIdx - 1]); }

  applyHelm(delta) {
    this.rudderAngle = Math.max(-35, Math.min(35, this.rudderAngle + delta));
  }

  setHelm(angle) {
    this.rudderAngle = Math.max(-35, Math.min(35, angle));
  }

  update(dt, env = null) {
    // Speed with realistic engine lag and stopping
    if (this._engineLag > 0) this._engineLag -= dt;
    const speedDiff = this._targetSpeed - this.speed;
    // Stopping uses realistic deceleration; acceleration is slower
    const stopAccel = (this.type.maxSpeed * NM / 3600) ** 2 / (2 * this.type.stopDistNM * NM); // m/s²
    const stopAccelKn = stopAccel * 3600 / NM; // knots/s
    const accelKnS = this.type.maxSpeed / (this.type.engineLag * 2);
    const rate = speedDiff > 0 ? accelKnS : stopAccelKn;
    this.speed += Math.sign(speedDiff) * Math.min(Math.abs(rate * dt), Math.abs(speedDiff));
    this.rpm = Math.abs(this.speed / this.type.maxSpeed) * 120;

    // ROT: first-order lag — actual ROT approaches target ROT with time constant = steeringLag
    const speedRatio = Math.min(1, Math.abs(this.speed) / Math.max(this.type.maxSpeed, 0.1));
    // Higher low-speed rudder authority so helm orders are clearly visible in training mode.
    const rudderAuthority = THREE.MathUtils.lerp(0.75, 1.3, speedRatio);
    const lowSpeedBoost = THREE.MathUtils.lerp(2.8, 1.0, speedRatio);
    const sensitivityBoost = 1.8;
    const targetROT = (this.rudderAngle / 35) * this.type.turnRate * rudderAuthority * lowSpeedBoost * sensitivityBoost * Math.sign(this.speed || 1);
    const clampedTargetROT = THREE.MathUtils.clamp(targetROT, -35, 35);
    const lagTC = Math.max(1.2, this.type.steeringLag * 0.45); // more responsive helm
    this.rot += (clampedTargetROT - this.rot) * Math.min(1, dt / lagTC);
    this.heading = (this.heading + (this.rot / 60) * dt + 360) % 360;

    const speedMS = this.speed * NM / 3600;
    this.velocity.set(
      speedMS * Math.sin(this.heading * Math.PI / 180),
      0,
      -speedMS * Math.cos(this.heading * Math.PI / 180)
    );

    const currentVector = ShipNavigatorSimulator.currentVectorFromEnv(env);
    this.velocity.add(currentVector);
    this.position.addScaledVector(this.velocity, dt);
    this.position.y = this.type.bridgeHeight;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TRAFFIC SHIP (AI)
// ══════════════════════════════════════════════════════════════════════════════
class TrafficShip {
  constructor(def, id) {
    this.id       = id;
    this.name     = def.name;
    this.callsign = def.callsign;
    this.type     = def.type;
    this.heading  = def.hdg;
    this.speed    = def.spd;
    this.status   = def.status || 'underway';
    this.position = new THREE.Vector3(def.x, 0, def.z);
    this.mesh     = null;
    this._wanderTimer = Math.random() * 120;
    this._originalHdg = def.hdg;
  }

  update(dt, env = null) {
    if (this.status !== 'underway') {
      this.position.addScaledVector(ShipNavigatorSimulator.currentVectorFromEnv(env), dt);
      return;
    }

    // Slight wandering
    this._wanderTimer -= dt;
    if (this._wanderTimer < 0) {
      this.heading = (this._originalHdg + (Math.random() - 0.5) * 20 + 360) % 360;
      this._wanderTimer = 60 + Math.random() * 120;
    }

    const speedMS = this.speed * NM / 3600;
    this.position.x += speedMS * Math.sin(this.heading * Math.PI / 180) * dt;
    this.position.z -= speedMS * Math.cos(this.heading * Math.PI / 180) * dt;
    this.position.addScaledVector(ShipNavigatorSimulator.currentVectorFromEnv(env), dt);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// WEATHER
// ══════════════════════════════════════════════════════════════════════════════
class WeatherSystem {
  constructor() {
    this.fog         = 0;
    this.rain        = 0;
    this.windSpeed   = 10;
    this.windDirection = 45;
    this.waveHeight  = 0.5;
    this.wavePeriod  = 7;
    this.visibility  = 10;
    this.airTemp     = 22;
    this.seaTemp     = 20;
    this.pressure    = 1012;
    this.humidity    = 70;
    this.current     = { speed: 0, direction: 0 };
    this._rainParticles = null;
    this._fogLayer   = null;
    this._scene      = null;
  }

  init(scene) {
    this._scene = scene;
    this._createRainParticles(scene);
    this._createFogLayer(scene);
  }

  _createRainParticles(scene) {
    const count = 3000;
    const positions = new Float32Array(count * 6); // 2 points per line
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 1600;
      const y = Math.random() * 180;
      const z = (Math.random() - 0.5) * 1600;
      positions[i * 6]     = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x + 1.5;  // wind drift
      positions[i * 6 + 4] = y - 4;    // streak length
      positions[i * 6 + 5] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xaabbdd, transparent: true, opacity: 0, linewidth: 1 });
    this._rainParticles = new THREE.LineSegments(geo, mat);
    scene.add(this._rainParticles);
  }

  _createFogLayer(scene) {
    // Fog is handled via THREE.FogExp2 on the scene
  }

  setFog(level, scene) {
    this.fog = level;
    this.visibility = Math.max(0.05, 10 * (1 - level));
    if (level > 0.1) {
      const density = 0.00005 + level * 0.0012;
      scene.fog = new THREE.FogExp2(0xc8d8e0, density);
    } else {
      scene.fog = new THREE.FogExp2(0x87ceeb, 0.000008);
    }
  }

  setRain(level, audio) {
    this.rain = level;
    if (this._rainParticles) {
      this._rainParticles.material.opacity = level * 0.7;
    }
    if (audio) {
      if (level > 0.1 && !audio.rainNode) audio.startRain(level);
      else if (level <= 0.1 && audio.rainNode) audio.stopRain();
      else if (audio.rainNode) audio.setRainIntensity(level);
    }
    this.windSpeed = 8 + level * 25;
    this.waveHeight = 0.3 + level * 4;
  }

  updateRainParticles(camera, dt) {
    if (!this._rainParticles || this.rain < 0.05) return;
    const pos = this._rainParticles.geometry.attributes.position;
    const windX = Math.sin(this.windDirection * Math.PI / 180) * this.windSpeed * 0.3;
    for (let i = 0; i < pos.count / 2; i++) {
      const base = i * 6;
      pos.array[base + 1] -= (60 + this.windSpeed * 2) * dt;
      pos.array[base]     += windX * dt;
      pos.array[base + 4] -= (60 + this.windSpeed * 2) * dt;
      pos.array[base + 3] += windX * dt;
      if (pos.array[base + 1] < -5) {
        const x = camera.position.x + (Math.random() - 0.5) * 1600;
        const y = camera.position.y + 150 + Math.random() * 30;
        const z = camera.position.z + (Math.random() - 0.5) * 1600;
        pos.array[base]     = x;
        pos.array[base + 1] = y;
        pos.array[base + 2] = z;
        pos.array[base + 3] = x + 1.5;
        pos.array[base + 4] = y - 4;
        pos.array[base + 5] = z;
      }
    }
    pos.needsUpdate = true;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SIMULATOR
// ══════════════════════════════════════════════════════════════════════════════
class ShipNavigatorSimulator {
  static currentVectorFromEnv(env) {
    if (!env?.current?.speed) return new THREE.Vector3();
    const dirRad = (env.current.direction || 0) * Math.PI / 180;
    const speedMS = env.current.speed * NM / 3600;
    return new THREE.Vector3(
      speedMS * Math.sin(dirRad),
      0,
      -speedMS * Math.cos(dirRad)
    );
  }

  constructor() {
    this.renderer   = null;
    this.scene      = null;
    this.camera     = null;
    this.controls   = null;
    this.water      = null;
    this.sky        = null;
    this.sun        = new THREE.Vector3();

    this.ownShip    = null;
    this.trafficShips = [];
    this.buoyMeshes = [];
    this.landMeshes = [];

    this.audio      = new AudioSystem();
    this.vhf        = new VHFSystem(this.audio);
    this.radar      = new RadarSystem();
    this.ecdis      = new ECDISSystem();
    this.instruments= new InstrumentSystem();
    this.weather    = new WeatherSystem();

    this.currentLocation = null;
    this.selectedShipType= 'cargo';
    this.currentScenario = null;

    this.simTime    = 12 * 3600; // seconds from midnight (noon start)
    this.simTimeSpeed = 60;       // 1 real second = 1 sim minute
    this.paused     = false;

    this._clock     = new THREE.Clock();
    this._fogSignalActive = false;
    this._mouseDown = false;
    this._prevMouseX = 0;
    this._prevMouseY = 0;
    this._pitch = 0;
    this._yaw   = 0;
    this._lastHeading = 0; // tracks heading for camera yaw delta
    this._helm  = { left: false, right: false };
    this._bridge = null; // bridge mesh group
    this._deckMesh = null;
    this._keyState = {};
    this._binoculars = false;
    this._mouseSensitivity = 0.2;
    this._bridgeGroup = null;
    this._wakeLine = null;
    this._wakeTrail = [];
    this._wakeSampleTimer = 0;
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  async init(locationId, shipTypeId) {
    this.selectedShipType = shipTypeId;
    const loc = LOCATIONS.find(l => l.id === locationId) || LOCATIONS[0];
    this.currentLocation  = loc;

    // Show progress
    this._setProgress(10, 'Initialising renderer…');
    await this._tick();

    // Renderer
    const canvas = document.getElementById('bridge-view');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.000008);

    // Camera (bridge eye position)
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.5, 250000);

    this._setProgress(20, 'Setting up ship…');
    await this._tick();

    // Own ship
    const shipType = SHIP_TYPES.find(t => t.id === shipTypeId) || SHIP_TYPES[0];
    this.ownShip = new OwnShip(shipTypeId);
    this.ownShip.position.set(loc.startPos.x, shipType.bridgeHeight, loc.startPos.z);
    this.ownShip.heading = loc.startHeading;
    this.ownShip.setEngineOrder('STOP');
    // Start at slow ahead after 3s
    setTimeout(() => {
      const order = loc.startSpeed > 14 ? 'FULL_AHEAD' : loc.startSpeed > 8 ? 'HALF_AHEAD' : 'SLOW_AHEAD';
      this.ownShip.setEngineOrder(order);
    }, 3000);

    // Camera starts at bridge
    this.camera.position.copy(this.ownShip.position);
    this._yaw = loc.startHeading;
    this._lastHeading = loc.startHeading;
    this._pitch = -10; // look slightly down to see the foredeck ahead

    this._setProgress(30, 'Building ocean…');
    await this._tick();
    this._createWater();
    this._createWakeEffect();

    this._setProgress(40, 'Building sky…');
    await this._tick();
    this._createSky();
    this._updateSun();

    this._setProgress(50, 'Adding terrain…');
    await this._tick();
    this._createTerrain(loc);

    this._setProgress(60, 'Placing buoys…');
    await this._tick();
    this._createBuoys(loc);

    this._setProgress(65, 'Spawning traffic…');
    await this._tick();
    this._createTraffic(loc);

    this._setProgress(70, 'Building bridge interior…');
    await this._tick();
    this._createBridgeInterior(shipType);
    this._createForedeck(shipType);

    this._setProgress(80, 'Initialising systems…');
    await this._tick();

    // Weather
    this.weather.current = { speed: loc.current.speed, direction: loc.current.direction };
    this.weather.init(this.scene);

    // ECDIS
    this.ecdis.init('ecdis-canvas', loc);

    // Radar
    this.radar.init('radar-canvas');
    this.radar.onTargetUpdate = (targets) => {
      document.getElementById('arpa-count').textContent = targets.length + ' targets';
      this.ownShip.aisTargetCount = targets.length;
    };

    // Instruments
    this.instruments.setLocation(loc);

    // Audio
    this.audio.init();

    // VHF
    this.vhf.init(shipType.name, 'OWN_VESSEL', loc.id);
    this.vhf.onMessage = (msg, onCurrentChannel) => {
      this._addVHFMessage(msg, onCurrentChannel);
    };

    // Lighting
    this._setProgress(90, 'Lighting…');
    await this._tick();
    this._createLights();

    // Controls
    this._setupControls();
    this._setupUI(loc, shipType);

    this._setProgress(100, 'Ready!');
    await this._tick();
    await new Promise(r => setTimeout(r, 400));

    // Hide loading screen
    document.getElementById('loading-screen').style.display = 'none';

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  // ── Water ───────────────────────────────────────────────────────────────────
  _createWater() {
    const geo = new THREE.PlaneGeometry(200000, 200000);
    const loader = new THREE.TextureLoader();
    const waterNormals = loader.load(
      'https://threejs.org/examples/textures/waternormals.jpg',
      t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    );
    this.water = new Water(geo, {
      textureWidth:  512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e4e,
      distortionScale: 3.7,
      fog: this.scene.fog !== undefined,
    });
    this.water.rotation.x = -Math.PI / 2;
    this.scene.add(this.water);
  }

  _createWakeEffect() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this._wakeLine = new THREE.Line(geo, mat);
    this._wakeLine.frustumCulled = false;
    this.scene.add(this._wakeLine);
  }

  // ── Sky ─────────────────────────────────────────────────────────────────────
  _createSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value     = 5;
    skyUniforms['rayleigh'].value      = 2;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;
  }

  _updateSun() {
    const hours  = (this.simTime % 86400) / 3600;
    const elevation = -90 + hours * (180 / 24); // -90° midnight, +90° noon
    const azimuth   = hours * 15; // rotate around
    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sun.setFromSphericalCoords(1, phi, theta);

    if (this.sky) this.sky.material.uniforms['sunPosition'].value.copy(this.sun);
    if (this.water) this.water.material.uniforms['sunDirection'].value.copy(this.sun).normalize();

    // Ambient light
    if (this._ambientLight) {
      const dayFactor = Math.max(0, Math.min(1, (elevation + 6) / 12));
      const nightColor = new THREE.Color(0x112244);
      const dayColor   = new THREE.Color(0xffeedd);
      this._ambientLight.color.lerpColors(nightColor, dayColor, dayFactor);
      this._ambientLight.intensity = 0.1 + dayFactor * 0.6;
    }
    if (this._dirLight) {
      this._dirLight.position.copy(this.sun).multiplyScalar(150000);
      const elev = Math.max(0, elevation);
      this._dirLight.intensity = elev / 90 * 1.5;
    }
    // Sky darkness at night
    if (this.sky) {
      const rayleigh = elevation > 0 ? 2 : Math.max(0, 2 + elevation / 6);
      this.sky.material.uniforms['rayleigh'].value = rayleigh;
    }
    // Stars visible at night
    if (this._stars) this._stars.visible = elevation < -5;
    // Moon: opposite to sun + offset
    if (this._moon) {
      const moonPhi = THREE.MathUtils.degToRad(90 - (-elevation + 10));
      const moonTheta = THREE.MathUtils.degToRad(azimuth + 180);
      const moonPos = new THREE.Vector3();
      moonPos.setFromSphericalCoords(180000, moonPhi, moonTheta);
      this._moon.position.copy(moonPos);
      this._moon.visible = elevation < -5;
    }
    // Renderer exposure
    if (this.renderer) {
      this.renderer.toneMappingExposure = elevation > 0 ? 0.8 : Math.max(0.1, 0.8 + elevation * 0.05);
    }
  }

  // ── Lights ──────────────────────────────────────────────────────────────────
  _createLights() {
    // Strong ambient so ship hull is always visible
    this._ambientLight = new THREE.AmbientLight(0xddeeff, 1.4);
    this.scene.add(this._ambientLight);

    // Sun directional (intensity driven by time of day)
    this._dirLight = new THREE.DirectionalLight(0xfff5e0, 1.5);
    this._dirLight.castShadow = false;
    this.scene.add(this._dirLight);

    // Hemisphere sky/ground fill
    const hemi = new THREE.HemisphereLight(0x88bbdd, 0x446633, 0.7);
    this.scene.add(hemi);

    // Fixed forward fill — illuminates the foredeck/bow from camera direction
    const fill = new THREE.DirectionalLight(0xaaccee, 0.6);
    fill.position.set(0, 0.4, -1).normalize();
    this.scene.add(fill);

    // Upward fill (bounce light from sea)
    const seaBounce = new THREE.DirectionalLight(0x224466, 0.3);
    seaBounce.position.set(0, -1, 0).normalize();
    this.scene.add(seaBounce);

    // Stars + Moon
    this._createStars();
  }

  _createStars() {
    const count = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const r     = 200000;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 5000;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 80, sizeAttenuation: true, transparent: true, opacity: 0.9 });
    this._stars = new THREE.Points(geo, mat);
    this._stars.visible = false;
    this.scene.add(this._stars);
    this._createMoon();
  }

  _createMoon() {
    const geo = new THREE.SphereGeometry(3000, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffee });
    this._moon = new THREE.Mesh(geo, mat);
    this._moon.visible = false;
    this.scene.add(this._moon);
  }

  // ── Terrain ─────────────────────────────────────────────────────────────────
  _createTerrain(loc) {
    for (const lt of loc.terrain) {
      if (lt.outline.length < 3) continue;
      const shape = new THREE.Shape();
      shape.moveTo(lt.outline[0][0], lt.outline[0][1]);
      for (let i = 1; i < lt.outline.length; i++) shape.lineTo(lt.outline[i][0], lt.outline[i][1]);
      shape.closePath();

      const extruded = new THREE.ExtrudeGeometry(shape, { depth: lt.height, bevelEnabled: false });
      // Shape is in XY plane (x=east, y=south on shape); rotate to lie flat
      extruded.rotateX(-Math.PI / 2);
      // After rotation: shape's X=X, shape's Y=Z_world, extrude goes Y_world up
      // But the extrude depth goes -Y before rotation = +Z after rotation — we need it going up (+Y)
      // Correct: rotate X by -90, extrude's depth becomes +Y
      const mat = new THREE.MeshLambertMaterial({ color: lt.color });
      const mesh = new THREE.Mesh(extruded, mat);
      mesh.position.y = -2; // slight under sea level so shore blends
      this.scene.add(mesh);
      this.landMeshes.push(mesh);
    }
  }

  // ── Buoys ───────────────────────────────────────────────────────────────────
  _createBuoys(loc) {
    const isRegionA = loc.region === 'IALA_A';
    const colors = {
      port:     isRegionA ? 0xff0000 : 0x00cc00,
      stbd:     isRegionA ? 0x00cc00 : 0xff0000,
      N:        0x000000, // black (yellow band)
      S:        0xffff00,
      E:        0x000000,
      W:        0xffff00,
      safe:     0xff3366,
      danger:   0x000000,
      isolated: 0x000000,
      special:  0xffcc00,
    };
    const lightColors = {
      port: 0xff0000, stbd: 0x00ff00,
      N: 0xffffff, S: 0xffffff, E: 0xffffff, W: 0xffffff,
      safe: 0xff3366, danger: 0xffffff, isolated: 0xffffff, special: 0xffff00,
    };

    for (const b of loc.buoys) {
      const group = new THREE.Group();
      group.position.set(b.x, 0, b.z);

      // Body (cylinder for can, cone for conical)
      const isConical = (b.type === 'stbd' && isRegionA) || (b.type === 'port' && !isRegionA);
      let bodyGeo;
      if (isConical) {
        bodyGeo = new THREE.ConeGeometry(0.8, 3.5, 8);
      } else {
        bodyGeo = new THREE.CylinderGeometry(0.8, 0.8, 3.5, 8);
      }
      const bodyMat = new THREE.MeshLambertMaterial({ color: colors[b.type] || 0xff8800 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 2.5;
      group.add(body);

      // Mooring chain
      const chainGeo = new THREE.CylinderGeometry(0.15, 0.15, 10, 4);
      const chainMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const chain = new THREE.Mesh(chainGeo, chainMat);
      chain.position.y = -4;
      group.add(chain);

      // Light on top
      const lightGeo = new THREE.SphereGeometry(0.5, 8, 8);
      const lightMat = new THREE.MeshBasicMaterial({ color: lightColors[b.type] || 0xffffff });
      const lightMesh = new THREE.Mesh(lightGeo, lightMat);
      lightMesh.position.y = 4.5;
      group.add(lightMesh);

      // Flashing point light
      const ptLight = new THREE.PointLight(lightColors[b.type] || 0xffffff, 1, 300);
      ptLight.position.y = 4.5;
      group.add(ptLight);
      group.userData.light = ptLight;
      group.userData.flashPhase = Math.random() * Math.PI * 2;
      group.userData.buoyType = b.type;

      // Label
      group.userData.label = b.label;
      group.userData.racon = b.racon;

      this.scene.add(group);
      this.buoyMeshes.push(group);
    }
  }

  // ── Traffic Ships ────────────────────────────────────────────────────────────
  _createTraffic(loc) {
    loc.traffic.forEach((def, i) => {
      const ts = new TrafficShip(def, `traffic_${i}`);
      const mesh = buildTrafficShipMesh(def.type);
      mesh.position.set(ts.position.x, 0, ts.position.z);
      mesh.rotation.y = -def.hdg * Math.PI / 180;
      this.scene.add(mesh);
      ts.mesh = mesh;
      this.trafficShips.push(ts);
    });
  }

  _buildShipMesh(typeId, isOwn = false) {
    const type = SHIP_TYPES.find(t => t.id === typeId) || SHIP_TYPES[0];
    const group = new THREE.Group();
    const loa = type.loa, beam = type.beam;

    // Hull
    const hullGeo = new THREE.BoxGeometry(beam, type.draft * 0.3, loa);
    const hullMat = new THREE.MeshLambertMaterial({ color: type.color });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = type.draft * 0.15;
    group.add(hull);

    // Superstructure
    const ssW = beam * 0.5, ssH = type.bridgeHeight * 0.7, ssL = loa * 0.15;
    const ssGeo = new THREE.BoxGeometry(ssW, ssH, ssL);
    const ssMat = new THREE.MeshLambertMaterial({ color: 0xddddcc });
    const ss = new THREE.Mesh(ssGeo, ssMat);
    ss.position.set(0, type.draft * 0.15 + ssH / 2, loa * 0.15);
    group.add(ss);

    // Mast
    const mastGeo = new THREE.CylinderGeometry(0.3, 0.3, type.bridgeHeight * 0.6, 6);
    const mastMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, type.bridgeHeight * 0.15 + type.bridgeHeight * 0.3, loa * 0.15);
    group.add(mast);

    // Navigation lights
    this._addNavLights(group, type);

    // Set depth in water
    group.position.y = -type.draft * 0.15;

    return group;
  }

  _addNavLights(group, type) {
    const addLight = (color, x, y, z, intensity, distance) => {
      const geo = new THREE.SphereGeometry(0.3, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      group.add(mesh);
      const light = new THREE.PointLight(color, intensity, distance);
      light.position.set(x, y, z);
      group.add(light);
    };
    const h = type.bridgeHeight;
    // Masthead white
    addLight(0xffffff, 0, h + 5, type.loa * 0.1, 0.8, 600);
    // Sidelights
    addLight(0xff4400, -type.beam / 2, h * 0.6, type.loa * 0.12, 0.6, 500); // port red
    addLight(0x44ff44,  type.beam / 2, h * 0.6, type.loa * 0.12, 0.6, 500); // stbd green
    // Stern white
    addLight(0xffffff, 0, h * 0.6, -type.loa * 0.48, 0.5, 400);
  }

  // ── Bridge Interior ──────────────────────────────────────────────────────────
  _createBridgeInterior(shipType) {
    // Bridge interior is rendered entirely via CSS overlay (#bridge-frame).
    // No 3D geometry needed — avoids clipping artifacts with camera.
    this._bridgeGroup = null;
    return;
    // eslint-disable-next-line no-unreachable
    const bw = Math.min(shipType.beam * 0.85, 30); // (dead code kept for reference)
    const g = new THREE.Group();

    const steel  = new THREE.MeshLambertMaterial({ color: 0x2a3a4a });
    const glass  = new THREE.MeshLambertMaterial({ color: 0x4a7a9a, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const deckMat   = new THREE.MeshLambertMaterial({ color: 0x1a2230 });
    const instr  = new THREE.MeshLambertMaterial({ color: 0x0d1520 });

    // Floor of bridge (1m below eye)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bw + 4, 0.2, 8), deckMat);
    floor.position.set(0, -1, 0);
    g.add(floor);

    // Forward console / dashboard
    const consoleH = 0.9;
    const console1 = new THREE.Mesh(new THREE.BoxGeometry(bw, consoleH, 0.6), instr);
    console1.position.set(0, -1 + consoleH / 2, -1.8);
    g.add(console1);

    // Console top face
    const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.05, 0.6), new THREE.MeshLambertMaterial({ color: 0x1a2a3a }));
    consoleTop.position.set(0, -1 + consoleH + 0.025, -1.8);
    g.add(consoleTop);

    // Radar display on console
    const radDisp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), new THREE.MeshLambertMaterial({ color: 0x003300, emissive: 0x004400 }));
    radDisp.position.set(-1.5, -0.05, -1.8);
    g.add(radDisp);

    // Chart table on console
    const chart = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.5), new THREE.MeshLambertMaterial({ color: 0x002244, emissive: 0x001122 }));
    chart.position.set(1.2, -0.05, -1.8);
    g.add(chart);

    // Forward window frames — 5 window panes across
    const winH = 2.2;
    const winY = -1 + consoleH + 0.15;
    const frameW = bw / 5;
    for (let i = 0; i < 5; i++) {
      const wx = -bw / 2 + frameW / 2 + i * frameW;
      // Glass pane
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(frameW - 0.12, winH), glass);
      pane.position.set(wx, winY + winH / 2, -2.2);
      g.add(pane);
      // Vertical frame post (between panes)
      if (i > 0) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH + 0.3, 0.15), steel);
        post.position.set(-bw / 2 + i * frameW, winY + winH / 2, -2.2);
        g.add(post);
      }
    }

    // Outer window frame posts (A-pillars)
    [-bw / 2, bw / 2].forEach(px => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, winH + 0.3, 0.2), steel);
      post.position.set(px, winY + winH / 2, -2.2);
      g.add(post);
    });

    // Horizontal sill rail
    const sill = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, 0.15, 0.2), steel);
    sill.position.set(0, winY - 0.07, -2.2);
    g.add(sill);

    // Horizontal header rail
    const hdr = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.3, 0.2, 0.2), steel);
    hdr.position.set(0, winY + winH + 0.1, -2.2);
    g.add(hdr);

    // Ceiling
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(bw + 4, 0.2, 8), new THREE.MeshLambertMaterial({ color: 0x1e2a38 }));
    ceiling.position.set(0, winY + winH + 0.2, 0);
    g.add(ceiling);

    // Side walls (partial — port and stbd)
    [-bw / 2 - 0.15, bw / 2 + 0.15].forEach((sx, si) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.25, winH + 1, 8), steel);
      sw.position.set(sx, winY + winH / 2, 0);
      g.add(sw);
      // Side window glass
      const spane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, winH), glass);
      spane.rotation.y = (si === 0 ? 1 : -1) * Math.PI / 2;
      spane.position.set(sx, winY + winH / 2, -0.5);
      g.add(spane);
    });

    // Compass binnacle
    const binn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.8, 12), new THREE.MeshLambertMaterial({ color: 0x8a7050 }));
    binn.position.set(0, -0.6, -1.3);
    g.add(binn);
    const compassTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    compassTop.position.set(0, -0.2, -1.3);
    g.add(compassTop);

    // Nav light indicator panel on overhead console
    const navPanel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    navPanel.position.set(bw / 2 - 0.5, winY + winH + 0.15, -1.5);
    g.add(navPanel);

    this._bridgeGroup = g;
    this.scene.add(g);
  }

  _createForedeck(shipType) {
    const group = buildForedeckMesh(shipType.id);
    this._deckMesh = group;
    this.scene.add(group);
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  _setupControls() {
    const canvas = document.getElementById('bridge-view');

    // Mouse look — drag to look around
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this._mouseDown = true;
        this._prevMouseX = e.clientX;
        this._prevMouseY = e.clientY;
      }
    });
    canvas.addEventListener('mouseup', () => { this._mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!this._mouseDown) return;
      const dx = e.clientX - this._prevMouseX;
      const dy = e.clientY - this._prevMouseY;
      this._yaw   = (this._yaw   + dx * (this._mouseSensitivity || 0.2) + 360) % 360;
      this._pitch = Math.max(-40, Math.min(30, this._pitch - dy * (this._mouseSensitivity || 0.2) * 0.75));
      this._prevMouseX = e.clientX;
      this._prevMouseY = e.clientY;
    });

    // Touch look
    let lastTouch = null;
    canvas.addEventListener('touchstart', (e) => { lastTouch = e.touches[0]; });
    canvas.addEventListener('touchmove', (e) => {
      if (!lastTouch || !e.touches[0]) return;
      const dx = e.touches[0].clientX - lastTouch.clientX;
      const dy = e.touches[0].clientY - lastTouch.clientY;
      this._yaw   = (this._yaw   + dx * (this._mouseSensitivity || 0.2) + 360) % 360;
      this._pitch = Math.max(-40, Math.min(30, this._pitch - dy * (this._mouseSensitivity || 0.2) * 0.75));
      lastTouch = e.touches[0];
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this._keyState[e.key] = true;
      this._handleKey(e.key);
    });
    window.addEventListener('keyup', (e) => { this._keyState[e.key] = false; });

    // Helm buttons
    document.getElementById('helm-port')?.addEventListener('mousedown',  () => { this._helm.left  = true; });
    document.getElementById('helm-stbd')?.addEventListener('mousedown',  () => { this._helm.right = true; });
    document.getElementById('helm-port')?.addEventListener('mouseup',    () => { this._helm.left  = false; });
    document.getElementById('helm-stbd')?.addEventListener('mouseup',    () => { this._helm.right = false; });
    document.getElementById('helm-midships')?.addEventListener('click',  () => { this.ownShip.setHelm(0); });
    document.getElementById('helm-hard-port')?.addEventListener('click', () => { this.ownShip.setHelm(-35); });
    document.getElementById('helm-hard-stbd')?.addEventListener('click', () => { this.ownShip.setHelm(35); });

    // Engine telegraph
    document.getElementById('eng-ahead')?.addEventListener('click',    () => { this.ownShip.orderAhead();  this._updateTelegraph(); });
    document.getElementById('eng-astern')?.addEventListener('click',   () => { this.ownShip.orderAstern(); this._updateTelegraph(); });

    // Radar controls
    document.getElementById('radar-range-up')?.addEventListener('click',   () => { this.radar.rangeUp(); });
    document.getElementById('radar-range-down')?.addEventListener('click',  () => { this.radar.rangeDown(); });
    document.getElementById('radar-north-up')?.addEventListener('click',   () => { this.radar.toggleNorthUp(); });

    // ECDIS controls
    document.getElementById('ecdis-range-up')?.addEventListener('click',   () => { this.ecdis.rangeUp(); });
    document.getElementById('ecdis-range-down')?.addEventListener('click',  () => { this.ecdis.rangeDown(); });
    document.getElementById('ecdis-north-up')?.addEventListener('click',   () => { this.ecdis.toggleNorthUp(); });

    // Panel tab switching
    document.getElementById('tab-radar')?.addEventListener('click', () => {
      document.getElementById('radar-tab-content').style.display = '';
      document.getElementById('ecdis-tab-content').style.display = 'none';
      document.getElementById('tab-radar').classList.add('active');
      document.getElementById('tab-ecdis').classList.remove('active');
    });
    document.getElementById('tab-ecdis')?.addEventListener('click', () => {
      document.getElementById('radar-tab-content').style.display = 'none';
      document.getElementById('ecdis-tab-content').style.display = '';
      document.getElementById('tab-radar').classList.remove('active');
      document.getElementById('tab-ecdis').classList.add('active');
    });

    // VHF
    document.getElementById('vhf-ch-up')?.addEventListener('click',   () => {
      const ch = this.vhf.channelUp();
      this._updateVHFDisplay(ch);
    });
    document.getElementById('vhf-ch-down')?.addEventListener('click',  () => {
      const ch = this.vhf.channelDown();
      this._updateVHFDisplay(ch);
    });
    document.getElementById('vhf-ch16')?.addEventListener('click', () => {
      const ch = this.vhf.setChannel(16);
      this._updateVHFDisplay(ch);
    });
    document.getElementById('vhf-tx-btn')?.addEventListener('click', () => {
      const input = document.getElementById('vhf-input');
      if (input && input.value.trim()) {
        this.vhf.transmit(input.value.trim());
        input.value = '';
      }
    });
    document.getElementById('vhf-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('vhf-tx-btn')?.click();
    });
    document.getElementById('vhf-mayday')?.addEventListener('click', () => {
      const pos = `${this.instruments.formatLat(this.instruments.data.lat)} ${this.instruments.formatLon(this.instruments.data.lon)}`;
      this.vhf.sendMayday(pos);
    });

    // Weather controls
    document.getElementById('btn-fog')?.addEventListener('click',  () => this._toggleFog());
    document.getElementById('btn-rain')?.addEventListener('click', () => this._toggleRain());
    document.getElementById('btn-night')?.addEventListener('click',() => this._toggleNight());
    document.getElementById('btn-proc-view')?.addEventListener('click', () => this._toggleProceduralBridgeOverlay());

    // Sound signals
    document.getElementById('btn-foghorn')?.addEventListener('click', () => this.audio.playFogHorn(1));
    document.getElementById('btn-1short')?.addEventListener('click',  () => this.audio.playShortBlast(1));
    document.getElementById('btn-2short')?.addEventListener('click',  () => this.audio.playShortBlast(2));
    document.getElementById('btn-3short')?.addEventListener('click',  () => this.audio.playShortBlast(3));
    document.getElementById('btn-5short')?.addEventListener('click',  () => this.audio.playShortBlast(5));
    document.getElementById('btn-bell')?.addEventListener('click',    () => this.audio.playBell());
    document.getElementById('btn-gong')?.addEventListener('click',    () => this.audio.playGong());

    // Quick VHF presets
    document.getElementById('vhf-position')?.addEventListener('click', () => {
      const d = this.instruments.data;
      const pos = `${this.instruments.formatLat(d.lat)} ${this.instruments.formatLon(d.lon)}`;
      this.vhf.sendPositionReport(pos, d.heading, d.speedLog);
    });
    document.getElementById('vhf-securite')?.addEventListener('click', () => {
      this.vhf.sendSecurite('Navigation hazard in vicinity. All vessels keep sharp lookout.');
    });

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => this._loadScenario(btn.dataset.id));
    });
  }

  _handleKey(key) {
    switch (key) {
      case 'ArrowLeft':  case 'a': this.ownShip.applyHelm(-1); break;
      case 'ArrowRight': case 'd': this.ownShip.applyHelm( 1); break;
      case 'ArrowUp':    case 'w': this.ownShip.orderAhead();  this._updateTelegraph(); break;
      case 'ArrowDown':  case 's': this.ownShip.orderAstern(); this._updateTelegraph(); break;
      case ' ':  this.ownShip.setEngineOrder('STOP'); this._updateTelegraph(); break;
      case 'h': this.ownShip.setHelm(0); break;
      case 'f': this._toggleFog(); break;
      case 'r': this._toggleRain(); break;
      case 'n': this._toggleNight(); break;
      case 'm': this.audio.toggle(); break;
      case 'v': this._togglePanel('vhf-panel'); break;
      case 'i': this._togglePanel('instruments-panel'); break;
      case 'b': this._togglePanel('radar-panel'); break;
      case 'z': this._toggleBinoculars(); break;
    }
  }

  _toggleBinoculars() {
    this._binoculars = !this._binoculars;
    this.camera.fov = this._binoculars ? 7 : 75;
    this.camera.updateProjectionMatrix();
    const el = document.getElementById('binoculars-overlay');
    if (el) el.style.display = this._binoculars ? 'flex' : 'none';
    // Tighter mouse look in binoculars mode
    this._mouseSensitivity = this._binoculars ? 0.03 : 0.2;
  }

  // ── Weather Toggles ─────────────────────────────────────────────────────────
  _fogLevel = 0;
  _toggleFog() {
    this._fogLevel = this._fogLevel < 0.95 ? this._fogLevel + 0.3 : 0;
    this.weather.setFog(this._fogLevel, this.scene);
    if (this._fogLevel > 0.5 && !this._fogSignalActive) {
      this._fogSignalActive = true;
      this.audio.startFogSignal('underway');
    } else if (this._fogLevel <= 0.3) {
      this._fogSignalActive = false;
      this.audio.stopFogSignal();
    }
    const btn = document.getElementById('btn-fog');
    if (btn) btn.textContent = this._fogLevel > 0 ? `FOG ${Math.round(this._fogLevel*100)}%` : 'FOG';
  }

  _rainLevel = 0;
  _toggleRain() {
    this._rainLevel = this._rainLevel < 0.9 ? this._rainLevel + 0.3 : 0;
    this.weather.setRain(this._rainLevel, this.audio);
    const btn = document.getElementById('btn-rain');
    if (btn) btn.textContent = this._rainLevel > 0 ? `RAIN ${Math.round(this._rainLevel*100)}%` : 'RAIN';
  }

  _isNight = false;
  _toggleNight() {
    this._isNight = !this._isNight;
    this.simTime = this._isNight ? 0 * 3600 : 12 * 3600;
    this._updateSun();
    const btn = document.getElementById('btn-night');
    if (btn) btn.textContent = this._isNight ? 'DAY' : 'NIGHT';
  }

  _toggleProceduralBridgeOverlay() {
    const overlay = document.getElementById('bridge-procedural-overlay');
    if (!overlay) return;
    overlay.classList.toggle('off');
  }

  _updateWake(dt) {
    if (!this._wakeLine || !this.ownShip) return;

    const speed = Math.abs(this.ownShip.speed);
    const hdgRad = this.ownShip.heading * Math.PI / 180;
    const offset = (0.5 - (this.ownShip.type.bridgeZOffset || 0)) * this.ownShip.type.loa;
    const sternX = this.ownShip.position.x - Math.sin(hdgRad) * offset;
    const sternZ = this.ownShip.position.z + Math.cos(hdgRad) * offset;

    this._wakeSampleTimer += dt;
    const sampleGap = THREE.MathUtils.lerp(0.08, 0.28, Math.min(1, speed / Math.max(this.ownShip.type.maxSpeed, 1)));

    if (speed > 1.2 && this._wakeSampleTimer >= sampleGap) {
      this._wakeSampleTimer = 0;
      this._wakeTrail.push({
        x: sternX,
        z: sternZ,
        age: 0,
        strength: Math.min(1, speed / Math.max(this.ownShip.type.maxSpeed * 0.6, 1)),
      });
    }

    const maxAge = 24;
    const current = ShipNavigatorSimulator.currentVectorFromEnv(this.weather);
    const positions = [];
    for (const node of this._wakeTrail) {
      node.age += dt;
      if (node.age > maxAge) continue;
      // Slight spread and drift to mimic turbulent wake
      const spread = (1 + node.age * 0.5) * node.strength;
      node.x += current.x * dt + (Math.random() - 0.5) * 0.05 * spread;
      node.z += current.z * dt + (Math.random() - 0.5) * 0.05 * spread;
      positions.push(node.x, 0.12, node.z);
    }
    this._wakeTrail = this._wakeTrail.filter(n => n.age <= maxAge);

    this._wakeLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this._wakeLine.geometry.computeBoundingSphere();
    this._wakeLine.material.opacity = speed > 0.8 ? 0.65 : 0.25;
  }

  // ── Panel Toggle ─────────────────────────────────────────────────────────────
  _togglePanel(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('panel-collapsed');
  }

  // ── Scenario ─────────────────────────────────────────────────────────────────
  _loadScenario(id) {
    const sc = ROR_SCENARIOS.find(s => s.id === id);
    if (!sc) return;
    this.currentScenario = sc;

    // Brief
    const panel = document.getElementById('scenario-brief');
    if (panel) {
      panel.style.display = 'block';
      panel.innerHTML = `
        <div class="brief-header">RULE ${sc.rule} — ${sc.name}</div>
        <div class="brief-body">${sc.description}</div>
        <div class="brief-guidance">${sc.guidance}</div>
        <button onclick="document.getElementById('scenario-brief').style.display='none'">Close</button>
      `;
    }

    // Set weather if specified
    if (sc.setup.weather) {
      this.weather.setFog(sc.setup.weather.fog || 0, this.scene);
      this.weather.setRain(0, this.audio);
    }

    // Spawn scenario ships
    if (sc.setup.targets) {
      // Remove old scenario ships
      this.trafficShips = this.trafficShips.filter(s => !s._scenario);
      sc.setup.targets.forEach((t, i) => {
        const rangeM = t.startRange * NM;
        const bearingRad = (t.startBearing - this.ownShip.heading) * Math.PI / 180;
        const x = this.ownShip.position.x + rangeM * Math.sin(t.startBearing * Math.PI / 180);
        const z = this.ownShip.position.z - rangeM * Math.cos(t.startBearing * Math.PI / 180);
        const def = { x, z, hdg: t.heading, spd: t.speed, type: t.type || 'cargo', name: t.name, callsign: 'SCN' + i, status: t.status || 'underway' };
        const ts = new TrafficShip(def, `scenario_${i}`);
        ts._scenario = true;
        const mesh = buildTrafficShipMesh(def.type);
        mesh.position.set(ts.position.x, 0, ts.position.z);
        mesh.rotation.y = -def.hdg * Math.PI / 180;
        this.scene.add(mesh);
        ts.mesh = mesh;
        this.trafficShips.push(ts);
      });
    }
  }

  // ── UI Setup ────────────────────────────────────────────────────────────────
  _setupUI(loc, shipType) {
    document.getElementById('location-name').textContent  = loc.name;
    document.getElementById('ship-type-name').textContent = shipType.name;

    // VHF init
    this._updateVHFDisplay(16);

    // Clock
    this._updateClock();
    setInterval(() => this._updateClock(), 1000);
  }

  _updateClock() {
    const h = Math.floor((this.simTime % 86400) / 3600);
    const m = Math.floor((this.simTime % 3600) / 60);
    const s = Math.floor(this.simTime % 60);
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} UTC`;
    const el = document.getElementById('sim-time');
    if (el) el.textContent = timeStr;
  }

  _updateTelegraph() {
    const order = this.ownShip.engineOrder;
    const el = document.getElementById('telegraph-display');
    if (el) {
      el.textContent = order.replace(/_/g, ' ');
      el.className = 'telegraph-' + (order.includes('AHEAD') ? 'ahead' : order.includes('ASTERN') ? 'astern' : 'stop');
    }
    this.audio.setEngineSpeed(this.ownShip.speed);
  }

  _updateVHFDisplay(ch) {
    const chEl   = document.getElementById('vhf-channel');
    const nameEl = document.getElementById('vhf-ch-name');
    if (chEl)   chEl.textContent  = `CH ${String(ch).padStart(2, '0')}`;
    if (nameEl) nameEl.textContent = this.vhf.getChannelName(ch);
  }

  _addVHFMessage(msg, onCurrentCh) {
    const log = document.getElementById('vhf-log');
    if (!log) return;
    const cls = msg.own ? 'vhf-own' : onCurrentCh ? 'vhf-other' : 'vhf-other-ch';
    const indicator = msg.own ? '▶ TX' : `◀ ${msg.callsign}`;
    const div = document.createElement('div');
    div.className = `vhf-msg ${cls}`;
    div.innerHTML = `<span class="vhf-time">${msg.time}</span> <span class="vhf-from">[CH${msg.channel}] ${indicator}</span><br><span class="vhf-text">${msg.text}</span>`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    // Flash alert for incoming on current channel
    if (!msg.own && onCurrentCh) {
      const alert = document.getElementById('vhf-alert');
      if (alert) {
        alert.textContent = `Incoming CH${msg.channel}: ${msg.from}`;
        alert.style.display = 'block';
        setTimeout(() => { alert.style.display = 'none'; }, 4000);
      }
    }
  }

  _setProgress(pct, msg) {
    const bar  = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-msg');
    if (bar)  bar.style.width  = pct + '%';
    if (text) text.textContent = msg;
  }

  _tick() { return new Promise(r => requestAnimationFrame(r)); }

  // ── Animate ─────────────────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());
    if (this.paused) return;

    const dt = Math.min(this._clock.getDelta(), 0.1);

    // Continuous helm from held buttons
    if (this._helm.left)  this.ownShip.applyHelm(-0.3);
    if (this._helm.right) this.ownShip.applyHelm( 0.3);
    if (this._keyState['ArrowLeft']  || this._keyState['a']) this.ownShip.applyHelm(-0.3);
    if (this._keyState['ArrowRight'] || this._keyState['d']) this.ownShip.applyHelm( 0.3);

    // Update own ship
    this.ownShip.update(dt, this.weather);

    // Camera yaw tracks ship heading (bridge rotates with ship)
    const hdgDelta = this.ownShip.heading - this._lastHeading;
    // Handle wrap-around (e.g. 359 → 1 = +2, not -358)
    const wrappedDelta = ((hdgDelta + 180) % 360) - 180;
    this._yaw = (this._yaw + wrappedDelta + 360) % 360;
    this._lastHeading = this.ownShip.heading;

    // Update traffic
    for (const ts of this.trafficShips) {
      ts.update(dt, this.weather);
      if (ts.mesh) {
        ts.mesh.position.x = ts.position.x;
        ts.mesh.position.y = 0; // ship model handles own y offset (waterline at 0)
        ts.mesh.position.z = ts.position.z;
        ts.mesh.rotation.y = -ts.heading * Math.PI / 180;
      }
    }

    // Camera follows bridge
    this.camera.position.copy(this.ownShip.position);
    // Look direction from yaw/pitch
    const yawRad   = this._yaw   * Math.PI / 180;
    const pitchRad = this._pitch * Math.PI / 180;
    const lookDir = new THREE.Vector3(
      Math.sin(yawRad) * Math.cos(pitchRad),
      Math.sin(pitchRad),
      -Math.cos(yawRad) * Math.cos(pitchRad)
    );
    this.camera.lookAt(this.camera.position.clone().add(lookDir));

    // Foredeck / own-ship front view follows vessel motion and heading
    if (this._deckMesh) {
      const hdgRad = this.ownShip.heading * Math.PI / 180;
      const bzo = (this.ownShip.type.bridgeZOffset || 0) * this.ownShip.type.loa;
      this._deckMesh.position.x = this.ownShip.position.x + bzo * Math.sin(hdgRad);
      this._deckMesh.position.y = 0;
      this._deckMesh.position.z = this.ownShip.position.z - bzo * Math.cos(hdgRad);
      this._deckMesh.rotation.y = -hdgRad;
    }

    // Procedural bridge-front overlay reacts slightly with turn/helm to show motion cue
    const procOverlay = document.getElementById('bridge-procedural-overlay');
    if (procOverlay && !procOverlay.classList.contains('off')) {
      const swayPx = THREE.MathUtils.clamp(this.ownShip.rudderAngle * 0.55, -18, 18);
      const tiltDeg = THREE.MathUtils.clamp(-this.ownShip.rot * 0.08, -5, 5);
      procOverlay.style.transform = `translateX(${swayPx}px) rotateZ(${tiltDeg}deg)`;
    }

    // Bridge interior follows ship heading (not pitch/yaw); y = bridge eye height
    if (this._bridgeGroup) {
      const hdgRad = this.ownShip.heading * Math.PI / 180;
      const bzo = (this.ownShip.type.bridgeZOffset || 0) * this.ownShip.type.loa;
      this._bridgeGroup.position.x = this.ownShip.position.x + bzo * Math.sin(hdgRad);
      this._bridgeGroup.position.y = this.ownShip.position.y; // = bridgeHeight
      this._bridgeGroup.position.z = this.ownShip.position.z - bzo * Math.cos(hdgRad);
      this._bridgeGroup.rotation.y = -hdgRad;
    }

    // Water animation
    if (this.water) {
      this.water.material.uniforms['time'].value += dt;
      // Water color changes slightly with weather
      const waveH = this.weather.waveHeight;
      const col = new THREE.Color(0x001e4e).lerp(new THREE.Color(0x003366), waveH / 6);
      this.water.material.uniforms['waterColor'].value = col;
    }
    this._updateWake(dt);

    // Day/night cycle
    this.simTime += dt * this.simTimeSpeed;
    this._updateSun();

    // Buoy light flashing
    const t = Date.now() * 0.001;
    for (const b of this.buoyMeshes) {
      const flash = Math.sin(t * 2 + b.userData.flashPhase) > 0;
      if (b.userData.light) b.userData.light.intensity = flash ? 1.5 : 0;
    }

    // Weather rain particles
    this.weather.updateRainParticles(this.camera, dt);

    // Instruments
    this.instruments.update(this.ownShip, this.weather, dt);
    this.instruments.render();

    // Radar
    this.radar.update(this.ownShip, this.trafficShips, dt);
    this.radar.render();
    this.radar.renderARPAList();

    // ECDIS
    this.ecdis.update(this.ownShip, this.trafficShips);
    this.ecdis.render();

    // HUD heading/speed
    this._updateHUD();
    this._updateBridgeConsole();

    // Clock
    this._updateClock();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _updateHUD() {
    const d = this.instruments.data;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('hud-heading',  String(Math.round((this.ownShip.heading + 360) % 360)).padStart(3,'0') + '°');
    set('hud-speed',    Math.max(0, this.ownShip.speed).toFixed(1) + ' kn');
    const ra = this.ownShip.rudderAngle;
    set('hud-rudder',   Math.abs(ra) < 1 ? 'MID' : ra > 0 ? ra.toFixed(0) + '°S' : Math.abs(ra).toFixed(0) + '°P');
    set('hud-depth',    d.depthKeel.toFixed(1) + ' m');
    set('hud-wind',     d.windSpeedTrue.toFixed(0) + 'kn/' + String(Math.round(d.windDirTrue)).padStart(3,'0') + '°');
    set('hud-target',   this._getRelativeTargetText());
    set('hud-pos',      this.instruments.formatLat(d.lat) + '\n' + this.instruments.formatLon(d.lon));
  }

  _getRelativeTargetText() {
    if (!this.trafficShips.length) return 'NO TARGET IN RANGE';

    let nearest = null;
    let minRangeNM = Infinity;

    for (const ship of this.trafficShips) {
      const dx = ship.position.x - this.ownShip.position.x;
      const dz = ship.position.z - this.ownShip.position.z;
      const rangeNM = Math.hypot(dx, dz) / NM;
      if (rangeNM < minRangeNM) {
        minRangeNM = rangeNM;
        nearest = ship;
      }
    }

    if (!nearest || !Number.isFinite(minRangeNM) || minRangeNM > 24) return 'NO TARGET IN RANGE';

    const dx = nearest.position.x - this.ownShip.position.x;
    const dz = nearest.position.z - this.ownShip.position.z;
    const trueBearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const relBearing = ((trueBearing - this.ownShip.heading + 540) % 360) - 180;

    const ownVx = this.ownShip.velocity.x;
    const ownVz = this.ownShip.velocity.z;
    const tgtVx = nearest.speed * NM / 3600 * Math.sin(nearest.heading * Math.PI / 180);
    const tgtVz = -nearest.speed * NM / 3600 * Math.cos(nearest.heading * Math.PI / 180);
    const current = ShipNavigatorSimulator.currentVectorFromEnv(this.weather);
    const rvx = (tgtVx + current.x) - ownVx;
    const rvz = (tgtVz + current.z) - ownVz;
    const rangeM = Math.max(1, Math.hypot(dx, dz));
    const closingKn = -((dx * rvx) + (dz * rvz)) / rangeM * 3600 / NM;
    const side = relBearing > 0 ? 'STBD' : relBearing < 0 ? 'PORT' : 'AHEAD';
    const signedBearing = side === 'AHEAD' ? '000°' : `${String(Math.round(Math.abs(relBearing))).padStart(3, '0')}° ${side}`;

    return `${nearest.name} · ${minRangeNM.toFixed(2)} nm · ${signedBearing} · ${closingKn >= 0 ? 'closing' : 'opening'} ${Math.abs(closingKn).toFixed(1)} kn`;
  }

  _updateBridgeConsole() {
    if (!this.ownShip) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('bf-gyro', String(Math.round((this.ownShip.heading + 360) % 360)).padStart(3, '0') + '°');
    set('bf-spd',  Math.max(0, this.ownShip.speed).toFixed(1) + ' kn');
    set('bf-rot',  this.ownShip.rot.toFixed(1) + '°/m');
    const ra = this.ownShip.rudderAngle;
    set('bf-rdr',  Math.abs(ra) < 1 ? 'MID' : ra > 0 ? ra.toFixed(0) + '°S' : Math.abs(ra).toFixed(0) + '°P');
    const teleEl = document.getElementById('bf-tele');
    if (teleEl) {
      teleEl.textContent = this.ownShip.engineOrder.replace(/_/g, ' ');
      teleEl.style.color = this.ownShip.engineOrder.includes('AHEAD') ? '#00cc44'
        : this.ownShip.engineOrder.includes('ASTERN') ? '#ff4422' : '#ffaa00';
    }
  }

  _onResize() {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — Start Screen Logic
// ══════════════════════════════════════════════════════════════════════════════
function populateStartScreen() {
  // Populate location list
  const locList = document.getElementById('location-list');
  if (locList) {
    LOCATIONS.forEach(loc => {
      const btn = document.createElement('button');
      btn.className = 'loc-btn';
      btn.dataset.id = loc.id;
      btn.innerHTML = `<span class="loc-name">${loc.name}</span><span class="loc-desc">${loc.description}</span>`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loc-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window._selectedLocation = loc.id;
      });
      locList.appendChild(btn);
    });
    // Default select first
    locList.querySelector('.loc-btn')?.classList.add('selected');
    window._selectedLocation = LOCATIONS[0].id;
  }

  // Populate ship type list
  const shipList = document.getElementById('ship-type-list');
  if (shipList) {
    SHIP_TYPES.forEach(st => {
      const btn = document.createElement('button');
      btn.className = 'ship-btn';
      btn.dataset.id = st.id;
      btn.innerHTML = `<span class="ship-name">${st.name}</span><span class="ship-spec">LOA ${st.loa}m &middot; Max ${st.maxSpeed}kn</span>`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ship-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        window._selectedShip = st.id;
      });
      shipList.appendChild(btn);
    });
    // Default
    shipList.querySelector('.ship-btn')?.classList.add('selected');
    window._selectedShip = SHIP_TYPES[0].id;
  }

  // Populate scenario list
  const scList = document.getElementById('scenario-list');
  if (scList) {
    ROR_SCENARIOS.forEach(sc => {
      const btn = document.createElement('button');
      btn.className = 'scenario-btn';
      btn.dataset.id = sc.id;
      btn.innerHTML = `<span class="sc-name">Rule ${sc.rule} — ${sc.name}</span><span class="sc-diff">${sc.difficulty}</span>`;
      scList.appendChild(btn);
    });
  }

  // Start button
  document.getElementById('start-btn')?.addEventListener('click', async () => {
    const locId  = window._selectedLocation || LOCATIONS[0].id;
    const shipId = window._selectedShip     || SHIP_TYPES[0].id;
    document.getElementById('start-modal').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    const sim = new ShipNavigatorSimulator();
    window.simulator = sim;
    await sim.init(locId, shipId);
    sim.audio.resume();
  });
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  populateStartScreen();
});
