// ============================================================
// BIBLIOTECA DE LOGOS (IA + redes) para sumar a las piezas.
// SVG open-source (simple-icons, CC0). Se colorean en su color de
// marca oficial o en blanco (para el estilo "tile" tipo app-icon).
// Los usuarios también pueden SUBIR su propio PNG (versión glossy).
// ============================================================

// Vite: carga todos los SVG de la carpeta como URLs
const modules = import.meta.glob('./assets/icons/**/*.svg', { eager: true, query: '?url', import: 'default' })
// marcas gráficas (flechas, círculos, subrayados, doodles) — assets de marca
const markModules = import.meta.glob('./assets/*.svg', { eager: true, query: '?url', import: 'default' })

const COLORS = {
  // IA
  openai: '#000000', anthropic: '#D97757', claude: '#D97757', googlegemini: '#8E75B2',
  google: '#4285F4', perplexity: '#20808D', huggingface: '#FFD21E', mistralai: '#FA520F',
  ollama: '#000000', meta: '#0668E1',
  // Redes
  youtube: '#FF0000', instagram: '#E4405F', linkedin: '#0A66C2', whatsapp: '#25D366',
  tiktok: '#000000', x: '#000000', facebook: '#1877F2', threads: '#000000',
  telegram: '#26A5E4', discord: '#5865F2', twitch: '#9146FF', pinterest: '#BD081C',
  reddit: '#FF4500',
}
const NAMES = {
  openai: 'OpenAI', anthropic: 'Anthropic', claude: 'Claude', googlegemini: 'Gemini',
  google: 'Google', perplexity: 'Perplexity', huggingface: 'Hugging Face', mistralai: 'Mistral',
  ollama: 'Ollama', meta: 'Meta AI',
  youtube: 'YouTube', instagram: 'Instagram', linkedin: 'LinkedIn', whatsapp: 'WhatsApp',
  tiktok: 'TikTok', x: 'X', facebook: 'Facebook', threads: 'Threads',
  telegram: 'Telegram', discord: 'Discord', twitch: 'Twitch', pinterest: 'Pinterest',
  reddit: 'Reddit',
}

export const ICONS = Object.entries(modules).map(([path, url]) => {
  const m = path.match(/icons\/(ai|social)\/([^/]+)\.svg$/)
  const category = m ? m[1] : 'other'
  const slug = m ? m[2] : path
  return {
    id: `${category}:${slug}`,
    slug,
    category, // 'ai' | 'social'
    label: NAMES[slug] || slug,
    url,
    color: COLORS[slug] || '#0D0C0C',
  }
})

// ---- trazos y misceláneas (currentColor → se tiñen con el acento/negro) ----
const MARK_NAMES = { 'flourish-arrow': 'Flecha', 'flourish-circle': 'Círculo', 'flourish-underline': 'Subrayado', 'flourish-navarrow': 'Botón flecha', 'doodle-dots': 'Dots de carrusel' }
export const MARKS = Object.entries(markModules)
  .map(([path, url]) => {
    const m = path.match(/\/((?:flourish|doodle)-[^/]+)\.svg$/)
    return m ? { slug: m[1], url } : null
  })
  .filter(Boolean)
  .filter((x) => MARK_NAMES[x.slug])
  .map((x) => ({ id: `marks:${x.slug}`, slug: x.slug, category: (x.slug.startsWith('flourish') && x.slug !== 'flourish-navarrow') ? 'trazos' : 'misc', label: MARK_NAMES[x.slug], url: x.url, color: '#0D0C0C', isMark: true }))

// ---- marca de Magoya como elemento colocable (wordmark + isotipo) ----
import { WORDMARKS, ISOTIPOS } from './brandKit.js'
export const MAGOYA_OBJECTS = [
  ...Object.entries(ISOTIPOS).map(([k, i]) => ({
    id: `magoya:iso-${k}`, slug: `iso-${k}`, category: 'magoya', label: i.label, url: i.url,
    color: i.tintable ? '#0D0C0C' : null, isWordmark: !i.tintable, isMark: !!i.tintable, isIsotipo: true,
  })),
  ...Object.entries(WORDMARKS).map(([k, w]) => ({
    id: `magoya:${k}`, slug: k, category: 'magoya', label: `Wordmark ${w.label}`, url: w.url, color: null, isWordmark: true,
  })),
]

// ---- dispositivos (celular / notebook / tablet) — se colocan como imagen,
// y adentro se les mete una foto/gráfico con "Recorte / pantalla" ----
const deviceModules = import.meta.glob('./assets/devices/*.svg', { eager: true, query: '?url', import: 'default' })
const DEVICE_NAMES = { phone: 'Celular', laptop: 'Notebook', tablet: 'Tablet' }
// screen = rect de la PANTALLA en fracciones del marco (x, y, w, h, radio)
// para meter la foto adentro automáticamente, sin que el usuario recorte nada
const DEVICE_SCREENS = {
  phone: { x: 11 / 232, y: 11 / 468, w: 210 / 232, h: 446 / 468, r: 0.19, ratio: 232 / 468 },
  laptop: { x: 78 / 560, y: 18 / 336, w: 404 / 560, h: 274 / 336, r: 0.006, ratio: 560 / 336 },
  tablet: { x: 16 / 344, y: 16 / 468, w: 312 / 344, h: 436 / 468, r: 0.045, ratio: 344 / 468 },
}
export const DEVICES = Object.entries(deviceModules).map(([path, url]) => {
  const slug = path.match(/([^/]+)\.svg$/)[1]
  return { id: `devices:${slug}`, slug, category: 'devices', label: DEVICE_NAMES[slug] || slug, url, color: '#1B1B1B', isDevice: true, screen: DEVICE_SCREENS[slug] }
})

// ---- FORMAS generativas (alto impacto "AI en campo") ----
export const SHAPES = [
  { id: 'shape:arrow', slug: 'arrow', category: 'shapes', label: 'Flecha gruesa', shape: 'arrow', isShape: true, color: '#00DE68' },
  { id: 'shape:handArrow', slug: 'handArrow', category: 'shapes', label: 'Flecha a mano', shape: 'handArrow', isShape: true, color: '#00DE68' },
  { id: 'shape:sparkle', slug: 'sparkle', category: 'shapes', label: 'Destello', shape: 'sparkle', isShape: true, color: '#00DE68' },
  { id: 'shape:badge', slug: 'badge', category: 'shapes', label: 'Etiqueta', shape: 'badge', isShape: true, color: '#00DE68' },
  { id: 'shape:bars', slug: 'bars', category: 'shapes', label: 'Barras', shape: 'bars', isShape: true, color: '#00DE68' },
  { id: 'shape:sparkline', slug: 'sparkline', category: 'shapes', label: 'Curva', shape: 'sparkline', isShape: true, color: '#00DE68' },
  { id: 'shape:callout', slug: 'callout', category: 'shapes', label: 'Bocadillo', shape: 'callout', isShape: true, color: '#00DE68' },
]

export const ALL_OBJECTS = [...ICONS, ...MARKS, ...SHAPES, ...MAGOYA_OBJECTS, ...DEVICES]
export const ICONS_BY_ID = Object.fromEntries(ALL_OBJECTS.map((i) => [i.id, i]))
export const ICON_CATEGORIES = { ai: 'Logos de IA', social: 'Redes sociales', trazos: 'Trazos', misc: 'Misceláneas', shapes: 'Formas', devices: 'Dispositivos', magoya: 'Logo Magoya' }
export const ICON_URLS = ALL_OBJECTS.map((i) => i.url).filter(Boolean)
