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
    // Emma uses the shared POLICY rates unchanged; super is ADDED on top.
    policy: {},
    bandMembers: "Ben Edgar (guitar, often MD), Dave Symes (bass), Danny Farrugia (drums), Yanya Boston (drums), Mick Meagher (bass), Clio (keys), Georgia (BV), Eilla (BV), Tweedie (guitar), Ruben (bass), Felix Bloxsom (drums), Victor (guitar), Adam V (bass)",
    ratesText: null, // null -> the shared POLICY rates block is used in the chat prompt
  },
  sarah: {
    key: "sarah",
    name: "Sarah Grace Buckley",
    shortName: "Sarah",
    invoiceTo: "Sarah Grace Buckley",
    abn: "40 729 436 212",
    // Not yet set - the reference line is simply omitted until it is.
    artistFee: null,
    // Sarah's band economics (from her own fee sheet):
    // - $200 show fee per musician, no metro/interstate split known yet
    // - rehearsals ~$50 (Jesse $100), set per booking in the editor
    // - Jesse gets a $50 petrol allowance per show and per rehearsal
    // - fees are INCLUSIVE of super ("baked in"), never added on top
    // Travel day and per diem rates are inherited from the shared POLICY until
    // Sarah specifies her own.
    policy: {
      showFee: { vic: 200, interstate: 200 },
      transportCap: 50,
      transportLabel: "Petrol allowance ($50)",
      superMode: "inclusive",
      defaults: { showFee: 200, rehearsalFee: 50, petrol: 50 },
    },
    bandMembers: "Jacob, Tate, Lozz (each $200 show / $50 rehearsal), Jesse ($200 show / $100 rehearsal, plus $50 petrol per show and per rehearsal)",
    ratesText: [
      "- Show fee: $200 per musician (Jacob, Tate, Lozz, Jesse)",
      "- Rehearsal fee: $50 per musician per rehearsal; Jesse's rehearsals are $100 each (set per booking via hasRehearsal/rehearsalFee, or a Rehearsal engagement)",
      "- Jesse also receives a $50 petrol allowance per show and per rehearsal - use the per-engagement petrolFee field",
      "- ALL fees are INCLUSIVE of superannuation (super is baked in) - never add super on top, and say so when asked",
      "- Travel days ($" + POLICY.travelDay + ") and per diems ($" + POLICY.perDiem + ") follow the shared band policy until Sarah specifies her own",
    ].join("\n"),
  },
};

// The effective rate set for an artist: shared POLICY with the artist's
// overrides applied. superMode: "additional" (super added on top, Emma) or
// "inclusive" (super baked into the fees, Sarah).
export function effectiveRates(artistOrKey) {
  const a = typeof artistOrKey === "string" ? getArtist(artistOrKey) : (artistOrKey || ARTISTS.emma);
  return {
    showFee: POLICY.showFee, travelDay: POLICY.travelDay, perDiem: POLICY.perDiem,
    transportCap: POLICY.transportCap, superRate: POLICY.superRate,
    superMode: "additional", transportLabel: null, defaults: null,
    ...(a.policy || {}),
  };
}

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
