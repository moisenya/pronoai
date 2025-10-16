import "./globals.css";

export const metadata = {
  title: "PronoAI — Pronostics Sportifs",
  description: "Pronos IA gratuits Football, Tennis, Basket",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="antialiased bg-black text-white">{children}</body>
    </html>
  );
}
