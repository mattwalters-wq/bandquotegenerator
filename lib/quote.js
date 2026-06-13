// Quick Quote engine - turns resolved trip inputs (location, show date, the
// travel days/nights the app inferred per player, and lineup) into a band cost
// for every lineup, plus plain-English summaries. All rates come from
// lib/policy.js - this file only orchestrates.

import { POLICY, LINEUPS, locationClass, computeBand, money } from "./policy";

// Normalise inputs. travelDays and nights are already resolved by the itinerary
// engine (and may be a manual override).
export function normaliseTrip(input) {
  const loc = locationClass(input.locationClass);
  return {
    locationLabel: input.locationLabel || loc.label,
    locationClass: loc.key,
    feeKey: loc.feeKey,
    showDate: input.showDate || "",
    travelDays: Math.max(0, Number(input.travelDays) || 0),
    nights: Math.max(0, Number(input.nights) || 0),
    lineupKey: input.lineupKey || "full",
  };
}

// Cost for every lineup for this trip, plus the delta vs the previous lineup.
export function compareLineups(trip) {
  let prev = 0;
  return LINEUPS.map((l) => {
    const band = computeBand({
      feeKey: trip.feeKey, musicians: l.musicians, travelDays: trip.travelDays, nights: trip.nights,
    });
    const delta = band.total - prev;
    prev = band.total;
    return { key: l.key, label: l.label, musicians: l.musicians, total: band.total, delta, per: band.per };
  });
}

export function selectedBand(trip) {
  const l = LINEUPS.find((x) => x.key === trip.lineupKey) || LINEUPS[LINEUPS.length - 1];
  return {
    ...l,
    band: computeBand({ feeKey: trip.feeKey, musicians: l.musicians, travelDays: trip.travelDays, nights: trip.nights }),
  };
}

function nightsPhrase(nights) {
  if (nights === 0) return "no overnight stay";
  if (nights === 1) return "one night away";
  return nights + " nights away";
}

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

// "Includes 2 travel days per Melbourne-based player, 0 for Sydney-based players."
export function travelWordsSummary(perBase) {
  const parts = (perBase || []).filter(Boolean);
  if (!parts.length) return "";
  const phrase = (p) => p.days + " travel day" + (p.days === 1 ? "" : "s") + " per " + p.base + "-based player" + (p.days === 1 ? "" : "");
  if (parts.length === 1) return "Includes " + phrase(parts[0]) + ".";
  const head = "Includes " + phrase(parts[0]);
  const tail = parts.slice(1).map((p) => p.days + " for " + p.base + "-based players").join(", ");
  return head + ", " + tail + ".";
}

// Everything the share page and the result panel need, in one snapshot. Stored
// as-is so a shared quote renders identically even if POLICY rates change later.
export function buildQuoteSnapshot(input) {
  const trip = normaliseTrip(input);
  const comparison = compareLineups(trip);
  const selected = selectedBand(trip);
  return {
    version: 2,
    createdRates: {
      showFee: POLICY.showFee, travelDay: POLICY.travelDay, perDiem: POLICY.perDiem,
      transportCap: POLICY.transportCap, superRate: POLICY.superRate,
    },
    trip,
    comparison,
    selected: { key: selected.key, label: selected.label, musicians: selected.musicians, total: selected.band.total, per: selected.band.per },
    travel: input.travel || null, // { reasons, assumptions, perBase, manual, summary }
    emmaFeeReference: POLICY.emmaFee,
    summary: summarySentence(trip),
  };
}

// Plain-English email for a Quick Quote snapshot (copy or open in mail).
export function quoteEmail(snapshot) {
  const { trip, selected, comparison, summary, travel, emmaFeeReference } = snapshot;
  const where = trip.locationLabel;
  const subject = "Emma Donovan - Band Quote - " + where + (trip.showDate ? ", " + trip.showDate : "");

  let body = "Hi,\n\n" + summary + "\n";
  if (travel && travel.summary) body += "\n" + travel.summary + "\n";

  if (selected.musicians > 0) {
    body += "\n" + selected.label + " (" + selected.musicians + " musician" + (selected.musicians > 1 ? "s" : "") + "):\n";
    selected.per.lines.forEach((l) => { body += "  - " + l.label + ": " + money(l.amount) + "\n"; });
    body += "  - Per musician: " + money(selected.per.total) + "\n";
    body += "  - x " + selected.musicians + " = " + money(selected.total) + "\n";
  }

  body += "\nFor comparison, the same trip by lineup:\n";
  comparison.forEach((c) => {
    body += "  - " + c.label + ": " + (c.musicians === 0 ? "no band" : money(c.total)) + "\n";
  });

  body += "\nFlights, accommodation and backline are NOT included in these figures.";
  body += "\nEmma's own performance fee (" + money(emmaFeeReference) + "/show) sits in the P&L and is not part of the band cost.";
  body += "\n\nThanks,\nMatt";

  return { subject, body };
}

export { money };
