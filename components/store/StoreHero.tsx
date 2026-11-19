import type { ReactNode } from "react";

/** Black hero band shared by /store, /events and /store/profile (same look as the Coffee home sections). */
export default function StoreHero({ id, kicker, side, title, children }: { id: string; kicker: string; side: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="store-hero section-pad" aria-labelledby={id}>
      <div className="section-kicker section-kicker-dark"><span>/ {kicker}</span><span>{side}</span></div>
      <div className="store-hero-body">
        <h1 id={id}>{title}</h1>
        {children}
      </div>
      <span className="store-hero-checker" aria-hidden="true" />
    </section>
  );
}
