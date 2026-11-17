import type { Metadata } from "next";
import { PageFooter } from "@/components/PageShell";
import StoreHeader from "@/components/store/StoreHeader";
import StoreApp from "@/components/store/StoreApp";

export const metadata: Metadata = {
  title: "LOCA STORE — Boardgame & Pokémon",
  description: "Boardgame, kartu Pokémon, dan aksesori dari Loca. Pilih barangnya, pesan lewat WhatsApp.",
};

export default function StorePage() {
  return (
    <main className="page-shell store-page">
      <StoreHeader />
      <StoreApp />
      <PageFooter items={["COFFE LOCA · MEDAN", "PESAN LEWAT WHATSAPP", "© 2026"]} />
    </main>
  );
}
