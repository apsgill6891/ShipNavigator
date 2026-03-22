// js/vhf.js — VHF Radio Simulation

export class VHFSystem {
  constructor(audio) {
    this.audio = audio;
    this.channel = 16;
    this.txChannel = 16;
    this.squelch = 5;
    this.volume = 7;
    this.transmitting = false;
    this.callsign = 'BRIDGE_SIM';
    this.shipName = 'OWN VESSEL';
    this.messageLog = [];
    this.onMessage = null; // callback(msg)
    this._trafficTimer = null;
    this._msgQueue = [];
    this._msgIdx = 0;
    this._trafficScripts = [];
  }

  init(shipName, callsign, locationId) {
    this.shipName = shipName;
    this.callsign = callsign;
    this._buildTrafficScripts(locationId);
    this._scheduleTraffic();
    // Initial welcome on Ch 16
    setTimeout(() => this._incomingMsg('MRCC DOVER', 'WGW21', 16, 'All stations, all stations, all stations. This is MRCC Dover. Navtex broadcast scheduled 0800 UTC. Out.'), 5000);
  }

  _buildTrafficScripts(locationId) {
    const base = [
      { delay:  20000, from: 'MV CHALLENGER',  callsign:'9VDK5', ch:16, text:'Securité, securité, securité. All stations this is MV Challenger. NAVAREA warning — debris reported at position bearing 045° range 8.2 nm. Out.' },
      { delay:  45000, from: 'PORT CONTROL',   callsign:'VTS01', ch:12, text:'Traffic in the eastbound lane, this is VTS. You are approaching the separation zone. Maintain present course. Out.' },
      { delay:  80000, from: 'MV AURORA',      callsign:'C6XY3', ch:16, text:'MV Challenger, MV Challenger — this is MV Aurora, MV Aurora on channel 16. Switch to channel 06. Over.' },
      { delay:  82000, from: 'MV CHALLENGER',  callsign:'9VDK5', ch:16, text:'MV Aurora this is MV Challenger. Switching channel 06. Out.' },
      { delay:  85000, from: 'MV AURORA',      callsign:'C6XY3', ch: 6, text:'MV Challenger this is MV Aurora. I have you fine on radar bearing 278, range 3.4 miles. My intentions: maintain course 090. Your action please. Over.' },
      { delay:  90000, from: 'MV CHALLENGER',  callsign:'9VDK5', ch: 6, text:'MV Aurora this is MV Challenger. Understand, I confirm starboard-to-starboard passing. I will keep to port side of channel. Out.' },
      { delay: 130000, from: 'PILOT STATION',  callsign:'PLT01', ch:16, text:'All vessels intending to transit, pilot boarding ground is at position 1° 10.5N 103° 48.0E. Pilot vessel on station. Out.' },
      { delay: 200000, from: 'MV OCEAN PRINCE', callsign:'C6BX8', ch:16, text:'Pan-pan, pan-pan, pan-pan. All stations this is MV Ocean Prince. We have a man overboard at position 01° 12N 104° 05E. We are recovering. No assistance required. Out.' },
      { delay: 240000, from: 'MRCC',           callsign:'MRC01', ch:16, text:'MV Ocean Prince, this is MRCC. Understood man overboard recovery in progress. Advise when crew recovered. Out.' },
      { delay: 300000, from: 'MV SEA FALCON',  callsign:'9HZA2', ch:16, text:'Securité, securité, securité. All stations this is MV Sea Falcon. Heavy rain squall moving east at 15 knots, visibility reducing to half mile. Out.' },
    ];

    // Location-specific traffic
    const locationSpecific = {
      singapore_strait: [
        { delay: 15000, from:'VTIS WEST',    callsign:'VTIS1', ch:22, text:'All vessels in TSS westbound lane, this is VTIS West. Eastbound tanker convoy now entering from Eastern Anchorage. Mariners are advised to maintain safe speed. Out.' },
        { delay: 60000, from:'VTIS EAST',    callsign:'VTIS2', ch:22, text:'MV Ever Given, MV Ever Given — this is VTIS East. You are approaching the separation zone. Please confirm your intentions. Over.' },
      ],
      dover_strait:  [
        { delay: 10000, from:'CROSS GRIS-NEZ', callsign:'CGN01', ch:69, text:'Bonjour all stations. This is Gris-Nez Traffic. Navigational warning: sandbank survey vessel operating in TSS north lane at 51° 02N 001° 32E. Keep well clear. Out.' },
      ],
      bosphorus: [
        { delay: 12000, from:'ISTANBUL VTS',  callsign:'IVT01', ch:12, text:'All vessels southbound in Bosphorus, this is Istanbul VTS. Traffic separation — northbound convoy commences 0900. All southbound vessels reduce speed now. Over.' },
      ],
      suez_canal: [
        { delay: 10000, from:'SUEZ CANAL AUTH', callsign:'SCA01', ch:16, text:'All vessels in northbound convoy, this is Suez Canal Authority. Maintain 200-metre spacing. Speed 8 knots maximum in lakes section. Out.' },
      ],
      panama_canal: [
        { delay: 10000, from:'CRISTOBAL CONTROL', callsign:'CRS01', ch:12, text:'MV Gatun Trader, this is Cristobal Control. You are cleared to lock-in at 1430 local. Await pilot instructions on Channel 12. Out.' },
      ],
    };

    this._trafficScripts = [...base, ...(locationSpecific[locationId] || [])];
    this._trafficScripts.sort((a, b) => a.delay - b.delay);
  }

  _scheduleTraffic() {
    this._trafficScripts.forEach(msg => {
      setTimeout(() => {
        this._incomingMsg(msg.from, msg.callsign, msg.ch, msg.text);
      }, msg.delay);
    });
  }

  _incomingMsg(from, callsign, ch, text) {
    const entry = {
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      from,
      callsign,
      channel: ch,
      text,
      own: false,
    };
    this.messageLog.push(entry);
    if (this.onMessage) this.onMessage(entry, ch === this.channel);
    if (ch === this.channel) this._playRxBeep();
  }

  _playRxBeep() {
    if (!this.audio || !this.audio.ctx) return;
    const ctx = this.audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.audio.signalGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  setChannel(ch) {
    ch = Math.max(1, Math.min(88, parseInt(ch)));
    this.channel = ch;
    return ch;
  }

  channelUp() { return this.setChannel(this.channel + 1); }
  channelDown() { return this.setChannel(this.channel - 1); }

  transmit(text) {
    if (!text.trim()) return;
    const entry = {
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      from: this.shipName,
      callsign: this.callsign,
      channel: this.channel,
      text,
      own: true,
    };
    this.messageLog.push(entry);
    if (this.onMessage) this.onMessage(entry, true);

    // Auto-response logic
    this._autoRespond(text.toLowerCase(), this.channel);
  }

  _autoRespond(text, ch) {
    const responses = [
      { trigger: /mayday/i,   delay: 4000,  from:'MRCC DOVER',    callsign:'MRC01', resp: (s) => `${s}, ${s}, this is MRCC Dover. Your Mayday received. State position and nature of distress. Over.` },
      { trigger: /pan.pan/i,  delay: 3000,  from:'MRCC DOVER',    callsign:'MRC01', resp: (s) => `${s}, this is MRCC Dover. Pan-pan acknowledged. Please state position and nature of urgency. Over.` },
      { trigger: /securite/i, delay: 2000,  from:'PORT CONTROL',  callsign:'VTS01', resp: (s) => `${s}, securité acknowledged. All stations on channel ${ch} notified. Out.` },
      { trigger: /this is own vessel/i, delay:5000, from:'MV CHALLENGER', callsign:'9VDK5', resp: (s) => `Own Vessel, Own Vessel — this is MV Challenger. Received your call, standing by on channel ${ch}. Over.` },
      { trigger: /agree|concur|port.to.port|starboard.to.starboard/i, delay: 3000, from: 'TRAFFIC TARGET', callsign:'TGT01', resp: (s) => `${s}, agreed — port to port passing. We will alter 10° to starboard. Out.` },
    ];

    for (const r of responses) {
      if (r.trigger.test(text)) {
        setTimeout(() => {
          this._incomingMsg(r.from, r.callsign, ch, r.resp(this.shipName));
        }, r.delay);
        break;
      }
    }
  }

  // Quick transmit presets
  sendMayday(pos) {
    const txt = `MAYDAY MAYDAY MAYDAY. This is ${this.shipName}, ${this.callsign}. Position ${pos}. We require immediate assistance. ${this.callsign} out.`;
    this.transmit(txt);
  }

  sendPanPan(pos, nature) {
    const txt = `PAN-PAN PAN-PAN PAN-PAN. All stations this is ${this.shipName} ${this.callsign}. Position ${pos}. ${nature}. Assistance may be required. Out.`;
    this.transmit(txt);
  }

  sendSecurite(info) {
    const txt = `SECURITÉ SECURITÉ SECURITÉ. All stations this is ${this.shipName}. ${info}. Out.`;
    this.transmit(txt);
  }

  sendPositionReport(pos, hdg, spd) {
    const txt = `This is ${this.shipName} ${this.callsign}. Position ${pos}. Course ${String(hdg).padStart(3,'0')} degrees. Speed ${spd.toFixed(1)} knots. Out.`;
    this.transmit(txt);
  }

  callOtherShip(targetName) {
    const txt = `${targetName}, ${targetName} — this is ${this.shipName} ${this.callsign} on channel ${this.channel}. Do you read? Over.`;
    this.transmit(txt);
  }

  getChannelName(ch) {
    const names = {
      16: 'CH 16 — Distress/Safety/Calling',
       6: 'CH 6 — Intership Safety',
       8: 'CH 8 — Intership',
      12: 'CH 12 — Port Operations',
      13: 'CH 13 — Bridge-to-Bridge',
      14: 'CH 14 — Port Operations',
      22: 'CH 22 — US Coast Guard / VTS',
      67: 'CH 67 — UK Small Vessel Safety',
      69: 'CH 69 — Intership',
      70: 'CH 70 — Digital Selective Calling',
      72: 'CH 72 — Intership',
      77: 'CH 77 — Port Operations',
    };
    return names[ch] || `CH ${ch}`;
  }

  getLog(limit = 50) {
    return this.messageLog.slice(-limit);
  }
}
