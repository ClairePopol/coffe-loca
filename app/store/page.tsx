"use client";

export default function StorePage() {
  return (
    <main className="store-page">
      <header className="store-header"><a className="wordmark store-wordmark" href="/"><img className="wordmark-logo" src="/white-coffee-bean.png" alt="" /><span className="wordmark-type"><span>LOCA <b>STORE</b></span><small>TAKE LOCA HOME</small></span></a><a className="store-back" href="/">← BACK TO COFFEE</a></header>
      <section className="store-content"><span className="eyebrow"><i /> LOCA STORE / COMING SOON</span><h1>Take a little<br /><em>Loca home.</em></h1><p>Beans, objects, dan cerita kecil dari Loca sedang kami siapkan.</p><a className="store-return" href="/">KEMBALI KE COFFEE LOCA <span className="arrow-icon" aria-hidden="true" /></a></section>
      <footer className="store-footer"><span>COFFE LOCA · MEDAN</span><span>GOOD COFFEE, GOOD COMPANY.</span></footer>
    </main>
  );
}
