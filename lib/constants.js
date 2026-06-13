import { POLICY } from "./policy";

// Rates here are derived from lib/policy.js (the single source of truth).
export const DEFAULT_VALUES = {
  artistName: "EMMA DONOVAN",
  invoiceTo: "Jiindahood Pty Ltd",
  abn: "61 663 395 364",
  localFee: POLICY.showFee.vic,
  interstateFee: POLICY.showFee.interstate,
  perDiem: POLICY.perDiem,
  superRate: Math.round(POLICY.superRate * 100), // stored as a percentage in the editor
  reimbursementCap: POLICY.transportCap,
};

export const EMPTY_SHOW = {
  engagement: "",
  location: "",
  performanceDate: "",
  slot: "Evening",
  repertoire: "",
  format: "Duo",
  activity: "Performance",
  feeType: "interstate",
  performanceFee: DEFAULT_VALUES.interstateFee,
  hasMdFee: false,
  mdFee: POLICY.mdFee.halfDay,
};

export const INITIAL_FORM = {
  shows: [{ ...EMPTY_SHOW }],
  homeBase: "Melbourne",      // recipient's home base - drives per-player travel days
  soundcheck: "",             // optional soundcheck/load-in time for travel inference
  travelComputed: false,      // true once travel days were auto-computed
  travelManual: false,        // true if the manager hand-edited travel days after computing
  hasRehearsalFee: false,
  rehearsalFee: POLICY.rehearsal.halfDay,
  rehearsalNote: "1/2 day rehearsal",
  hasTravelDay: false,
  travelDays: 1,
  perDiem: DEFAULT_VALUES.perDiem,
  pdDays: 1,
  superRate: DEFAULT_VALUES.superRate,
  reimbursementCap: DEFAULT_VALUES.reimbursementCap,
  transportType: "interstate_provided",
  reimbursementItems: "Ubers or parking",
  hasAccommodation: true,
  accommodationNote: "Accommodation is provided where an overnight stay is required.",
  recipientName: "",
};

export const SLOT_OPTIONS = ["Evening", "Day", "Mixed", "Afternoon"];
export const FORMAT_OPTIONS = ["Duo", "Emma + 3", "Full Band", "Em Solo", "Emma + 2"];
export const ACTIVITY_OPTIONS = ["Performance", "Rehearsal", "Performance + Rehearsal"];
export const TRANSPORT_OPTIONS = [
  { value: "interstate_provided", label: "Interstate travel provided" },
  { value: "flights_accom", label: "Flights and accommodation provided" },
  { value: "travel_provided", label: "Travel provided (all)" },
  { value: "none", label: "Self-arranged" },
];
export const REIMBURSEMENT_OPTIONS = ["Ubers or parking", "fuel or parking", "fuel, Ubers or parking"];

export function formatCurrency(n) {
  return "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: 0 });
}

export function buildRows(form) {
  const rows = [];
  let total = 0;
  const multiShow = form.shows && form.shows.length > 1;

  form.shows.forEach((show, i) => {
    const fee = Number(show.performanceFee) || DEFAULT_VALUES.interstateFee;
    const label = multiShow
      ? show.activity + " fee - " + (show.engagement || "Show " + (i + 1)) + " (" + (show.performanceDate || "TBD") + ")"
      : show.activity + " fee";
    rows.push({ item: label, amount: fee, qty: 1, total: fee });
    total += fee;

    if (show.hasMdFee) {
      const md = Number(show.mdFee) || 225;
      const mdLabel = multiShow ? "Music Director fee - " + (show.engagement || "Show " + (i + 1)) : "Music Director fee";
      rows.push({ item: mdLabel, amount: md, qty: 1, total: md });
      total += md;
    }
  });

  if (form.hasRehearsalFee) {
    const rh = Number(form.rehearsalFee) || 225;
    rows.push({ item: "Rehearsal" + (form.rehearsalNote ? " - " + form.rehearsalNote : ""), amount: rh, qty: 1, total: rh });
    total += rh;
  }

  if (form.hasTravelDay) {
    // Flat travel-day rate per lib/policy.js (a full non-show day consumed by
    // required travel). Travel on a show day is included in the show fee.
    const td = POLICY.travelDay;
    const travelDays = Number(form.travelDays) || 1;
    rows.push({ item: "Travel day", amount: td, qty: travelDays, total: td * travelDays });
    total += td * travelDays;
  }

  // Per diem (living allowance). Allow 0 to remove it - only add the row when
  // there are nights AND a rate. An empty rate falls back to the policy default.
  const pdRaw = Number(form.perDiem);
  const pd = (form.perDiem === "" || form.perDiem == null || isNaN(pdRaw)) ? POLICY.perDiem : pdRaw;
  const pdDaysRaw = Number(form.pdDays);
  const pdDays = isNaN(pdDaysRaw) ? 0 : pdDaysRaw;
  if (pdDays > 0 && pd > 0) {
    rows.push({ item: "Living allowance (per diem)", amount: pd, qty: pdDays, total: pd * pdDays });
    total += pd * pdDays;
  }

  return { rows, total };
}

export function buildTransportLines(form) {
  const lines = [];
  if (form.transportType === "interstate_provided") lines.push("If you are travelling interstate, travel is provided.");
  else if (form.transportType === "flights_accom") lines.push("Where interstate travel is required, flights and accommodation are provided.");
  else if (form.transportType === "travel_provided") lines.push("Travel is provided.");

  if (form.reimbursementCap && form.reimbursementItems) {
    lines.push("A reimbursement of up to " + formatCurrency(form.reimbursementCap) + " will be provided for " + form.reimbursementItems + " upon receipt of proof of payment.");
    lines.push("Travel reimbursements are handled separately and cannot be included in the fee.");
  }
  if (form.hasAccommodation && form.transportType !== "flights_accom") {
    lines.push(form.accommodationNote);
  }
  return lines;
}

export function generateEmail(form) {
  const name = form.recipientName || "there";
  const showCount = form.shows.length;

  const showLines = form.shows.map((show) => {
    const parts = [];
    if (show.performanceDate) parts.push(show.performanceDate);
    if (show.engagement) parts.push(show.engagement);
    if (show.location) parts.push(show.location);
    if (show.format) parts.push("(" + show.format + ")");
    if (show.activity !== "Performance") parts.push("[" + show.activity + "]");
    return "  - " + parts.join(" - ");
  });

  const { total } = buildRows(form);
  const showWord = showCount === 1 ? "engagement" : "engagements";
  const showRef = showCount === 1 ? (form.shows[0].engagement || "the upcoming show") : "the following " + showWord;

  let body = "Hi " + name + ",\n\n";
  body += "Hope you're well.\n\n";
  body += "On behalf of Emma, please find attached the fee offer for " + showRef;
  if (showCount === 1 && form.shows[0].performanceDate) body += " on " + form.shows[0].performanceDate;
  body += ".\n";
  if (showCount > 1) body += "\n" + showLines.join("\n") + "\n";
  body += "\nThe total for this offer is " + formatCurrency(total) + " (GST excl). Full breakdown is in the attached rate card.\n";
  body += "\nPlease respond in writing with \"Yes\" to confirm your availability and acceptance of the offer.\n";
  body += "\nLet me know if you have any questions.\n";
  body += "\nThanks,\nMatt";

  const subject = showCount === 1
    ? "Emma Donovan - Fee Offer - " + (form.shows[0].engagement || "Engagement") + (form.shows[0].performanceDate ? ", " + form.shows[0].performanceDate : "")
    : "Emma Donovan - Fee Offer - " + showCount + " " + showWord;

  return { subject, body };
}
