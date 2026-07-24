// ============================================================
// REGISTRO DE FORMATOS — todas las redes
// Cada formato: { id, network, label, group, w, h, safe }
//  - group: familia de proporción (para reflow y agrupar en UI)
//  - safe:  márgenes seguros como fracción de la dimensión (evita
//           que UI de la red tape contenido, p.ej. stories)
// ============================================================

// familias de proporción (ratio)
export const RATIO_GROUPS = {
  square: '1:1',
  portrait45: '4:5',
  vertical916: '9:16',
  landscape169: '16:9',
  landscapeWide: '1.91:1',
  landscape43: '4:3',
}

const S_DEFAULT = { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 }
// stories/reels: dejar aire arriba (perfil) y abajo (CTA/UI de la red)
const S_STORY = { top: 0.14, right: 0.06, bottom: 0.16, left: 0.06 }

export const FORMATS = [
  // ---------- Instagram ----------
  { id: 'ig-post', network: 'Instagram', label: 'Post cuadrado', group: 'square', w: 1080, h: 1080, safe: S_DEFAULT },
  { id: 'ig-portrait', network: 'Instagram', label: 'Post retrato 4:5', group: 'portrait45', w: 1080, h: 1350, safe: S_DEFAULT },
  { id: 'ig-story', network: 'Instagram', label: 'Story / Reel 9:16', group: 'vertical916', w: 1080, h: 1920, safe: S_STORY },

  // ---------- LinkedIn ----------
  { id: 'li-square', network: 'LinkedIn', label: 'Post cuadrado', group: 'square', w: 1200, h: 1200, safe: S_DEFAULT },
  { id: 'li-landscape', network: 'LinkedIn', label: 'Post horizontal', group: 'landscapeWide', w: 1200, h: 627, safe: S_DEFAULT },
  { id: 'li-carousel', network: 'LinkedIn', label: 'Carrusel (retrato)', group: 'portrait45', w: 1080, h: 1350, safe: S_DEFAULT },

  // ---------- WhatsApp ----------
  { id: 'wa-status', network: 'WhatsApp', label: 'Estado 9:16', group: 'vertical916', w: 1080, h: 1920, safe: S_STORY },

  // ---------- Facebook ----------
  { id: 'fb-post', network: 'Facebook', label: 'Post', group: 'landscapeWide', w: 1200, h: 630, safe: S_DEFAULT },
  { id: 'fb-story', network: 'Facebook', label: 'Story 9:16', group: 'vertical916', w: 1080, h: 1920, safe: S_STORY },

  // ---------- X / Twitter ----------
  { id: 'x-post', network: 'X / Twitter', label: 'Post 16:9', group: 'landscape169', w: 1600, h: 900, safe: S_DEFAULT },

  // ---------- YouTube ----------
  { id: 'yt-thumb', network: 'YouTube', label: 'Miniatura', group: 'landscape169', w: 1280, h: 720, safe: S_DEFAULT },

  // ---------- Genérico ----------
  { id: 'gen-169', network: 'Genérico', label: 'Presentación 16:9', group: 'landscape169', w: 1920, h: 1080, safe: S_DEFAULT },
  { id: 'gen-43', network: 'Genérico', label: 'Clásico 4:3', group: 'landscape43', w: 1600, h: 1200, safe: S_DEFAULT },
]

export const FORMATS_BY_ID = Object.fromEntries(FORMATS.map((f) => [f.id, f]))

// Agrupados por red para el selector
export function formatsByNetwork() {
  const out = {}
  for (const f of FORMATS) {
    ;(out[f.network] ||= []).push(f)
  }
  return out
}

// devuelve los pixeles del rectángulo seguro
export function safeRect(format) {
  const { w, h, safe } = format
  return {
    x: w * safe.left,
    y: h * safe.top,
    w: w * (1 - safe.left - safe.right),
    h: h * (1 - safe.top - safe.bottom),
  }
}

// carrusel: qué formatos permiten multi-slide
export const CAROUSEL_FORMATS = ['li-carousel', 'ig-post', 'ig-portrait', 'li-square']
