import "./globals.css";

export const metadata = {
  title: "Rate Card Generator - Emma Donovan",
  description: "Band rate card generator for Emma Donovan engagements",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
