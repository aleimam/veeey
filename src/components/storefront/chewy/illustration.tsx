// Veeey × Chewy flat illustration set — friendly category/goal glyphs in the
// brand palette (deep green + lime + gold). Ported from the design-system kit.
const GREEN = '#38764D';
const EMER = '#235C3C';
const LIME = '#D1D725';
const GOLD = '#FFC000';

export function Illo({ name, size = 96 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 96 96', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' } as const;
  switch (name) {
    case 'bottle':
      return (
        <svg {...common}>
          <rect x="30" y="28" width="36" height="46" rx="9" fill={GREEN} />
          <rect x="34" y="20" width="28" height="12" rx="4" fill={EMER} />
          <rect x="34.5" y="42" width="27" height="26" rx="5" fill="#fff" />
          <path d="M48 46v18M40 55h16" stroke={LIME} strokeWidth="3.4" strokeLinecap="round" />
          <ellipse cx="38" cy="35" rx="3" ry="3" fill={LIME} />
        </svg>
      );
    case 'tub':
      return (
        <svg {...common}>
          <rect x="28" y="34" width="40" height="40" rx="8" fill={GREEN} />
          <rect x="25" y="26" width="46" height="12" rx="6" fill={EMER} />
          <rect x="33" y="46" width="30" height="22" rx="4" fill="#fff" />
          <path d="M40 64c0-6 3-10 8-10s8 4 8 10" stroke={LIME} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="48" cy="52" r="3.2" fill={GOLD} />
        </svg>
      );
    case 'softgel':
      return (
        <svg {...common}>
          <rect x="40" y="22" width="16" height="52" rx="8" fill={GREEN} />
          <rect x="43" y="40" width="10" height="20" rx="5" fill={LIME} opacity="0.9" />
          <ellipse cx="48" cy="30" rx="4" ry="5" fill="#fff" opacity="0.85" />
          <path d="M30 34c-4 0-6 3-6 6s2 5 6 5" stroke={EMER} strokeWidth="3" strokeLinecap="round" />
          <path d="M66 52c4 0 6 3 6 6s-2 5-6 5" stroke={EMER} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'dropper':
      return (
        <svg {...common}>
          <rect x="34" y="40" width="28" height="34" rx="8" fill={GREEN} />
          <rect x="42" y="22" width="12" height="22" rx="5" fill={EMER} />
          <rect x="44.5" y="14" width="7" height="12" rx="3.5" fill={LIME} />
          <rect x="39" y="50" width="18" height="18" rx="4" fill="#fff" />
          <path d="M48 54c4 4 4 7 0 10-4-3-4-6 0-10z" fill={LIME} />
        </svg>
      );
    case 'device':
      return (
        <svg {...common}>
          <rect x="24" y="30" width="48" height="36" rx="8" fill={GREEN} />
          <rect x="31" y="37" width="34" height="22" rx="4" fill="#fff" />
          <path d="M36 48h6l3-6 4 12 3-6h8" stroke={LIME} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="40" y="68" width="16" height="6" rx="3" fill={EMER} />
        </svg>
      );
    case 'tag':
      return (
        <svg {...common}>
          <path d="M30 24h20l24 24a6 6 0 0 1 0 8.5L56 74a6 6 0 0 1-8.5 0L24 50V30a6 6 0 0 1 6-6z" fill={GOLD} />
          <circle cx="40" cy="40" r="5" fill="#fff" />
          <path d="M44 62l14-14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M48 22l20 8v14c0 14-9 24-20 30-11-6-20-16-20-30V30l20-8z" fill={GREEN} />
          <path d="M40 48l6 6 12-13" stroke={LIME} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'shield-plus':
      return (
        <svg {...common}>
          <path d="M48 22l20 8v14c0 14-9 24-20 30-11-6-20-16-20-30V30l20-8z" fill={GREEN} />
          <path d="M48 38v18M39 47h18" stroke={LIME} strokeWidth="4.2" strokeLinecap="round" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M54 8 22 52h18l-6 36 34-50H50l4-30z" fill={LIME} stroke={GREEN} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M66 12a30 30 0 1 0 18 46A24 24 0 0 1 66 12z" fill={EMER} />
          <circle cx="40" cy="28" r="3" fill={LIME} />
          <circle cx="30" cy="46" r="2.4" fill={LIME} />
          <circle cx="44" cy="54" r="2" fill={GOLD} />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common}>
          <path d="M48 82C22 65 10 50 10 32a18 18 0 0 1 38-6 18 18 0 0 1 38 6c0 18-12 33-38 50z" fill={GREEN} />
          <path d="M26 44h13l4-10 8 20 4-10h15" stroke={LIME} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M48 30c20 0 34 14 34 30s-14 26-34 26-34-10-34-26 14-30 34-30z" fill={GREEN} />
          <path d="M48 46c10 0 16 6 16 13s-6 12-13 12-11-5-11-10 4-8 8-8 6 2 6 5" fill="none" stroke={LIME} strokeWidth="4.6" strokeLinecap="round" />
          <path d="M48 30c0-9 5-15 14-17-1 9-6 15-14 17z" fill={LIME} />
          <path d="M48 30c0-7-4-12-11-14 1 8 4 12 11 14z" fill={EMER} />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M46 6c4 28 12 36 40 44-28 8-36 16-40 44-4-28-12-36-40-44 28-8 36-16 40-44z" fill={GREEN} />
          <path d="M78 12c1.6 7 3 8.4 9.5 10-6.5 1.6-7.9 3-9.5 10-1.6-7-3-8.4-9.5-10 6.5-1.6 7.9-3 9.5-10z" fill={GOLD} />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="48" cy="48" r="24" fill={GREEN} />
        </svg>
      );
  }
}

/** Illustration tile (the glyph centered in a fixed box). */
export function IlloTile({ name, size = 132 }: { name: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <Illo name={name} size={Math.round(size * 0.96)} />
    </span>
  );
}
