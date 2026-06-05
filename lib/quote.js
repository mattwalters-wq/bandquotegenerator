// Quick Quote engine - turns the three Emma-mode inputs (where / when / lineup)
// into a band cost for every lineup, plus a plain-English summary. All rates
// come from lib/policy.js - this file only orchestrates.

import {
  POLICY, LINEUPS, locationClass, computeBand, travelDaysFor, money,
} from "./policy";

// Build the full set of inputs into a normalised trip object.
export function normaliseTrip(input) {
  const loc = locationClass(input.locationClass);
  const canTravelShowDay = !!input.canTravelShowDay;
  const nights = canTravelShowDay ? 0 : Math.max(0, Number(input.nights) || 0);
  const travelDays = travelDaysFor(canTravelShowDay, nights);
  return {
    locationLabel: input.locationLabel || loc.label,
    locationClass: loc.key,
    feeKey: loc.feeKey,
    showDate: input.showDate || "",
    canTravelShowDay,
    nights,
    travelDays,
    lineupKey: input.lineupKey || "full",
  };
}

// Cost for every lineup for this trip, plus the delta vs the previous lineup
// (so Emma can see what each added player costs).
export function compareLineups(trip) {
  let prev = 0;
  return LINEUPS.map((l) => {
    const band = computeBand({
      feeKey: trip.feeKey,
      musicians: l.musicians,
      travelDays: trip.travelDays,
      nights: trip.nights,
    });
    const delta = band.total - prev;
    prev = band.total;
    return {
      key: l.key,
      label: l.label,
      musicians: l.musicians,
      total: band.total,
      delta,
      per: band.per,
    };
  });
}

export function selectedBand(trip) {
  const l = LINEUPS.find((x) => x.key === trip.lineupKey) || LINEUPS[LINEUPS.length - 1];
  return {
    ...l,
    band: computeBand({
      feeKey: trip.feeKey,
      musicians: l.musicians,
      travelDays: trip.travelDays,
      nights: trip.nights,
    }),
  };
}

function nightsPhrase(nights) {
  if (nights === 0) return "no overnight stay";
  if (nights === 1) return "one night away";
  return nights + " nights away";
}

// Top-line plain-English sentence.
export function summarySentence(trip) {
  const sel = selectedBand(trip);
  const where = trip.locationLabel || locationClass(trip.locationClass).label;
  if (sel.musicians === 0) {
    return "A solo show in " + where + " hires no band, so there are no band fees - just Emma's own performance fee, which sits in the P&L.";
  }
  const lead = sel.label === "Full Band" ? "A full band show" : (sel.label === "Duo" ? "A duo show" : sel.label + " show");
  return lead + " in " + where + " with " + nightsPhrase(trip.nights) + " costs about " +
    money(sel.band.total) + " in band fees before flights and accommodation.";
}

// Everything the share page and the result panel need, in one snapshot. We store
// this snapshot so a shared quote always renders exactly as it did when created,
// even if POLICY rates change later.
export function buildQuoteSnapshot(input) {
  const trip = normaliseTrip(input);
  const comparison = compareLineups(trip);
  const selected = selectedBand(trip);
  return {
    version: 1,
    createdRates: {
      showFee: POLICY.showFee,
      travelDay: POLICY.travelDay,
      perDiem: POLICY.perDiem,
      transportCap: POLICY.transportCap,
      superRate: POLICY.superRate,
    },
    trip,
    comparison,
    selected: {
      key: selected.key,
      label: selected.label,
      musicians: selected.musicians,
      total: selected.band.total,
      per: selected.band.per,
    },
    emmaFeeReference: POLICY.emmaFee,
    summary: summarySentence(trip),
  };
}

export { money };
