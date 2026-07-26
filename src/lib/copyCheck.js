// ============================================================
// VALIDACIÓN DE COPY (F3) — las reglas editoriales de Magoya, en la app.
// No bloquea nada: avisa. La idea es que el equipo escriba bien sin tener
// que acordarse del manual, no que la app le discuta.
// ============================================================

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u
// palabras funcionales muy frecuentes: sirven para detectar mezcla de idioma
const EN = /\b(the|and|with|for|your|our|from|that|this|about|how|why|what|when|into|more|best|new|now|get|make|help|team|data|field|farm)\b/i
const ES = /\b(el|la|los|las|de|del|que|para|con|una|uno|por|en|su|más|cómo|cuándo|dónde|hacer|equipo|campo|dato|datos|productor)\b/i
// una métrica sin ventana temporal no se puede verificar ni comparar
const HAS_METRIC = /(^|\s)[−\-+]?\d+([.,]\d+)?\s*%|\b\d+\s*(x|veces)\b/i
const HAS_WINDOW = /\b(en|durante|tras|desde|hace|por)\s+\d|\b(mes|meses|semana|semanas|año|años|día|días|trimestre|campaña|zafra)\b|\b(20\d\d)\b|\b(mensual|anual|semanal|diario)\b/i

// roles donde el texto es una cita textual: ahí no mandamos nosotros
const VERBATIM = new Set(['quote', 'author'])

export function checkCopy(role, text, ctx = {}) {
  const t = String(text ?? '').trim()
  if (!t) return []
  const out = []

  if (EMOJI.test(t)) {
    out.push('Sacá el emoji: la marca no los usa en piezas.')
  }
  if (!VERBATIM.has(role) && /!|¡/.test(t)) {
    out.push('Sin signos de exclamación. El dato ya es la noticia.')
  }
  if (EN.test(t) && ES.test(t)) {
    out.push('Parece que mezcla español e inglés. Una pieza, un idioma.')
  }
  // la ventana temporal puede estar en este texto o en el que lo acompaña
  if (!VERBATIM.has(role) && HAS_METRIC.test(t)) {
    const around = [t, ctx.metricLabel, ctx.subtitle, ctx.body, ctx.title].filter(Boolean).join(' ')
    if (!HAS_WINDOW.test(around)) {
      out.push('Falta la ventana temporal: “−70%” solo, no se puede verificar. Agregá “en 4 meses”, “por campaña”…')
    }
  }
  if (role === 'kicker' && /[.]$/.test(t)) {
    out.push('La volanta no lleva punto final.')
  }
  if (/\s{2,}/.test(t)) out.push('Hay espacios de más.')
  return out
}

// ¿toda la pieza está limpia? (para un resumen en el panel)
export function checkPiece(content = {}) {
  const roles = ['kicker', 'title', 'subtitle', 'body', 'metric', 'metricLabel', 'quote', 'author']
  const issues = []
  for (const r of roles) {
    checkCopy(r, content[r], content).forEach((msg) => issues.push({ role: r, msg }))
  }
  ;(content.textBlocks || []).forEach((b, i) => {
    checkCopy(b.style || 'title', b.text, content).forEach((msg) => issues.push({ role: `tb:${i}`, msg }))
  })
  return issues
}
