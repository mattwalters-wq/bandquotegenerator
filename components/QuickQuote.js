"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { COLORS, FONTS } from "@/lib/theme";
import { LOCATION_CLASSES, LINEUPS, locationClass, formatTripDate } from "@/lib/policy";
import { computePlayerTravel, computePlayerTravelFromAI } from "@/lib/itinerary";
import { buildQuoteSnapshot, travelWordsSummary, quoteEmail } from "@/lib/quote";
import { CAPITALS } from "@/lib/travelData";
import { supabase } from "@/lib/supabase";
import QuoteResult from "./QuoteResult";

const BAND_BASE = "Melbourne"; // Emma's band is Melbourne-based by default
const CONTRAST_BASE = "Sydney"; // commonly some players are Sydney-based
const DEFAULT_SOUNDCHECK = "3:00pm";

const CITY_PICKS = [
  { name: "Melbourne", cls: "metro" },
  { name: "Geelong", cls: "regional" },
  { name: "Sydney", cls: "capital" },
  { name: "Brisbane", cls: "capital" },
  { name: "Adelaide", cls: "capital" },
  { name: "Gold Coast", cls: "capital" },
  { name: "Bowraville", cls: "regional" },
  { name: "Byron Bay", cls: "regional" },
];

export default function QuickQuote() {
  const [locationText, setLocationText] = useState("");
  const [clsKey, setClsKey] = useState("capital");
  const [gateway, setGateway] = useState("Sydney");
  const [driveHours, setDriveHours] = useState(4);
  const [showDate, setShowDate] = useState(""); // ISO yyyy-mm-dd
  const [soundcheck, setSoundcheck] = useState(DEFAULT_SOUNDCHECK);
  const [scProvided, setScProvided] = useState(false);
  const [lineupKey, setLineupKey] = useState("full");

  const [manualTravel, setManualTravel] = useState(null); // null = use computed
  const [manualNights, setManualNights] = useState(null); // null = use computed
  const [aiEstimate, setAiEstimate] = useState(null);
  const [aiState, setAiState] = useState("idle"); // idle | loading | error
  const aiKeyRef = useRef("");

  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailPanel, setEmailPanel] = useState(null);
  const [emailCopied, setEmailCopied] = useState(false);

  const cls = locationClass(clsKey);

  // Resolve the destination + any regional gateway/drive the engine needs.
  const destination = clsKey === "metro" ? "Melbourne" : (locationText.trim() || cls.label);
  const regional = clsKey === "regional" ? { gateway, driveHoursFromGateway: Number(driveHours) || 0 } : undefined;
  const showDates = showDate ? [showDate] : [];

  const baseInput = useMemo(() => ({
    destination, showDates, soundcheckTime: soundcheck, soundcheckProvided: scProvided, regional,
  }), [destination, showDate, soundcheck, scProvided, gateway, driveHours]);

  // Inference for the band base (Melbourne) and the contrast base (Sydney).
  const melRaw = useMemo(() => computePlayerTravel({ ...baseInput, homeBase: BAND_BASE }), [baseInput]);
  const sydRaw = useMemo(() => computePlayerTravel({ ...baseInput, homeBase: CONTRAST_BASE }), [baseInput]);

  // If the static table can't resolve it, fetch a validated AI estimate (cached).
  useEffect(() => {
    if (!melRaw.needsEstimate || !showDates.length) { setAiState("idle"); return; }
    const key = (BAND_BASE + "|" + destination + "|" + soundcheck).toLowerCase();
    if (aiKeyRef.current === key && aiEstimate) return;
    aiKeyRef.current = key;
    setAiState("loading");
    setAiEstimate(null);
    (async () => {
      try {
        const res = await fetch("/api/travel-estimate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin: BAND_BASE, destination, showTime: soundcheck }),
        });
        const data = await res.json();
        if (data.estimate) { setAiEstimate(data.estimate); setAiState("idle"); }
        else setAiState("error");
      } catch (e) { setAiState("error"); }
    })();
  }, [melRaw.needsEstimate, destination, soundcheck, showDate]);

  // Effective Melbourne-base travel (table or AI).
  const mel = useMemo(() => {
    if (!melRaw.needsEstimate) return melRaw;
    if (aiEstimate) return computePlayerTravelFromAI({ ...baseInput, homeBase: BAND_BASE }, aiEstimate);
    return null;
  }, [melRaw, aiEstimate, baseInput]);

  const inferredTravel = mel?.travelDays ?? 0;
  const inferredNights = mel?.nights ?? 0;
  const travelDays = manualTravel != null ? manualTravel : inferredTravel;
  const nights = manualNights != null ? manualNights : inferredNights;
  const isManual = manualTravel != null && manualTravel !== inferredTravel;
  const nightsManual = manualNights != null && manualNights !== inferredNights;

  // Per-base words summary.
  const perBase = useMemo(() => {
    const arr = [{ base: BAND_BASE, days: travelDays }];
    if (!melRaw.needsEstimate && sydRaw.resolved) arr.push({ base: CONTRAST_BASE, days: sydRaw.travelDays });
    return arr;
  }, [travelDays, sydRaw, melRaw.needsEstimate]);
  const travelSummary = travelWordsSummary(perBase);

  const snapshot = useMemo(() => buildQuoteSnapshot({
    locationClass: clsKey,
    locationLabel: locationText.trim() || cls.label,
    showDate: showDate ? formatTripDate(showDate) : "",
    travelDays, nights, lineupKey,
    travel: {
      reasons: mel?.reasons || [],
      assumptions: mel?.assumptions || [],
      perBase, manual: isManual || nightsManual, summary: travelSummary,
    },
  }), [clsKey, locationText, showDate, travelDays, nights, lineupKey, mel, isManual, nightsManual, travelSummary]);

  // --- input handlers ---
  const applyClass = (key) => {
    setClsKey(key); setManualTravel(null); setManualNights(null); setShareUrl("");
  };
  const pickCity = (city) => {
    setLocationText(city.name); applyClass(city.cls);
    if (city.cls === "regional") {
      // sensible gateway defaults for known towns
      if (/byron/i.test(city.name)) { setGateway("Gold Coast"); setDriveHours(1); }
      else if (/bowraville|coffs/i.test(city.name)) { setGateway("Sydney"); setDriveHours(6.5); }
      else if (/geelong/i.test(city.name)) { setGateway("Melbourne"); setDriveHours(1); }
    }
  };

  const handleShare = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!supabase) throw new Error("Sharing needs Supabase configured.");
      const { data, error } = await supabase.from("quotes").insert([{ data: snapshot }]).select().single();
      if (error) throw error;
      setShareUrl(window.location.origin + "/q/" + data.id); setCopied(false);
    } catch (e) { alert("Could not save quote: " + e.message); }
    setSaving(false);
  };
  const copyShare = () => navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  const handleExportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quote: snapshot }) });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Emma_Donovan_Band_Quote_" + (snapshot.trip.locationLabel || "quote").replace(/\s+/g, "_") + ".pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { alert("PDF export failed."); }
    setExporting(false);
  };

  const handleEmail = () => { setEmailPanel(quoteEmail(snapshot)); setEmailCopied(false); };
  const copyEmail = () => navigator.clipboard.writeText("Subject: " + emailPanel.subject + "\n\n" + emailPanel.body).then(() => { setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); });
  const openMail = () => window.open("mailto:?subject=" + encodeURIComponent(emailPanel.subject) + "&body=" + encodeURIComponent(emailPanel.body));

  return (
    <div style={{ width: "100%", overflowY: "auto", padding: "28px 18px 60px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h2 style={{ fontFamily: FONTS.display, fontSize: "clamp(26px, 7vw, 36px)", fontWeight: 700, margin: "0 0 6px", color: COLORS.cream }}>Price a show</h2>
        <p style={{ fontSize: 15, color: COLORS.creamDim, margin: "0 0 32px", lineHeight: 1.6 }}>
          Three quick questions. The app works out the travel days for you - no need to know the policy.
        </p>

        {/* WHERE */}
        <Section step="1" title="Where is the show?">
          <input value={locationText} onChange={(e) => { setLocationText(e.target.value); setShareUrl(""); }} placeholder="City or town" style={bigInput} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 16px" }}>
            {CITY_PICKS.map((c) => <button key={c.name} onClick={() => pickCity(c)} style={chip}>{c.name}</button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
            {LOCATION_CLASSES.map((c) => (
              <Choice key={c.key} active={clsKey === c.key} onClick={() => applyClass(c.key)} title={c.label}
                sub={c.feeKey === "vic" ? "Local Victorian fee" : "Interstate / travel-away fee"} />
            ))}
          </div>
          {clsKey === "regional" && (
            <div style={{ marginTop: 12, padding: "14px 16px", borderRadius: 14, border: "1px solid " + COLORS.border, background: COLORS.bgCard }}>
              <p style={{ fontSize: 13, color: COLORS.creamDim, margin: "0 0 10px" }}>Regional town - nearest airport and drive</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontSize: 12, color: COLORS.creamFaint }}>Fly into
                  <select value={gateway} onChange={(e) => { setGateway(e.target.value); setShareUrl(""); }} style={{ ...bigInput, padding: "12px 14px", fontSize: 14, marginTop: 4 }}>
                    {CAPITALS.filter((c) => c !== "Gold Coast" || true).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: 12, color: COLORS.creamFaint }}>Drive hours
                  <input type="number" min="0" step="0.5" value={driveHours} onChange={(e) => { setDriveHours(e.target.value); setShareUrl(""); }} style={{ ...bigInput, padding: "12px 14px", fontSize: 14, marginTop: 4 }} />
                </label>
              </div>
            </div>
          )}
        </Section>

        {/* WHEN */}
        <Section step="2" title="When is it?">
          <input type="date" value={showDate} onChange={(e) => { setShowDate(e.target.value); setManualTravel(null); setManualNights(null); setShareUrl(""); }} style={bigInput} />
          <label style={{ display: "block", marginTop: 14, fontSize: 13, color: COLORS.creamDim }}>
            Soundcheck / load-in time
            <input value={soundcheck} onChange={(e) => { setSoundcheck(e.target.value); setScProvided(true); setManualTravel(null); setManualNights(null); setShareUrl(""); }}
              placeholder="3:00pm" style={{ ...bigInput, marginTop: 6 }} />
          </label>
          <p style={{ fontSize: 12, color: COLORS.creamFaint, margin: "8px 2px 0" }}>
            The app uses this to decide whether the band can fly in on the show day. Defaults to 3:00pm if you are not sure.
          </p>
        </Section>

        {/* LINEUP */}
        <Section step="3" title="Which lineup?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LINEUPS.map((l) => (
              <Choice key={l.key} active={lineupKey === l.key} onClick={() => { setLineupKey(l.key); setShareUrl(""); }} title={l.label}
                sub={l.musicians === 0 ? "no band" : l.musicians + " musician" + (l.musicians > 1 ? "s" : "")} />
            ))}
          </div>
        </Section>

        {/* TRAVEL DAYS & PER DIEMS - computed, editable */}
        <Section step="" title="Travel & per diems (worked out for you)">
          {!showDate && <p style={{ fontSize: 13, color: COLORS.creamFaint, margin: 0 }}>Pick a show date above and the app will calculate travel days and per diems.</p>}
          {showDate && melRaw.needsEstimate && aiState === "loading" && <p style={{ fontSize: 13, color: COLORS.creamFaint, margin: 0 }}>Estimating travel for {destination}...</p>}
          {showDate && melRaw.needsEstimate && aiState === "error" && <p style={{ fontSize: 13, color: COLORS.error, margin: 0 }}>Could not estimate travel automatically - enter values manually below.</p>}
          {showDate && (mel || !melRaw.needsEstimate) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 8 }}>
                  Travel days {isManual ? <span style={{ color: COLORS.gold, fontWeight: 700 }}>(manual)</span> : <span style={{ color: COLORS.creamFaint }}>(computed)</span>}
                </div>
                <Stepper value={travelDays} min={0} max={10} onChange={(v) => { setManualTravel(v); setShareUrl(""); }} />
                {isManual && <button onClick={() => { setManualTravel(null); setShareUrl(""); }} style={{ ...chip, marginTop: 8 }}>Use computed ({inferredTravel})</button>}
              </div>
              <div>
                <div style={{ fontSize: 13, color: COLORS.creamDim, marginBottom: 8 }}>
                  Per diems / nights {nightsManual ? <span style={{ color: COLORS.gold, fontWeight: 700 }}>(manual)</span> : <span style={{ color: COLORS.creamFaint }}>(computed)</span>}
                </div>
                <Stepper value={nights} min={0} max={14} onChange={(v) => { setManualNights(v); setShareUrl(""); }} />
                {nightsManual && <button onClick={() => { setManualNights(null); setShareUrl(""); }} style={{ ...chip, marginTop: 8 }}>Use computed ({inferredNights})</button>}
              </div>
              <p style={{ flexBasis: "100%", fontSize: 12, color: COLORS.creamFaint, margin: 0 }}>Both are for {BAND_BASE}-based players and fully editable - set per diems to 0 to remove them. Your override wins.</p>
            </div>
          )}
        </Section>

        {/* RESULT */}
        <div style={{ marginTop: 30, paddingTop: 30, borderTop: "1px solid " + COLORS.border }}>
          <QuoteResult snapshot={snapshot} onSelectLineup={(k) => { setLineupKey(k); setShareUrl(""); }}
            actions={
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={handleExportPdf} disabled={exporting} style={primaryBtn}>{exporting ? "Exporting..." : "Export PDF"}</button>
                  <button onClick={handleEmail} style={secondaryBtn}>Email</button>
                  <button onClick={handleShare} disabled={saving} style={secondaryBtn}>{saving ? "Saving..." : "Save & share link"}</button>
                </div>

                {shareUrl && (
                  <div style={{ marginTop: 12, background: COLORS.bgCard, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 16 }}>
                    <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 8px" }}>Read-only link</p>
                    <p style={{ fontSize: 13, color: COLORS.creamDim, wordBreak: "break-all", margin: "0 0 12px" }}>{shareUrl}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={copyShare} style={primaryBtn}>{copied ? "Copied!" : "Copy link"}</button>
                      <a href={shareUrl} target="_blank" rel="noreferrer" style={{ ...secondaryBtn, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Open</a>
                    </div>
                  </div>
                )}

                {emailPanel && (
                  <div style={{ marginTop: 12, background: COLORS.bgCard, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 16 }}>
                    <p style={{ fontSize: 12, color: COLORS.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, margin: "0 0 6px" }}>Email</p>
                    <p style={{ fontSize: 13.5, color: COLORS.cream, fontWeight: 600, margin: "0 0 8px" }}>{emailPanel.subject}</p>
                    <pre style={{ fontSize: 12.5, color: COLORS.creamDim, whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontFamily: FONTS.body }}>{emailPanel.body}</pre>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button onClick={copyEmail} style={primaryBtn}>{emailCopied ? "Copied!" : "Copy"}</button>
                      <button onClick={openMail} style={secondaryBtn}>Open in mail</button>
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

// ---- building blocks -------------------------------------------------------
function Section({ step, title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {step ? <span style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.gold, color: COLORS.onGold, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{step}</span> : null}
        <h3 style={{ fontFamily: FONTS.display, fontSize: 21, fontWeight: 600, margin: 0, color: COLORS.cream }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Choice({ active, onClick, title, sub }) {
  return (
    <button onClick={onClick} style={{ textAlign: "left", padding: "14px 16px", borderRadius: 14, cursor: "pointer", background: active ? COLORS.gold : COLORS.bgCard, color: active ? COLORS.onGold : COLORS.cream, border: "1px solid " + (active ? COLORS.gold : COLORS.border), minHeight: 58 }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, marginTop: 3, color: active ? COLORS.onGold : COLORS.creamFaint, opacity: active ? 0.85 : 1 }}>{sub}</div>
    </button>
  );
}
function Stepper({ value, min, max, onChange }) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <button onClick={dec} disabled={value <= min} style={stepBtn(value <= min)}>-</button>
      <span style={{ fontSize: 28, fontWeight: 700, fontFamily: FONTS.display, color: COLORS.cream, minWidth: 28, textAlign: "center" }}>{value}</span>
      <button onClick={inc} disabled={value >= max} style={stepBtn(value >= max)}>+</button>
    </div>
  );
}
const stepBtn = (disabled) => ({ width: 48, height: 48, borderRadius: "50%", fontSize: 22, fontWeight: 700, cursor: disabled ? "default" : "pointer", background: COLORS.bgCard, color: disabled ? COLORS.creamFaint : COLORS.gold, border: "1px solid " + COLORS.border, opacity: disabled ? 0.5 : 1, lineHeight: 1 });
const bigInput = { width: "100%", padding: "16px 18px", background: COLORS.bgInput, border: "1px solid " + COLORS.border, borderRadius: 14, color: COLORS.cream, fontSize: 16, outline: "none", boxSizing: "border-box", fontFamily: FONTS.body };
const chip = { padding: "8px 14px", borderRadius: 999, background: "transparent", color: COLORS.creamDim, border: "1px solid " + COLORS.border, fontSize: 13, cursor: "pointer", fontFamily: FONTS.body };
const primaryBtn = { padding: "14px 22px", borderRadius: 12, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.onGold, fontWeight: 700, fontSize: 15, fontFamily: FONTS.body, minHeight: 50 };
const secondaryBtn = { padding: "14px 22px", borderRadius: 12, border: "1px solid " + COLORS.gold, cursor: "pointer", background: "transparent", color: COLORS.gold, fontWeight: 700, fontSize: 15, fontFamily: FONTS.body, minHeight: 50 };
