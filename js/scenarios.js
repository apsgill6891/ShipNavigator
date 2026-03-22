// js/scenarios.js — Rules of the Road Scenarios

export const ROR_SCENARIOS = [
  {
    id: 'head_on',
    name: 'Head-On Situation',
    rule: 14,
    difficulty: 'beginner',
    description: 'Two power-driven vessels meeting head-on or nearly head-on (within 6°). BOTH are give-way vessels.',
    setup: {
      ownShip: { heading: 90, speed: 12 },
      targets: [
        { name: 'MV CHALLENGER', heading: 270, speed: 14, startRange: 5.0, startBearing: 90, type: 'cargo' }
      ]
    },
    correctAction: {
      description: 'Alter course to STARBOARD (Rule 14). Each vessel turns right to pass port-to-port.',
      courseChange: 10,
      direction: 'starboard',
    },
    guidance: 'Rule 14: When two power-driven vessels meet on reciprocal or nearly reciprocal courses so as to involve risk of collision, each shall alter course to starboard so that each shall pass on the port side of the other.',
    signals: {
      sound: '1_short', // 1 short blast when turning starboard
      light: 'not_required',
    },
    debriefPass: 'Correct! Altered to starboard early and clearly, passing port-to-port.',
    debriefFail: 'Incorrect. Both vessels must alter to starboard in a head-on situation.',
  },

  {
    id: 'crossing_giveway',
    name: 'Crossing — You are Give-Way Vessel',
    rule: 15,
    difficulty: 'beginner',
    description: 'Two power-driven vessels crossing. The vessel with the other on her starboard side is the give-way vessel.',
    setup: {
      ownShip: { heading: 0, speed: 12 },
      targets: [
        { name: 'MV AURORA', heading: 270, speed: 10, startRange: 4.0, startBearing: 40, type: 'tanker' }
      ]
    },
    correctAction: {
      description: 'You have MV AURORA on your starboard bow. YOU are give-way. Alter course to starboard to pass ASTERN, or reduce speed/stop.',
      courseChange: 90,
      direction: 'starboard',
    },
    guidance: 'Rule 15: When two power-driven vessels are crossing so as to involve risk of collision, the vessel which has the other on her own starboard side shall keep out of the way and shall, if the circumstances of the case admit, avoid crossing ahead of the other vessel.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Gave way early and clearly, passing astern of the stand-on vessel.',
    debriefFail: 'You crossed ahead or did not take sufficient action. The give-way vessel must keep clear.',
  },

  {
    id: 'crossing_standon',
    name: 'Crossing — You are Stand-On Vessel',
    rule: 17,
    difficulty: 'intermediate',
    description: 'Two power-driven vessels crossing. You have the other vessel on your PORT side — you are the stand-on vessel.',
    setup: {
      ownShip: { heading: 90, speed: 14 },
      targets: [
        { name: 'MV HORIZON', heading: 0, speed: 10, startRange: 3.0, startBearing: 220, type: 'cargo' }
      ]
    },
    correctAction: {
      description: 'Maintain course and speed initially (Rule 17a-i). If risk of collision develops and give-way vessel fails to act, you MAY take action (Rule 17a-ii). If collision imminent, take best action (Rule 17b).',
      courseChange: 0,
      direction: 'none',
    },
    guidance: 'Rule 17: The stand-on vessel shall keep her course and speed. She may take action to avoid collision ONLY when it becomes apparent the give-way vessel is not taking appropriate action. She shall NOT alter to port for a vessel on her port side.',
    signals: {
      sound: '5_short',
      light: 'not_required',
    },
    debriefPass: 'Correct! Maintained course and speed, sounding 5 short blasts when give-way failed to comply.',
    debriefFail: 'Incorrect. Stand-on vessel must maintain course/speed and not alter to port for a vessel on port side.',
  },

  {
    id: 'overtaking',
    name: 'Overtaking Situation',
    rule: 13,
    difficulty: 'beginner',
    description: 'You are coming up from more than 22.5° abaft the beam of a slower vessel — you are the overtaking (give-way) vessel.',
    setup: {
      ownShip: { heading: 90, speed: 18 },
      targets: [
        { name: 'MV SLOW MOVER', heading: 90, speed: 8, startRange: 2.0, startBearing: 90, type: 'bulk' }
      ]
    },
    correctAction: {
      description: 'You are overtaking. YOU are give-way for as long as you are overtaking, even if you cross onto a bearing that would normally make you stand-on.',
      courseChange: 0,
      direction: 'maintain_clear',
    },
    guidance: 'Rule 13: Any vessel overtaking any other vessel shall keep out of the way of the vessel being overtaken. An overtaking vessel is one coming up from more than 22.5° abaft the beam.',
    signals: {
      sound: 'none_required',
      light: 'stern_light_visible',
    },
    debriefPass: 'Correct! Maintained clear distance while overtaking, passing well clear.',
    debriefFail: 'You did not maintain sufficient clearance while overtaking.',
  },

  {
    id: 'restricted_visibility',
    name: 'Restricted Visibility — Radar Contact',
    rule: 19,
    difficulty: 'advanced',
    description: 'Fog. You detect a vessel by radar only. Visibility < 0.5 nm. Fog signals in use.',
    setup: {
      ownShip: { heading: 90, speed: 12 },
      weather: { fog: 0.95, visibility: 0.4 },
      targets: [
        { name: 'MV PHANTOM', heading: 180, speed: 10, startRange: 3.0, startBearing: 30, type: 'tanker' }
      ]
    },
    correctAction: {
      description: 'Sound fog signal (1 prolonged blast every 2 min). Reduce to safe speed. If radar contact forward of beam with risk of collision — DO NOT alter to port. Alter to starboard or reduce speed/stop.',
      courseChange: 0,
      direction: 'stop_or_starboard',
    },
    guidance: 'Rule 19: In or near an area of restricted visibility, vessels shall proceed at safe speed. A vessel detecting another by radar forward of beam shall not alter course to port; shall take all way off if necessary.',
    signals: {
      sound: 'prolonged_blast_2min',
      light: 'not_required',
    },
    debriefPass: 'Correct! Used radar early, reduced speed, sounded fog signals, avoided altering to port.',
    debriefFail: 'Incorrect. In fog, safe speed is essential and course to port forbidden for forward contacts.',
  },

  {
    id: 'narrow_channel',
    name: 'Narrow Channel — Rule 9',
    rule: 9,
    difficulty: 'intermediate',
    description: 'Inside the Kiel Canal. Keep to starboard side. Vessel navigating with current meets vessel against.',
    setup: {
      ownShip: { heading: 270, speed: 7 },
      targets: [
        { name: 'MV NORD PIONEER', heading: 90, speed: 7, startRange: 1.5, startBearing: 270, type: 'cargo' }
      ]
    },
    correctAction: {
      description: 'Keep to the starboard side of the channel. Do not impede vessels which can navigate only within the channel.',
      courseChange: 0,
      direction: 'keep_starboard',
    },
    guidance: 'Rule 9: A vessel proceeding along the course of a narrow channel or fairway shall keep as near to the outer limit of the channel which lies on her starboard side as is safe and practicable.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Kept well to starboard side, passed safely port to port.',
    debriefFail: 'You were not keeping sufficiently to the starboard side of the channel.',
  },

  {
    id: 'traffic_separation',
    name: 'Traffic Separation Scheme — Rule 10',
    rule: 10,
    difficulty: 'intermediate',
    description: 'Singapore Strait TSS. You are joining the eastbound lane.',
    setup: {
      ownShip: { heading: 70, speed: 12 },
      targets: [
        { name: 'MV EASTBOUND 1', heading: 90, speed: 14, startRange: 4.0, startBearing: 90, type: 'container' },
        { name: 'MV EASTBOUND 2', heading: 90, speed: 12, startRange: 6.0, startBearing: 90, type: 'tanker' }
      ]
    },
    correctAction: {
      description: 'Join the lane at as small an angle as practicable. Proceed in the general direction of traffic flow. Do not cross the lane unless necessary.',
      courseChange: 20,
      direction: 'align_with_traffic',
    },
    guidance: 'Rule 10: A vessel shall, so far as practicable, join or leave a traffic lane at the termination of the lane. A vessel joining a lane shall do so at as small an angle to the general direction of traffic flow as practicable.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Joined the TSS lane at a shallow angle and aligned with traffic.',
    debriefFail: 'You joined the TSS lane at too steep an angle or did not align with traffic direction.',
  },

  {
    id: 'vessel_nuc',
    name: 'Vessel Not Under Command',
    rule: 18,
    difficulty: 'intermediate',
    description: 'You are a power vessel. Ahead is a vessel displaying two black balls/shapes — Not Under Command.',
    setup: {
      ownShip: { heading: 0, speed: 14 },
      targets: [
        { name: 'MV BREAKDOWN', heading: 0, speed: 0, startRange: 3.0, startBearing: 0, type: 'tanker', status: 'NUC' }
      ]
    },
    correctAction: {
      description: 'YOU must keep out of the way of NUC vessel (Rule 18a). Alter course with plenty of sea-room.',
      courseChange: 20,
      direction: 'starboard',
    },
    guidance: 'Rule 18a: A power-driven vessel underway shall keep out of the way of: a vessel not under command (NUC). A NUC cannot comply with the rules owing to exceptional circumstances.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Gave way to the NUC vessel with ample sea-room.',
    debriefFail: 'A power-driven vessel must keep clear of a NUC vessel.',
  },

  {
    id: 'sailing_vessel',
    name: 'Power Vessel vs Sailing Vessel',
    rule: 18,
    difficulty: 'beginner',
    description: 'A sailing vessel is crossing ahead of you. You are a power-driven vessel.',
    setup: {
      ownShip: { heading: 0, speed: 14 },
      targets: [
        { name: 'SAILING YACHT BLUE WAVE', heading: 270, speed: 6, startRange: 3.0, startBearing: 40, type: 'sailing' }
      ]
    },
    correctAction: {
      description: 'Keep out of the way of the sailing vessel (Rule 18b). Alter course or reduce speed.',
      courseChange: 15,
      direction: 'starboard',
    },
    guidance: 'Rule 18b: A power-driven vessel shall keep out of the way of a sailing vessel, except when the sailing vessel is overtaking.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Kept clear of the sailing vessel.',
    debriefFail: 'Power vessels must keep clear of sailing vessels unless the sailing vessel is overtaking.',
  },

  {
    id: 'pilot_vessel',
    name: 'Pilot Vessel on Duty',
    rule: 29,
    difficulty: 'beginner',
    description: 'A vessel displaying white-over-red all-round lights is a pilot vessel. What action do you take?',
    setup: {
      ownShip: { heading: 90, speed: 12 },
      targets: [
        { name: 'PILOT VESSEL ZEEHOND', heading: 180, speed: 8, startRange: 2.0, startBearing: 90, type: 'pilot', status: 'PILOT_DUTY' }
      ]
    },
    correctAction: {
      description: 'Pilot vessels on station may proceed under sails or engine. Treat as any other vessel of her class for COLREGS purposes. Do not impede.',
      courseChange: 0,
      direction: 'observe',
    },
    guidance: 'Rule 29: A vessel engaged on pilotage duty shall exhibit white over red all-round lights. She may use flare to attract attention. A vessel engaged on pilotage duty shall not impede a vessel piloting another.',
    signals: {
      sound: 'none_required',
      light: 'not_required',
    },
    debriefPass: 'Correct! Identified pilot vessel and did not impede her operation.',
    debriefFail: 'You did not correctly identify or respond to the pilot vessel.',
  },
];

// ── Sound Signal Reference ────────────────────────────────────────────────────
export const SOUND_SIGNALS = {
  manoeuvring: [
    { code: '1_short',   meaning: 'I am altering my course to starboard',   duration: '1 short blast (~1s)' },
    { code: '2_short',   meaning: 'I am altering my course to port',         duration: '2 short blasts' },
    { code: '3_short',   meaning: 'I am operating astern propulsion',        duration: '3 short blasts' },
    { code: '5_short',   meaning: 'Doubt/danger — at least 5 short blasts',  duration: '≥5 short blasts' },
  ],
  fog: [
    { code: 'prolonged_2min',     vessel: 'Power-driven vessel underway',          signal: '1 prolonged every 2 min' },
    { code: 'prolonged_prolonged_short', vessel: 'Power vessel underway, stopped', signal: '2 prolonged every 2 min' },
    { code: 'prolonged_2short_2short',   vessel: 'NUC / Restricted / Sailing',     signal: '1 prolonged + 2 short every 2 min' },
    { code: 'rapid_bell',         vessel: 'Vessel at anchor (<100m)',              signal: 'Rapid bell 5s every min' },
    { code: 'bell_gong',          vessel: 'Vessel at anchor (>100m)',              signal: 'Rapid bell forward + gong aft every min' },
  ],
  distress: [
    { code: 'mayday',    meaning: 'MAYDAY — immediate danger, request assistance' },
    { code: 'pan_pan',   meaning: 'PAN-PAN — urgent message, safety of vessel/person' },
    { code: 'securite',  meaning: 'SECURITE — safety message, navigation hazard' },
  ],
};

// ── Light Signals ─────────────────────────────────────────────────────────────
export const LIGHT_SIGNALS = {
  power_underway: ['Masthead light (white, 225°)', 'Sidelights (red/green, 112.5° each)', 'Stern light (white, 135°)'],
  sailing_underway: ['Sidelights', 'Stern light', 'Optional: tri-colour at masthead'],
  at_anchor: ['All-round white light forward', '>50m: all-round white aft too'],
  nuc: ['2 all-round red lights (vertical)'],
  restricted_ability: ['All-round red-white-red lights (vertical)', 'plus standard lights if making way'],
  constrained_draft: ['3 all-round red lights (vertical)'],
  engaged_fishing: ['All-round red over white', 'plus sidelights/stern if making way'],
  pilot_duty: ['All-round white over red'],
  towing: ['2 masthead lights (vertical)', 'tow >200m: 3 masthead lights'],
  aground: ['Anchor lights', 'plus 2 all-round red lights'],
};
