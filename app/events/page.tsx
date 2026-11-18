import type { Metadata } from "next";
import { PageFooter } from "@/components/PageShell";
import StoreHeader, { type Brand } from "@/components/store/StoreHeader";
import EventsApp from "@/components/events/EventsApp";

export const metadata: Metadata = {
  title: "EVENT — Coffe Loca",
  description: "Jadwal turnamen dan kegiatan di Coffe Loca: Riftbound, Pokémon, Digimon, One Piece, Lorcana, boardgame, dan lainnya.",
};

const EVENTS_BRAND: Brand = { second: "EVENT", tagline: "TURNAMEN & KEGIATAN", href: "/events", label: "Loca Event, ke jadwal", menuTop: "NAVIGASI / LOCA EVENT", next: "/events" };

export default function EventsPage() {
  return (
    <main className="page-shell store-page events-page">
      <StoreHeader brand={EVENTS_BRAND} />
      <EventsApp />
      <PageFooter items={["COFFE LOCA · MEDAN", "SEMUA WAKTU DALAM WIB", "© 2026"]} />
    </main>
  );
}
