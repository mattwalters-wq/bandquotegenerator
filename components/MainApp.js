"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { COLORS, FONTS } from "@/lib/theme";
import { useTheme, getSessionId } from "@/lib/useTheme";
import QuickQuote from "@/components/QuickQuote";
import { computePlayerTravel, computePlayerTravelFromAI } from "@/lib/itinerary";
import { CAPITALS } from "@/lib/travelData";
import {
  DEFAULT_VALUES, INITIAL_FORM, EMPTY_SHOW,
  SLOT_OPTIONS, FORMAT_OPTIONS, ACTIVITY_OPTIONS,
  TRANSPORT_OPTIONS, REIMBURSEMENT_OPTIONS,
  formatCurrency, buildRows, buildTransportLines, generateEmail,
} from "@/lib/constants";

// Shared styles
const iS = { width: "100%", padding: "9px 12px", background: COLORS.bgInput, border: "1px solid " + COLORS.border, borderRadius: 8, color: COLORS.cream, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: FONTS.body };
const sS = { ...iS, appearance: "none", cursor: "pointer", paddingRight: 28, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23c4b8a8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };
const cL = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.creamDim, cursor: "pointer", marginBottom: 6, fontFamily: FONTS.body };
const smallBtn = { padding: "4px 10px", borderRadius: 6, border: "1px solid " + COLORS.border, cursor: "pointer", background: "transparent", color: COLORS.creamDim, fontSize: 10, fontWeight: 600, fontFamily: FONTS.body };

export default function MainApp() {
  const { theme, toggle: toggleTheme } = useTheme();
  const [view, setView] = useState("quick"); // quick (Emma mode) | pro (manager tools)
  const [form, setForm] = useState(INITIAL_FORM);
  const [saved, setSaved] = useState([]);
  const [members, setMembers] = useState([]);
  const [travelMeta, setTravelMeta] = useState(null); // { reasons, assumptions } for the editor
  const [computingTravel, setComputingTravel] = useState(false);
  const [activePanel, setActivePanel] = useState("chat"); // chat | editor | saved | roster
  const [rightPanel, setRightPanel] = useState("preview"); // preview | email
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([{ role: "assistant", content: "Hey! I'm here to help you create rate cards for Emma's band. You can describe a show, paste in details, or upload file content and I'll set up the rate card for you.\n\nTry something like: \"Ben Edgar is doing Parrtjima Festival in Alice Springs April 17 as Emma + 3, plus Booderee National Park May 2 as a duo with MD duties.\"" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [emailData, setEmailData] = useState({ subject: "", body: "" });
  const [copied, setCopied] = useState(false);
  const chatEndRef = useRef(null);
  const previewRef = useRef(null);

  const loadCards = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.from("rate_cards").select("*").order("created_at", { ascending: false });
      if (!error && data) setSaved(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from("band_members").select("*").order("name");
      if (!error && data) setMembers(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadCards(); loadMembers(); }, [loadCards, loadMembers]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Roster CRUD
  const updateMember = async (id, field, value) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
    if (supabase) await supabase.from("band_members").update({ [field]: value }).eq("id", id);
  };
  const addMember = async () => {
    const row = { name: "New member", instrument: "", home_base: "Melbourne", gst_registered: false };
    if (supabase) {
      const { data, error } = await supabase.from("band_members").insert([row]).select().single();
      if (!error && data) setMembers((prev) => [...prev, data]);
    } else {
      setMembers((prev) => [...prev, { id: Date.now(), ...row }]);
    }
  };
  const deleteMember = async (id) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    if (supabase) await supabase.from("band_members").delete().eq("id", id);
  };

  // Editor: compute travel days for the recipient from their home base.
  const toISO = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };
  const computeEditorTravel = async () => {
    if (computingTravel) return;
    setComputingTravel(true);
    setTravelMeta(null);
    try {
      const showDates = form.shows.map((s) => toISO(s.performanceDate)).filter(Boolean).sort();
      const destination = form.shows[0]?.location || "";
      const input = { homeBase: form.homeBase || "Melbourne", destination, showDates, soundcheckTime: form.soundcheck || "3:00pm", soundcheckProvided: !!form.soundcheck };
      if (!showDates.length || !destination) {
        setTravelMeta({ reasons: [], assumptions: [{ text: "Add a location and a parseable show date to compute travel days.", assumed: false }] });
        setComputingTravel(false);
        return;
      }
      let res = computePlayerTravel(input);
      if (res.needsEstimate) {
        const r = await fetch("/api/travel-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: input.homeBase, destination, showTime: input.soundcheckTime }) });
        const data = await r.json();
        if (data.estimate) res = computePlayerTravelFromAI(input, data.estimate);
        else { setTravelMeta({ reasons: [], assumptions: [{ text: "Could not estimate travel automatically - enter travel days manually.", assumed: false }] }); setComputingTravel(false); return; }
      }
      setForm((prev) => ({ ...prev, hasTravelDay: res.travelDays > 0, travelDays: res.travelDays, pdDays: res.nights || prev.pdDays, travelComputed: true, travelManual: false }));
      setTravelMeta({ reasons: res.reasons, assumptions: res.assumptions });
    } catch (e) {
      setTravelMeta({ reasons: [], assumptions: [{ text: "Travel calculation failed: " + e.message, assumed: false }] });
    }
    setComputingTravel(false);
  };

  // Load the saved view preference (Quick Quote vs Pro) for this session. New
  // sessions default to Quick Quote.
  useEffect(() => {
    const sid = getSessionId();
    if (!sid) return;
    (async () => {
      try {
        let saved = localStorage.getItem("bqg_view");
        if (supabase) {
          const { data } = await supabase.from("session_prefs").select("view").eq("session_id", sid).single();
          if (data?.view) saved = data.view;
        }
        if (saved === "pro" || saved === "quick") setView(saved);
      } catch (e) { /* default stays quick */ }
    })();
  }, []);

  // Persist the view preference against the session in Supabase.
  const changeView = (next) => {
    setView(next);
    const sid = getSessionId();
    try { localStorage.setItem("bqg_view", next); } catch (e) {}
    if (supabase && sid) {
      supabase.from("session_prefs").upsert({ session_id: sid, view: next, updated_at: new Date().toISOString() }).then(() => {}, () => {});
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const updateShow = (idx, field, value) => {
    setForm((prev) => {
      const shows = [...prev.shows];
      const updated = { ...shows[idx], [field]: value };
      if (field === "feeType") {
        if (value === "local") updated.performanceFee = DEFAULT_VALUES.localFee;
        else if (value === "interstate") updated.performanceFee = DEFAULT_VALUES.interstateFee;
      }
      shows[idx] = updated;
      return { ...prev, shows };
    });
  };
  const addShow = () => setForm((prev) => ({ ...prev, shows: [...prev.shows, { ...EMPTY_SHOW }] }));
  const removeShow = (idx) => setForm((prev) => prev.shows.length <= 1 ? prev : { ...prev, shows: prev.shows.filter((_, i) => i !== idx) });
  const duplicateShow = (idx) => {
    setForm((prev) => {
      const shows = [...prev.shows];
      shows.splice(idx + 1, 0, { ...prev.shows[idx], performanceDate: "" });
      return { ...prev, shows };
    });
  };

  // Chat
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.filter((m) => m.role !== "system") }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setChatMessages((prev) => [...prev, { role: "assistant", content: data.text }]);

      if (data.rateCardData) {
        setForm((prev) => ({
          ...prev,
          ...data.rateCardData,
          shows: data.rateCardData.shows || prev.shows,
          perDiem: data.rateCardData.perDiem || prev.perDiem,
          superRate: data.rateCardData.superRate || prev.superRate,
          reimbursementCap: data.rateCardData.reimbursementCap || prev.reimbursementCap,
          accommodationNote: data.rateCardData.accommodationNote || prev.accommodationNote,
          recipientName: data.rateCardData.recipientName || prev.recipientName,
        }));
      }
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong: " + e.message }]);
    }
    setChatLoading(false);
  };

  // Save / Load / Delete
  const handleSave = async () => {
    const name = form.shows.map((s) => s.engagement || "Untitled").join(", ") + " - " + (form.shows[0]?.performanceDate || "No date");
    if (supabase) {
      const { data, error } = await supabase.from("rate_cards").insert([{ name, form_data: form }]).select().single();
      if (!error && data) setSaved((prev) => [data, ...prev]);
    } else {
      setSaved((prev) => [{ id: Date.now(), name, form_data: form, created_at: new Date().toISOString() }, ...prev]);
    }
  };
  const handleLoad = (entry) => { setForm({ ...INITIAL_FORM, ...entry.form_data }); setActivePanel("editor"); };
  const handleDelete = async (id) => { if (supabase) await supabase.from("rate_cards").delete().eq("id", id); setSaved((prev) => prev.filter((s) => s.id !== id)); };
  const handleReset = () => setForm(INITIAL_FORM);

  // PDF Export
  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ form }) });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const titles = [...new Set(form.shows.map((s) => (s.engagement || "").trim()).filter(Boolean))];
      const titlePart = titles.length ? titles.join(", ") : "Rate Card";
      a.download = "Emma Donovan - Rate Card - " + titlePart + ".pdf";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { alert("PDF export failed."); }
    setExporting(false);
  };

  // Email
  const handleGenerateEmail = () => { setEmailData(generateEmail(form)); setRightPanel("email"); setCopied(false); };
  const handleCopyEmail = () => { navigator.clipboard.writeText("Subject: " + emailData.subject + "\n\n" + emailData.body).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const handleMailto = () => { window.open("mailto:?subject=" + encodeURIComponent(emailData.subject) + "&body=" + encodeURIComponent(emailData.body)); };

  // Preview data
  const { rows, total } = buildRows(form);
  const transportLines = buildTransportLines(form);

  const isPro = view === "pro";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: COLORS.bgDeep, fontFamily: FONTS.body, color: COLORS.cream }}>
      {/* Header */}
      <div style={{ background: COLORS.bgDeep, borderBottom: "1px solid " + COLORS.border, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 19, fontWeight: 700, margin: 0, color: COLORS.cream }}>Emma Donovan</h1>
          <span style={{ fontSize: 10.5, color: COLORS.creamFaint, letterSpacing: 1.4, textTransform: "uppercase" }}>Band quotes</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Quick Quote / Pro segmented control */}
          <div style={{ display: "flex", background: COLORS.bgInput, borderRadius: 10, padding: 3, border: "1px solid " + COLORS.border }}>
            {[["quick", "Quick Quote"], ["pro", "Pro"]].map(([key, label]) => (
              <button key={key} onClick={() => changeView(key)} style={{
                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: FONTS.body,
                background: view === key ? COLORS.gold : "transparent", color: view === key ? COLORS.onGold : COLORS.creamDim,
              }}>{label}</button>
            ))}
          </div>
          {isPro && (
            <div style={{ display: "flex", gap: 6 }}>
              {[["chat", "AI Chat"], ["editor", "Editor"], ["saved", "Saved (" + saved.length + ")"], ["roster", "Roster (" + members.length + ")"]].map(([key, label]) => (
                <button key={key} onClick={() => setActivePanel(key)} style={{
                  padding: "6px 12px", borderRadius: 8, border: "1px solid " + COLORS.border, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONTS.body,
                  background: activePanel === key ? COLORS.bgCard : "transparent", color: activePanel === key ? COLORS.gold : COLORS.creamDim,
                }}>{label}</button>
              ))}
            </div>
          )}
          <button onClick={toggleTheme} aria-label="Toggle light or dark mode" style={{
            width: 38, height: 38, borderRadius: 10, border: "1px solid " + COLORS.border, background: "transparent",
            color: COLORS.creamDim, cursor: "pointer", fontSize: 16,
          }}>{theme === "dark" ? "☀" : "☾"}</button>
        </div>
      </div>

      {!isPro && <QuickQuote />}

      {isPro && (
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left panel */}
        <div style={{ width: 400, flexShrink: 0, overflow: "auto", borderRight: "1px solid " + COLORS.border, background: COLORS.bgDeep, display: "flex", flexDirection: "column" }}>

          {activePanel === "chat" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
                {chatMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 14, display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "85%", padding: "10px 14px", borderRadius: 12,
                      background: msg.role === "user" ? COLORS.gold : COLORS.bgCard,
                      color: msg.role === "user" ? COLORS.onGold : COLORS.cream,
                      fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
                      border: msg.role === "assistant" ? "1px solid " + COLORS.border : "none",
                    }}>{msg.content}</div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ padding: "10px 14px", borderRadius: 12, background: COLORS.bgCard, border: "1px solid " + COLORS.border, color: COLORS.creamDim, fontSize: 13 }}>Thinking...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: "12px 18px", borderTop: "1px solid " + COLORS.border, display: "flex", gap: 8 }}>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="Describe shows, paste details, or ask questions..."
                  rows={2}
                  style={{ ...iS, resize: "none", flex: 1 }}
                />
                <button onClick={sendChat} disabled={chatLoading} style={{
                  padding: "0 18px", borderRadius: 8, border: "none", cursor: chatLoading ? "wait" : "pointer",
                  background: COLORS.gold, color: COLORS.onGold, fontWeight: 700, fontSize: 13, fontFamily: FONTS.body,
                  opacity: chatLoading ? 0.5 : 1, alignSelf: "flex-end", height: 38,
                }}>Send</button>
              </div>
            </div>
          )}

          {activePanel === "editor" && (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
              <SL>Recipient</SL>
              <FG label="Musician Name (for email)"><input style={iS} value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} placeholder="e.g. Ben" /></FG>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
                <SL>Shows ({form.shows.length})</SL>
                <button onClick={addShow} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.onGold, fontSize: 11, fontWeight: 700, fontFamily: FONTS.body }}>+ Add Show</button>
              </div>

              {form.shows.map((show, idx) => (
                <div key={idx} style={{ background: COLORS.bgCard, borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: "1px solid " + COLORS.border }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, textTransform: "uppercase", letterSpacing: 0.8 }}>{form.shows.length > 1 ? "Show " + (idx + 1) : "Show Details"}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => duplicateShow(idx)} style={smallBtn}>Duplicate</button>
                      {form.shows.length > 1 && <button onClick={() => removeShow(idx)} style={{ ...smallBtn, borderColor: COLORS.error, color: COLORS.error }}>Remove</button>}
                    </div>
                  </div>
                  <FG label="Activity"><select style={sS} value={show.activity} onChange={(e) => updateShow(idx, "activity", e.target.value)}>{ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select></FG>
                  <FG label="Engagement"><input style={iS} value={show.engagement} onChange={(e) => updateShow(idx, "engagement", e.target.value)} placeholder="e.g. MSO Hamer Hall" /></FG>
                  <FG label="Location"><input style={iS} value={show.location} onChange={(e) => updateShow(idx, "location", e.target.value)} placeholder="e.g. Melbourne, VIC" /></FG>
                  <FG label="Date"><input style={iS} value={show.performanceDate} onChange={(e) => updateShow(idx, "performanceDate", e.target.value)} placeholder="e.g. July 10, 2026" /></FG>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FG label="Slot"><select style={sS} value={show.slot} onChange={(e) => updateShow(idx, "slot", e.target.value)}>{SLOT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></FG>
                    <FG label="Format"><select style={sS} value={show.format} onChange={(e) => updateShow(idx, "format", e.target.value)}>{FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></FG>
                  </div>
                  <FG label="Repertoire"><input style={iS} value={show.repertoire} onChange={(e) => updateShow(idx, "repertoire", e.target.value)} placeholder="e.g. Take Me To The River" /></FG>
                  <FG label="Fee Type"><select style={sS} value={show.feeType || "interstate"} onChange={(e) => updateShow(idx, "feeType", e.target.value)}><option value="local">Local ($450)</option><option value="interstate">Interstate ($550)</option><option value="custom">Custom</option></select></FG>
                  <FG label="Fee"><input type="number" style={iS} value={show.performanceFee} onChange={(e) => updateShow(idx, "performanceFee", e.target.value)} /></FG>
                  <label style={cL}><input type="checkbox" checked={show.hasMdFee} onChange={(e) => updateShow(idx, "hasMdFee", e.target.checked)} /> Music Director fee</label>
                  {show.hasMdFee && <FG label="MD Fee"><input type="number" style={iS} value={show.mdFee} onChange={(e) => updateShow(idx, "mdFee", e.target.value)} /></FG>}
                </div>
              ))}

              <SL>Additional Fees</SL>
              <label style={cL}><input type="checkbox" checked={form.hasRehearsalFee} onChange={(e) => update("hasRehearsalFee", e.target.checked)} /> Separate rehearsal fee</label>
              {form.hasRehearsalFee && (<><FG label="Rehearsal Fee"><input type="number" style={iS} value={form.rehearsalFee} onChange={(e) => update("rehearsalFee", e.target.value)} /></FG><FG label="Note"><input style={iS} value={form.rehearsalNote} onChange={(e) => update("rehearsalNote", e.target.value)} /></FG></>)}
              <SL>Travel (per player, from home base)</SL>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FG label="Recipient Home Base"><select style={sS} value={form.homeBase} onChange={(e) => { update("homeBase", e.target.value); update("travelComputed", false); }}>{CAPITALS.map((c) => <option key={c} value={c}>{c}</option>)}</select></FG>
                <FG label="Soundcheck (optional)"><input style={iS} value={form.soundcheck} onChange={(e) => update("soundcheck", e.target.value)} placeholder="3:00pm" /></FG>
              </div>
              <button onClick={computeEditorTravel} disabled={computingTravel} style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "1px solid " + COLORS.gold, cursor: computingTravel ? "wait" : "pointer", background: "transparent", color: COLORS.gold, fontWeight: 700, fontSize: 12, fontFamily: FONTS.body, marginBottom: 10 }}>
                {computingTravel ? "Calculating..." : "Compute travel days from itinerary"}
              </button>
              {travelMeta && (
                <div style={{ background: COLORS.bgCard, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                  {(travelMeta.reasons || []).map((r, i) => (
                    <p key={i} style={{ fontSize: 11.5, color: COLORS.cream, margin: "2px 0" }}>• {r.explanation}</p>
                  ))}
                  {(travelMeta.reasons || []).length === 0 && <p style={{ fontSize: 11.5, color: COLORS.creamDim, margin: "2px 0" }}>No travel days for this itinerary.</p>}
                  {(travelMeta.assumptions || []).map((a, i) => (
                    <p key={i} style={{ fontSize: 10.5, color: COLORS.creamFaint, margin: "3px 0 0", fontStyle: "italic" }}>{a.assumed ? "(assumed) " : ""}{a.text}</p>
                  ))}
                </div>
              )}
              <label style={cL}><input type="checkbox" checked={form.hasTravelDay} onChange={(e) => update("hasTravelDay", e.target.checked)} /> Travel day(s)</label>
              {form.hasTravelDay && <FG label={"Travel Days" + (form.travelManual ? " (manual)" : form.travelComputed ? " (computed)" : "")}><input type="number" style={iS} value={form.travelDays} onChange={(e) => { update("travelDays", e.target.value); if (form.travelComputed) update("travelManual", true); }} min={1} max={10} /></FG>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FG label="Per Diem"><input type="number" style={iS} value={form.perDiem} onChange={(e) => update("perDiem", e.target.value)} min={0} /></FG>
                <FG label="PD Days (0 to remove)"><input type="number" style={iS} value={form.pdDays} onChange={(e) => update("pdDays", e.target.value)} min={0} max={10} /></FG>
              </div>

              <SL>Transport</SL>
              <FG label="Transport Type"><select style={sS} value={form.transportType} onChange={(e) => update("transportType", e.target.value)}>{TRANSPORT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></FG>
              <FG label="Reimbursement"><select style={sS} value={form.reimbursementItems} onChange={(e) => update("reimbursementItems", e.target.value)}>{REIMBURSEMENT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></FG>
              <FG label="Cap"><input type="number" style={iS} value={form.reimbursementCap} onChange={(e) => update("reimbursementCap", e.target.value)} /></FG>
              {form.transportType !== "flights_accom" && <label style={cL}><input type="checkbox" checked={form.hasAccommodation} onChange={(e) => update("hasAccommodation", e.target.checked)} /> Accommodation (overnight)</label>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 18, paddingBottom: 18 }}>
                <button onClick={handleExportPDF} disabled={exporting} style={{ padding: "10px 0", borderRadius: 8, border: "none", cursor: exporting ? "wait" : "pointer", background: COLORS.gold, color: COLORS.onGold, fontWeight: 700, fontSize: 12, fontFamily: FONTS.body, opacity: exporting ? 0.5 : 1 }}>{exporting ? "Exporting..." : "Export PDF"}</button>
                <button onClick={handleGenerateEmail} style={{ padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", background: COLORS.bgInput, color: COLORS.gold, fontWeight: 700, fontSize: 12, fontFamily: FONTS.body, border: "1px solid " + COLORS.gold }}>Generate Email</button>
                <button onClick={handleSave} style={{ padding: "10px 0", borderRadius: 8, border: "1px solid " + COLORS.border, cursor: "pointer", background: "transparent", color: COLORS.creamDim, fontWeight: 600, fontSize: 12, fontFamily: FONTS.body }}>Save</button>
                <button onClick={handleReset} style={{ padding: "10px 0", borderRadius: 8, border: "1px solid " + COLORS.border, cursor: "pointer", background: "transparent", color: COLORS.creamFaint, fontWeight: 600, fontSize: 12, fontFamily: FONTS.body }}>Reset</button>
              </div>
            </div>
          )}

          {activePanel === "saved" && (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
              {loading ? <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 40 }}>Loading...</p>
                : saved.length === 0 ? <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 40 }}>No saved cards yet.</p>
                : saved.map((entry) => (
                  <div key={entry.id} style={{ background: COLORS.bgCard, borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid " + COLORS.border }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.cream }}>{entry.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: COLORS.creamFaint }}>{entry.form_data?.shows?.length || 1} show(s)</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleLoad(entry)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.onGold, fontSize: 11, fontWeight: 700, fontFamily: FONTS.body }}>Load</button>
                      <button onClick={() => handleDelete(entry.id)} style={smallBtn}>Delete</button>
                    </div>
                  </div>
              ))}
            </div>
          )}

          {activePanel === "roster" && (
            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <SL>Band Roster</SL>
                <button onClick={addMember} style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: COLORS.gold, color: COLORS.onGold, fontSize: 11, fontWeight: 700, fontFamily: FONTS.body }}>+ Add</button>
              </div>
              <p style={{ fontSize: 11.5, color: COLORS.creamFaint, margin: "0 0 12px", lineHeight: 1.5 }}>Home base drives each player&apos;s travel days. A Sydney show is local for a Sydney-based player.</p>
              {members.length === 0 && <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 30 }}>No members yet.</p>}
              {members.map((m) => (
                <div key={m.id} style={{ background: COLORS.bgCard, borderRadius: 8, padding: "10px 12px", marginBottom: 8, border: "1px solid " + COLORS.border }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FG label="Name"><input style={iS} value={m.name || ""} onChange={(e) => updateMember(m.id, "name", e.target.value)} /></FG>
                    <FG label="Instrument"><input style={iS} value={m.instrument || ""} onChange={(e) => updateMember(m.id, "instrument", e.target.value)} /></FG>
                    <FG label="Home Base"><select style={sS} value={m.home_base || "Melbourne"} onChange={(e) => updateMember(m.id, "home_base", e.target.value)}>{CAPITALS.map((c) => <option key={c} value={c}>{c}</option>)}</select></FG>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 10 }}>
                      <label style={{ ...cL, marginBottom: 0 }}><input type="checkbox" checked={!!m.gst_registered} onChange={(e) => updateMember(m.id, "gst_registered", e.target.checked)} /> GST reg.</label>
                      <button onClick={() => deleteMember(m.id)} style={{ ...smallBtn, borderColor: COLORS.error, color: COLORS.error }}>Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right panel - Preview / Email */}
        <div style={{ flex: 1, overflow: "auto", padding: 20, background: COLORS.bgDeep }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: COLORS.creamFaint, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, margin: 0 }}>
              {rightPanel === "email" ? "Generated Email" : "Live Preview"}
            </p>
            {rightPanel === "email" && <button onClick={() => setRightPanel("preview")} style={smallBtn}>Back to Preview</button>}
            {rightPanel === "preview" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleExportPDF} disabled={exporting} style={{ ...smallBtn, background: COLORS.gold, color: COLORS.onGold, border: "none" }}>{exporting ? "..." : "Export PDF"}</button>
                <button onClick={handleGenerateEmail} style={{ ...smallBtn, color: COLORS.gold, borderColor: COLORS.gold }}>Email</button>
              </div>
            )}
          </div>

          {rightPanel === "email" ? (
            <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 24, border: "1px solid " + COLORS.border, maxWidth: 600 }}>
              <p style={{ fontSize: 11, color: COLORS.creamFaint, marginBottom: 4 }}>SUBJECT</p>
              <p style={{ fontSize: 14, color: COLORS.cream, margin: "0 0 16px", fontWeight: 600 }}>{emailData.subject}</p>
              <p style={{ fontSize: 11, color: COLORS.creamFaint, marginBottom: 4 }}>BODY</p>
              <pre style={{ fontSize: 13, color: COLORS.creamDim, whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontFamily: FONTS.body }}>{emailData.body}</pre>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={handleCopyEmail} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: copied ? COLORS.success : COLORS.gold, color: COLORS.onGold, fontWeight: 700, fontSize: 12, fontFamily: FONTS.body }}>{copied ? "Copied!" : "Copy to Clipboard"}</button>
                <button onClick={handleMailto} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid " + COLORS.gold, cursor: "pointer", background: "transparent", color: COLORS.gold, fontWeight: 700, fontSize: 12, fontFamily: FONTS.body }}>Open in Mail</button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 580, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
              <PreviewCard form={form} rows={rows} total={total} transportLines={transportLines} />
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

// Preview component
function PreviewCard({ form, rows, total, transportLines }) {
  const multiShow = form.shows.length > 1;
  return (
    <div style={{ background: COLORS.bgCard, color: COLORS.cream, fontFamily: FONTS.body, minHeight: 600 }}>
      <div style={{ height: 5, background: COLORS.gold }} />
      <div style={{ padding: "24px 28px 32px" }}>
        <h1 style={{ fontFamily: FONTS.display, fontSize: 24, fontWeight: 700, margin: 0, color: COLORS.cream }}>Emma Donovan</h1>
        <p style={{ color: COLORS.creamDim, fontSize: 12, margin: "4px 0 0", letterSpacing: 0.5 }}>
          Fee Offer - {multiShow ? form.shows.length + " Engagements" : "Engagement"}
        </p>
        <div style={{ height: 1.5, background: COLORS.gold, margin: "14px 0 18px", opacity: 0.8 }} />

        {form.shows.map((show, idx) => (
          <div key={idx}>
            {multiShow && <p style={{ color: COLORS.gold, fontSize: 10, fontWeight: 700, letterSpacing: 1, margin: idx === 0 ? "0 0 6px" : "12px 0 6px", textTransform: "uppercase" }}>{show.activity} {idx + 1} of {form.shows.length}</p>}
            {!multiShow && <PH>Engagement Details</PH>}
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "4px 10px", marginBottom: multiShow ? 6 : 16 }}>
              <DR label="Engagement" value={show.engagement} />
              <DR label="Location" value={show.location} />
              <DR label="Date" value={show.performanceDate} />
              <DR label="Slot" value={show.slot} />
              {show.repertoire && <DR label="Repertoire" value={show.repertoire} />}
              <DR label="Format" value={show.format} />
              {multiShow && <DR label="Activity" value={show.activity} />}
            </div>
            {multiShow && idx < form.shows.length - 1 && <div style={{ height: 1, background: COLORS.border, margin: "4px 0" }} />}
          </div>
        ))}

        <div style={{ height: 1, background: COLORS.border, margin: "10px 0" }} />
        <PH>Fee Breakdown</PH>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 32px 72px", background: COLORS.bgTableAlt, padding: "6px 10px", borderRadius: "6px 6px 0 0", fontSize: 10, fontWeight: 700, color: COLORS.gold, letterSpacing: 0.5 }}>
            <span>ITEM</span><span>AMOUNT</span><span>QTY</span><span>TOTAL</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 32px 72px", padding: "5px 10px", fontSize: 11, background: i % 2 === 1 ? COLORS.bgTable : "transparent" }}>
              <span style={{ color: COLORS.cream }}>{r.item}</span>
              <span style={{ color: COLORS.creamDim }}>{formatCurrency(r.amount)}</span>
              <span style={{ color: COLORS.creamDim }}>{r.qty}</span>
              <span style={{ color: COLORS.cream }}>{formatCurrency(r.total)}</span>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 32px 72px", padding: "7px 10px", background: COLORS.gold, borderRadius: "0 0 6px 6px", fontWeight: 700, fontSize: 12, color: COLORS.onGold }}>
            <span>TOTAL</span><span></span><span></span><span>{formatCurrency(total)} <span style={{ fontWeight: 400, fontSize: 9 }}>GST excl</span></span>
          </div>
        </div>

        <div style={{ height: 1, background: COLORS.border, margin: "12px 0" }} />
        <PH>Conditions</PH>
        <CT>Upon acceptance, a tour schedule and charts will be prepared and distributed.</CT>
        <CT>Fees payable within 14 days of invoice date, following the performance.</CT>
        <CT>Super at {form.superRate}% of performance and rehearsal fees to nominated fund.</CT>
        <CT>Please add living allowance (per diem) to your invoice.</CT>

        <div style={{ height: 1, background: COLORS.border, margin: "12px 0" }} />
        <PH>Transport & Accommodation</PH>
        {transportLines.map((l, i) => <CT key={i}>{l}</CT>)}

        <div style={{ height: 1, background: COLORS.border, margin: "12px 0" }} />
        <PH>Invoice To</PH>
        <p style={{ color: COLORS.cream, fontSize: 11, margin: "4px 0 2px" }}>Jiindahood Pty Ltd</p>
        <p style={{ color: COLORS.creamDim, fontSize: 11, margin: 0 }}>ABN: 61 663 395 364</p>
      </div>
      <div style={{ height: 3, background: COLORS.gold }} />
    </div>
  );
}

function PH({ children }) { return <h3 style={{ color: COLORS.gold, fontSize: 12, fontWeight: 700, letterSpacing: 0.8, margin: "14px 0 6px", fontFamily: FONTS.body }}>{children}</h3>; }
function DR({ label, value }) { return (<><span style={{ color: COLORS.creamDim, fontSize: 11 }}>{label}</span><span style={{ color: COLORS.cream, fontSize: 11, fontWeight: 600 }}>{value || "-"}</span></>); }
function CT({ children }) { return <p style={{ color: COLORS.creamDim, fontSize: 10, margin: "2px 0", lineHeight: 1.5 }}>{children}</p>; }
function SL({ children }) { return <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, textTransform: "uppercase", letterSpacing: 1.2, margin: "16px 0 8px", paddingBottom: 4, borderBottom: "1px solid " + COLORS.border, fontFamily: FONTS.body }}>{children}</p>; }
function FG({ label, children }) { return (<div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: COLORS.creamFaint, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONTS.body }}>{label}</label>{children}</div>); }
