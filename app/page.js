"use client";
import dynamic from "next/dynamic";

// On charge TON composant côté client (évite les soucis avec Recharts)
const ClientApp = dynamic(() => import("../components/PronoAIApp"), { ssr: false });

export default function Page() {
  return <ClientApp />;
}
