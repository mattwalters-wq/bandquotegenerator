"use client";
import { useState, useMemo } from "react";
import { COLORS, FONTS } from "@/lib/theme";
import { LOCATION_CLASSES, LINEUPS, locationClass, suggestedNights } from "@/lib/policy";
import { buildQuoteSnapshot } from "@/lib/quote";
import { supabase } from "@/lib/supabase";
import QuoteResult from "./QuoteResult";

// Quick city picks that pre-set the location class (lightweight "autocomplete").
const CITY_PICKS = [
  { name: "Melbourne", cls: "metro" },
  { name: "Geelong", cls: "metro" },
  { name: "Sydney", cls: "capital" },
  { name: "Brisbane", cls: "capital" },
  { name: "Adelaide", cls: "capital" },
  { name: "Perth", cls: "capital" },
  { name: "Coffs Harbour", cls: "regional" },
  { name: "Byron Bay", cls: "regional" },
];

export default function QuickQuote() {
  const [locationText, setLocationText] = useState("");
  const [clsKey, setClsKey] = useState("capital");
  const [showDate, setShowDate] = useState("");
  const [canTravelShowDay, setCanTravelShowDay] = useState(false);
  const [nights, setNights] = useState(1);
  const [lineupKey, setLineupKey] = useState("full");

  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Apply a location class: pick its show fee, default travel-on-show-day and nights.
  const applyClass = (key) => {
    const c = locationClass(key);
    setClsKey(key);
    const canTravel = c.canTravelShowDayDefault;
    setCanTravelShowDay(canTravel);
    setNights(suggestedNights(c, canTravel));
    setShareUrl("");
  };

  const pickCity = (city) => {
    setLocationText(city.name);
    applyClass(city.cls);
  };

  const setTravelToggle = (canTravel) => {
    setCanTravelShowDay(canTravel);
    setNights(canTravel ? 0 : suggestedNights(locationClass(clsKey), false) || 1);
    setShareUrl("");
  };

  const cls = locationClass(clsKey);
  const maxNights = cls.maxNights;

  const snapshot = useMemo(() => buildQuoteSnapshot({
    locationLabel: locationText.trim() || cls.label,
    locationClass: clsKey,
    showDate,
    canTravelShowDay,
    nights,
    lineupKey,
  }), [locationText, clsKey, showDate, canTravelShowDay, nights, lineupKey, cls.label]);

  const handleShare = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!supabase) throw new Error("Sharing needs Supabase configured.");
      const { data, error } = await supabase.from("quotes").insert([{ data: snapshot }]).select().single();
      if (error) throw error;
      const url = window.location.origin + "/q/" + data.id;
      setShareUrl(url);
      setCopied(false);
    } catch (e) {
      alert("Could not save quote: " + e.message);
    }
    setSaving(false);
  };

  const copyShare = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ width: "100%", overflowY: "auto", padding: "28px 18px 60px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h2 style={{ fontFamily: FONTS.display, fontSize: "clamp(26px, 7vw, 36px)", fontWeight: 700, margin: "0 0 6px", color: COLORS.cream }}>
          Price a show
        </h2>
        <p style={{ fontSize: 15, color: COLORS.creamDim, margin: "0 0 32px", lineHeight: 1.6 }}>
          Three quick questions and you will see what the band costs for every lineup.
        </p>

        {/* WHERE */}
        <Section step="1" title="Where is the show?">
          <input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="City or town"
            style={bigInput}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 16px" }}>
            {CITY_PICKS.map((c) => (
              <button key={c.name} onClick={() => pickCity(c)} style={chip}>{c.name}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {LOCATION_CLASSES.map((c) => (
              <Choice key={c.key} active={clsKey === c.key} onClick={() => applyClass(c.key)}
                title={c.label}
                sub={c.feeKey === "vic" ? "Local Victorian fee" : "Interstate / travel-away fee"} />
            ))}
          </div>
        </Section>

        {/* WHEN */}
        <Section step="2" title="When is it?">
          <input
            value={showDate}
            onChange={(e) => setShowDate(e.target.value)}
            placeholder="e.g. 12 July 2026"
            style={bigInput}
          />
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, color: COLORS.creamDim, margin: "0 0 10px" }}>Can the band travel on the show day?</p>
            <div style={{ display: "flex", gap: 8 }}>
              <Toggle active={canTravelShowDay} onClick={() => setTravelToggle(true)} label="Yes - same day" />
              <Toggle active={!canTravelShowDay} onClick={() => setTravelToggle(false)} label="No - stay overnight" />
            </div>
          </div>
          {!canTravelShowDay && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 14, color: COLORS.creamDim, margin: "0 0 10px" }}>Nights away</p>
              <Stepper value={nights} min={0} max={maxNights} onChange={(v) => { setNights(v); setShareUrl(""); }} />
              <p style={{ fontSize: 12, color: COLORS.creamFaint, margin: "8px 2px 0" }}>
                Suggested {cls.suggestedNights} for {cls.label.toLowerCase()} - adjust as needed. Each night away adds a per diem and a travel day per musician.
              </p>
            </div>
          )}
        </Section>

        {/* LINEUP */}
        <Section step="3" title="Which lineup?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LINEUPS.map((l) => (
              <Choice key={l.key} active={lineupKey === l.key} onClick={() => { setLineupKey(l.key); setShareUrl(""); }}
                title={l.label}
                sub={l.musicians === 0 ? "no band" : l.musicians + " musician" + (l.musicians > 1 ? "s" : "")} />
            ))}
          </div>
        </Section>

        {/* RESULT */}
        <div style={{ marginTop: 36, paddingTop: 30, borderTop: "1px solid " + COLORS.border }}>
          <QuoteResult
            snapshot={snapshot}
            onSelectLineup={(k) => { setLineupKey(k); setShareUrl(""); }}
            actions={
              <div>
                {!shareUrl ? (
                  <button onClick={handleShare} disabled={saving} style={primaryBtn}>
                    {saving ? "Saving..." : "Save & share this quote"}
                  </button>
                ) : (
                  <div style={{ background: COLORS.bgCard, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 16 }}>
                    <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 8px" }}>Read-only link</p>
                    <p style={{ fontSize: 13, color: COLORS.creamDim, wordBreak: "break-all", margin: "0 0 12px" }}>{shareUrl}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={copyShare} style={primaryBtn}>{copied ? "Copied!" : "Copy link"}</button>
                      <a href={shareUrl} target="_blank" rel="noreferrer" style={{ ...secondaryBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open</a>
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---- small building blocks -------------------------------------------------

function Section({ step, title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 26, height: 26, borderRadius: "50%", background: COLORS.gold, color: COLORS.onGold,
          display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
        }}>{step}</span>
        <h3 style={{ fontFamily: FONTS.display, fontSize: 21, fontWeight: 600, margin: 0, color: COLORS.cream }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Choice({ active, onClick, title, sub }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer",
      background: active ? COLORS.gold : COLORS.bgCard,
      color: active ? COLORS.onGold : COLORS.cream,
      border: "1px solid " + (active ? COLORS.gold : COLORS.border),
      minHeight: 58,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 3, color: active ? COLORS.onGold : COLORS.creamFaint, opacity: active ? 0.85 : 1 }}>{sub}</div>
    </button>
  );
}

function Toggle({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "14px 12px", borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600,
      background: active ? COLORS.gold : COLORS.bgCard, color: active ? COLORS.onGold : COLORS.creamDim,
      border: "1px solid " + (active ? COLORS.gold : COLORS.border), minHeight: 52,
    }}>{label}</button>
  );
}

function Stepper({ value, min, max, onChange }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <button onClick={dec} disabled={value <= min} style={stepBtn(value <= min)}>-</button>
      <span style={{ fontSize: 28, fontWeight: 700, fontFamily: FONTS.display, color: COLORS.cream, minWidth: 30, textAlign: "center" }}>{value}</span>
      <button onClick={inc} disabled={value >= max} style={stepBtn(value >= max)}>+</button>
    </div>
  );
}

const stepBtn = (disabled) => ({
  width: 52, height: 52, borderRadius: "50%", fontSize: 24, fontWeight: 700, cursor: disabled ? "default" : "pointer",
  background: COLORS.bgCard, color: disabled ? COLORS.creamFaint : COLORS.gold,
  border: "1px solid " + COLORS.border, opacity: disabled ? 0.5 : 1, lineHeight: 1,
});

const bigInput = {
  width: "100%", padding: "16px 18px", background: COLORS.bgInput, border: "1px solid " + COLORS.border,
  borderRadius: 14, color: COLORS.cream, fontSize: 16, outline: "none", boxSizing: "border-box", fontFamily: FONTS.body,
};
const chip = {
  padding: "8px 14px", borderRadius: 999, background: "transparent", color: COLORS.creamDim,
  border: "1px solid " + COLORS.border, fontSize: 13, cursor: "pointer", fontFamily: FONTS.body,
};
const primaryBtn = {
  padding: "14px 22px", borderRadius: 12, border: "none", cursor: "pointer", background: COLORS.gold,
  color: COLORS.onGold, fontWeight: 700, fontSize: 15, fontFamily: FONTS.body, minHeight: 50,
};
const secondaryBtn = {
  padding: "14px 22px", borderRadius: 12, border: "1px solid " + COLORS.gold, cursor: "pointer", background: "transparent",
  color: COLORS.gold, fontWeight: 700, fontSize: 15, fontFamily: FONTS.body, minHeight: 50,
};
