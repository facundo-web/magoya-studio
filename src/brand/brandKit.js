// ============================================================
// MAGOYA · BRAND KIT (en JS)
// Fuente autoritativa: brand-system/tokens.css
// El SVG exportado NO lee variables CSS → necesitamos los valores acá.
// Este archivo es la "caja de marca": nadie elige colores libres,
// solo ROLES aprobados. Es el núcleo anti-"AI delira".
// ============================================================

// Wordmarks reales (Vite los resuelve a URLs)
import wordmarkCream from './assets/magoya-wordmark-cream.svg'
import wordmarkGreen from './assets/magoya-wordmark-green.svg'
import wordmarkBlack from './assets/magoya-wordmark-black.svg'
import wordmarkDeep from './assets/magoya-wordmark-deep.svg'
import motifEstratos from './assets/motif-estratos.svg'

// Logos de cliente
import logoBasf from './assets/logos/basf.svg'
import logoBayer from './assets/logos/bayer.svg'
import logoCorteva from './assets/logos/corteva.svg'
import logoJohnDeere from './assets/logos/john-deere.svg'
import logoSyngenta from './assets/logos/syngenta.svg'

// ---------- PRIMITIVOS DE COLOR (mirror de tokens.css) ----------
export const PALETTE = {
  green950: '#0C2117',
  green900: '#133825', // Verde Magoya oficial
  green800: '#1A4A31',
  green700: '#235F40',
  emerald500: '#00DE68', // acento digital oficial
  emerald600: '#00B856',
  lime300: '#CBF06E',
  cream50: '#F6F1EB',
  cream100: '#ECE3DB', // Crema Magoya oficial
  cream300: '#C4B5A6',
  ink900: '#0D0C0C',
  gray600: '#666666',
  gray400: '#AAAAAA',
  white: '#FFFFFF',
}

// ---------- ROLES DE COLOR APROBADOS ----------
// Lo único entre lo que el usuario puede elegir. Cada "esquema" es una
// combinación de superficie + acento válida por dirección de arte.
// Regla central: negro construye, verde hace crecer. Nunca todo verde.
export const COLOR_SCHEMES = {
  // clave: { label, surface, onSurface, accent, onAccent, muted }
  deep: {
    label: 'Verde profundo',
    surface: PALETTE.green950,
    onSurface: PALETTE.cream50,
    accent: PALETTE.emerald500,
    onAccent: PALETTE.green950,
    muted: '#8FA396',
  },
  ink: {
    label: 'Negro',
    surface: PALETTE.ink900,
    onSurface: PALETTE.cream50,
    accent: PALETTE.emerald500,
    onAccent: PALETTE.ink900,
    muted: PALETTE.gray400,
  },
  cream: {
    label: 'Crema',
    surface: PALETTE.cream100,
    onSurface: PALETTE.green900,
    accent: PALETTE.green900,
    onAccent: PALETTE.cream50,
    muted: PALETTE.gray600,
  },
  studio: {
    label: 'Blanco',
    surface: PALETTE.white,
    onSurface: PALETTE.ink900,
    accent: PALETTE.emerald500,
    onAccent: PALETTE.ink900,
    muted: PALETTE.gray600,
  },
}
export const DEFAULT_SCHEME = 'deep'

// Acentos válidos para "una palabra en verde" / detalles vivos
export const ACCENTS = {
  emerald: { label: 'Verde digital', value: PALETTE.emerald500 },
  lime: { label: 'Lime marcador', value: PALETTE.lime300 },
  deep: { label: 'Verde profundo', value: PALETTE.green900 },
}

// ---------- LOGOS ----------
export const WORDMARKS = {
  cream: { label: 'Crema (sobre oscuro)', url: wordmarkCream },
  green: { label: 'Verde digital', url: wordmarkGreen },
  black: { label: 'Negro (sobre claro)', url: wordmarkBlack },
  deep: { label: 'Verde profundo', url: wordmarkDeep },
}
// El wordmark tiene proporción ~139x38
export const WORDMARK_RATIO = 139 / 38

export const CLIENT_LOGOS = {
  none: { label: 'Sin logo de cliente', url: null },
  basf: { label: 'BASF', url: logoBasf },
  bayer: { label: 'Bayer', url: logoBayer },
  corteva: { label: 'Corteva', url: logoCorteva },
  johndeere: { label: 'John Deere', url: logoJohnDeere },
  syngenta: { label: 'Syngenta', url: logoSyngenta },
}

export const MOTIF_ESTRATOS = motifEstratos

// ---------- DEGRADÉS (overlay sobre el fondo) ----------
// stops: at 0..1, color, opacity. angle en grados (180 = de arriba a abajo).
export const GRADIENTS = {
  scrimBottom: {
    label: 'Oscuro abajo',
    angle: 180,
    stops: [{ at: 0, color: '#000000', opacity: 0 }, { at: 0.55, color: '#000000', opacity: 0 }, { at: 1, color: '#000000', opacity: 0.8 }],
  },
  scrimTop: {
    label: 'Oscuro arriba',
    angle: 0,
    stops: [{ at: 0, color: '#000000', opacity: 0 }, { at: 0.55, color: '#000000', opacity: 0 }, { at: 1, color: '#000000', opacity: 0.8 }],
  },
  greenWash: {
    label: 'Verde Magoya',
    angle: 160,
    stops: [{ at: 0, color: PALETTE.green950, opacity: 0 }, { at: 1, color: PALETTE.green950, opacity: 0.92 }],
  },
  emeraldGlow: {
    label: 'Glow verde',
    angle: 135,
    stops: [{ at: 0, color: PALETTE.emerald500, opacity: 0.55 }, { at: 0.6, color: PALETTE.emerald500, opacity: 0 }],
  },
  inkFade: {
    label: 'Negro lateral',
    angle: 90,
    stops: [{ at: 0, color: PALETTE.ink900, opacity: 0.85 }, { at: 0.75, color: PALETTE.ink900, opacity: 0 }],
  },
  duo: {
    label: 'Verde → negro',
    angle: 145,
    stops: [{ at: 0, color: PALETTE.green900, opacity: 0.9 }, { at: 1, color: PALETTE.ink900, opacity: 0.9 }],
  },
}
export const GRADIENT_KEYS = Object.keys(GRADIENTS)

// ---------- TIPOGRAFÍA ----------
export const FONT_FAMILY = 'Manrope'
export const FONT_STACK = "'Manrope', system-ui, -apple-system, sans-serif"

// Estilos de texto semánticos (rol → tratamiento)
// weights disponibles: 400,500,600,700,800
export const TEXT_STYLES = {
  kicker: { weight: 700, tracking: 0.14, upper: true, sizeRel: 0.026, mono: false },
  title: { weight: 800, tracking: -0.02, upper: false, sizeRel: 0.078, lineHeight: 1.05 },
  subtitle: { weight: 500, tracking: 0, upper: false, sizeRel: 0.038, lineHeight: 1.25 },
  body: { weight: 500, tracking: 0, upper: false, sizeRel: 0.03, lineHeight: 1.4 },
  quote: { weight: 700, tracking: -0.01, upper: false, sizeRel: 0.06, lineHeight: 1.2 },
  metric: { weight: 800, tracking: -0.02, upper: false, sizeRel: 0.16, lineHeight: 1 },
  metricLabel: { weight: 600, tracking: 0.02, upper: false, sizeRel: 0.032, lineHeight: 1.2 },
}
