export const DEFAULT_VALUES = {
  artistName: "EMMA DONOVAN",
  invoiceTo: "Jiindahood Pty Ltd",
  abn: "61 663 395 364",
  localFee: 450,
  interstateFee: 540,
  perDiem: 89,
  superRate: 12,
  reimbursementCap: 80,
};

export const INITIAL_FORM = {
  engagement: "",
  location: "",
  performanceDate: "",
  slot: "Evening",
  repertoire: "",
  format: "Duo",
  feeType: "local",
  performanceFee: DEFAULT_VALUES.localFee,
  hasMdFee: false,
  mdFee: 225,
  hasRehearsalFee: false,
  rehearsalFee: 225,
  rehearsalNote: "1/2 day rehearsal",
  hasTravelDay: false,
  perDiem: DEFAULT_VALUES.perDiem,
  pdDays: 1,
  superRate: DEFAULT_VALUES.superRate,
  reimbursementCap: DEFAULT_VALUES.reimbursementCap,
  transportType: "interstate_provided",
  reimbursementItems: "Ubers or parking",
  hasAccommodation: true,
  accommodationNote: "Accommodation is provided where an overnight stay is required.",
};

export const SLOT_OPTIONS = ["Evening", "Day", "Mixed", "Afternoon"];
export const FORMAT_OPTIONS = ["Duo", "Emma + 3", "Full Band", "Em Solo", "Emma + 2"];
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
  const fee = Number(form.performanceFee);

  const feeLabel = form.feeType === "interstate" ? " (Interstate)" : form.feeType === "local" ? " (Local)" : "";
  rows.push({ item: "Performance fee" + feeLabel, amount: fee, qty: 1, total: fee });
  total += fee;

  if (form.hasMdFee) {
    const md = Number(form.mdFee);
    rows.push({ item: "Music Director fee", amount: md, qty: 1, total: md });
    total += md;
  }
  if (form.hasRehearsalFee) {
    const rh = Number(form.rehearsalFee);
    rows.push({ item: "Rehearsal" + (form.rehearsalNote ? " - " + form.rehearsalNote : ""), amount: rh, qty: 1, total: rh });
    total += rh;
  }
  if (form.hasTravelDay) {
    const td = Math.round(fee * 0.5);
    rows.push({ item: "Travel day (50% of show fee)", amount: td, qty: 1, total: td });
    total += td;
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
