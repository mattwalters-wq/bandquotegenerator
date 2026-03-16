"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_VALUES, INITIAL_FORM, SLOT_OPTIONS, FORMAT_OPTIONS, TRANSPORT_OPTIONS, REIMBURSEMENT_OPTIONS } from "@/lib/constants";
import RateCardPreview from "@/components/RateCardPreview";

export default function EditorPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saved, setSaved] = useState([]);
  const [activeTab, setActiveTab] = useState("editor");
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef(null);

  // Load saved cards from Supabase
  const loadCards = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("rate_cards")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setSaved(data);
    } catch (e) { console.error("Load error:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "feeType") {
        if (value === "local") next.performanceFee = DEFAULT_VALUES.localFee;
        else if (value === "interstate") next.performanceFee = DEFAULT_VALUES.interstateFee;
      }
      return next;
    });
  };

  const handleSave = async () => {
    const name = (form.engagement || "Untitled") + " - " + (form.performanceDate || "No date");
    if (supabase) {
      const { data, error } = await supabase
        .from("rate_cards")
        .insert([{ name, form_data: form }])
        .select()
        .single();
      if (!error && data) setSaved((prev) => [data, ...prev]);
    } else {
      setSaved((prev) => [{ id: Date.now(), name, form_data: form, created_at: new Date().toISOString() }, ...prev]);
    }
  };

  const handleLoad = (entry) => {
    setForm({ ...entry.form_data });
    setActiveTab("editor");
  };

  const handleDelete = async (id) => {
    if (supabase) {
      await supabase.from("rate_cards").delete().eq("id", id);
    }
    setSaved((prev) => prev.filter((s) => s.id !== id));
  };

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
      const filename = "Emma_Donovan_-_Rate_Card_-_" + (form.engagement || "Untitled").replace(/\s+/g, "_") + ".pdf";
      pdf.save(filename);
    } catch (e) {
      console.error("PDF export error:", e);
      alert("PDF export failed. Please try again.");
    }
    setExporting(false);
  };

  const inputStyle = { width: "100%", padding: "8px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const selectStyle = { ...inputStyle, appearance: "none", cursor: "pointer", paddingRight: 28, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };
  const checkStyle = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1", cursor: "pointer", marginBottom: 6 };

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
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
              background: activeTab === tab ? "#e94560" : "#1e293b", color: activeTab === tab ? "#fff" : "#94a3b8", transition: "all 0.15s",
            }}>{tab === "editor" ? "Editor" : `Saved (${saved.length})`}</button>
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
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>{entry.form_data?.location} - {entry.form_data?.format}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleLoad(entry)} style={{ padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", background: "#e94560", color: "#fff", fontSize: 11, fontWeight: 600 }}>Load</button>
                    <button onClick={() => handleDelete(entry.id)} style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid #475569", cursor: "pointer", background: "transparent", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Form */}
          <div style={{ width: 360, flexShrink: 0, overflow: "auto", padding: "16px 18px", borderRight: "1px solid #1e293b", background: "#0f172a" }}>
            <SectionLabel>Engagement Details</SectionLabel>
            <FieldGroup label="Engagement / Event"><input style={inputStyle} value={form.engagement} onChange={(e) => update("engagement", e.target.value)} placeholder="e.g. Port Fairy Folk Festival" /></FieldGroup>
            <FieldGroup label="Location"><input style={inputStyle} value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Port Fairy, VIC" /></FieldGroup>
            <FieldGroup label="Performance Date"><input style={inputStyle} value={form.performanceDate} onChange={(e) => update("performanceDate", e.target.value)} placeholder="e.g. March 8, 2026" /></FieldGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldGroup label="Slot"><select style={selectStyle} value={form.slot} onChange={(e) => update("slot", e.target.value)}>{SLOT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select></FieldGroup>
              <FieldGroup label="Format"><select style={selectStyle} value={form.format} onChange={(e) => update("format", e.target.value)}>{FORMAT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}</select></FieldGroup>
            </div>
            <FieldGroup label="Repertoire (optional)"><input style={inputStyle} value={form.repertoire} onChange={(e) => update("repertoire", e.target.value)} placeholder="e.g. Take Me To The River" /></FieldGroup>

            <SectionLabel>Fees</SectionLabel>
            <FieldGroup label="Fee Type">
              <select style={selectStyle} value={form.feeType} onChange={(e) => update("feeType", e.target.value)}>
                <option value="local">Local ($450)</option>
                <option value="interstate">Interstate ($540)</option>
                <option value="custom">Custom</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Performance Fee"><input type="number" style={inputStyle} value={form.performanceFee} onChange={(e) => update("performanceFee", e.target.value)} /></FieldGroup>

            <label style={checkStyle}><input type="checkbox" checked={form.hasMdFee} onChange={(e) => update("hasMdFee", e.target.checked)} /> Music Director fee</label>
            {form.hasMdFee && <FieldGroup label="MD Fee"><input type="number" style={inputStyle} value={form.mdFee} onChange={(e) => update("mdFee", e.target.value)} /></FieldGroup>}

            <label style={checkStyle}><input type="checkbox" checked={form.hasRehearsalFee} onChange={(e) => update("hasRehearsalFee", e.target.checked)} /> Rehearsal fee</label>
            {form.hasRehearsalFee && (
              <>
                <FieldGroup label="Rehearsal Fee"><input type="number" style={inputStyle} value={form.rehearsalFee} onChange={(e) => update("rehearsalFee", e.target.value)} /></FieldGroup>
                <FieldGroup label="Rehearsal Note"><input style={inputStyle} value={form.rehearsalNote} onChange={(e) => update("rehearsalNote", e.target.value)} /></FieldGroup>
              </>
            )}

            <label style={checkStyle}><input type="checkbox" checked={form.hasTravelDay} onChange={(e) => update("hasTravelDay", e.target.checked)} /> Travel day (50% of show fee)</label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <FieldGroup label="Per Diem"><input type="number" style={inputStyle} value={form.perDiem} onChange={(e) => update("perDiem", e.target.value)} /></FieldGroup>
              <FieldGroup label="PD Days"><input type="number" style={inputStyle} value={form.pdDays} onChange={(e) => update("pdDays", e.target.value)} min={1} max={10} /></FieldGroup>
            </div>

            <SectionLabel>Transport & Accommodation</SectionLabel>
            <FieldGroup label="Transport Type">
              <select style={selectStyle} value={form.transportType} onChange={(e) => update("transportType", e.target.value)}>
                {TRANSPORT_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Reimbursement Items">
              <select style={selectStyle} value={form.reimbursementItems} onChange={(e) => update("reimbursementItems", e.target.value)}>
                {REIMBURSEMENT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Reimbursement Cap"><input type="number" style={inputStyle} value={form.reimbursementCap} onChange={(e) => update("reimbursementCap", e.target.value)} /></FieldGroup>

            {form.transportType !== "flights_accom" && (
              <label style={checkStyle}><input type="checkbox" checked={form.hasAccommodation} onChange={(e) => update("hasAccommodation", e.target.checked)} /> Accommodation provided (overnight)</label>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 20, paddingBottom: 20 }}>
              <button onClick={handleExportPDF} disabled={exporting} style={{
                flex: 1, padding: "10px 0", borderRadius: 6, border: "none", cursor: exporting ? "wait" : "pointer",
                background: "#e94560", color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: 0.5, opacity: exporting ? 0.6 : 1,
              }}>{exporting ? "Exporting..." : "Export PDF"}</button>
              <button onClick={handleSave} style={{ flex: 1, padding: "10px 0", borderRadius: 6, border: "1px solid #e94560", cursor: "pointer", background: "transparent", color: "#e94560", fontWeight: 700, fontSize: 13, letterSpacing: 0.5 }}>Save</button>
              <button onClick={handleReset} style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #475569", cursor: "pointer", background: "transparent", color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>Reset</button>
            </div>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#0b1120" }}>
            <p style={{ fontSize: 11, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Live Preview</p>
            <div style={{ maxWidth: 580, borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
              <RateCardPreview form={form} ref={previewRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "#e94560", textTransform: "uppercase", letterSpacing: 1.2, margin: "18px 0 10px", paddingBottom: 4, borderBottom: "1px solid #1e293b" }}>{children}</p>;
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>
      {children}
    </div>
  );
}
