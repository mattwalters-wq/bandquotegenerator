"use client";
import { forwardRef } from "react";
import { DEFAULT_VALUES, formatCurrency, buildRows, buildTransportLines } from "@/lib/constants";

const RateCardPreview = forwardRef(function RateCardPreview({ form }, ref) {
  const { rows, total } = buildRows(form);
  const transportLines = buildTransportLines(form);

  return (
    <div ref={ref} style={{ background: "#1a1a2e", color: "#fff", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", minHeight: 700, position: "relative", overflow: "hidden", width: 580 }}>
      <div style={{ height: 8, background: "#e94560", width: "100%" }} />
      <div style={{ padding: "28px 32px 40px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: 1.5 }}>{DEFAULT_VALUES.artistName}</h1>
        <p style={{ color: "#b0b0b0", fontSize: 13, margin: "4px 0 0", letterSpacing: 0.5 }}>
          FEE OFFER - {form.feeType === "interstate" ? "Interstate " : form.feeType === "local" ? "Local " : ""}Engagement
        </p>
        <div style={{ height: 2, background: "#e94560", margin: "16px 0 20px", opacity: 0.9 }} />

        <SectionTitle>ENGAGEMENT DETAILS</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "5px 12px", marginBottom: 20 }}>
          <DetailRow label="Engagement" value={form.engagement} />
          <DetailRow label="Location" value={form.location} />
          <DetailRow label="Performance Date" value={form.performanceDate} />
          <DetailRow label="Slot" value={form.slot} />
          {form.repertoire && <DetailRow label="Repertoire" value={form.repertoire} />}
          <DetailRow label="Format" value={form.format} />
        </div>

        <Divider />
        <SectionTitle>FEE BREAKDOWN</SectionTitle>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px 90px", background: "#0f3460", padding: "7px 10px", borderRadius: "4px 4px 0 0", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
            <span>ITEM</span><span>AMOUNT</span><span>QTY</span><span>TOTAL</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px 90px", padding: "6px 10px", fontSize: 12, background: i % 2 === 1 ? "#16213e" : "transparent" }}>
              <span>{r.item}</span><span>{formatCurrency(r.amount)}</span><span>{r.qty}</span><span>{formatCurrency(r.total)}</span>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 40px 90px", padding: "8px 10px", background: "#e94560", borderRadius: "0 0 4px 4px", fontWeight: 700, fontSize: 13 }}>
            <span>TOTAL INVOICE</span><span></span><span></span>
            <span>{formatCurrency(total)} <span style={{ fontWeight: 400, fontSize: 10 }}>GST excl</span></span>
          </div>
        </div>

        <Divider />
        <SectionTitle>CONDITIONS</SectionTitle>
        <CondText>Upon acceptance of this offer, a tour schedule and charts will be prepared and distributed.</CondText>
        <CondText>Fees are payable within 14 days of the invoice date, following the performance.</CondText>
        <CondText>Superannuation contributions will be made at {form.superRate}% of the show fee to the nominated fund.</CondText>
        <CondText>Please add the living allowance (per diem) to your invoice.</CondText>

        <Divider />
        <SectionTitle>TRANSPORT & ACCOMMODATION</SectionTitle>
        {transportLines.map((l, i) => <CondText key={i}>{l}</CondText>)}

        <Divider />
        <SectionTitle>INVOICE TO</SectionTitle>
        <p style={{ color: "#fff", fontSize: 12, margin: "4px 0 2px" }}>{DEFAULT_VALUES.invoiceTo}</p>
        <p style={{ color: "#b0b0b0", fontSize: 12, margin: 0 }}>ABN: {DEFAULT_VALUES.abn}</p>
      </div>
      <div style={{ height: 4, background: "#e94560", width: "100%", position: "absolute", bottom: 0 }} />
    </div>
  );
});

function SectionTitle({ children }) {
  return <h3 style={{ color: "#e94560", fontSize: 13, fontWeight: 700, letterSpacing: 1, margin: "16px 0 8px" }}>{children}</h3>;
}
function DetailRow({ label, value }) {
  return (<><span style={{ color: "#b0b0b0", fontSize: 12 }}>{label}</span><span style={{ color: "#fff", fontSize: 12 }}>{value || "-"}</span></>);
}
function Divider() {
  return <div style={{ height: 1, background: "#333355", margin: "12px 0" }} />;
}
function CondText({ children }) {
  return <p style={{ color: "#b0b0b0", fontSize: 11, margin: "3px 0", lineHeight: 1.5 }}>{children}</p>;
}

export default RateCardPreview;
