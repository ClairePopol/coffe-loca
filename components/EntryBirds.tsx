import type { CSSProperties } from "react";

type Palette = { body: string; belly: string; wing: string };

/** A small round bird in profile (faces right). Sits on a branch or on a wire. */
function PerchBird({ body, belly, wing }: Palette) {
  return (
    <svg className="pb" viewBox="0 0 90 78" aria-hidden="true">
      <g className="pb-body">
        <polygon points="16,46 0,38 3,54" fill={wing} />
        <ellipse cx="42" cy="46" rx="26" ry="20" fill={body} />
        <ellipse cx="48" cy="53" rx="17" ry="11" fill={belly} />
        <g className="pb-head">
          <circle cx="62" cy="30" r="15" fill={body} />
          <path d="M55 17c-3-8 3-9 6-6-3 1-4 3-3 6z" fill={body} />
          <polygon points="75,28 87,32 75,36" fill="#ff9d2e" />
          <circle cx="67" cy="27" r="2.8" fill="#2b1a14" />
          <circle cx="68" cy="26" r="1" fill="#fff" />
          <circle cx="63" cy="36" r="3.2" fill="#ff8f8f" opacity=".55" />
        </g>
        <ellipse className="pb-wing" cx="37" cy="46" rx="15" ry="10" fill={wing} transform="rotate(-14 37 46)" />
      </g>
      <g stroke="#ff9d2e" strokeWidth="2.4" strokeLinecap="round"><line x1="40" y1="64" x2="40" y2="76" /><line x1="50" y1="64" x2="50" y2="76" /></g>
    </svg>
  );
}

function Flyer({ style }: { style: CSSProperties }) {
  return (
    <span className="flyer" style={style}>
      <svg viewBox="0 0 64 44" aria-hidden="true">
        <polygon points="18,24 2,18 4,30" fill="#fff" opacity=".9" />
        <ellipse cx="32" cy="25" rx="15" ry="8.5" fill="#fff" />
        <circle cx="48" cy="21" r="7.5" fill="#fff" />
        <polygon points="54,19 63,22 54,25" fill="#ffb02e" />
        <circle cx="50.5" cy="19.5" r="1.8" fill="#2b2b3a" />
        <path className="fl-wing" d="M26 23C20 2 40 0 44 10 38 12 34 18 34 23z" fill="#eaf4ff" />
      </svg>
    </span>
  );
}

function Owl() {
  return (
    <svg className="owl" viewBox="0 0 96 104" aria-hidden="true">
      <g className="ow-all">
        <ellipse cx="48" cy="66" rx="27" ry="29" fill="#8a6a4e" />
        <ellipse cx="48" cy="72" rx="16" ry="20" fill="#e6cfae" />
        <path d="M40 66q4 3 8 0M48 66q4 3 8 0M40 76q4 3 8 0M48 76q4 3 8 0" stroke="#b99770" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx="25" cy="68" rx="9" ry="20" fill="#765a41" transform="rotate(8 25 68)" />
        <ellipse cx="71" cy="68" rx="9" ry="20" fill="#765a41" transform="rotate(-8 71 68)" />
        <g className="ow-head">
          <ellipse cx="48" cy="36" rx="28" ry="23" fill="#8a6a4e" />
          <polygon points="23,24 27,6 40,17" fill="#8a6a4e" />
          <polygon points="73,24 69,6 56,17" fill="#8a6a4e" />
          <g className="ow-eye"><circle cx="36" cy="36" r="11" fill="#fff6dc" /><circle cx="36" cy="36" r="6.4" fill="#ffd34d" /><circle cx="36" cy="36" r="3.2" fill="#2a1a12" /><circle cx="37.6" cy="34.2" r="1.2" fill="#fff" /></g>
          <g className="ow-eye"><circle cx="60" cy="36" r="11" fill="#fff6dc" /><circle cx="60" cy="36" r="6.4" fill="#ffd34d" /><circle cx="60" cy="36" r="3.2" fill="#2a1a12" /><circle cx="61.6" cy="34.2" r="1.2" fill="#fff" /></g>
          <polygon points="48,40 43,49 53,49" fill="#ff9d2e" />
        </g>
        <g stroke="#ff9d2e" strokeWidth="2.6" strokeLinecap="round"><line x1="40" y1="92" x2="40" y2="99" /><line x1="56" y1="92" x2="56" y2="99" /></g>
      </g>
      <path d="M0 100Q48 95 96 101" stroke="#6b4429" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Cute birds that change with the time of day: a chirping chick (pagi), flyers (siang), birds on a wire (sore), a blinking owl (malam). */
export default function EntryBirds() {
  return (
    <>
      <div className="bird-spot bird-pagi">
        <PerchBird body="#ffd54a" belly="#fff2b8" wing="#f2a93b" />
        <span className="note n1">♪</span><span className="note n2">♫</span>
        <svg className="branch" viewBox="0 0 120 20" aria-hidden="true"><path d="M0 12Q60 4 120 14" stroke="#7a4a2a" strokeWidth="6" fill="none" strokeLinecap="round" /><ellipse cx="22" cy="8" rx="9" ry="5" fill="#7bc96f" transform="rotate(-25 22 8)" /><ellipse cx="96" cy="12" rx="9" ry="5" fill="#7bc96f" transform="rotate(20 96 12)" /></svg>
      </div>
      <div className="bird-spot bird-siang">
        <Flyer style={{ top: "12%", width: 64, animationDuration: "22s", animationDelay: "-4s" }} />
        <Flyer style={{ top: "22%", width: 46, animationDuration: "28s", animationDelay: "-17s" }} />
        <Flyer style={{ top: "8%", width: 38, animationDuration: "34s", animationDelay: "-26s" }} />
      </div>
      <div className="bird-spot bird-sore">
        <span className="wire" />
        <span className="perch p1"><PerchBird body="#3a2644" belly="#7a5a80" wing="#2a1a33" /></span>
        <span className="perch p2"><PerchBird body="#4a2a3e" belly="#8a5f78" wing="#341f2c" /></span>
      </div>
      <div className="bird-spot bird-malam"><Owl /></div>
    </>
  );
}
