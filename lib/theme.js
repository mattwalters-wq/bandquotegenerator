// Emma Donovan inspired palette - warm earth tones, calmed down.
// The UI colours below resolve to CSS variables defined in app/globals.css, so a
// single [data-theme] switch on <html> flips the whole app between dark and light.
// The pdf* arrays stay as literal RGB values because the PDF is rendered
// server-side and is always the dark, branded document.
export const COLORS = {
  // Backgrounds
  bgDeep: "var(--bg-deep)",       // page background
  bgCard: "var(--bg-card)",       // card surfaces
  bgInput: "var(--bg-input)",     // input fields
  bgTable: "var(--bg-table)",     // table rows
  bgTableAlt: "var(--bg-table-alt)", // alternating rows
  bgTableHead: "var(--bg-table-head)", // table header

  // Accent
  gold: "var(--gold)",            // primary accent - warm gold
  goldLight: "var(--gold-light)", // lighter gold for hover
  goldDim: "var(--gold-dim)",     // dimmer gold
  onGold: "var(--on-gold)",       // text/icon colour on a gold fill

  // Text
  cream: "var(--cream)",          // primary text
  creamDim: "var(--cream-dim)",   // secondary text
  creamFaint: "var(--cream-faint)", // tertiary / placeholder

  // Borders
  border: "var(--border)",        // subtle borders
  borderLight: "var(--border-light)",

  // Functional
  success: "var(--success)",
  error: "var(--error)",

  // PDF specific (server-side, always the dark branded document)
  pdfBg: [28, 20, 16],
  pdfCard: [42, 31, 24],
  pdfGold: [212, 160, 74],
  pdfCream: [245, 239, 230],
  pdfCreamDim: [196, 184, 168],
  pdfTableHead: [74, 56, 40],
  pdfTableAlt: [58, 44, 32],
  pdfDivider: [74, 60, 48],
};

export const FONTS = {
  display: "'Playfair Display', Georgia, serif",
  body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
