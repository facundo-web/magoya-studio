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

// ---- marcas gráficas (currentColor → se tiñen con el acento/negro) ----
const MARK_NAMES = { 'flourish-arrow': 'Flecha', 'flourish-circle': 'Círculo', 'flourish-underline': 'Subrayado', 'doodle-blob': 'Mancha', 'doodle-loop': 'Bucle', 'doodle-sparkle': 'Destello' }
export const MARKS = Object.entries(markModules)
  .map(([path, url]) => {
    const m = path.match(/\/((?:flourish|doodle)-[^/]+)\.svg$/)
    return m ? { slug: m[1], url } : null
  })
  .filter(Boolean)
  .filter((x) => MARK_NAMES[x.slug])
  .map((x) => ({ id: `marks:${x.slug}`, slug: x.slug, category: 'marks', label: MARK_NAMES[x.slug], url: x.url, color: '#0D0C0C' }))

// ---- logo de Magoya como elemento colocable (se ubica libre, no auto) ----
import { WORDMARKS } from './brandKit.js'
export const MAGOYA_OBJECTS = Object.entries(WORDMARKS).map(([k, w]) => ({
  id: `magoya:${k}`, slug: k, category: 'magoya', label: `Magoya ${w.label}`, url: w.url, color: null, isWordmark: true,
}))

export const ALL_OBJECTS = [...ICONS, ...MARKS, ...MAGOYA_OBJECTS]
export const ICONS_BY_ID = Object.fromEntries(ALL_OBJECTS.map((i) => [i.id, i]))
export const ICON_CATEGORIES = { ai: 'Logos de IA', social: 'Redes sociales', marks: 'Trazos y marcas', magoya: 'Logo Magoya' }
export const ICON_URLS = ALL_OBJECTS.map((i) => i.url)
