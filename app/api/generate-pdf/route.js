import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { POLICY } from "@/lib/policy";
import { buildRows } from "@/lib/constants";
import { getArtist } from "@/lib/artists";
import { snapshotArtist } from "@/lib/quote";

// Clean, light, editorial document - warm white paper, dark brown ink, a
// restrained gold accent. Far more professional (and printable) than a dark fill.
const PAPER = [255, 253, 248];
const INK = [38, 30, 22];
const SOFT = [92, 79, 66];
const FAINT = [150, 136, 120];
const GOLD = [169, 118, 42];
const RULE = [228, 217, 199];
const ALT = [248, 243, 234];

const money = (n) => "$" + Number(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 });

function wrapText(doc, text, maxW) {
  const words = String(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (doc.getTextWidth(test) > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function frame(doc, W, H) {
  doc.setFillColor(...PAPER); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 0, W, 2.2, "F"); // slim brand rule
}

function footer(doc, W, H, artistName) {
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(22, H - 12, W - 22, H - 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...FAINT);
    doc.text(artistName || "Emma Donovan", 22, H - 8);
    doc.text(p + " / " + pages, W - 22, H - 8, { align: "right" });
  }
}

function checkPage(doc, y, W, H, need) {
  if (y + need > H - 18) { doc.addPage(); frame(doc, W, H); return 22; }
  return y;
}

// Small-caps gold section heading with a hairline rule beneath.
function heading(doc, text, M, W, y) {
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...GOLD);
  doc.setCharSpace(0.8);
  doc.text(text.toUpperCase(), M, y);
  doc.setCharSpace(0);
  doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M, y + 2.5, W - M, y + 2.5);
  return y + 9;
}

function detailRow(doc, M, y, label, value) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...FAINT);
  doc.text(label, M, y);
  doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
  doc.text(String(value || "-"), M + 40, y);
  return y + 6;
}

// ---------------------------------------------------------------------------
// Rate card (fee offer) PDF
// ---------------------------------------------------------------------------
function rateCardPdf(form) {
  const artist = getArtist(form && form.artist);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 22;
  const CW = W - M * 2;
  frame(doc, W, H);
  let y = 24;

  const shows = form.shows || [];
  const multiShow = shows.length > 1;

  // Masthead
  doc.setFont("times", "bold"); doc.setFontSize(28); doc.setTextColor(...INK);
  doc.text(artist.name, M, y);
  y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...FAINT);
  doc.setCharSpace(1.2);
  doc.text((multiShow ? "FEE OFFER - " + shows.length + " ENGAGEMENTS" : "FEE OFFER"), M, y);
  doc.setCharSpace(0);
  y += 6;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 11;

  // Engagement details
  shows.forEach((show, idx) => {
    y = checkPage(doc, y, W, H, 44);
    const title = multiShow ? "Engagement " + (idx + 1) + " - " + (show.activity || "Performance") : "Engagement Details";
    y = heading(doc, title, M, W, y);
    y = detailRow(doc, M, y, "Engagement", show.engagement);
    y = detailRow(doc, M, y, "Location", show.location);
    y = detailRow(doc, M, y, "Date", show.performanceDate);
    y = detailRow(doc, M, y, "Slot", show.slot);
    if (show.repertoire) y = detailRow(doc, M, y, "Repertoire", show.repertoire);
    y = detailRow(doc, M, y, "Format", show.format);
    y += 5;
  });

  // Fee breakdown - assembled by the same buildRows as the live preview, so
  // the PDF can never disagree with the app (single source of line-item truth).
  const { rows: rowObjs, total, superAmount } = buildRows(form);
  const rows = rowObjs.map((r) => [r.item, r.amount, r.qty, r.total]);

  y = checkPage(doc, y, W, H, 30);
  y = heading(doc, "Fee Breakdown", M, W, y);

  const totalX = W - M;
  const qtyX = totalX - 26;
  const amtX = qtyX - 24;
  const itemMax = amtX - M - 6;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...FAINT);
  doc.setCharSpace(0.5);
  doc.text("ITEM", M, y); doc.text("AMOUNT", amtX, y, { align: "right" }); doc.text("QTY", qtyX, y, { align: "right" }); doc.text("TOTAL", totalX, y, { align: "right" });
  doc.setCharSpace(0);
  y += 2; doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5;

  doc.setFontSize(9.5);
  rows.forEach((r) => {
    const lines = wrapText(doc, r[0], itemMax);
    const rowH = Math.max(lines.length * 4.6 + 2.4, 7);
    y = checkPage(doc, y, W, H, rowH + 4);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
    lines.forEach((l, li) => doc.text(l, M, y + li * 4.6));
    doc.setTextColor(...SOFT);
    doc.text(money(r[1]), amtX, y, { align: "right" });
    doc.text(String(r[2]), qtyX, y, { align: "right" });
    doc.setTextColor(...INK); doc.text(money(r[3]), totalX, y, { align: "right" });
    y += rowH;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.15); doc.line(M, y - 2.4, W - M, y - 2.4);
  });

  // Total
  y += 3.5;
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, y - 4, W - M, y - 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
  doc.text("Total", M, y + 1);
  doc.setFontSize(13); doc.setTextColor(...GOLD);
  doc.text(money(total), totalX, y + 1, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...FAINT);
  doc.text("GST excl", totalX, y + 6, { align: "right" });
  y += 15;

  // Conditions
  const conditions = [
    "Upon acceptance of this offer, a tour schedule and charts will be prepared and distributed.",
    "Fees are payable within 14 days of the invoice date, following the performance.",
    "Superannuation contributions will be made at " + (form.superRate || Math.round(POLICY.superRate * 100)) + "% of performance and rehearsal fees" + (superAmount > 0 ? " (" + money(superAmount) + ")" : "") + " to the nominated fund.",
    "Please add the living allowance (per diem) to your invoice.",
  ];
  y = checkPage(doc, y, W, H, 40);
  y = heading(doc, "Conditions", M, W, y);
  y = bulletList(doc, M, W, H, y, conditions);
  y += 4;

  // Transport
  const tLines = [];
  if (form.transportType === "interstate_provided") tLines.push("If you are travelling interstate, travel is provided.");
  else if (form.transportType === "flights_accom") tLines.push("Where interstate travel is required, flights and accommodation are provided.");
  else if (form.transportType === "travel_provided") tLines.push("Travel is provided.");
  if (form.reimbursementCap && form.reimbursementItems) {
    tLines.push("A reimbursement of up to $" + form.reimbursementCap + " will be provided for " + form.reimbursementItems + " upon receipt of proof of payment.");
    tLines.push("Travel reimbursements are handled separately and cannot be included in the fee.");
  }
  if (form.hasAccommodation && form.transportType !== "flights_accom") tLines.push(form.accommodationNote || "Accommodation is provided where an overnight stay is required.");
  if (tLines.length) {
    y = checkPage(doc, y, W, H, 30);
    y = heading(doc, "Transport & Accommodation", M, W, y);
    y = bulletList(doc, M, W, H, y, tLines);
    y += 4;
  }

  // Invoice to
  y = checkPage(doc, y, W, H, 24);
  y = heading(doc, "Invoice To", M, W, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...INK);
  doc.text(artist.invoiceTo, M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT);
  doc.text("ABN: " + artist.abn, M, y);

  footer(doc, W, H, artist.name);
  return respond(doc, "rate-card");
}

function bulletList(doc, M, W, H, y, items) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...SOFT);
  items.forEach((c) => {
    const lines = wrapText(doc, c, W - M * 2 - 5);
    y = checkPage(doc, y, W, H, lines.length * 4.6 + 3);
    doc.setTextColor(...GOLD); doc.text("-", M, y);
    doc.setTextColor(...SOFT);
    lines.forEach((l, li) => doc.text(l, M + 5, y + li * 4.6));
    y += lines.length * 4.6 + 2.4;
  });
  return y;
}

// ---------------------------------------------------------------------------
// Band Quote PDF (from the Quick Quote snapshot)
// ---------------------------------------------------------------------------
function quotePdf(q) {
  const artist = snapshotArtist(q);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 22;
  const CW = W - M * 2;
  frame(doc, W, H);
  let y = 24;

  doc.setFont("times", "bold"); doc.setFontSize(28); doc.setTextColor(...INK);
  doc.text(artist.name, M, y);
  y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...FAINT);
  doc.setCharSpace(1.2); doc.text("BAND QUOTE", M, y); doc.setCharSpace(0);
  y += 6; doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 11;

  // Summary
  doc.setFont("times", "italic"); doc.setFontSize(14); doc.setTextColor(...INK);
  wrapText(doc, q.summary || "", CW).forEach((l) => { y = checkPage(doc, y, W, H, 8); doc.text(l, M, y); y += 7; });
  y += 1;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...FAINT);
  const sub = [q.trip.showDate, q.trip.locationLabel, (q.trip.nights ? q.trip.nights + " night(s) away" : "no overnight")].filter(Boolean).join("   -   ");
  doc.text(sub, M, y); y += 6;
  if (q.travel && q.travel.summary) { doc.setTextColor(...SOFT); wrapText(doc, q.travel.summary, CW).forEach((l) => { y = checkPage(doc, y, W, H, 7); doc.text(l, M, y); y += 5; }); }
  y += 5;

  // Lineup comparison
  y = checkPage(doc, y, W, H, 30);
  y = heading(doc, "Lineup comparison", M, W, y);
  const totalX = W - M, musX = totalX - 34;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...FAINT); doc.setCharSpace(0.5);
  doc.text("LINEUP", M, y); doc.text("MUSICIANS", musX, y, { align: "right" }); doc.text("BAND COST", totalX, y, { align: "right" });
  doc.setCharSpace(0); y += 2; doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5;
  doc.setFontSize(10);
  (q.comparison || []).forEach((c) => {
    y = checkPage(doc, y, W, H, 8);
    const sel = c.key === q.selected.key;
    doc.setFont("helvetica", sel ? "bold" : "normal"); doc.setTextColor(...(sel ? GOLD : INK));
    doc.text(c.label + (sel ? "  (selected)" : ""), M, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT);
    doc.text(c.musicians === 0 ? "-" : String(c.musicians), musX, y, { align: "right" });
    doc.setFont("helvetica", sel ? "bold" : "normal"); doc.setTextColor(...(sel ? GOLD : INK));
    doc.text(c.musicians === 0 ? "no band" : money(c.total), totalX, y, { align: "right" });
    y += 6.5; doc.setDrawColor(...RULE); doc.setLineWidth(0.15); doc.line(M, y - 2.4, W - M, y - 2.4);
  });
  y += 6;

  // Selected breakdown
  if (q.selected.musicians > 0) {
    y = checkPage(doc, y, W, H, 44);
    y = heading(doc, q.selected.label + " - per musician", M, W, y);
    doc.setFontSize(9.5);
    (q.selected.per.lines || []).forEach((l) => {
      y = checkPage(doc, y, W, H, 7);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT); doc.text(l.label, M, y);
      doc.setTextColor(...INK); doc.text(money(l.amount), totalX, y, { align: "right" }); y += 5.6;
    });
    doc.setDrawColor(...RULE); doc.setLineWidth(0.2); doc.line(M, y - 2, W - M, y - 2); y += 4;
    doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
    doc.text("Per musician", M, y); doc.text(money(q.selected.per.total), totalX, y, { align: "right" }); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...SOFT);
    doc.text("x " + q.selected.musicians + " musician(s)", M, y); y += 9;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, y - 4.5, W - M, y - 4.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text("Estimated band total", M, y + 1);
    doc.setFontSize(14); doc.setTextColor(...GOLD);
    doc.text(money(q.selected.total), totalX, y + 1, { align: "right" }); y += 14;
  }

  if (q.travel && (q.travel.reasons || []).length) {
    y = checkPage(doc, y, W, H, 24);
    y = heading(doc, "Travel days", M, W, y);
    y = bulletList(doc, M, W, H, y, q.travel.reasons.map((r) => r.explanation));
    y += 4;
  }

  y = checkPage(doc, y, W, H, 26);
  y = heading(doc, "Not included", M, W, y);
  y = bulletList(doc, M, W, H, y, [
    "Flights, accommodation and backline are not included in this number.",
    (artist.artistFee ? artist.shortName + "'s own performance fee (" + money(artist.artistFee) + "/show) sits in the P&L and is not part of the band cost. " : "") + "Figures exclude GST (added only for GST-registered musicians).",
  ]);

  footer(doc, W, H, artist.name);
  return respond(doc, "band-quote");
}

function respond(doc, name) {
  return new NextResponse(doc.output("arraybuffer"), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=" + name + ".pdf" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body && body.quote) return quotePdf(body.quote);
    return rateCardPdf(body.form);
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
