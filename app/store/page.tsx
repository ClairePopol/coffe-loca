import type { Metadata } from "next";
import { PageFooter, PageHeader } from "@/components/PageShell";
import StoreApp from "@/components/store/StoreApp";

export const metadata: Metadata = {
  title: "LOCA STORE — Boardgame & Pokémon",
  description: "Boardgame, kartu Pokémon, dan aksesori dari Loca. Pilih barangnya, pesan lewat WhatsApp.",
};

export default function StorePage() {
  return (
    <main className="page-shell store-page">
      <PageHeader backLabel="BACK TO COFFEE" wordmark={{ first: "LOCA", second: "STORE", tagline: "BOARDGAME · POKÉMON" }} />
      <StoreApp />
      <PageFooter items={["COFFE LOCA · MEDAN", "PESAN LEWAT WHATSAPP", "© 2026"]} />
    </main>
  );
}
