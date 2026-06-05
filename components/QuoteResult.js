"use client";
import { COLORS, FONTS } from "@/lib/theme";
import { money } from "@/lib/policy";

// Presentational, read-only breakdown of a Quick Quote snapshot. Shared by the
// interactive Quick Quote screen and the public /q/[id] share page.
export default function QuoteResult({ snapshot, onSelectLineup, actions }) {
  if (!snapshot) return null;
  const { trip, comparison, selected, summary, emmaFeeReference, travel } = snapshot;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
      {/* Plain-English top line */}
      <p style={{
        fontFamily: FONTS.display, fontSize: "clamp(20px, 5.5vw, 28px)", lineHeight: 1.35,
        color: COLORS.cream, margin: "0 0 6px", fontWeight: 600,
      }}>{summary}</p>
      <p style={{ fontSize: 13, color: COLORS.creamFaint, margin: "0 0 10px" }}>
        {trip.showDate ? trip.showDate + " - " : ""}{trip.locationLabel}
        {trip.nights > 0 ? " - " + trip.nights + " night" + (trip.nights > 1 ? "s" : "") + " away" : " - no overnight"}
      </p>
      {travel && travel.summary ? (
        <p style={{ fontSize: 13.5, color: COLORS.creamDim, margin: "0 0 22px", lineHeight: 1.6 }}>{travel.summary}</p>
      ) : <div style={{ height: 12 }} />}

      {/* Comparison strip - cost for every lineup */}
      <p style={subLabel}>Compare lineups</p>
      <div style={{
        display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 24,
        WebkitOverflowScrolling: "touch",
      }}>
        {comparison.map((c) => {
          const isSel = c.key === selected.key;
          return (
            <button
              key={c.key}
              onClick={onSelectLineup ? () => onSelectLineup(c.key) : undefined}
              style={{
                flex: "1 0 110px", minWidth: 110, textAlign: "left", cursor: onSelectLineup ? "pointer" : "default",
                background: isSel ? COLORS.gold : COLORS.bgCard,
                color: isSel ? COLORS.onGold : COLORS.cream,
                border: "1px solid " + (isSel ? COLORS.gold : COLORS.border),
                borderRadius: 14, padding: "14px 14px",
              }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 19, fontWeight: 700, fontFamily: FONTS.display }}>{money(c.total)}</div>
              <div style={{ fontSize: 11, marginTop: 4, color: isSel ? COLORS.onGold : COLORS.creamFaint, opacity: isSel ? 0.85 : 1 }}>
                {c.musicians === 0 ? "no band hired" : c.musicians + " musician" + (c.musicians > 1 ? "s" : "")}
                {c.delta > 0 ? "  +" + money(c.delta) : ""}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected breakdown */}
      <p style={subLabel}>{selected.label} - per-musician breakdown</p>
      {selected.musicians === 0 ? (
        <div style={card}>
          <p style={{ fontSize: 14, color: COLORS.creamDim, margin: 0 }}>
            A solo show hires no band, so there are no band fees here. Emma's own performance fee is handled in the P&L.
          </p>
        </div>
      ) : (
        <div style={card}>
          {selected.per.lines.map((ln, i) => (
            <Row key={i} label={ln.label} value={money(ln.amount)} />
          ))}
          <div style={{ height: 1, background: COLORS.border, margin: "10px 0" }} />
          <Row label="Per musician" value={money(selected.per.total)} strong />
          <Row label={"× " + selected.musicians + " musician" + (selected.musicians > 1 ? "s" : "")} value="" muted />
          <div style={{ height: 1, background: COLORS.border, margin: "10px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.cream }}>Estimated band total</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.gold, fontFamily: FONTS.display }}>{money(selected.total)}</span>
          </div>
        </div>
      )}

      {/* Travel days - how the app worked them out */}
      {travel && (travel.reasons?.length || travel.assumptions?.length) ? (
        <div style={{ marginTop: 16 }}>
          <p style={subLabel}>
            Travel days {travel.manual ? <span style={manualBadge}>manual</span> : null}
          </p>
          <div style={card}>
            {(travel.reasons || []).length === 0 && (
              <p style={{ fontSize: 13.5, color: COLORS.creamDim, margin: 0 }}>No travel days for this trip.</p>
            )}
            {(travel.reasons || []).map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
                <span style={{ color: COLORS.gold, fontSize: 13 }}>•</span>
                <span style={{ fontSize: 13.5, color: COLORS.cream }}>{r.explanation}</span>
              </div>
            ))}
            {(travel.assumptions || []).length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid " + COLORS.border, display: "flex", flexDirection: "column", gap: 6 }}>
                {travel.assumptions.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    {a.assumed ? <span style={assumedChip}>assumed</span> : <span style={{ ...assumedChip, background: "transparent", color: COLORS.creamFaint, borderColor: COLORS.border }}>note</span>}
                    <span style={{ fontSize: 12.5, color: COLORS.creamDim, lineHeight: 1.5 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Exclusions note */}
      <div style={{
        marginTop: 16, padding: "14px 16px", borderRadius: 12,
        border: "1px dashed " + COLORS.borderLight, background: "transparent",
      }}>
        <p style={{ fontSize: 12.5, color: COLORS.creamDim, margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: COLORS.cream }}>Not included:</strong> flights, accommodation and backline are
          {" "}<strong>not</strong> in this number. They are arranged and costed separately.
        </p>
      </div>

      {/* Emma fee reference */}
      <p style={{ fontSize: 12, color: COLORS.creamFaint, margin: "12px 2px 0", lineHeight: 1.6 }}>
        For reference, Emma's own performance fee of {money(emmaFeeReference)} per show sits in the P&L and is not part of
        the band cost above. Figures exclude GST (added only for GST-registered musicians).
      </p>

      {actions ? <div style={{ marginTop: 22 }}>{actions}</div> : null}
    </div>
  );
}

const subLabel = {
  fontSize: 11, fontWeight: 700, color: COLORS.gold, textTransform: "uppercase",
  letterSpacing: 1.4, margin: "0 0 10px", fontFamily: FONTS.body,
};
const card = {
  background: COLORS.bgCard, border: "1px solid " + COLORS.border, borderRadius: 16, padding: "18px 20px",
};
const assumedChip = {
  flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
  padding: "2px 7px", borderRadius: 999, background: COLORS.gold, color: COLORS.onGold, border: "1px solid " + COLORS.gold,
};
const manualBadge = {
  marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
  padding: "2px 7px", borderRadius: 999, background: "transparent", color: COLORS.gold, border: "1px solid " + COLORS.gold,
};

function Row({ label, value, strong, muted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "5px 0" }}>
      <span style={{ fontSize: 13.5, color: muted ? COLORS.creamFaint : COLORS.creamDim, fontWeight: strong ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: strong ? COLORS.cream : COLORS.creamDim, fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}
