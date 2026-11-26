"use client";

import { useEffect, useRef, useState } from "react";
import type { DayPeriod } from "@/lib/dayPeriod";

/** A limb: red outline under a white stroke so it reads on the white card, the sky and the dark theme alike. */
function Limb({ d }: { d: string }) {
  return <><path d={d} fill="none" stroke="#d4232a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" /><path d={d} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></>;
}

/** Card-game style card faces (domain-coloured art windows) for the night fan of cards. */
const RIFT = ["#d4232a", "#2f9e5b", "#2b6fd6", "#8a3fc7"];

const SAYS: Record<DayPeriod, string> = {
  pagi: "Pagi! Ngopi dulu yuk ☕",
  siang: "Wih enak nih kerja sambil ngopi di Loca",
  sore: "Sore-sore main mahjong sambil ngopi di Loca",
  malam: "Begadang main Riftbound, kopinya jangan lupa ☕",
};

/**
 * Loki, the Loca pin mascot (the logo pin: white outline + coffee bean, no face). One character all day long: same pin, a different outfit and action per time of day
 * (morning coffee, noon laptop, evening mahjong, night card game). Accessories cross-fade and the bird
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
    // On first load wait for the drop-in entrance to land before talking.
    const delay = first.current ? 2300 : 0;
    first.current = false;
    let hide = 0;
    const show = window.setTimeout(() => {
      setTalking(true);
      hide = window.setTimeout(() => setTalking(false), 4200);
    }, delay);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [period]);

  return (
    <div className="loki" data-mood={period} aria-hidden="true">
      <div className={`loki-bubble${talking ? " is-show" : ""}`}>
        {(Object.keys(SAYS) as DayPeriod[]).map((key) => <span key={key} className={key === period ? "is-on" : ""}>{SAYS[key]}</span>)}
      </div>
      <div className="loki-hop" ref={ref}>
        <span className="loki-note">♪</span>
        <span className="loki-zzz z1">z</span><span className="loki-zzz z2">Z</span>
        <svg className="loki-svg" viewBox="-14 -14 168 208">
          <defs><linearGradient id="loki-bf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3a2f8f" /><stop offset=".55" stopColor="#2b6fd6" /><stop offset="1" stopColor="#d9b45a" /></linearGradient></defs>
          <g className="loki-squat-legs">
            <Limb d="M60 156L42 162L48 172" /><Limb d="M80 156L98 162L92 172" />
            <g fill="#fff" stroke="#d4232a" strokeWidth="2.4"><ellipse cx="46" cy="176" rx="10" ry="5" /><ellipse cx="94" cy="176" rx="10" ry="5" /></g>
          </g>
          <g className="loki-body">
            <g className="loki-squat">
            <g className="loki-stand-legs">
            <g className="loki-leg loki-leg-l"><Limb d="M60 142L59 171" /><ellipse cx="55" cy="176" rx="10" ry="5" fill="#fff" stroke="#d4232a" strokeWidth="2.4" /></g>
            <g className="loki-leg loki-leg-r"><Limb d="M80 142L81 171" /><ellipse cx="85" cy="176" rx="10" ry="5" fill="#fff" stroke="#d4232a" strokeWidth="2.4" /></g>
            </g>
            <path d="M70 151C70 151 17 99 17 66 17 36 40 13 70 13s53 23 53 53c0 33-53 85-53 85z" fill="#d4232a" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
            <g transform="rotate(35 70 56)">
              <ellipse cx="70" cy="56" rx="27" ry="36" fill="#fff" />
              <path d="M70 22Q61 40 70 56Q79 72 70 90" fill="none" stroke="#d4232a" strokeWidth="3" strokeLinecap="round" opacity=".7" />
            </g>
            <g className="loki-scarf"><path d="M33 99Q70 123 107 99L100 114Q70 137 40 114Z" fill="#ff9a3d" /><path d="M88 125l11 25H83z" fill="#ff7a2b" /><path d="M50 115l-1 7M62 120l-1 7M76 121l1 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" /></g>
            <g className="loki-cap"><path d="M33 34Q40 -10 80 -10Q108 -9 124 24Q104 12 102 40Q70 26 35 42Z" fill="#3b4a9c" /><ellipse cx="68" cy="34" rx="38" ry="7" fill="#f4f6ff" /><circle cx="124" cy="25" r="8" fill="#f4f6ff" /></g>
            <g className="loki-arm loki-arm-l"><Limb d="M19 84L6 102" />
              <g className="loki-fore loki-fore-l"><Limb d="M6 102L9 124" />
                <g className="loki-ice"><g className="loki-icefix">
                  <path d="M11 116L13 104Q14 100 18 98L23 96" fill="none" stroke="#d4232a" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M0 113H18L16 137H2Z" fill="#eaf6ff" stroke="#d4232a" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M.8 122H17.2L16 137H2Z" fill="#9b6a43" />
                  <rect x="3" y="115.5" width="5" height="5" rx="1" fill="#fff" opacity=".9" /><rect x="9.5" y="117" width="5" height="5" rx="1" fill="#fff" opacity=".9" />
                  <rect x="-1" y="111" width="20" height="3" rx="1.5" fill="#fff" stroke="#d4232a" strokeWidth="1.2" />
                </g></g>
                <g className="loki-fan"><g className="loki-fanfix">
                  {RIFT.map((c, i) => (
                    <g key={i} className={i === 2 ? "loki-fan-pick" : undefined}><g transform={`rotate(${[-36, -12, 12, 36][i]} 9 132) translate(9 132) scale(1.3) translate(-9 -132)`}>
                      <rect x="2.5" y="106" width="13" height="19" rx="1.8" fill="#14121c" stroke="#d9b45a" strokeWidth=".9" />
                      <rect x="4" y="108.6" width="10" height="8.4" rx=".8" fill={c} />
                      <path d="M4 114.6l3-3 2.4 2.2 1.6-1.4 3 2.6V117H4z" fill="#000" opacity=".28" />
                      <rect x="4" y="118" width="10" height="5.4" rx=".6" fill="#efe6d2" />
                      <circle cx="4.6" cy="107.6" r="2" fill="#d9b45a" stroke="#14121c" strokeWidth=".5" />
                    </g></g>
                  ))}
                </g></g>
                <circle cx="9" cy="125" r="4.6" fill="#fff" stroke="#d4232a" strokeWidth="2" />
              </g>
            </g>
            <g className="loki-arm loki-arm-r"><Limb d="M121 84L134 102" />
              <g className="loki-fore loki-fore-r"><Limb d="M134 102L131 124" />
                <g className="loki-cup"><g className="loki-cupfix">
                  <path d="M126 119.5q8 0 8 6t-8 6" fill="none" stroke="#d4232a" strokeWidth="5.6" /><path d="M126 119.5q8 0 8 6t-8 6" fill="none" stroke="#fff" strokeWidth="3" />
                  <rect x="107" y="115" width="20" height="20" rx="4.5" fill="#fff" stroke="#d4232a" strokeWidth="1.6" />
                  <ellipse cx="117" cy="116.6" rx="8.4" ry="2.5" fill="#6b3a1d" />
                  <g className="loki-steam" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M113 109q-4-5 0-9t0-9" /><path d="M122 109q-4-5 0-9t0-9" /></g>
                </g></g>
                <g className="loki-tile"><g className="loki-tilefix"><rect x="125.5" y="122" width="11" height="14" rx="2" fill="#fffaf0" stroke="#1f6b4f" strokeWidth="1.3" /><rect x="125.5" y="133" width="11" height="3" rx="1" fill="#1f8a70" /><text x="131" y="131.5" fontSize="8" fontWeight="800" textAnchor="middle" fill="#d4232a">中</text></g></g>
                <circle cx="131" cy="125" r="4.6" fill="#fff" stroke="#d4232a" strokeWidth="2" />
              </g>
            </g>
            </g>
          </g>
          <g className="loki-mj">
            <path d="M30 128H112L122 140H20Z" fill="#2f8f5b" stroke="#1d6440" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="20" y="140" width="102" height="36" rx="2" fill="#8a5a32" /><path d="M20 146H122" stroke="#6b4426" strokeWidth="2" />
            <g>{[34, 43, 52, 61, 70, 79].map((x) => <g key={x}><rect x={x} y="117" width="8" height="11" rx="1.5" fill="#1f8a70" stroke="#145c4a" strokeWidth=".8" /><rect x={x} y="117" width="8" height="3" rx="1" fill="#fffaf0" /></g>)}</g>
            <g fill="#fffaf0" stroke="#1d6440" strokeWidth=".6"><rect x="40" y="131" width="9" height="5" rx="1" /><rect x="52" y="133" width="9" height="5" rx="1" /><rect x="64" y="131" width="9" height="5" rx="1" /></g>
            <g fill="#d4232a"><circle cx="44.5" cy="133.5" r="1.2" /><circle cx="68.5" cy="133.5" r="1.2" /></g><circle cx="56.5" cy="135.5" r="1.2" fill="#1f5fae" />
            <g className="loki-slam" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M88 128l-5-4M100 124v-6M112 128l5-4" /></g>
          </g>
          <g className="loki-cardtable">
            <path d="M30 128H112L122 140H20Z" fill="#6b4630" stroke="#3b2618" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="20" y="140" width="102" height="36" rx="2" fill="#3b2618" /><path d="M20 146H122" stroke="#2a1a10" strokeWidth="2" />
            <rect x="48" y="129.6" width="26" height="8.6" rx="1.2" fill="#14121c" stroke="#d9b45a" strokeWidth=".8" />
            <rect x="49.6" y="131" width="22.8" height="5.8" rx=".6" fill="url(#loki-bf)" />
            <g transform="rotate(-8 36 134)"><rect x="31" y="129" width="9" height="11" rx="1.2" fill="#14121c" stroke="#d9b45a" strokeWidth=".7" /><rect x="32.2" y="130.4" width="6.6" height="4.6" rx=".5" fill="#d4232a" /><rect x="32.2" y="135.8" width="6.6" height="3" rx=".4" fill="#efe6d2" /></g>
            <g transform="rotate(7 85 134)"><rect x="80" y="129" width="9" height="11" rx="1.2" fill="#14121c" stroke="#d9b45a" strokeWidth=".7" /><rect x="81.2" y="130.4" width="6.6" height="4.6" rx=".5" fill="#2b6fd6" /><rect x="81.2" y="135.8" width="6.6" height="3" rx=".4" fill="#efe6d2" /></g>
            <g stroke="#14121c" strokeWidth=".5"><circle cx="25" cy="136.5" r="2.4" fill="#e0622a" /><circle cx="97" cy="134" r="2.2" fill="#2f9e5b" /><circle cx="101" cy="137.5" r="2.2" fill="#8a3fc7" /></g>
          </g>
          <g className="loki-laptop">
            <rect x="38" y="126" width="64" height="44" rx="5" fill="#d9dde5" stroke="#8a909c" strokeWidth="2" />
            <path d="M70 140c-4 0-7 3-7 6.6 0 4.6 7 11.4 7 11.4s7-6.8 7-11.4c0-3.6-3-6.6-7-6.6z" fill="#d4232a" />
            <circle cx="70" cy="146.6" r="2.4" fill="#fff" />
            <path d="M28 169H112L106 177H34Z" fill="#6b707c" />
          </g>
        </svg>
      </div>
    </div>
  );
}
