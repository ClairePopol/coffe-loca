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
 * Loki, the Loca pin mascot (the logo pin: white outline + coffee bean, with plain eyes). One character all day long: same pin, a different outfit and action per time of day
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
        <svg className="loki-svg" viewBox="-12 -14 164 190">
          <ellipse cx="70" cy="167" rx="28" ry="5" fill="#000" opacity=".2" />
          <g className="loki-body">
            <g className="loki-legs" stroke="#fff" strokeWidth="6.5" strokeLinecap="round"><path d="M62 148v15" /><path d="M78 148v15" /></g>
            <g fill="#fff"><ellipse cx="58" cy="166" rx="9" ry="3.8" /><ellipse cx="82" cy="166" rx="9" ry="3.8" /></g>
            <path className="loki-arm-l" d="M19 84Q5 91 8 106" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
            <path d="M70 151C70 151 17 99 17 66 17 36 40 13 70 13s53 23 53 53c0 33-53 85-53 85z" fill="#d4232a" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
            <g transform="rotate(35 70 56)">
              <ellipse cx="70" cy="56" rx="27" ry="36" fill="#fff" />
              <path d="M70 22Q61 40 70 56Q79 72 70 90" fill="none" stroke="#d4232a" strokeWidth="3" strokeLinecap="round" opacity=".7" />
            </g>
            <g className="loki-eyes">
              <ellipse cx="56" cy="58" rx="4.6" ry="6" fill="#2a1a14" /><ellipse cx="84" cy="58" rx="4.6" ry="6" fill="#2a1a14" />
              <circle cx="57.4" cy="55.6" r="1.4" fill="#fff" /><circle cx="85.4" cy="55.6" r="1.4" fill="#fff" />
            </g>
            <g className="loki-lids" fill="#fff"><ellipse cx="56" cy="58" rx="6.4" ry="7.6" /><ellipse cx="84" cy="58" rx="6.4" ry="7.6" /></g>
            <g className="loki-sleepy" fill="none" stroke="#2a1a14" strokeWidth="2.4" strokeLinecap="round"><path d="M50 58Q56 63 62 58" /><path d="M78 58Q84 63 90 58" /></g>
            <g className="loki-glasses"><rect x="45" y="50" width="20" height="16" rx="6" fill="#1d1d2c" opacity=".94" /><rect x="73" y="50" width="20" height="16" rx="6" fill="#1d1d2c" opacity=".94" /><path d="M65 56H73" stroke="#1d1d2c" strokeWidth="3" /><path d="M49 55l6-1.5M77 55l6-1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".6" /></g>
            <g className="loki-scarf"><path d="M33 99Q70 123 107 99L100 114Q70 137 40 114Z" fill="#ff9a3d" /><path d="M88 125l11 25H83z" fill="#ff7a2b" /><path d="M50 115l-1 7M62 120l-1 7M76 121l1 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" /></g>
            <g className="loki-cap"><path d="M33 34Q40 -10 80 -10Q108 -9 124 24Q104 12 102 40Q70 26 35 42Z" fill="#3b4a9c" /><ellipse cx="68" cy="34" rx="38" ry="7" fill="#f4f6ff" /><circle cx="124" cy="25" r="8" fill="#f4f6ff" /></g>
            <g className="loki-arm">
              <path d="M121 84Q135 91 133 105" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" />
              <g className="loki-cup"><rect x="124" y="101" width="22" height="19" rx="5" fill="#fff" stroke="#e9d3c2" strokeWidth="1.2" /><path d="M146 105q8 0 8 7t-8 6" fill="none" stroke="#fff" strokeWidth="3" /><ellipse cx="135" cy="102" rx="10" ry="3" fill="#6b3a1d" />
                <g className="loki-steam" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M130 95q-4-5 0-9t0-9" /><path d="M140 95q-4-5 0-9t0-9" /></g></g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
