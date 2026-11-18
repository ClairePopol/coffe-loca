import type { Metadata } from "next";
import { PageFooter } from "@/components/PageShell";
import StoreHeader from "@/components/store/StoreHeader";
import StoreProfile from "@/components/store/StoreProfile";

export const metadata: Metadata = {
  title: "AKUN — Loca Store",
  description: "Pesanan dan titipan Loca Store kamu.",
  robots: { index: false },
};

export default function StoreProfilePage() {
  return (
    <main className="page-shell store-page">
      <StoreHeader />
      <StoreProfile />
      <PageFooter items={["COFFE LOCA · MEDAN", "LOCA STORE", "© 2026"]} />
    </main>
  );
}
