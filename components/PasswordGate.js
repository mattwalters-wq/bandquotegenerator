"use client";
import { useState } from "react";

const PASSCODE = "2026";

export default function PasswordGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (authenticated) return children;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input === PASSCODE) {
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  return (
    <div style={{
      height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0f172a", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    }}>
      <div style={{
        background: "#1a1a2e", borderRadius: 12, padding: "40px 36px", width: 360,
        border: "1px solid #1e293b", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, background: "#e94560",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 18, color: "#fff",
          }}>RC</div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>Rate Card Generator</h1>
            <p style={{ fontSize: 12, color: "#b0b0b0", margin: 0 }}>Emma Donovan Band Offers</p>
          </div>
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
              flex: 1, padding: "10px 14px", background: "#1e293b", border: error ? "1px solid #e94560" : "1px solid #334155",
              borderRadius: 8, color: "#f1f5f9", fontSize: 14, outline: "none",
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "#e94560", color: "#fff", fontWeight: 700, fontSize: 13,
            }}
          >Enter</button>
        </div>
        {error && <p style={{ color: "#e94560", fontSize: 12, marginTop: 8 }}>Incorrect passcode</p>}
      </div>
    </div>
  );
}
