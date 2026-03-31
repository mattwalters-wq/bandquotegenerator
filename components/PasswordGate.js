"use client";
import { useState } from "react";
import { COLORS, FONTS } from "@/lib/theme";

export default function PasswordGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authenticated) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === "2026") { setAuthenticated(true); setError(false); }
    else { setError(true); setInput(""); }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bgDeep }}>
      <div style={{ background: COLORS.bgCard, borderRadius: 16, padding: "48px 40px", width: 380, border: "1px solid " + COLORS.border, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontFamily: FONTS.display, fontSize: 28, fontWeight: 700, color: COLORS.cream, margin: "0 0 6px" }}>Emma Donovan</h1>
          <p style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.creamDim, letterSpacing: 1.5, textTransform: "uppercase" }}>Rate Card Generator</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
            placeholder="Enter passcode"
            autoFocus
            style={{
              flex: 1, padding: "12px 16px", background: COLORS.bgInput, border: "1px solid " + (error ? COLORS.error : COLORS.border),
              borderRadius: 10, color: COLORS.cream, fontSize: 14, outline: "none", fontFamily: FONTS.body,
            }}
          />
          <button onClick={handleSubmit} style={{
            padding: "12px 24px", borderRadius: 10, border: "none", cursor: "pointer",
            background: COLORS.gold, color: COLORS.bgDeep, fontWeight: 700, fontSize: 14, fontFamily: FONTS.body,
          }}>Enter</button>
        </div>
        {error && <p style={{ color: COLORS.error, fontSize: 12, marginTop: 8, fontFamily: FONTS.body }}>Incorrect passcode</p>}
      </div>
    </div>
  );
}
