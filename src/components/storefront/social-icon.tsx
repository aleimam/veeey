/** Maps a SocialLink.platform to its icon (inline SVGs — lucide dropped brand
 *  marks). "other" / unknown falls back to a generic link glyph. */
export function SocialIcon({ platform, className }: { platform: string; className?: string }) {
  const common = { className, 'aria-hidden': true as const, viewBox: '0 0 24 24' };
  switch (platform) {
    case 'instagram':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...common} fill="currentColor">
          <path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H7v3h3v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1z" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common} fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...common} fill="currentColor">
          <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.3a2.53 2.53 0 1 1-2.53-2.53c.18 0 .35.02.52.06V9.6a5.66 5.66 0 0 0-.52-.03 5.62 5.62 0 1 0 5.62 5.62V8.9a7.3 7.3 0 0 0 4.32 1.4V7.2a4.28 4.28 0 0 1-3.26-1.38z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...common} fill="currentColor">
          <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg {...common} fill="currentColor">
          <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.07 1.4-2.07 2.85V21H9z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.2 0-.3 0-.5l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.7.8-.9 1.7-.6 2.8a9 9 0 0 0 4.6 4.6c1.6.7 2.3.6 3.1.5.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1l-.4-.2z" />
        </svg>
      );
    case 'snapchat':
      return (
        <svg {...common} fill="currentColor">
          <path d="M12.02 2c2.5 0 4.2 1.9 4.3 4.4.03.6 0 1.2-.03 1.7.3.17.66.1 1.06-.06.5-.2 1.1.06 1.2.55.1.5-.26.86-.86 1.1-.3.12-.9.3-1 .6-.1.36.5 1.3 1 1.9.5.6 1.2 1.2 2.1 1.5.4.13.5.4.45.66-.1.55-1.2.9-2 1.05-.2.04-.3.1-.35.34-.04.2-.1.5-.16.7-.07.27-.27.33-.55.3-.4-.05-.9-.16-1.5-.05-.6.1-1 .55-1.6.95-.6.4-1.3.7-2.4.7s-1.8-.3-2.4-.7c-.6-.4-1-.85-1.6-.95-.6-.1-1.1 0-1.5.05-.28.03-.48-.03-.55-.3-.06-.2-.12-.5-.16-.7-.05-.24-.15-.3-.35-.34-.8-.15-1.9-.5-2-1.05-.05-.26.05-.53.45-.66.9-.3 1.6-.9 2.1-1.5.5-.6 1.1-1.54 1-1.9-.1-.3-.7-.48-1-.6-.6-.24-.96-.6-.86-1.1.1-.5.7-.75 1.2-.55.4.16.76.23 1.06.06-.03-.5-.06-1.1-.03-1.7.1-2.5 1.8-4.4 4.3-4.4z" />
        </svg>
      );
    default:
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
        </svg>
      );
  }
}
