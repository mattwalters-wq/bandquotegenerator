import "./globals.css";

export const metadata = {
  title: "Band Quotes - Emma Donovan & Sarah Grace Buckley",
  description: "Quick band quotes and rate cards",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

// Apply the saved theme before first paint to avoid a flash of the wrong colours.
const themeInit = `(function(){try{var t=localStorage.getItem('bqg_theme')||'dark';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
