import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { POLICY } from "@/lib/policy";

const BG = [28, 20, 16];
const CARD = [42, 31, 24];
const GOLD = [212, 160, 74];
const CREAM = [245, 239, 230];
const DIM = [196, 184, 168];
const TH = [74, 56, 40];
const TA = [58, 44, 32];
const DIV = [74, 60, 48];

function newPage(doc, W, H) {
  doc.addPage();
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 5, "F");
  return 18;
}

function checkPage(doc, y, W, H, needed) {
  if (y + needed > H - 10) return newPage(doc, W, H);
  return y;
}

function wrapText(doc, text, maxW) {
  const words = text.split(" ");
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

const m$ = (n) => "$" + Number(n || 0).toLocaleString("en-AU", { maximumFractionDigits: 0 });

// Band Quote PDF (from the Quick Quote snapshot).
function quotePdf(q) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 20;
  const CW = W - M * 2;

  doc.setFillColor(...BG); doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...GOLD); doc.rect(0, 0, W, 5, "F");
  let y = 20;

  doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.setTextColor(...CREAM);
  doc.text("Emma Donovan", M, y);
  y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(...DIM);
  doc.text("Band Quote", M, y);
  y += 5; doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 9;

  // Summary
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...CREAM);
  wrapText(doc, q.summary || "", CW).forEach((l) => { y = checkPage(doc, y, W, H, 8); doc.text(l, M, y); y += 6; });
  y += 1;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...DIM);
  const sub = [q.trip.showDate, q.trip.locationLabel, (q.trip.nights ? q.trip.nights + " night(s) away" : "no overnight")].filter(Boolean).join("  -  ");
  doc.text(sub, M, y); y += 6;
  if (q.travel && q.travel.summary) { wrapText(doc, q.travel.summary, CW).forEach((l) => { y = checkPage(doc, y, W, H, 8); doc.text(l, M, y); y += 5; }); }
  y += 4;

  // Lineup comparison
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GOLD);
  doc.text("Lineup comparison", M, y); y += 7;
  doc.setFillColor(...TH); doc.roundedRect(M, y - 4, CW, 7, 1, 1, "F");
  doc.setFontSize(8.5); doc.setTextColor(...GOLD);
  doc.text("LINEUP", M + 3, y); doc.text("MUSICIANS", M + CW * 0.5, y); doc.text("BAND COST", M + CW - 32, y); y += 6;
  doc.setFontSize(9.5);
  (q.comparison || []).forEach((c, i) => {
    y = checkPage(doc, y, W, H, 8);
    if (i % 2 === 1) { doc.setFillColor(...TA); doc.rect(M, y - 4, CW, 7, "F"); }
    const sel = c.key === q.selected.key;
    doc.setFont("helvetica", sel ? "bold" : "normal"); doc.setTextColor(...(sel ? GOLD : CREAM));
    doc.text(c.label + (sel ? "  (selected)" : ""), M + 3, y);
    doc.setTextColor(...DIM);
    doc.text(c.musicians === 0 ? "-" : String(c.musicians), M + CW * 0.5, y);
    doc.setTextColor(...(sel ? GOLD : CREAM));
    doc.text(c.musicians === 0 ? "no band" : m$(c.total), M + CW - 32, y);
    y += 7;
  });
  y += 6;

  // Selected breakdown
  if (q.selected.musicians > 0) {
    y = checkPage(doc, y, W, H, 40);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GOLD);
    doc.text(q.selected.label + " - per musician", M, y); y += 7;
    doc.setFontSize(9.5);
    (q.selected.per.lines || []).forEach((l) => {
      y = checkPage(doc, y, W, H, 7);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...DIM); doc.text(l.label, M + 2, y);
      doc.setTextColor(...CREAM); doc.text(m$(l.amount), M + CW - 30, y); y += 5.5;
    });
    y += 1; doc.setDrawColor(...DIV); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 6;
    doc.setFont("helvetica", "bold"); doc.setTextColor(...CREAM);
    doc.text("Per musician", M + 2, y); doc.text(m$(q.selected.per.total), M + CW - 30, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...DIM);
    doc.text("x " + q.selected.musicians + " musician(s)", M + 2, y); y += 8;
    doc.setFillColor(...GOLD); doc.roundedRect(M, y - 5, CW, 10, 1, 1, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...BG);
    doc.text("ESTIMATED BAND TOTAL", M + 3, y + 1);
    doc.text(m$(q.selected.total), M + CW - 30, y + 1); y += 14;
  }

  // Travel reasons
  if (q.travel && (q.travel.reasons || []).length) {
    y = checkPage(doc, y, W, H, 20);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...GOLD);
    doc.text("Travel days", M, y); y += 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...DIM);
    q.travel.reasons.forEach((r) => { wrapText(doc, "- " + r.explanation, CW - 4).forEach((l) => { y = checkPage(doc, y, W, H, 6); doc.text(l, M, y); y += 4.5; }); });
    y += 4;
  }

  // Exclusions + Emma reference
  y = checkPage(doc, y, W, H, 24);
  doc.setDrawColor(...DIV); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...DIM);
  ["Flights, accommodation and backline are NOT included in this number.",
   "Emma's own performance fee (" + m$(q.emmaFeeReference) + "/show) sits in the P&L and is not part of the band cost. Figures exclude GST (added only for GST-registered musicians)."]
    .forEach((c) => { wrapText(doc, c, CW).forEach((l) => { y = checkPage(doc, y, W, H, 6); doc.text(l, M, y); y += 4.5; }); y += 1; });

  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) { doc.setPage(p); doc.setFillColor(...GOLD); doc.rect(0, H - 3, W, 3, "F"); }

  return new NextResponse(doc.output("arraybuffer"), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=band-quote.pdf" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body && body.quote) return quotePdf(body.quote);
    const { form } = body;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 20;
    const CW = W - M * 2;

    doc.setFillColor(...BG);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 0, W, 5, "F");

    let y = 20;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(...CREAM);
    doc.text("Emma Donovan", M, y);

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...DIM);
    const multiShow = form.shows && form.shows.length > 1;
    doc.text(multiShow ? "Fee Offer - " + form.shows.length + " Engagements" : "Fee Offer - Engagement", M, y);

    y += 5;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 10;

    // Shows
    const shows = form.shows || [];
    shows.forEach((show, idx) => {
      y = checkPage(doc, y, W, H, 50);

      if (multiShow) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...GOLD);
        doc.text((show.activity || "Performance").toUpperCase() + " " + (idx + 1) + " of " + shows.length, M, y);
        y += 7;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...GOLD);
        doc.text("Engagement Details", M, y);
        y += 7;
      }

      const details = [
        ["Engagement", show.engagement || "-"],
        ["Location", show.location || "-"],
        ["Date", show.performanceDate || "-"],
        ["Slot", show.slot || "-"],
      ];
      if (show.repertoire) details.push(["Repertoire", show.repertoire]);
      details.push(["Format", show.format || "-"]);
      if (multiShow) details.push(["Activity", show.activity || "Performance"]);

      doc.setFontSize(10);
      details.forEach(([label, value]) => {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...DIM);
        doc.text(label, M + 2, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...CREAM);
        doc.text(value, M + 45, y);
        y += 5.5;
      });

      if (multiShow && idx < shows.length - 1) {
        y += 3;
        doc.setDrawColor(...DIV);
        doc.setLineWidth(0.15);
        doc.line(M, y, W - M, y);
        y += 6;
      }
    });

    y += 5;
    doc.setDrawColor(...DIV);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 8;

    // Fee breakdown
    y = checkPage(doc, y, W, H, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text("Fee Breakdown", M, y);
    y += 7;

    // Build rows
    const rows = [];
    let total = 0;

    shows.forEach((show, i) => {
      const fee = Number(show.performanceFee) || POLICY.showFee.interstate;
      const label = multiShow
        ? show.activity + " fee - " + (show.engagement || "Show " + (i + 1)) + " (" + (show.performanceDate || "TBD") + ")"
        : show.activity + " fee";
      rows.push([label, fee, 1, fee]);
      total += fee;
      if (show.hasMdFee) {
        const md = Number(show.mdFee) || POLICY.mdFee.halfDay;
        rows.push([multiShow ? "Music Director - " + (show.engagement || "Show " + (i + 1)) : "Music Director fee", md, 1, md]);
        total += md;
      }
    });

    if (form.hasRehearsalFee) {
      const rh = Number(form.rehearsalFee) || POLICY.rehearsal.halfDay;
      rows.push(["Rehearsal" + (form.rehearsalNote ? " - " + form.rehearsalNote : ""), rh, 1, rh]);
      total += rh;
    }
    if (form.hasTravelDay) {
      // Flat travel-day rate per lib/policy.js. Travel on a show day is included
      // in the show fee, so only full non-show travel days are charged here.
      const td = POLICY.travelDay;
      const travelDays = Number(form.travelDays) || 1;
      rows.push(["Travel day", td, travelDays, td * travelDays]);
      total += td * travelDays;
    }
    const pdRaw = Number(form.perDiem);
    const pd = (form.perDiem === "" || form.perDiem == null || isNaN(pdRaw)) ? POLICY.perDiem : pdRaw;
    const pdDaysRaw = Number(form.pdDays);
    const pdDays = isNaN(pdDaysRaw) ? 0 : pdDaysRaw;
    if (pdDays > 0 && pd > 0) {
      rows.push(["Living allowance (per diem)", pd, pdDays, pd * pdDays]);
      total += pd * pdDays;
    }

    // Table
    const itemW = CW * 0.58;
    const amtX = M + itemW;
    const qtyX = amtX + 22;
    const totX = qtyX + 16;

    // Header
    doc.setFillColor(...TH);
    doc.roundedRect(M, y - 4, CW, 7, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GOLD);
    doc.text("ITEM", M + 3, y);
    doc.text("AMOUNT", amtX + 2, y);
    doc.text("QTY", qtyX + 2, y);
    doc.text("TOTAL", totX + 2, y);
    y += 6;

    // Rows
    doc.setFontSize(9);
    rows.forEach((row, i) => {
      doc.setFont("helvetica", "normal");
      const lines = wrapText(doc, row[0], itemW - 8);
      const rowH = Math.max(lines.length * 4.5 + 3, 7.5);

      y = checkPage(doc, y, W, H, rowH + 5);

      if (i % 2 === 1) {
        doc.setFillColor(...TA);
        doc.rect(M, y - 4, CW, rowH, "F");
      }

      doc.setTextColor(...CREAM);
      lines.forEach((line, li) => doc.text(line, M + 3, y + li * 4.5));
      doc.text("$" + Number(row[1]).toLocaleString(), amtX + 2, y);
      doc.text(String(row[2]), qtyX + 2, y);
      doc.text("$" + Number(row[3]).toLocaleString(), totX + 2, y);
      y += rowH;
    });

    // Total
    y += 1;
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y - 4.5, CW, 9, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...BG);
    doc.text("TOTAL INVOICE", M + 3, y);
    const ts = "$" + Number(total).toLocaleString();
    doc.text(ts, totX + 2, y);
    doc.setFontSize(7.5);
    doc.text("GST excl", totX + 2 + doc.getTextWidth(ts) + 2, y);

    y += 14;

    // Conditions
    y = checkPage(doc, y, W, H, 40);
    doc.setDrawColor(...DIV);
    doc.setLineWidth(0.2);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text("Conditions", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DIM);
    [
      "Upon acceptance of this offer, a tour schedule and charts will be prepared and distributed.",
      "Fees are payable within 14 days of the invoice date, following the performance.",
      "Superannuation contributions will be made at " + (form.superRate || Math.round(POLICY.superRate * 100)) + "% of performance and rehearsal fees to the nominated fund.",
      "Please add the living allowance (per diem) to your invoice.",
    ].forEach((c) => {
      wrapText(doc, c, CW - 4).forEach((cl) => { doc.text(cl, M, y); y += 4.5; });
      y += 1;
    });

    // Transport
    y += 2;
    y = checkPage(doc, y, W, H, 35);
    doc.setDrawColor(...DIV);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text("Transport & Accommodation", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DIM);

    const tLines = [];
    if (form.transportType === "interstate_provided") tLines.push("If you are travelling interstate, travel is provided.");
    else if (form.transportType === "flights_accom") tLines.push("Where interstate travel is required, flights and accommodation are provided.");
    else if (form.transportType === "travel_provided") tLines.push("Travel is provided.");
    if (form.reimbursementCap && form.reimbursementItems) {
      tLines.push("A reimbursement of up to $" + form.reimbursementCap + " will be provided for " + form.reimbursementItems + " upon receipt of proof of payment.");
      tLines.push("Travel reimbursements are handled separately and cannot be included in the fee.");
    }
    if (form.hasAccommodation && form.transportType !== "flights_accom") tLines.push(form.accommodationNote || "Accommodation is provided where an overnight stay is required.");

    tLines.forEach((l) => {
      wrapText(doc, l, CW - 4).forEach((tl) => { doc.text(tl, M, y); y += 4.5; });
      y += 1;
    });

    // Invoice to
    y += 2;
    y = checkPage(doc, y, W, H, 25);
    doc.setDrawColor(...DIV);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text("Invoice To", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...CREAM);
    doc.text("Jiindahood Pty Ltd", M, y);
    y += 5;
    doc.setTextColor(...DIM);
    doc.text("ABN: 61 663 395 364", M, y);

    // Bottom bar on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor(...GOLD);
      doc.rect(0, H - 3, W, 3, "F");
    }

    return new NextResponse(doc.output("arraybuffer"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=rate-card.pdf",
      },
    });
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
