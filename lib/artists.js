import { POLICY, LINEUPS } from "./policy";

// =============================================================================
// ARTISTS - single source of truth for artist-specific details.
// Band rates and rules stay shared in lib/policy.js; only identity, invoicing
// and the artist's own fee reference differ per artist.
// =============================================================================
export const ARTISTS = {
  emma: {
    key: "emma",
    name: "Emma Donovan",
    shortName: "Emma",
    invoiceTo: "Jiindahood Pty Ltd",
    abn: "61 663 395 364",
    // The artist's own per-show fee, tracked in the P&L and never part of a
    // band quote - shown only as a reference line.
    artistFee: POLICY.emmaFee,
  },
  sarah: {
    key: "sarah",
    name: "Sarah Grace Buckley",
    shortName: "Sarah",
    invoiceTo: "Sarah Grace Buckley",
    abn: "40 729 436 212",
    // Not yet set - the reference line is simply omitted until it is.
    artistFee: null,
  },
};

export const DEFAULT_ARTIST = "emma";

export function getArtist(key) {
  return ARTISTS[key] || ARTISTS[DEFAULT_ARTIST];
}

// Lineup label for a given artist: "Emma +2" becomes "Sarah +2" etc.
export function lineupLabel(lineup, artistOrShortName) {
  const short = typeof artistOrShortName === "string"
    ? artistOrShortName
    : (artistOrShortName?.shortName || "Emma");
  if (lineup.key === "emma2") return short + " +2";
  if (lineup.key === "emma3") return short + " +3";
  return lineup.label;
}

export function lineupsFor(artist) {
  return LINEUPS.map((l) => ({ ...l, label: lineupLabel(l, artist) }));
}
