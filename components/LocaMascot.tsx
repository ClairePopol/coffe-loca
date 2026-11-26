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
 * Loki, the Loca pin mascot (the logo pin with a coffee-bean face). One character all day long: same pin, a different outfit and action per time of day
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
        <svg className="loki-svg" viewBox="0 -14 140 176">
          <ellipse cx="70" cy="153" rx="24" ry="5" fill="#fff" opacity=".92" />
          <g className="loki-body">
            <ellipse className="loki-wing-l" cx="19" cy="90" rx="8" ry="15" fill="#fff" transform="rotate(24 19 90)" />
            <path d="M70 151C70 151 17 99 17 66 17 36 40 13 70 13s53 23 53 53c0 33-53 85-53 85z" fill="#e8353b" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
            <ellipse cx="70" cy="62" rx="31" ry="38" fill="#fff1e8" />
            <path d="M70 26Q60 42 70 54" fill="none" stroke="#e8353b" strokeWidth="3.2" strokeLinecap="round" />
            <g fill="#ff8f8f" opacity=".65"><circle cx="46" cy="76" r="6.5" /><circle cx="94" cy="76" r="6.5" /></g>
            <g className="loki-eyes">
              <circle cx="55" cy="62" r="9.5" fill="#fff" stroke="#e9d3c2" strokeWidth="1.2" /><circle cx="85" cy="62" r="9.5" fill="#fff" stroke="#e9d3c2" strokeWidth="1.2" />
              <circle cx="56" cy="63" r="5.6" fill="#2a1a14" /><circle cx="86" cy="63" r="5.6" fill="#2a1a14" />
              <circle cx="58" cy="60.8" r="1.9" fill="#fff" /><circle cx="88" cy="60.8" r="1.9" fill="#fff" />
            </g>
            <g className="loki-lids" fill="#fff1e8"><ellipse cx="55" cy="62" rx="11" ry="11" /><ellipse cx="85" cy="62" rx="11" ry="11" /></g>
            <g className="loki-sleepy" fill="none" stroke="#2a1a14" strokeWidth="2.4" strokeLinecap="round"><path d="M46 63Q55 71 64 63" /><path d="M76 63Q85 71 94 63" /></g>
            <path className="loki-smile" d="M62 82Q70 90 78 82" fill="none" stroke="#c4541c" strokeWidth="2.2" strokeLinecap="round" />
            <g className="loki-glasses"><rect x="42" y="52" width="26" height="19" rx="8" fill="#1d1d2c" opacity=".94" /><rect x="72" y="52" width="26" height="19" rx="8" fill="#1d1d2c" opacity=".94" /><path d="M68 59H72" stroke="#1d1d2c" strokeWidth="3" /><path d="M47 57l8-2M77 57l8-2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".6" /></g>
            <g className="loki-scarf"><path d="M33 99Q70 123 107 99L100 114Q70 137 40 114Z" fill="#ff9a3d" /><path d="M88 125l11 25H83z" fill="#ff7a2b" /><path d="M50 115l-1 7M62 120l-1 7M76 121l1 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" /></g>
            <g className="loki-cap"><path d="M33 34Q40 -10 80 -10Q108 -9 124 24Q104 12 102 40Q70 26 35 42Z" fill="#3b4a9c" /><ellipse cx="68" cy="34" rx="38" ry="7" fill="#f4f6ff" /><circle cx="124" cy="25" r="8" fill="#f4f6ff" /></g>
            <g className="loki-arm">
              <ellipse cx="121" cy="90" rx="8" ry="15" fill="#fff" transform="rotate(-24 121 90)" />
              <g className="loki-cup"><rect x="114" y="92" width="24" height="21" rx="5" fill="#fff" stroke="#e9d3c2" strokeWidth="1.2" /><path d="M138 97q9 0 9 8t-9 7" fill="none" stroke="#fff" strokeWidth="3" /><ellipse cx="126" cy="93" rx="11" ry="3" fill="#6b3a1d" />
                <g className="loki-steam" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M120 86q-4-5 0-9t0-9" /><path d="M130 86q-4-5 0-9t0-9" /></g></g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
