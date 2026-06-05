// Itinerary inference: turn what the user knows (destination, show date(s),
// soundcheck time) into a sensible PER-PLAYER itinerary, then count travel days
// with the pure rule engine in lib/policy.js. Every inferred choice is returned
// as an "assumed" note so the UI can label it and let the user override.

import { countTravelDays } from "./policy";
import { estimateDoorToDoor, normalizeCity } from "./travelData";

const MORNING_DEPART = 7;      // assumed earliest practical departure (24h)
const DEFAULT_SOUNDCHECK = 15; // 3:00pm
const DEFAULT_SHOW_END = 22.5; // 10:30pm

function toUTC(iso) { return new Date(String(iso).slice(0, 10) + "T00:00:00Z"); }
function addDays(iso, n) {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function diffDays(a, b) { return Math.round((toUTC(a) - toUTC(b)) / 86400000); }

// Parse "15:00", "3:00pm", "3pm" or a number into a 24h decimal hour.
export function parseHour(t, fallback) {
  if (t === 0) return 0;
  if (typeof t === "number" && !isNaN(t)) return t;
  if (typeof t === "string") {
    const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const ap = m[3] ? m[3].toLowerCase() : null;
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      return h + min / 60;
    }
  }
  return fallback;
}

// Decide same-day feasibility from a door-to-door estimate.
export function sameDayFeasibility({ hours, soundcheckHour = DEFAULT_SOUNDCHECK, showEndHour = DEFAULT_SHOW_END }) {
  // Same-day-in: morning departure arrives at least 2h before soundcheck.
  const arrival = MORNING_DEPART + hours;
  const canIn = arrival <= soundcheckHour - 2;
  // Same-day-out: show ends by 10:30pm and the return is short (drive-home territory).
  const canOut = hours < 3 && showEndHour <= DEFAULT_SHOW_END;
  return { canIn, canOut, arrivalHour: arrival };
}

// Build a per-player itinerary from a resolved door-to-door estimate.
// `estimate` is { hours, mode, destLabel, gateway } from travelData OR an AI
// result mapped to the same shape. `feasibility` lets the AI override the
// same-day booleans directly.
function buildDays({ homeBase, destBase, destLabel, showDates, estimate, feasibility }) {
  const home = normalizeCity(homeBase) || homeBase;
  const first = showDates[0];
  const last = showDates[showDates.length - 1];
  const mode = estimate.mode === "drive" ? "drive" : "flight"; // local handled earlier
  const hours = estimate.hours;

  const days = [];
  const assumptions = [];

  if (!feasibility.canIn) {
    days.push({
      date: addDays(first, -1),
      hasPerformance: false,
      travel: { occurs: true, mode, doorToDoorHours: hours, overnightAway: true, isPersonal: false, fromBase: home, toBase: destBase, destLabel },
    });
    assumptions.push({ key: "in", text: "Assumed you travel in the day before and stay overnight (no same-day arrival before soundcheck).", assumed: true });
  } else {
    assumptions.push({ key: "in", text: "Assumed a morning departure gets you in by soundcheck, so travel in is on the show day.", assumed: true });
  }

  showDates.forEach((d) => {
    days.push({ date: d, hasPerformance: true, travel: { occurs: false } });
  });

  if (!feasibility.canOut) {
    days.push({
      date: addDays(last, 1),
      hasPerformance: false,
      travel: { occurs: true, mode, doorToDoorHours: hours, overnightAway: false, isPersonal: false, fromBase: destBase, toBase: home, destLabel },
    });
    assumptions.push({ key: "out", text: "Assumed an overnight stay and a next-day return home (cannot realistically get home the same night).", assumed: true });
  } else {
    assumptions.push({ key: "out", text: "Assumed you can get home the same night after the show.", assumed: true });
  }

  const arrivalDay = feasibility.canIn ? first : addDays(first, -1);
  const departureDay = feasibility.canOut ? last : addDays(last, 1);
  const nights = Math.max(0, diffDays(departureDay, arrivalDay));

  return { days, nights, assumptions };
}

// Main entry: infer the itinerary for one player and count their travel days.
//   input: { homeBase, destination, showDates:[iso...], soundcheckTime, showEndTime,
//            soundcheckProvided, regional:{gateway, driveHoursFromGateway} }
// Returns { resolved, needsEstimate, travelDays, nights, reasons, assumptions,
//           sameDayIn, sameDayOut, estimate }.
export function computePlayerTravel(input) {
  const { homeBase, destination, soundcheckTime, showEndTime, soundcheckProvided } = input;
  const showDates = (input.showDates || []).filter(Boolean).sort();
  if (!showDates.length) return { resolved: false, needsEstimate: false, travelDays: 0, nights: 0, reasons: [], assumptions: [] };

  const estimate = estimateDoorToDoor({ origin: homeBase, destination, regional: input.regional });
  if (!estimate.resolved) {
    return { resolved: false, needsEstimate: true, travelDays: 0, nights: 0, reasons: [], assumptions: [], estimate };
  }

  // Local to home base -> no travel days at all.
  if (estimate.mode === "local") {
    return {
      resolved: true, needsEstimate: false, travelDays: 0, nights: 0, reasons: [],
      sameDayIn: true, sameDayOut: true, estimate,
      assumptions: [{ key: "local", text: "This is a local show for a " + (normalizeCity(homeBase) || homeBase) + "-based player - no travel days.", assumed: false }],
    };
  }

  return finishItinerary(input, estimate, sameDayFeasibilityFor(input, estimate), { soundcheckProvided, soundcheckTime, showEndTime, showDates });
}

function sameDayFeasibilityFor(input, estimate) {
  const soundcheckHour = parseHour(input.soundcheckTime, DEFAULT_SOUNDCHECK);
  const showEndHour = parseHour(input.showEndTime, DEFAULT_SHOW_END);
  return sameDayFeasibility({ hours: estimate.hours, soundcheckHour, showEndHour });
}

function finishItinerary(input, estimate, feasibility, ctx) {
  // Use the destination's own metro (capital) or, for a regional town, the town
  // name itself - never the gateway capital, which could equal the player's home
  // base and be mistaken for local travel.
  const destBase = normalizeCity(input.destination) || input.destination || estimate.destLabel;
  const built = buildDays({
    homeBase: input.homeBase,
    destBase,
    destLabel: estimate.destLabel,
    showDates: ctx.showDates,
    estimate,
    feasibility: { canIn: feasibility.canIn, canOut: feasibility.canOut },
  });
  const counted = countTravelDays({ days: built.days }, normalizeCity(input.homeBase) || input.homeBase);

  const assumptions = [...built.assumptions];
  if (!ctx.soundcheckProvided) {
    assumptions.unshift({ key: "soundcheck", text: "Assumed a 3:00pm soundcheck.", assumed: true });
  }

  return {
    resolved: true,
    needsEstimate: false,
    travelDays: counted.days,
    nights: built.nights,
    reasons: counted.reasons,
    assumptions,
    sameDayIn: feasibility.canIn,
    sameDayOut: feasibility.canOut,
    estimate,
    days: built.days,
  };
}

// Build an itinerary from a validated AI estimate (used when the static table
// cannot resolve the destination).
export function computePlayerTravelFromAI(input, aiEstimate) {
  const showDates = (input.showDates || []).filter(Boolean).sort();
  if (!showDates.length) return { resolved: false, travelDays: 0, nights: 0, reasons: [], assumptions: [] };

  const hours = Number(aiEstimate.estimatedDoorToDoorHours);
  const estimate = {
    hours,
    mode: hours >= 4 ? "flight" : "drive",
    destLabel: input.destination || "destination",
    gateway: null,
    resolved: true,
  };
  const feasibility = { canIn: !!aiEstimate.canTravelSameDayIn, canOut: !!aiEstimate.canTravelSameDayOut };
  const res = finishItinerary(input, estimate, feasibility, {
    soundcheckProvided: input.soundcheckProvided, soundcheckTime: input.soundcheckTime, showEndTime: input.showEndTime, showDates,
  });
  // Fold the AI's own assumptions in, clearly marked.
  const aiNotes = (aiEstimate.assumptions || []).map((t) => ({ key: "ai", text: t, assumed: true }));
  res.assumptions = [...aiNotes, ...res.assumptions];
  return res;
}

// ---------------------------------------------------------------------------
// Strict validation of the AI estimate JSON. Never let free text into the
// calculation - only a fully-typed, range-checked object passes.
// ---------------------------------------------------------------------------
export function validateTravelEstimate(raw) {
  const errors = [];
  let obj = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw); } catch (e) { return { valid: false, errors: ["not valid JSON"] }; }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { valid: false, errors: ["not an object"] };

  if (typeof obj.canTravelSameDayIn !== "boolean") errors.push("canTravelSameDayIn must be boolean");
  if (typeof obj.canTravelSameDayOut !== "boolean") errors.push("canTravelSameDayOut must be boolean");
  const hours = Number(obj.estimatedDoorToDoorHours);
  if (!isFinite(hours) || hours < 0 || hours > 24) errors.push("estimatedDoorToDoorHours must be a number between 0 and 24");
  let assumptions = [];
  if (Array.isArray(obj.assumptions)) {
    assumptions = obj.assumptions.filter((a) => typeof a === "string").slice(0, 8);
  }
  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    value: {
      canTravelSameDayIn: obj.canTravelSameDayIn,
      canTravelSameDayOut: obj.canTravelSameDayOut,
      estimatedDoorToDoorHours: hours,
      assumptions,
    },
  };
}
