"use client";

import { useEffect, useRef, useState } from "react";
import type { DayPeriod } from "@/lib/dayPeriod";

const SAYS: Record<DayPeriod, string> = {
  pagi: "Pagi! Ngopi dulu yuk ☕",
  siang: "Siang~ mampir ke Loca!",
  sore: "Sore santai di Loca ♪",
  malam: "Zzz… selamat malam",
};

/**
 * Loki, the Loca bird. One character all day long: same bird, a different outfit and action per time of day
 * (morning coffee, noon sunglasses, evening scarf, night cap + sleep). Accessories cross-fade and the bird
 * hops whenever the period changes.
 */
export default function LocaMascot({ period }: { period: DayPeriod }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  // The bubble only pops up briefly (on load and whenever the period changes) so it never sits on top of the sign.
  const [talking, setTalking] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !first.current) {
      el.classList.remove("is-hop");
      void el.offsetWidth;
      el.classList.add("is-hop");
    }
    first.current = false;
    setTalking(true);
    const timer = window.setTimeout(() => setTalking(false), 4200);
    return () => window.clearTimeout(timer);
  }, [period]);

  return (
    <div className="loki" data-mood={period} aria-hidden="true">
      <div className={`loki-bubble${talking ? " is-show" : ""}`}>
        {(Object.keys(SAYS) as DayPeriod[]).map((key) => <span key={key} className={key === period ? "is-on" : ""}>{SAYS[key]}</span>)}
      </div>
      <div className="loki-hop" ref={ref}>
        <span className="loki-note">♪</span>
        <span className="loki-zzz z1">z</span><span className="loki-zzz z2">Z</span>
        <svg className="loki-svg" viewBox="0 0 140 154">
          <ellipse cx="70" cy="148" rx="38" ry="5" fill="#000" opacity=".18" />
          <g className="loki-body">
            <g fill="#ffa534"><ellipse cx="54" cy="142" rx="10" ry="4.5" /><ellipse cx="86" cy="142" rx="10" ry="4.5" /></g>
            <ellipse className="loki-wing-l" cx="27" cy="98" rx="11" ry="22" fill="#cf2a31" transform="rotate(18 27 98)" />
            <ellipse cx="70" cy="88" rx="44" ry="46" fill="#e8353b" />
            <g fill="#d12a31"><ellipse cx="58" cy="43" rx="5" ry="11" transform="rotate(-28 58 43)" /><ellipse cx="70" cy="39" rx="5.5" ry="13" /><ellipse cx="82" cy="43" rx="5" ry="11" transform="rotate(28 82 43)" /></g>
            <ellipse cx="70" cy="106" rx="28" ry="30" fill="#fff1e8" />
            <g fill="#ff8f8f" opacity=".6"><circle cx="40" cy="92" r="6.5" /><circle cx="100" cy="92" r="6.5" /></g>
            <g className="loki-eyes">
              <circle cx="53" cy="78" r="10" fill="#fff" /><circle cx="87" cy="78" r="10" fill="#fff" />
              <circle cx="54" cy="79" r="5.6" fill="#2a1a14" /><circle cx="88" cy="79" r="5.6" fill="#2a1a14" />
              <circle cx="56" cy="76.8" r="1.9" fill="#fff" /><circle cx="90" cy="76.8" r="1.9" fill="#fff" />
            </g>
            <g className="loki-lids" fill="#e8353b"><ellipse cx="53" cy="78" rx="11" ry="11" /><ellipse cx="87" cy="78" rx="11" ry="11" /></g>
            <g className="loki-sleepy" fill="none" stroke="#2a1a14" strokeWidth="2.4" strokeLinecap="round"><path d="M44 79Q53 87 62 79" /><path d="M78 79Q87 87 96 79" /></g>
            <polygon points="62,89 78,89 70,101" fill="#ffa534" />
            <path className="loki-smile" d="M62 104Q70 110 78 104" fill="none" stroke="#c4541c" strokeWidth="1.8" strokeLinecap="round" />
            <g className="loki-glasses"><rect x="40" y="68" width="26" height="19" rx="8" fill="#1d1d2c" opacity=".94" /><rect x="74" y="68" width="26" height="19" rx="8" fill="#1d1d2c" opacity=".94" /><path d="M66 75H74" stroke="#1d1d2c" strokeWidth="3" /><path d="M45 73l8-2M79 73l8-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".6" /></g>
            <g className="loki-scarf"><path d="M32 112Q70 134 108 112L106 125Q70 146 34 125Z" fill="#ff9a3d" /><path d="M92 128l11 24H86z" fill="#ff7a2b" /><path d="M48 124l-1 7M62 129l-1 7M76 130l1 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" /></g>
            <g className="loki-cap"><path d="M40 60Q46 22 82 20Q104 20 118 48Q98 36 98 60Q70 46 42 64Z" fill="#3b4a9c" /><ellipse cx="70" cy="58" rx="35" ry="6.5" fill="#f4f6ff" /><circle cx="118" cy="48" r="7.5" fill="#f4f6ff" /></g>
            <g className="loki-arm">
              <ellipse cx="113" cy="98" rx="11" ry="22" fill="#cf2a31" transform="rotate(-18 113 98)" />
              <g className="loki-cup"><rect x="108" y="100" width="24" height="21" rx="5" fill="#fff" /><path d="M132 105q9 0 9 8t-9 7" fill="none" stroke="#fff" strokeWidth="3" /><ellipse cx="120" cy="101" rx="11" ry="3" fill="#6b3a1d" />
                <g className="loki-steam" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M114 94q-4-5 0-9t0-9" /><path d="M124 94q-4-5 0-9t0-9" /></g></g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
