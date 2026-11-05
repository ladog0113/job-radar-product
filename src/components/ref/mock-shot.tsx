import { hashOf } from "@/lib/disguise";

/** 공고와 무관한 UI 화면 목업 썸네일. seed가 같으면 같은 그림 */

const PALETTES = [
  { bg: "#EEF2FF", accent: "#6366F1", soft: "#C7D2FE" },
  { bg: "#ECFDF5", accent: "#10B981", soft: "#A7F3D0" },
  { bg: "#FFF7ED", accent: "#F97316", soft: "#FED7AA" },
  { bg: "#FDF2F8", accent: "#EC4899", soft: "#FBCFE8" },
  { bg: "#F0F9FF", accent: "#0EA5E9", soft: "#BAE6FD" },
  { bg: "#FEFCE8", accent: "#CA8A04", soft: "#FEF08A" },
  { bg: "#F5F3FF", accent: "#8B5CF6", soft: "#DDD6FE" },
  { bg: "#111827", accent: "#22D3EE", soft: "#374151" },
  { bg: "#F1F5F9", accent: "#0F172A", soft: "#CBD5E1" },
  { bg: "#FEF2F2", accent: "#EF4444", soft: "#FECACA" },
];

function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

type P = (typeof PALETTES)[number] & { r: () => number; card: string; line: string };

function Dashboard({ p }: { p: P }) {
  const bars = Array.from({ length: 9 }, () => 20 + p.r() * 60);
  return (
    <>
      <rect x="16" y="16" width="64" height="268" rx="10" fill={p.card} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="28" y={40 + i * 26} width={i === 1 ? 40 : 30} height="8" rx="4" fill={i === 1 ? p.accent : p.line} />
      ))}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={92 + i * 100} y="16" width="92" height="58" rx="10" fill={p.card} />
          <rect x={104 + i * 100} y="30" width="34" height="6" rx="3" fill={p.line} />
          <rect x={104 + i * 100} y="46" width={40 + p.r() * 30} height="12" rx="4" fill={i === 0 ? p.accent : p.soft} />
        </g>
      ))}
      <rect x="92" y="86" width="292" height="198" rx="10" fill={p.card} />
      {bars.map((h, i) => (
        <rect key={i} x={110 + i * 30} y={262 - h * 2} width="16" height={h * 2} rx="4" fill={i % 3 === 0 ? p.accent : p.soft} />
      ))}
    </>
  );
}

function Mobile({ p }: { p: P }) {
  return (
    <>
      {[0, 1].map((k) => {
        const x = 70 + k * 150;
        return (
          <g key={k}>
            <rect x={x} y="20" width="112" height="264" rx="18" fill={p.card} />
            <rect x={x + 38} y="30" width="36" height="6" rx="3" fill={p.line} />
            <rect x={x + 12} y="48" width="88" height={k ? 90 : 60} rx="10" fill={k ? p.accent : p.soft} />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <circle cx={x + 22} cy={(k ? 160 : 132) + i * 30} r="9" fill={p.soft} />
                <rect x={x + 38} y={(k ? 154 : 126) + i * 30} width={40 + p.r() * 20} height="6" rx="3" fill={p.line} />
                <rect x={x + 38} y={(k ? 164 : 136) + i * 30} width="30" height="4" rx="2" fill={p.soft} />
              </g>
            ))}
            <rect x={x + 12} y="262" width="88" height="12" rx="6" fill={p.accent} />
          </g>
        );
      })}
    </>
  );
}

function Landing({ p }: { p: P }) {
  return (
    <>
      <rect x="16" y="16" width="368" height="268" rx="12" fill={p.card} />
      <rect x="32" y="30" width="40" height="8" rx="4" fill={p.accent} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={250 + i * 40} y="31" width="28" height="6" rx="3" fill={p.line} />
      ))}
      <rect x="32" y="70" width="180" height="16" rx="5" fill={p.line} />
      <rect x="32" y="94" width="140" height="16" rx="5" fill={p.line} />
      <rect x="32" y="122" width="160" height="6" rx="3" fill={p.soft} />
      <rect x="32" y="134" width="120" height="6" rx="3" fill={p.soft} />
      <rect x="32" y="154" width="70" height="20" rx="10" fill={p.accent} />
      <rect x="226" y="62" width="142" height="120" rx="12" fill={p.soft} />
      <circle cx="297" cy="122" r="30" fill={p.accent} opacity="0.7" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={32 + i * 116} y="200" width="104" height="68" rx="10" fill={p.bg} />
          <rect x={44 + i * 116} y="212" width="20" height="20" rx="6" fill={p.soft} />
          <rect x={44 + i * 116} y="242" width="64" height="6" rx="3" fill={p.line} />
          <rect x={44 + i * 116} y="254" width="44" height="4" rx="2" fill={p.soft} />
        </g>
      ))}
    </>
  );
}

function Kanban({ p }: { p: P }) {
  return (
    <>
      {[0, 1, 2, 3].map((c) => {
        const n = 2 + Math.floor(p.r() * 3);
        return (
          <g key={c}>
            <rect x={16 + c * 92} y="16" width="84" height="268" rx="10" fill={p.card} />
            <rect x={26 + c * 92} y="28" width="40" height="7" rx="3" fill={c === 1 ? p.accent : p.line} />
            {Array.from({ length: n }, (_, i) => (
              <g key={i}>
                <rect x={24 + c * 92} y={48 + i * 56} width="68" height="48" rx="8" fill={p.bg} />
                <rect x={32 + c * 92} y={58 + i * 56} width={30 + p.r() * 24} height="5" rx="2.5" fill={p.line} />
                <rect x={32 + c * 92} y={70 + i * 56} width="24" height="10" rx="5" fill={p.soft} />
              </g>
            ))}
          </g>
        );
      })}
    </>
  );
}

function TableView({ p }: { p: P }) {
  return (
    <>
      <rect x="16" y="16" width="368" height="268" rx="12" fill={p.card} />
      <rect x="32" y="32" width="120" height="18" rx="9" fill={p.bg} />
      <rect x="300" y="32" width="68" height="18" rx="9" fill={p.accent} />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={i}>
          <rect x="32" y={68 + i * 26} width="336" height="1" fill={p.bg} />
          <circle cx="44" cy={81 + i * 26} r="6" fill={i === 0 ? p.line : p.soft} />
          <rect x="58" y={78 + i * 26} width={60 + p.r() * 50} height="6" rx="3" fill={p.line} />
          <rect x="200" y={78 + i * 26} width="50" height="6" rx="3" fill={p.soft} />
          <rect x="300" y={75 + i * 26} width="40" height="12" rx="6" fill={i % 3 === 0 ? p.accent : p.soft} />
        </g>
      ))}
    </>
  );
}

function Chat({ p }: { p: P }) {
  return (
    <>
      <rect x="16" y="16" width="110" height="268" rx="10" fill={p.card} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <circle cx="36" cy={42 + i * 36} r="10" fill={i === 1 ? p.accent : p.soft} />
          <rect x="54" y={36 + i * 36} width="56" height="6" rx="3" fill={p.line} />
          <rect x="54" y={46 + i * 36} width="36" height="4" rx="2" fill={p.soft} />
        </g>
      ))}
      <rect x="138" y="16" width="246" height="268" rx="10" fill={p.card} />
      {[0, 1, 2, 3].map((i) => {
        const mine = i % 2 === 1;
        const w = 70 + p.r() * 80;
        return <rect key={i} x={mine ? 370 - w : 152} y={34 + i * 48} width={w} height="32" rx="12" fill={mine ? p.accent : p.bg} />;
      })}
      <rect x="152" y="244" width="218" height="26" rx="13" fill={p.bg} />
    </>
  );
}

const LAYOUTS = [Dashboard, Mobile, Landing, Kanban, TableView, Chat];

export function MockShot({ seed, className = "" }: { seed: string; className?: string }) {
  const h = hashOf(seed);
  const pal = PALETTES[h % PALETTES.length];
  const dark = pal.bg === "#111827";
  const p: P = { ...pal, r: rng(h), card: dark ? "#1F2937" : "#FFFFFF", line: dark ? "#4B5563" : "#E2E8F0" };
  const Layout = LAYOUTS[Math.floor(h / PALETTES.length) % LAYOUTS.length];
  return (
    <svg viewBox="0 0 400 300" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="300" fill={p.bg} />
      <Layout p={p} />
    </svg>
  );
}
