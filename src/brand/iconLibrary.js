// ============================================================
// BIBLIOTECA DE LOGOS (IA + redes) para sumar a las piezas.
// SVG open-source (simple-icons, CC0). Se colorean en su color de
// marca oficial o en blanco (para el estilo "tile" tipo app-icon).
// Los usuarios también pueden SUBIR su propio PNG (versión glossy).
// ============================================================

// Vite: carga todos los SVG de la carpeta como URLs
const modules = import.meta.glob('./assets/icons/**/*.svg', { eager: true, query: '?url', import: 'default' })

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

export const ICONS_BY_ID = Object.fromEntries(ICONS.map((i) => [i.id, i]))
export const ICON_CATEGORIES = { ai: 'Logos de IA', social: 'Redes sociales' }
export const ICON_URLS = ICONS.map((i) => i.url)
