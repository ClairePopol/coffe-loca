import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { PageFooter, PageHeader } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "LOCA STORE — Coming soon",
  description: "Beans, objects, dan cerita kecil dari Loca sedang kami siapkan.",
};

const previews = [
  { number: "01", title: "Loca Beans", note: "Biji kopi yang kami seduh setiap hari, untuk diseduh di rumah." },
  { number: "02", title: "Objects", note: "Tumbler, mug, dan barang kecil untuk menemani jedamu." },
  { number: "03", title: "Gift Card", note: "Hadiah kecil untuk teman yang juga butuh jeda." },
];

export default function StorePage() {
  return (
    <main className="page-shell store-page">
      <PageHeader backLabel="BACK TO COFFEE" wordmark={{ first: "LOCA", second: "STORE", tagline: "TAKE LOCA HOME" }} />
      <section className="store-content" aria-labelledby="store-title">
        <div className="page-heading">
          <span className="eyebrow"><i /> LOCA STORE / COMING SOON</span>
          <h1 id="store-title">Take a little<br /><em>Loca home.</em></h1>
          <p>Beans, objects, dan cerita kecil dari Loca sedang kami siapkan. Sampai saat itu, mampir dulu ke kedai kami di Medan.</p>
        </div>
        <ul className="store-grid">
          {previews.map((item) => (
            <li key={item.number} className="store-item">
              <span className="store-item-top"><b>{item.number}</b><small>SEGERA HADIR</small></span>
              <span className="store-item-art" aria-hidden="true"><img src="/white-coffee-bean.png" alt="" /></span>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
            </li>
          ))}
        </ul>
        <div className="store-actions">
          <a className="btn-primary store-cta" href="/"><span>KEMBALI KE COFFEE LOCA</span><span className="arrow-icon" aria-hidden="true" /></a>
          <a className="btn-ghost" href={`mailto:${SITE.email}?subject=Kabari%20saya%20saat%20Loca%20Store%20buka`}>KABARI SAYA SAAT BUKA <span className="arrow-icon" aria-hidden="true" /></a>
        </div>
      </section>
      <PageFooter items={["COFFE LOCA · MEDAN", "GOOD COFFEE, GOOD COMPANY.", "© 2026"]} />
    </main>
  );
}
