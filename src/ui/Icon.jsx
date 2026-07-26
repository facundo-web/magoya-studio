// ============================================================
// ICONOS — SVG stroke 1.5, no emojis ni glifos sueltos.
// Los emojis rompen el peso tipográfico de Manrope y son el "tell"
// de hecho-por-IA que más se nota (auditoría de UI).
// ============================================================
const P = {
  text: 'M4 6V4h16v2M12 4v16M8 20h8',
  layers: 'M12 3l9 5-9 5-9-5 9-5M3 13l9 5 9-5M3 17l9 5 9-5',
  photo: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5a1 1 0 100-2 1 1 0 000 2',
  sparkle: 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z',
  brand: 'M4 19V7l8 6 8-6v12',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8a2 2 0 11-2.8 2.8a1.6 1.6 0 00-2.7 1.1a2 2 0 11-4 0a1.6 1.6 0 00-2.7-1.1a2 2 0 11-2.8-2.8A1.6 1.6 0 003 15a2 2 0 010-4a1.6 1.6 0 001.2-2.7a2 2 0 112.8-2.8A1.6 1.6 0 0010 4.6V4a2 2 0 114 0a1.6 1.6 0 002.7 1.1a2 2 0 112.8 2.8A1.6 1.6 0 0021 11a2 2 0 010 4z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  copy: 'M9 9h10v10H9zM5 15H4V4h11v1',
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  bookmark: 'M6 4h12v16l-6-4-6 4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M9 6l6 6-6 6',
  share: 'M7 17L17 7M9 7h8v8',
  cursor: 'M6 3l13 9-6 1.5L10 20z',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-4',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h4',
  check: 'M4 12l5 5L20 6',
  flipH: 'M12 3v18M8 7L4 12l4 5M16 7l4 5-4 5',
  flipV: 'M3 12h18M7 8l5-4 5 4M7 16l5 4 5-4',
  scissors: 'M6 3l12 12M6 21L18 9M8 6a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
}
export default function Icon({ n, size = 20, ...rest }) {
  return (
    <svg className="u-ico" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}><path d={P[n] || P.sparkle} /></svg>
  )
}
