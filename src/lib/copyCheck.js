// ============================================================
// VALIDACIÓN DE COPY (F3) — las reglas editoriales de Magoya, en la app.
// No bloquea nada: avisa. La idea es que el equipo escriba bien sin tener
// que acordarse del manual, no que la app le discuta.
// ============================================================

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u
// palabras funcionales muy frecuentes: sirven para detectar mezcla de idioma
// Sólo palabras FUNCIONALES en inglés. Nada de préstamos que en el agro
// argentino se usan en castellano (data, team, field, farm, insight…): si
// no, cualquier texto normal saltaba como "mezcla de idiomas".
const EN = /\b(the|and|with|for|your|our|from|that|this|about|how|why|what|when|into|which|there|they|will|would|should|because|before|after)\b/i
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
    out.push('La etiqueta no lleva punto final.')
  }
  if (/\s{2,}/.test(t)) out.push('Hay espacios de más.')
  return out
}

// ============================================================
// CONTRASTE (WCAG AA) — la misma idea que arriba, con el color.
//
// Lo pidió un diseñador que revisó la herramienta: "¿esto tiene algún
// chequeo de accesibilidad o algo que te diga che, te la estás mandando con
// alguna cosita?". Avisa, no impide: el aviso sale en la misma lista que los
// de redacción, en el inspector del texto, y no aparece si está todo bien.
//
// `lum` y `ratio` son los mismos de engine/layouts.js. Están repetidos
// porque layouts.js no los exporta (y no se puede tocar desde acá): si
// alguna vez se exportan, esto se borra y se importa de allá.
// ============================================================
import { COLOR_SCHEMES, DEFAULT_SCHEME, ACCENTS, TEXT_COLORS, HIGHLIGHTS, TEXT_STYLES } from '../brand/brandKit.js'

function lum(hex) {
  const h = String(hex || '#000').replace('#', '')
  if (h.length < 6) return 0
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
function contrastOn(hex) {
  const h = String(hex || '#000').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.55 ? '#0D0C0C' : '#F6F1EB'
}
function acentoLegible(clave, scheme) {
  const pedido = (ACCENTS[clave] || { value: scheme.accent }).value
  return ratio(pedido, scheme.surface) >= 1.6 ? pedido : scheme.accent
}

// Umbrales WCAG AA, sin inventar nada: 4.5:1 para texto normal, 3:1 para
// texto grande. "Grande" en WCAG es ≥18,66 px en negrita — todos nuestros
// estilos son de 500 para arriba. En el feed la pieza se ve a unos 400 px de
// ancho, así que un `sizeRel` de 0.05 ya son 20 px: de ahí para arriba
// (título 0.088, cifra 0.2, cita 0.066) cuenta como texto grande.
const AA_NORMAL = 4.5
const AA_GRANDE = 3
const REL_GRANDE = 0.05

// Cómo se llama el texto en el aviso, para que se entienda cuál es.
const NOMBRE = {
  kicker: 'La etiqueta', title: 'El título', subtitle: 'El subtítulo', body: 'Este texto',
  metric: 'El número', metricLabel: 'La descripción del dato', quote: 'La cita',
  author: 'El autor', cta: 'El botón', step: 'El paso',
}

// El fondo real que queda DETRÁS de este texto, o null si no se puede saber
// (una foto no tiene un color: ahí preferimos callarnos antes que inventar
// un aviso que la persona no puede verificar mirando la pieza).
function fondoDetras({ role, scheme, accent, onPhoto, opaquePlate, highlight }) {
  if (highlight) return highlight            // el marcador tapa todo lo de atrás
  if (role === 'cta') return accent          // el CTA se dibuja como pastilla de acento
  if (opaquePlate) return scheme.surface     // banda o tarjeta: el texto vive sobre la placa
  if (onPhoto) return null                   // foto: no hay un color con el que medir
  return scheme.surface
}

// El color con el que se va a pintar el texto. Es la MISMA cadena de
// decisiones que pintarBloque() en layouts.js — si allá cambia, acá también.
function colorDelTexto({ role, colorElegido, scheme, accent, onPhoto, opaquePlate, highlight }) {
  const textColor = onPhoto && !opaquePlate ? '#FFFFFF' : scheme.onSurface
  const mutedColor = onPhoto && !opaquePlate ? '#FFFFFF' : scheme.muted
  if (colorElegido && colorElegido !== 'auto') {
    if (colorElegido === 'accent') return accent
    if (colorElegido === 'strong') return textColor
    if (colorElegido === 'muted') return mutedColor
    const v = (TEXT_COLORS[colorElegido] || {}).value
    if (v) return v
  }
  if (role === 'cta') return contrastOn(accent)
  if (highlight) return contrastOn(highlight)
  if (role === 'kicker' || role === 'metric') return accent
  if (role === 'author' || role === 'subtitle' || role === 'metricLabel') return mutedColor
  return textColor
}

// Un aviso, o ninguno. `block` es el bloque suelto (tiene color y resaltado
// propios); los textos de la plantilla no los tienen y se avisan distinto,
// porque ahí lo que se cambia es el fondo o el acento, no el texto.
export function checkContrast({ role, template, content = {}, block = null }) {
  if (!role || !template) return []
  const d = template.defaults || {}
  const scheme = COLOR_SCHEMES[content.scheme || d.scheme || DEFAULT_SCHEME]
  if (!scheme) return []
  const accent = acentoLegible(content.accent || d.accent, scheme)

  // superficie efectiva, igual que resolvePiece()
  const bg = content.bg || d.bg || null
  const propia = template.surface || (d.hasPhoto ? 'photo' : 'solid')
  const surface = bg === 'photo' ? 'photo' : bg === 'color' ? 'solid' : (template.freeform ? 'solid' : propia)
  // en las plantillas partidas el texto nunca cae sobre la foto
  const onPhoto = surface === 'photo' && !template.split
  const plate = ['none', 'scrim', 'band', 'card'].includes(content.plate ?? d.plate)
    ? (content.plate ?? d.plate)
    : (template.zocalo ? 'band' : (onPhoto ? 'scrim' : 'none'))
  const opaquePlate = plate === 'band' || plate === 'card'

  const highlight = (HIGHLIGHTS[block?.highlight] || {}).value || null
  const fondo = fondoDetras({ role, scheme, accent, onPhoto, opaquePlate, highlight })
  if (!fondo) return []   // sobre foto no medimos: no hay con qué

  const colorElegido = block ? block.color : null
  const texto = colorDelTexto({ role, colorElegido, scheme, accent, onPhoto, opaquePlate, highlight })

  // ¿texto grande? El estilo manda, y el tamaño elegido a mano lo corre.
  const st = TEXT_STYLES[role] || TEXT_STYLES.body
  const rel = (st.sizeRel || 0.03) * (block?.size || content.sizes?.[role] || 1)
  const min = rel >= REL_GRANDE ? AA_GRANDE : AA_NORMAL
  if (ratio(texto, fondo) >= min) return []

  const quien = NOMBRE[role] || 'Este texto'
  if (highlight) {
    const comoSeLlama = Object.entries(HIGHLIGHTS).find(([, h]) => h.value === highlight)?.[1].label
    return [`${quien} casi no se lee sobre el resaltado ${comoSeLlama}. Probá el color Alto contraste, o sacá el resaltado.`]
  }
  // El texto tiene color propio (bloque suelto): la salida más corta es cambiarlo.
  if (block) return [`${quien} casi no se lee sobre el fondo. Probá el color Alto contraste.`]
  // Los textos de la plantilla no tienen color propio: la etiqueta y la cifra
  // se pintan con el acento (se cambia en Marca), el resto sigue al fondo.
  if (role === 'kicker' || role === 'metric') {
    return [`${quien} casi no se lee sobre el fondo. Probá otro color de acento en Marca.`]
  }
  return [`${quien} casi no se lee sobre el fondo. Probá otro color de fondo en Fondo.`]
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
