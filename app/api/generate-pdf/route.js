import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";

const DARK_BG = [26, 26, 46];
const ACCENT = [233, 69, 96];
const WHITE = [255, 255, 255];
const SUBTLE = [176, 176, 176];
const TABLE_ALT = [15, 52, 96];
const TABLE_BG = [22, 33, 62];
const DIVIDER = [51, 51, 85];

function newPage(doc, W, H) {
  doc.addPage();
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, W, H, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, W, 6, "F");
  return 20;
}

function checkPage(doc, y, W, H, needed) {
  if (y + needed > H - 12) return newPage(doc, W, H);
  return y;
}

// Wrap text to fit within maxWidth, return array of lines
function wrapText(doc, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (doc.getTextWidth(test) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function POST(request) {
  try {
    const { form } = await request.json();

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 20;
    const CW = W - M * 2;

    // Background
    doc.setFillColor(...DARK_BG);
    doc.rect(0, 0, W, H, "F");

    // Top bar
    doc.setFillColor(...ACCENT);
    doc.rect(0, 0, W, 6, "F");

    let y = 20;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(...WHITE);
    doc.text("EMMA DONOVAN", M, y);

    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...SUBTLE);
    const multiShow = form.shows && form.shows.length > 1;
    doc.text(multiShow ? "FEE OFFER - " + form.shows.length + " Engagements" : "FEE OFFER - Engagement", M, y);

    y += 5;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.7);
    doc.line(M, y, W - M, y);
    y += 10;

    // Shows
    const shows = form.shows || [];
    shows.forEach((show, idx) => {
      y = checkPage(doc, y, W, H, 45);

      if (multiShow) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...ACCENT);
        doc.text((show.activity || "PERFORMANCE").toUpperCase() + " " + (idx + 1) + " OF " + shows.length, M, y);
        y += 7;
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...ACCENT);
        doc.text("ENGAGEMENT DETAILS", M, y);
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
        doc.setTextColor(...SUBTLE);
        doc.text(label, M, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...WHITE);
        doc.text(value, M + 45, y);
        y += 5.5;
      });

      if (multiShow && idx < shows.length - 1) {
        y += 3;
        doc.setDrawColor(...DIVIDER);
        doc.setLineWidth(0.2);
        doc.line(M, y, W - M, y);
        y += 6;
      }
    });

    // Divider
    y += 4;
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 8;

    // Fee breakdown title
    y = checkPage(doc, y, W, H, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text("FEE BREAKDOWN", M, y);
    y += 7;

    // Build rows
    const rows = [];
    let total = 0;

    shows.forEach((show, i) => {
      const fee = Number(show.performanceFee) || 550;
      const label = multiShow
        ? show.activity + " fee - " + (show.engagement || "Show " + (i + 1)) + " (" + (show.performanceDate || "TBD") + ")"
        : show.activity + " fee";
      rows.push([label, fee, 1, fee]);
      total += fee;

      if (show.hasMdFee) {
        const md = Number(show.mdFee) || 225;
        const mdLabel = multiShow ? "Music Director fee - " + (show.engagement || "Show " + (i + 1)) : "Music Director fee";
        rows.push([mdLabel, md, 1, md]);
        total += md;
      }
    });

    if (form.hasRehearsalFee) {
      const rh = Number(form.rehearsalFee) || 225;
      rows.push(["Rehearsal" + (form.rehearsalNote ? " - " + form.rehearsalNote : ""), rh, 1, rh]);
      total += rh;
    }

    if (form.hasTravelDay) {
      const baseFee = Number(shows[0]?.performanceFee || 550);
      const td = Math.round(baseFee * 0.5);
      const travelDays = Number(form.travelDays) || 1;
      rows.push(["Travel day (50% of show fee)", td, travelDays, td * travelDays]);
      total += td * travelDays;
    }

    const pd = Number(form.perDiem) || 89;
    const pdDays = Number(form.pdDays) || 1;
    rows.push(["Living allowance (per diem)", pd, pdDays, pd * pdDays]);
    total += pd * pdDays;

    // Table layout - generous item column
    const itemColW = CW * 0.62;
    const amtX = M + itemColW;
    const qtyX = amtX + 22;
    const totX = qtyX + 16;
    const ROW_LINE_H = 4.5;
    const ROW_PAD = 3;

    // Header row
    doc.setFillColor(...TABLE_ALT);
    doc.rect(M, y - 4, CW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text("ITEM", M + 3, y);
    doc.text("AMOUNT", amtX + 2, y);
    doc.text("QTY", qtyX + 2, y);
    doc.text("TOTAL", totX + 2, y);
    y += 6;

    // Data rows with text wrapping
    doc.setFontSize(9);
    rows.forEach((row, i) => {
      doc.setFont("helvetica", "normal");
      const lines = wrapText(doc, row[0], itemColW - 6);
      const rowH = Math.max(lines.length * ROW_LINE_H + ROW_PAD, 7);

      y = checkPage(doc, y, W, H, rowH + 5);

      // Alternating row background
      if (i % 2 === 1) {
        doc.setFillColor(...TABLE_BG);
        doc.rect(M, y - 4, CW, rowH, "F");
      }

      doc.setTextColor(...WHITE);

      // Item text (wrapped)
      lines.forEach((line, li) => {
        doc.text(line, M + 3, y + li * ROW_LINE_H);
      });

      // Amount, qty, total on first line
      doc.text("$" + Number(row[1]).toLocaleString(), amtX + 2, y);
      doc.text(String(row[2]), qtyX + 2, y);
      doc.text("$" + Number(row[3]).toLocaleString(), totX + 2, y);

      y += rowH;
    });

    // Total row
    y += 1;
    doc.setFillColor(...ACCENT);
    doc.rect(M, y - 4, CW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    doc.text("TOTAL INVOICE", M + 3, y);
    const totalStr = "$" + Number(total).toLocaleString();
    doc.text(totalStr, totX + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("GST excl", totX + 2 + doc.getTextWidth(totalStr) + 2, y);

    y += 12;

    // Conditions
    y = checkPage(doc, y, W, H, 40);
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text("CONDITIONS", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUBTLE);
    const conditions = [
      "Upon acceptance of this offer, a tour schedule and charts will be prepared and distributed.",
      "Fees are payable within 14 days of the invoice date, following the performance.",
      "Superannuation contributions will be made at " + (form.superRate || 12) + "% of the show fee to the nominated fund.",
      "Please add the living allowance (per diem) to your invoice.",
    ];
    conditions.forEach((c) => {
      const cLines = wrapText(doc, c, CW - 4);
      cLines.forEach((cl) => { doc.text(cl, M, y); y += 4.5; });
      y += 1;
    });

    // Transport
    y += 2;
    y = checkPage(doc, y, W, H, 40);
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text("TRANSPORT & ACCOMMODATION", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SUBTLE);

    const transportLines = [];
    if (form.transportType === "interstate_provided") transportLines.push("If you are travelling interstate, travel is provided.");
    else if (form.transportType === "flights_accom") transportLines.push("Where interstate travel is required, flights and accommodation are provided.");
    else if (form.transportType === "travel_provided") transportLines.push("Travel is provided.");

    if (form.reimbursementCap && form.reimbursementItems) {
      transportLines.push("A reimbursement of up to $" + form.reimbursementCap + " will be provided for " + form.reimbursementItems + " upon receipt of proof of payment.");
      transportLines.push("Travel reimbursements are handled separately and cannot be included in the fee.");
    }
    if (form.hasAccommodation && form.transportType !== "flights_accom") {
      transportLines.push(form.accommodationNote || "Accommodation is provided where an overnight stay is required.");
    }

    transportLines.forEach((l) => {
      const tLines = wrapText(doc, l, CW - 4);
      tLines.forEach((tl) => { doc.text(tl, M, y); y += 4.5; });
      y += 1;
    });

    // Invoice to
    y += 2;
    y = checkPage(doc, y, W, H, 25);
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ACCENT);
    doc.text("INVOICE TO", M, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...WHITE);
    doc.text("Jiindahood Pty Ltd", M, y);
    y += 5;
    doc.setTextColor(...SUBTLE);
    doc.text("ABN: 61 663 395 364", M, y);

    // Bottom bar on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFillColor(...ACCENT);
      doc.rect(0, H - 3, W, 3, "F");
    }

    const pdfOutput = doc.output("arraybuffer");
    return new NextResponse(pdfOutput, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=rate-card.pdf",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}
