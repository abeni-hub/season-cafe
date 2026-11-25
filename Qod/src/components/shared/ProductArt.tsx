import { cn } from '@/utils/cn';

const palettes = [
  { bg: '#f3e6d2', base: '#e9d4b4', cream: '#fbf3e3', accent: '#c98d54' },
  { bg: '#ede0d2', base: '#d9bfa9', cream: '#f7ecdd', accent: '#5b3a27' },
  { bg: '#e9ddcd', base: '#d8c4ac', cream: '#f6ead9', accent: '#775338' },
  { bg: '#f0e8d8', base: '#e3d3b6', cream: '#fbf4e6', accent: '#b98a52' },
  { bg: '#f6ecd8', base: '#ecd9b9', cream: '#fff8e9', accent: '#c49657' },
  { bg: '#f0e0d6', base: '#e6c9b8', cream: '#fbf0e7', accent: '#b4432f' },
  { bg: '#e8ddd1', base: '#d7bda8', cream: '#f7ecdf', accent: '#4c3325' },
];

function Filling({ index, accent, cream }: { index: number; accent: string; cream: string }) {
  switch (index) {
    case 0:
      return (
        <g>
          <circle cx="100" cy="98" r="40" fill={cream} />
          <path d="M68 96c4-18 20-30 38-30 12 0 22 4 30 12" fill="none" stroke={accent} strokeWidth="2" opacity="0.55" />
          <path d="M72 106c6-16 20-26 36-26 9 0 17 3 24 9" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.4" />
          <circle cx="100" cy="98" r="7" fill={accent} opacity="0.5" />
        </g>
      );
    case 1:
      return (
        <g>
          <circle cx="100" cy="98" r="40" fill={accent} />
          <path d="M70 90c10-14 26-20 42-16" fill="none" stroke={cream} strokeWidth="2.4" opacity="0.35" />
          <circle cx="112" cy="82" r="4" fill={cream} opacity="0.5" />
        </g>
      );
    case 2:
      return (
        <g>
          <circle cx="100" cy="98" r="40" fill="#7c5a3c" />
          <path d="M62 94h76" stroke={cream} strokeWidth="7" opacity="0.18" />
          <circle cx="100" cy="98" r="26" fill="#8f6a48" />
          <ellipse cx="93" cy="94" rx="7" ry="10" fill="#5a3c26" transform="rotate(-24 93 94)" />
          <ellipse cx="108" cy="104" rx="7" ry="10" fill="#5a3c26" transform="rotate(-24 108 104)" />
        </g>
      );
    case 3:
      return (
        <g>
          {[0, 1, 2].map((layer) => (
            <rect
              key={layer}
              x={66 + layer * 2}
              y={78 + layer * 18}
              width={68 - layer * 4}
              height="11"
              rx="5"
              fill={layer % 2 === 0 ? '#f0d9b2' : cream}
              stroke={accent}
              strokeWidth="1"
              opacity="0.95"
            />
          ))}
          <path d="M86 76c4-10 24-10 28 0" fill="none" stroke={accent} strokeWidth="1.6" />
        </g>
      );
    case 4:
      return (
        <g>
          <circle cx="82" cy="102" r="21" fill="#e8c98e" />
          <circle cx="114" cy="90" r="23" fill="#ebd09a" />
          <circle cx="106" cy="118" r="18" fill="#e3c084" />
          <circle cx="80" cy="96" r="3" fill={cream} opacity="0.9" />
          <circle cx="112" cy="86" r="3" fill={cream} opacity="0.9" />
          <circle cx="104" cy="114" r="2.5" fill={cream} opacity="0.9" />
        </g>
      );
    case 5:
      return (
        <g>
          <circle cx="100" cy="98" r="40" fill={cream} />
          {[
            [86, 90, 10],
            [108, 86, 12],
            [98, 108, 11],
            [116, 106, 8],
            [82, 110, 7],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 === 0 ? '#b4432f' : '#c95741'} />
          ))}
          <path d="M100 76c-6-8-16-8-20-2 6 5 13 6 20 2Z" fill="#5f7d4a" />
          <path d="M100 76c6-8 16-8 20-2-6 5-13 6-20 2Z" fill="#728f58" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="100" cy="98" r="40" fill="#4a3022" />
          <path d="M75 88c12-8 30-8 44 2" fill="none" stroke={cream} strokeWidth="2" opacity="0.5" />
          <path d="M78 104c10 6 26 6 38-2" fill="none" stroke={cream} strokeWidth="1.4" opacity="0.35" />
          <path d="M95 70l10 12M108 72l-8 12" stroke={cream} strokeWidth="1.6" opacity="0.35" />
        </g>
      );
  }
}

export function ProductArt({ artIndex, className }: { artIndex: number; className?: string }) {
  const palette = palettes[artIndex % palettes.length];
  return (
    <div className={cn('relative overflow-hidden', className)} style={{ backgroundColor: palette.bg }}>
      <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Illustrated bakery artwork">
        <path
          d="M150 24c18 2 30 14 34 30-16 4-32-2-40-14"
          fill="#5f7d4a"
          opacity="0.35"
        />
        <path d="M154 40c14-2 24-10 28-22" stroke="#3f5c35" strokeWidth="1.5" opacity="0.35" fill="none" />
        <path
          d="M24 150c-6 14-2 28 10 36 8-12 6-26-4-36Z"
          fill="#b0552f"
          opacity="0.22"
        />
        <circle cx="100" cy="100" r="64" fill={palette.base} opacity="0.75" />
        <circle cx="100" cy="100" r="58" fill="#fbf6ea" />
        <circle cx="100" cy="100" r="49" fill={palette.accent} opacity="0.16" />
        <circle cx="100" cy="98" r="43" fill={palette.base} />
        <Filling index={artIndex % palettes.length} accent={palette.accent} cream={palette.cream} />
        <path
          d="M100 44c2-10 8-18 18-22"
          stroke="#3f5c35"
          strokeWidth="1.4"
          fill="none"
          opacity="0.4"
        />
        <ellipse cx="104" cy="44" rx="7" ry="3.4" fill="#5f7d4a" opacity="0.55" transform="rotate(-24 104 44)" />
        <circle cx="100" cy="150" r="3" fill={palette.accent} opacity="0.4" />
      </svg>
    </div>
  );
}

export function BotanicalSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" fill="none" className={className} aria-hidden="true">
      <path d="M60 154V26" stroke="#3f5c35" strokeWidth="1.4" opacity="0.55" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <path
            d={`M60 ${124 - i * 26}c-22-2-34-12-38-26 20-2 34 8 38 26Z`}
            fill={i % 2 === 0 ? '#5f7d4a' : '#8aa077'}
            opacity={0.8 - i * 0.1}
          />
          <path
            d={`M60 ${112 - i * 26}c22-2 34-12 38-26-20-2-34 8-38 26Z`}
            fill={i % 2 === 0 ? '#b0552f' : '#c97a4e'}
            opacity={0.55 - i * 0.08}
          />
        </g>
      ))}
      <ellipse cx="60" cy="20" rx="10" ry="18" fill="#5f7d4a" opacity="0.5" />
    </svg>
  );
}
