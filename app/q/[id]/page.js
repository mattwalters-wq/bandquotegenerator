"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { COLORS, FONTS } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";
import QuoteResult from "@/components/QuoteResult";
import { snapshotArtist } from "@/lib/quote";

export default function SharedQuotePage({ params }) {
  const { id } = params;
  const { theme, toggle } = useTheme();
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) { setStatus("error"); return; }
      try {
        const { data, error } = await supabase.from("quotes").select("data").eq("id", id).single();
        if (!active) return;
        if (error || !data) { setStatus("missing"); return; }
        setSnapshot(data.data);
        setStatus("ready");
      } catch (e) {
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, [id]);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bgDeep, color: COLORS.cream, fontFamily: FONTS.body }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px", borderBottom: "1px solid " + COLORS.border, maxWidth: 680, margin: "0 auto",
      }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.cream }}>{snapshot ? snapshotArtist(snapshot).name : "Band Quote"}</h1>
          <p style={{ fontSize: 11, color: COLORS.creamFaint, letterSpacing: 1.2, textTransform: "uppercase", margin: 0 }}>Band quote</p>
        </div>
        <button onClick={toggle} aria-label="Toggle theme" style={{
          width: 38, height: 38, borderRadius: 10, border: "1px solid " + COLORS.border, background: "transparent",
          color: COLORS.creamDim, cursor: "pointer", fontSize: 16,
        }}>{theme === "dark" ? "☀" : "☾"}</button>
      </header>

      <main style={{ padding: "30px 18px 60px", maxWidth: 680, margin: "0 auto" }}>
        {status === "loading" && <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 60 }}>Loading quote...</p>}
        {status === "missing" && <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 60 }}>This quote could not be found. The link may be incorrect.</p>}
        {status === "error" && <p style={{ color: COLORS.creamFaint, textAlign: "center", padding: 60 }}>Sorry, this quote could not be loaded right now.</p>}
        {status === "ready" && <QuoteResult snapshot={snapshot} />}
      </main>
    </div>
  );
}
