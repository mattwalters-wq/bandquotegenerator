// =============================================================================
// POLICY - SINGLE SOURCE OF TRUTH
// =============================================================================
// Every fee calculation in this app (the AI chat, the rate card editor, and the
// Quick Quote mode) reads its rates from this one object. If a rate changes,
// change it here and it changes everywhere. Do not hardcode rates elsewhere.
//
// This tool prices THE BAND EMMA HIRES. Emma's own performance fee (emmaFee) is
// tracked separately in the P&L and is NOT part of any band quote - it is shown
// only as a reference line so the numbers match how the P&L is built.
// =============================================================================

export const POLICY = {
  // Per-show performance fee for one band member.
  // "vic" = Melbourne metro / Victorian local. "interstate" = travel-away gigs
  // (interstate capitals and regional both attract the interstate fee).
  showFee: { vic: 450, interstate: 550 },

  // Travel day: a FLAT $275, payable per band member per travel day.
  // IMPORTANT - travel day trigger: a travel day is only payable for a FULL,
  // NON-SHOW day that is consumed by required travel. Travel that happens on a
  // show day is already included in the show fee and is NOT a separate travel day.
  travelDay: 275,

  // Music Director fee (when a member also musically directs).
  mdFee: { halfDay: 225, fullDay: 450 },

  // Standalone rehearsal fee (separate from a show).
  rehearsal: { halfDay: 225, fullDay: 550 },

  // Living allowance, paid per band member per OVERNIGHT STAY only.
  perDiem: 89,

  // Transport reimbursement cap per band member (receipts required, pre-agreed).
  // Covers Ubers / parking / fuel.
  transportCap: 80,

  // Superannuation, applied to PERFORMANCE and REHEARSAL fees only
  // (not to travel days, per diems or transport).
  superRate: 0.12,

  // GST, applied per band member ONLY if that member is GST registered.
  // Default is off (most session players are not registered).
  gst: { rate: 0.1, defaultRegistered: false },

  // Emma's own per-show performance fee. Handled in the P&L, NOT included in any
  // band quote. Surfaced only as a reference figure.
  emmaFee: 2000,
};

// -----------------------------------------------------------------------------
// Lineups - how many BAND MEMBERS (musicians Emma hires) each lineup implies.
// Emma herself is not counted as a hired band member.
// -----------------------------------------------------------------------------
export const LINEUPS = [
  { key: "solo",  label: "Solo",      musicians: 0 }, // Emma only, no band hired
  { key: "duo",   label: "Duo",       musicians: 1 },
  { key: "emma2", label: "Emma +2",   musicians: 2 },
  { key: "emma3", label: "Emma +3",   musicians: 3 },
  { key: "full",  label: "Full Band", musicians: 5 }, // Emma + 5 musicians
];

export function lineup(key) {
  return LINEUPS.find((l) => l.key === key) || LINEUPS[0];
}

// -----------------------------------------------------------------------------
// Location classes - drive the show fee and a suggested number of nights away.
// Nights are always overridable in the UI.
// -----------------------------------------------------------------------------
export const LOCATION_CLASSES = [
  {
    key: "metro",
    label: "Melbourne metro",
    feeKey: "vic",
    canTravelShowDayDefault: true, // local, band travels on the show day
    suggestedNights: 0,
    maxNights: 1,
  },
  {
    key: "capital",
    label: "Interstate capital",
    feeKey: "interstate",
    canTravelShowDayDefault: false,
    suggestedNights: 1, // typically 0-1
    maxNights: 3,
  },
  {
    key: "regional",
    label: "Regional",
    feeKey: "interstate",
    canTravelShowDayDefault: false,
    suggestedNights: 2, // typically 1-2
    maxNights: 4,
  },
];

export function locationClass(key) {
  return LOCATION_CLASSES.find((c) => c.key === key) || LOCATION_CLASSES[0];
}

// -----------------------------------------------------------------------------
// Core calculations - all derived from POLICY above.
// -----------------------------------------------------------------------------

export function showFeeFor(feeKey) {
  return POLICY.showFee[feeKey] ?? POLICY.showFee.interstate;
}

// Superannuation on a set of performance/rehearsal fees.
export function superOn(feeTotal) {
  return Math.round(feeTotal * POLICY.superRate);
}

// Cost for ONE band member for a single trip.
//   feeKey      - "vic" | "interstate"
//   travelDays  - full non-show travel days (flat rate each)
//   nights      - overnight stays (per diem each)
//   gstRegistered - add GST to this member's fees if true
export function computeMusician({ feeKey, travelDays = 0, nights = 0, gstRegistered = false }) {
  const showFee = showFeeFor(feeKey);
  const travel = travelDays * POLICY.travelDay;
  const perDiem = nights * POLICY.perDiem;
  const transport = POLICY.transportCap;
  const superAmt = superOn(showFee); // no rehearsal in a quick quote
  const subtotal = showFee + travel + perDiem + transport + superAmt;
  const gst = gstRegistered ? Math.round(showFee * POLICY.gst.rate) : 0;
  return {
    showFee,
    travelDays,
    travel,
    nights,
    perDiem,
    transport,
    super: superAmt,
    gst,
    total: subtotal + gst,
    lines: [
      { label: "Show fee", amount: showFee },
      ...(travelDays ? [{ label: travelDays + " travel day" + (travelDays > 1 ? "s" : "") + " @ $" + POLICY.travelDay, amount: travel }] : []),
      ...(nights ? [{ label: nights + " per diem" + (nights > 1 ? "s" : "") + " @ $" + POLICY.perDiem, amount: perDiem }] : []),
      { label: "Transport allowance (up to $" + POLICY.transportCap + ")", amount: transport },
      { label: "Super (" + Math.round(POLICY.superRate * 100) + "%)", amount: superAmt },
      ...(gst ? [{ label: "GST (10%)", amount: gst }] : []),
    ],
  };
}

// Whole-band cost for a single trip (musicians only; Emma excluded).
export function computeBand({ feeKey, musicians, travelDays = 0, nights = 0, gstRegistered = false }) {
  const per = computeMusician({ feeKey, travelDays, nights, gstRegistered });
  return {
    musicians,
    per,
    total: per.total * musicians,
  };
}

// Suggested nights away given a location class and whether the band can travel
// on the show day. Always overridable in the UI.
export function suggestedNights(locClass, canTravelShowDay) {
  if (canTravelShowDay) return 0;
  return locClass.suggestedNights;
}

// In the simple model, each non-show night away is also a non-show travel day,
// and travel that happens on the show day is included in the show fee.
export function travelDaysFor(canTravelShowDay, nights) {
  return canTravelShowDay ? 0 : nights;
}

// Currency formatting, shared everywhere.
export function money(n) {
  return "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
