"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_VALUES, INITIAL_FORM, EMPTY_SHOW,
  SLOT_OPTIONS, FORMAT_OPTIONS, ACTIVITY_OPTIONS,
  TRANSPORT_OPTIONS, REIMBURSEMENT_OPTIONS,
  generateEmail,
} from "@/lib/constants";
import RateCardPreview from "@/components/RateCardPreview";

export default function EditorPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saved, setSaved] = useState([]);
  const [activeTab, setActiveTab] = useState("editor");
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailData, setEmailData] = useState({ subject: "", body: "" });
  const [copied, setCopied] = useState(false);
  const previewRef = useRef(null);

  const loadCards = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data, error } = await supabase.from("rate_cards").select("*").order("created_at", { ascending: false });
      if (!error && data) setSaved(data);
    } catch (e) { console.error("Load error:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateShow = (idx, field, value) => {
    setForm((prev) => {
      const shows = [...prev.shows];
      shows[idx] = { ...shows[idx], [field]: value };
      return { ...prev, shows };
    });
  };

  const addShow = () => setForm((prev) => ({ ...prev, shows: [...prev.shows, { ...EMPTY_SHOW }] }));

  const removeShow = (idx) => {
    setForm((prev) => {
      if (prev.shows.length <= 1) return prev;
      return { ...prev, shows: prev.shows.filter((_, i) => i !== idx) };
    });
  };

  const duplicateShow = (idx) => {
    setForm((prev) => {
      const newShow = { ...prev.shows[idx], performanceDate: "" };
      const shows = [...prev.shows];
      shows.splice(idx + 1, 0, newShow);
      return { ...prev, shows };
    });
  };

  const handleSave = async () => {
    const showNames = form.shows.map((s) => s.engagement || "Untitled").join(", ");
    const name = showNames + " - " + (form.shows[0]?.performanceDate || "No date");
    if (supabase) {
      const { data, error } = await supabase.from("rate_cards").insert([{ name, form_data: form }]).select().single();
      if (!error && data) setSaved((prev) => [data, ...prev]);
    } else {
      setSaved((prev) => [{ id: Date.now(), name, form_data: form, created_at: new Date().toISOString() }, ...prev]);
    }
  };

  const handleLoad = (entry) => { setForm({ ...INITIAL_FORM, ...entry.form_data }); setActiveTab("editor"); };
  const handleDelete = async (id) => { if (supabase) await supabase.from("rate_cards").delete().eq("id", id); setSaved((prev) => prev.filter((s) => s.id !== id)); };
  const handleReset = () => setForm(INITIAL_FORM);

  const handleExportPDF = async () => {
    if (!previewRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: "#1a1a2e", useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, imgW, Math.min(imgH, pageH));
      const engName = form.shows.map((s) => s.engagement || "Untitled").join("_").replace(/\s+/g, "_");
      pdf.save("Emma_Donovan_-_Rate_Card_-_" + engName + ".pdf");
    } catch (e) { console.error("PDF export error:", e); alert("PDF export failed."); }
    setExporting(false);
  };

  const handleGenerateEmail = () => {
    const email = generateEmail(form);
    setEmailData(email);
    setShowEmailPanel(true);
    setCopied(false);
  };

  const handleCopyEmail = () => {
    const text = "Subject: " + emailData.subject + "\n\n" + emailData.body;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleMailto = () => {
    const mailto = "mailto:?subject=" + encodeURIComponent(emailData.subject) + "&body=" + encodeURIComponent(emailData.body);
    window.open(mailto);
  };

  const iS = { width: "100%", padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const sS = { ...iS, appearance: "none", cursor: "pointer", paddingRight: 28, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };
  const cL = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1", cursor: "pointer", marginBottom: 6 };
  const smallBtn = { padding: "3px 8px", borderRadius: 4, border: "1px solid #475569", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 10, fontWeight: 600 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f172a", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", borderBottom: "2px solid #e94560", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "#e94560", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#fff" }}>RC</div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff", letterSpacing: 0.5 }}>Rate Card Generator</h1>
            <p style={{ fontSize: 11, color: "#b0b0b0", margin: 0 }}>Emma Donovan Band Offers</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["editor", "saved"].map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setShowEmailPanel(false); }} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
              background: activeTab === tab ? "#e94560" : "#1e293b", color: activeTab === tab ? "#fff" : "#94a3b8",
            }}>{tab === "editor" ? "Editor" : "Saved (" + saved.length + ")"}</button>
          ))}
        </div>
      </div>

      {activeTab === "saved" ? (
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}><p>Loading...</p></div>
          ) : saved.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
              <p style={{ fontSize: 14 }}>No saved rate cards yet.</p>
              <p style={{ fontSize: 12 }}>Create one in the Editor tab and hit Save.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {saved.map((entry) => (
                <div key={entry.id} style={{ background: "#1e293b", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #334155" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>{entry.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                      {entry.form_data?.shows?.[0]?.location || ""} - {entry.form_data?.shows?.length || 1} show(s)
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleLoad(entry)} style={{ padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: "#e94560", color: "#fff", fontSize: 11, fontWeight: 600 }}>Load</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ ...smallBtn }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Form */}
          <div style={{ width: 380, flexShrink: 0, overflow: "auto", padding: "16px 18px", borderRight: "1px solid #1e293b", background: "#0f172a" }}>
            {/* Recipient */}
            <SL>Recipient</SL>
            <FG label="Musician Name (for email)">
              <input style={iS} value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} placeholder="e.g. Ben" />
            </FG>

            {/* Shows */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 6 }}>
              <SL style={{ margin: 0 }}>Shows / Engagements ({form.shows.length})</SL>
              <button onClick={addShow} style={{ padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", background: "#e94560", color: "#fff", fontSize: 11, fontWeight: 700 }}>+ Add Show</button>
            </div>

            {form.shows.map((show, idx) => (
              <div key={idx} style={{ background: "#111827", borderRadius: 8, padding: "12px 14px", marginBottom: 10, border: "1px solid #1e293b" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e94560", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {form.shows.length > 1 ? "Show " + (idx + 1) : "Show Details"}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => duplicateShow(idx)} style={smallBtn}>Duplicate</button>
                    {form.shows.length > 1 && <button onClick={() => removeShow(idx)} style={{ ...smallBtn, borderColor: "#e94560", color: "#e94560" }}>Remove</button>}
                  </div>
                </div>

                <FG label="Activity">
                  <select style={sS} value={show.activity} onChange={(e) => updateShow(idx, "activity", e.target.value)}>
                    {ACTIVITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </FG>
                <FG label="Engagement / Event"><input style={iS} value={show.engagement} onChange={(e) => updateShow(idx, "engagement", e.target.value)} placeholder="e.g. MSO Hamer Hall" /></FG>
                <FG label="Location"><input style={iS} value={show.location} onChange={(e) => updateShow(idx, "location", e.target.value)} placeholder="e.g. Melbourne, VIC" /></FG>
                <FG label="Date"><input style={iS} value={show.performanceDate} onChange={(e) => updateShow(idx, "performanceDate", e.target.value)} placeholder="e.g. July 10, 2026" /></FG>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <FG label="Slot"><select style={sS} value={show.slot} onChange={(e) => updateShow(idx, "slot", e.target.value)}>{SLOT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></FG>
                  <FG label="Format"><select style={sS} value={show.format} onChange={(e) => updateShow(idx, "format", e.target.value)}>{FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></FG>
                </div>
                <FG label="Repertoire (optional)"><input style={iS} value={show.repertoire} onChange={(e) => updateShow(idx, "repertoire", e.target.value)} placeholder="e.g. Take Me To The River" /></FG>
                <FG label="Fee for this show"><input type="number" style={iS} value={show.performanceFee} onChange={(e) => updateShow(idx, "performanceFee", e.target.value)} /></FG>
                <label style={cL}><input type="checkbox" checked={show.hasMdFee} onChange={(e) => updateShow(idx, "hasMdFee", e.target.checked)} /> Music Director fee</label>
                {show.hasMdFee && <FG label="MD Fee"><input type="number" style={iS} value={show.mdFee} onChange={(e) => updateShow(idx, "mdFee", e.target.value)} /></FG>}
              </div>
            ))}

            {/* Global fees */}
            <SL>Additional Fees</SL>
            <label style={cL}><input type="checkbox" checked={form.hasRehearsalFee} onChange={(e) => update("hasRehearsalFee", e.target.checked)} /> Separate rehearsal fee</label>
            {form.hasRehearsalFee && (
              <>
                <FG label="Rehearsal Fee"><input type="number" style={iS} value={form.rehearsalFee} onChange={(e) => update("rehearsalFee", e.target.value)} /></FG>
                <FG label="Rehearsal Note"><input style={iS} value={form.rehearsalNote} onChange={(e) => update("rehearsalNote", e.target.value)} /></FG>
              </>
            )}
            <label style={cL}><input type="checkbox" checked={form.hasTravelDay} onChange={(e) => update("hasTravelDay", e.target.checked)} /> Travel day(s)</label>
            {form.hasTravelDay && (
              <FG label="Travel Days"><input type="number" style={iS} value={form.travelDays} onChange={(e) => update("travelDays", e.target.value)} min={1} max={10} /></FG>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FG label="Per Diem"><input type="number" style={iS} value={form.perDiem} onChange={(e) => update("perDiem", e.target.value)} /></FG>
              <FG label="PD Days"><input type="number" style={iS} value={form.pdDays} onChange={(e) => update("pdDays", e.target.value)} min={1} max={10} /></FG>
            </div>

            <SL>Transport & Accommodation</SL>
            <FG label="Transport Type"><select style={sS} value={form.transportType} onChange={(e) => update("transportType", e.target.value)}>{TRANSPORT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></FG>
            <FG label="Reimbursement Items"><select style={sS} value={form.reimbursementItems} onChange={(e) => update("reimbursementItems", e.target.value)}>{REIMBURSEMENT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></FG>
            <FG label="Reimbursement Cap"><input type="number" style={iS} value={form.reimbursementCap} onChange={(e) => update("reimbursementCap", e.target.value)} /></FG>
            {form.transportType !== "flights_accom" && (
              <label style={cL}><input type="checkbox" checked={form.hasAccommodation} onChange={(e) => update("hasAccommodation", e.target.checked)} /> Accommodation provided (overnight)</label>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
              <button onClick={handleExportPDF} disabled={exporting} style={{
                flex: "1 1 45%", padding: "10px 0", borderRadius: 6, border: "none", cursor: exporting ? "wait" : "pointer",
                background: "#e94560", color: "#fff", fontWeight: 700, fontSize: 12, opacity: exporting ? 0.6 : 1,
              }}>{exporting ? "Exporting..." : "Export PDF"}</button>
              <button onClick={handleGenerateEmail} style={{
                flex: "1 1 45%", padding: "10px 0", borderRadius: 6, border: "none", cursor: "pointer",
                background: "#3b82f6", color: "#fff", fontWeight: 700, fontSize: 12,
              }}>Generate Email</button>
              <button onClick={handleSave} style={{ flex: "1 1 45%", padding: "10px 0", borderRadius: 6, border: "1px solid #e94560", cursor: "pointer", background: "transparent", color: "#e94560", fontWeight: 700, fontSize: 12 }}>Save</button>
              <button onClick={handleReset} style={{ flex: "1 1 45%", padding: "10px 0", borderRadius: 6, border: "1px solid #475569", cursor: "pointer", background: "transparent", color: "#94a3b8", fontWeight: 600, fontSize: 12 }}>Reset</button>
            </div>
            <div style={{ height: 20 }} />
          </div>

          {/* Preview / Email Panel */}
          <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#0b1120" }}>
            {showEmailPanel ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, margin: 0 }}>Generated Email</p>
                  <button onClick={() => setShowEmailPanel(false)} style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #475569", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 11 }}>Back to Preview</button>
                </div>
                <div style={{ background: "#1e293b", borderRadius: 8, padding: 20, border: "1px solid #334155", maxWidth: 600 }}>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>SUBJECT</p>
                  <p style={{ fontSize: 14, color: "#f1f5f9", margin: "0 0 16px", fontWeight: 600 }}>{emailData.subject}</p>
                  <p style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>BODY</p>
                  <pre style={{ fontSize: 13, color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>{emailData.body}</pre>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button onClick={handleCopyEmail} style={{
                      padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: copied ? "#22c55e" : "#e94560", color: "#fff", fontWeight: 700, fontSize: 12,
                    }}>{copied ? "Copied!" : "Copy to Clipboard"}</button>
                    <button onClick={handleMailto} style={{
                      padding: "8px 16px", borderRadius: 6, border: "1px solid #3b82f6", cursor: "pointer",
                      background: "transparent", color: "#3b82f6", fontWeight: 700, fontSize: 12,
                    }}>Open in Mail App</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 11, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Live Preview</p>
                <div style={{ maxWidth: 580, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                  <RateCardPreview form={form} ref={previewRef} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SL({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "#e94560", textTransform: "uppercase", letterSpacing: 1.2, margin: "18px 0 10px", paddingBottom: 4, borderBottom: "1px solid #1e293b" }}>{children}</p>;
}

function FG({ label, children }) {
  return (<div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>{children}</div>);
}
