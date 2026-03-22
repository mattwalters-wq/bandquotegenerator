export const DEFAULT_VALUES = {
  artistName: "EMMA DONOVAN",
  invoiceTo: "Jiindahood Pty Ltd",
  abn: "61 663 395 364",
  baseFee: 550,
  perDiem: 89,
  superRate: 12,
  reimbursementCap: 80,
};

export const EMPTY_SHOW = {
  engagement: "",
  location: "",
  performanceDate: "",
  slot: "Evening",
  repertoire: "",
  format: "Duo",
  activity: "Performance",
  performanceFee: DEFAULT_VALUES.baseFee,
  hasMdFee: false,
  mdFee: 225,
};

export const INITIAL_FORM = {
  shows: [{ ...EMPTY_SHOW }],
  hasRehearsalFee: false,
  rehearsalFee: 225,
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

  form.shows.forEach((show, i) => {
    const fee = Number(show.performanceFee);
    const label = form.shows.length > 1
      ? show.activity + " fee - " + (show.engagement || "Show " + (i + 1)) + " (" + (show.performanceDate || "TBD") + ")"
      : show.activity + " fee";
    rows.push({ item: label, amount: fee, qty: 1, total: fee });
    total += fee;

    if (show.hasMdFee) {
      const md = Number(show.mdFee);
      const mdLabel = form.shows.length > 1
        ? "Music Director fee - " + (show.engagement || "Show " + (i + 1))
        : "Music Director fee";
      rows.push({ item: mdLabel, amount: md, qty: 1, total: md });
      total += md;
    }
  });

  if (form.hasRehearsalFee) {
    const rh = Number(form.rehearsalFee);
    rows.push({ item: "Rehearsal" + (form.rehearsalNote ? " - " + form.rehearsalNote : ""), amount: rh, qty: 1, total: rh });
    total += rh;
  }

  if (form.hasTravelDay) {
    const baseFee = Number(form.shows[0]?.performanceFee || DEFAULT_VALUES.baseFee);
    const td = Math.round(baseFee * 0.5);
    const travelDays = Number(form.travelDays) || 1;
    const tdTotal = td * travelDays;
    rows.push({ item: "Travel day (50% of show fee)", amount: td, qty: travelDays, total: tdTotal });
    total += tdTotal;
  }

  const pd = Number(form.perDiem);
  const pdDays = Number(form.pdDays);
  const pdTotal = pd * pdDays;
  rows.push({ item: "Living allowance (per diem)", amount: pd, qty: pdDays, total: pdTotal });
  total += pdTotal;

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
  const showRef = showCount === 1
    ? (form.shows[0].engagement || "the upcoming show")
    : "the following " + showWord;

  let body = "Hi " + name + ",\n\n";
  body += "Hope you're well.\n\n";
  body += "On behalf of Emma, please find attached the fee offer for " + showRef;

  if (showCount === 1 && form.shows[0].performanceDate) {
    body += " on " + form.shows[0].performanceDate;
  }
  body += ".\n";

  if (showCount > 1) {
    body += "\n" + showLines.join("\n") + "\n";
  }

  body += "\nThe total for this offer is " + formatCurrency(total) + " (GST excl). Full breakdown is in the attached rate card.\n";
  body += "\nPlease respond in writing with \"Yes\" to confirm your availability and acceptance of the offer.\n";
  body += "\nLet me know if you have any questions.\n";
  body += "\nThanks,\nMatt";

  const subject = showCount === 1
    ? "Emma Donovan - Fee Offer - " + (form.shows[0].engagement || "Engagement") + (form.shows[0].performanceDate ? ", " + form.shows[0].performanceDate : "")
    : "Emma Donovan - Fee Offer - " + showCount + " " + showWord;

  return { subject, body };
}
