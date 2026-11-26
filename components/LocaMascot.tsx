"use client";

import { useEffect, useRef, useState } from "react";
import type { DayPeriod } from "@/lib/dayPeriod";

/** A limb: red outline under a white stroke so it reads on the white card, the sky and the dark theme alike. */
function Limb({ d }: { d: string }) {
  return <><path d={d} fill="none" stroke="#d4232a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" /><path d={d} fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></>;
}

const SAYS: Record<DayPeriod, string> = {
  pagi: "Pagi! Ngopi dulu yuk ☕",
  siang: "Wih enak nih kerja sambil ngopi di Loca",
  sore: "Sore-sore genjreng dulu di Loca ♪",
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
            <g className="loki-eyes">
              <ellipse cx="56" cy="58" rx="4.6" ry="6" fill="#2a1a14" /><ellipse cx="84" cy="58" rx="4.6" ry="6" fill="#2a1a14" />
              <circle cx="57.4" cy="55.6" r="1.4" fill="#fff" /><circle cx="85.4" cy="55.6" r="1.4" fill="#fff" />
            </g>
            <g className="loki-lids" fill="#fff"><ellipse cx="56" cy="58" rx="6.4" ry="7.6" /><ellipse cx="84" cy="58" rx="6.4" ry="7.6" /></g>
            <path className="loki-smile" d="M66 79Q72 84 78 79" fill="none" stroke="#2a1a14" strokeWidth="2.2" strokeLinecap="round" />
            <ellipse className="loki-mouth-o" cx="72" cy="81" rx="3.6" ry="4.2" fill="#4a1414" />
            <g className="loki-blink" fill="#fff"><g><ellipse cx="56" cy="58" rx="6.6" ry="7.8" /><path d="M49.6 58Q56 64.5 62.4 58" fill="none" stroke="#2a1a14" strokeWidth="2.2" strokeLinecap="round" /></g><g><ellipse cx="84" cy="58" rx="6.6" ry="7.8" /><path d="M77.6 58Q84 64.5 90.4 58" fill="none" stroke="#2a1a14" strokeWidth="2.2" strokeLinecap="round" /></g></g>
            <g className="loki-sleepy" fill="none" stroke="#2a1a14" strokeWidth="2.4" strokeLinecap="round"><path d="M50 58Q56 63 62 58" /><path d="M78 58Q84 63 90 58" /></g>
            <g className="loki-glasses"><rect x="45" y="50" width="20" height="16" rx="6" fill="#1d1d2c" opacity=".94" /><rect x="75" y="50" width="20" height="16" rx="6" fill="#1d1d2c" opacity=".94" /><path d="M65 56H75" stroke="#1d1d2c" strokeWidth="3" /><path d="M49 55l6-1.5M79 55l6-1.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".6" /></g>
            <g className="loki-scarf"><path d="M33 99Q70 123 107 99L100 114Q70 137 40 114Z" fill="#ff9a3d" /><path d="M88 125l11 25H83z" fill="#ff7a2b" /><path d="M50 115l-1 7M62 120l-1 7M76 121l1 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" /></g>
            <g className="loki-cap"><path d="M33 34Q40 -10 80 -10Q108 -9 124 24Q104 12 102 40Q70 26 35 42Z" fill="#3b4a9c" /><ellipse cx="68" cy="34" rx="38" ry="7" fill="#f4f6ff" /><circle cx="124" cy="25" r="8" fill="#f4f6ff" /></g>
            <g className="loki-guitar">
              <path d="M80 110L20 91" stroke="#7a4a2a" strokeWidth="7" strokeLinecap="round" />
              <g stroke="#e8d2a8" strokeWidth="1.2" opacity=".8"><path d="M66 105.6l1.4-4.4M54 101.8l1.4-4.4M42 98l1.4-4.4M31 94.5l1.4-4.4" /></g>
              <rect x="5" y="84" width="16" height="10" rx="3" fill="#5a3420" transform="rotate(17.6 13 89)" />
              <circle cx="98" cy="126" r="19" fill="#d98a3d" stroke="#8a4f22" strokeWidth="2.2" />
              <circle cx="83" cy="114" r="14" fill="#d98a3d" stroke="#8a4f22" strokeWidth="2.2" />
              <circle cx="84" cy="115" r="12.4" fill="#d98a3d" />
              <circle cx="89" cy="119" r="6.2" fill="#3a2214" />
              <rect x="99" y="128" width="13" height="4" rx="1.6" fill="#5a3420" transform="rotate(17.6 105.5 130)" />
              <g stroke="#fff6e6" strokeWidth=".75" opacity=".9"><path d="M106 129L21 89.6" /><path d="M105.6 130.6L21 91" /><path d="M106.4 127.4L21 88.2" /></g>
            </g>
            <g className="loki-arm loki-arm-l"><Limb d="M19 84L6 102" />
              <g className="loki-fore loki-fore-l"><Limb d="M6 102L9 124" />
                <g className="loki-ice"><g className="loki-icefix">
                  <path d="M11 116L13 104Q14 100 18 98L23 96" fill="none" stroke="#d4232a" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M0 113H18L16 137H2Z" fill="#eaf6ff" stroke="#d4232a" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M.8 122H17.2L16 137H2Z" fill="#9b6a43" />
                  <rect x="3" y="115.5" width="5" height="5" rx="1" fill="#fff" opacity=".9" /><rect x="9.5" y="117" width="5" height="5" rx="1" fill="#fff" opacity=".9" />
                  <rect x="-1" y="111" width="20" height="3" rx="1.5" fill="#fff" stroke="#d4232a" strokeWidth="1.2" />
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
                <circle cx="131" cy="125" r="4.6" fill="#fff" stroke="#d4232a" strokeWidth="2" />
              </g>
            </g>
            </g>
          </g>
          <g className="loki-amp">
            <rect x="-17" y="126" width="26" height="50" rx="3" fill="#2b2b33" stroke="#15151a" strokeWidth="1.6" />
            <circle cx="-4" cy="154" r="9" fill="#44444f" stroke="#15151a" strokeWidth="1.4" /><circle cx="-4" cy="154" r="3" fill="#2b2b33" />
            <rect x="-14" y="130" width="20" height="5" rx="1" fill="#d4232a" /><g fill="#c9c9d1"><circle cx="-11" cy="139" r="1.3" /><circle cx="-6" cy="139" r="1.3" /><circle cx="-1" cy="139" r="1.3" /></g>
            <g className="loki-amp-cup" transform="translate(-13 -11)">
              <path d="M11 116L13 104Q14 100 18 98L23 96" fill="none" stroke="#d4232a" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M0 113H18L16 137H2Z" fill="#eaf6ff" stroke="#d4232a" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M.8 122H17.2L16 137H2Z" fill="#9b6a43" />
              <rect x="3" y="115.5" width="5" height="5" rx="1" fill="#fff" opacity=".9" /><rect x="9.5" y="117" width="5" height="5" rx="1" fill="#fff" opacity=".9" />
              <rect x="-1" y="111" width="20" height="3" rx="1.5" fill="#fff" stroke="#d4232a" strokeWidth="1.2" />
            </g>
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
