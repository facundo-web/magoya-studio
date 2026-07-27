// ============================================================
// LAYOUTS — composición responsiva por template.
// Un template declara: superficie (foto|solid), ancla del stack de
// texto, qué roles muestra, y toggles (motivo, zócalo, tratamiento).
// El engine reflowa a cualquier formato usando el rect seguro.
// Reglas de arte Magoya: equilibrio negro↔verde, foto B&N + acento,
// Manrope, marcas sutiles. Nunca un lienzo en blanco.
// ============================================================

import { safeRect } from '../formats/registry.js'
import { COLOR_SCHEMES, DEFAULT_SCHEME, ACCENTS, TEXT_STYLES, WORDMARKS, WORDMARK_RATIO, MOTIF_ESTRATOS, GRADIENTS, FONT_HAND_STACK, HIGHLIGHTS } from '../brand/brandKit.js'
import { ICONS_BY_ID } from '../brand/iconLibrary.js'
import { getAsset, coloredIcon } from './assets.js'
import { fitText, measure, wrapText } from './textLayout.js'
import { arrowPath, handArrowPath, sparklePath, calloutPath, barsRects, sparkline, windowChrome } from './shapes.js'

// texto oscuro o claro según luminancia del fondo
function contrastOn(hex) {
  const h = (hex || '#000').replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.55 ? '#0D0C0C' : '#F6F1EB'
}

// roles de texto en orden de stack
const STACK_ORDER = ['kicker', 'title', 'subtitle', 'body', 'metric', 'metricLabel', 'quote', 'author']

// ---- Bloque B: ejes de composición ----
// densidad = cuánto aire respira el stack (gap entre bloques y ancho de línea)
const DENSITY = {
  compact: { gap: 0.68, w: 1.02 },
  normal: { gap: 1, w: 1 },
  roomy: { gap: 1.7, w: 0.84 },
}
// placa = qué hay DETRÁS del texto. Es el eje que más cambia la pieza.
const PLATES = ['none', 'scrim', 'band', 'card']
function normalizePlate(v, template, onPhoto) {
  if (PLATES.includes(v)) return v
  if (template.zocalo) return 'band'
  return onPhoto ? 'scrim' : 'none'
}

export function resolvePiece(template, content) {
  const d = template.defaults || {}
  const c = content || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = (ACCENTS[c.accent || d.accent] || { value: scheme.accent }).value
  const freeform = !!template.freeform
  // en freeform el fondo lo decide el usuario (color/foto)
  const bg = c.bg || d.bg || 'color'
  const surface = freeform ? (bg === 'photo' ? 'photo' : 'solid') : (template.surface || (d.hasPhoto ? 'photo' : 'solid'))
  const onPhoto = surface === 'photo'
  return {
    scheme,
    accent,
    freeform,
    surface,
    // ejes de composición (Bloque B) — los pisa la variante elegida
    plate: normalizePlate(c.plate ?? d.plate, template, onPhoto),
    density: DENSITY[c.density ?? d.density] ? (c.density ?? d.density) : 'normal',
    scale: Number(c.scale ?? d.scale) || 1,
    rule: c.rule ?? d.rule ?? 'top',
    anchor: c.anchor || template.anchor || 'bottom-left',
    motif: freeform ? false : template.motif !== false,
    zocalo: template.zocalo || false,
    roles: template.roles || (freeform ? [] : ['kicker', 'title', 'subtitle']),
    textBlocks: c.textBlocks || d.textBlocks || [],
    showLogo: c.showLogo !== undefined ? c.showLogo : d.showLogo !== false,
    logoPos: c.logoPos || d.logoPos || 'left',
    logoScale: c.logoScale || d.logoScale || 1,
    // logo automático: lo decide el contraste con el fondo. Es la regla de
    // marca que menos debería depender del criterio de cada uno.
    logo: c.logo || d.logo || (onPhoto ? 'cream' : (COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]?.onSurface === '#0D0C0C' ? 'black' : 'cream')),
    treatment: c.treatment || d.treatment || 'bw',
    photo: c.photo || null,
    gradient: c.gradient !== undefined ? c.gradient : d.gradient || null,
    objects: c.objects || d.objects || [],
    steps: c.steps || d.steps || [],
    sizes: c.sizes || d.sizes || null,
    vignette: c.vignette ?? d.vignette ?? 0,
    photoDim: c.photoDim ?? d.photoDim ?? 0,
    photoBlur: c.photoBlur ?? d.photoBlur ?? 0,
    handAccent: template.handAccent || false,
    text: {
      kicker: pick(c.kicker, d.kicker),
      title: pick(c.title, d.title),
      subtitle: pick(c.subtitle, d.subtitle),
      body: pick(c.body, d.body),
      metric: pick(c.metric, d.metric),
      metricLabel: pick(c.metricLabel, d.metricLabel),
      quote: pick(c.quote, d.quote),
      author: pick(c.author, d.author),
    },
  }
}
function pick(a, b) {
  return a !== undefined && a !== null ? a : b
}

// `sizeLock` = tamaño fijo por estilo, en px. Sirve para que en un carrusel
// el mismo rol mida IGUAL en todas las slides: si no, el auto-ajuste achica
// el texto según cuánto escribiste en cada una y la cita salta de 30 a 58 px
// entre la primera y la última. Se ve roto al scrollear.
export function drawPiece(b, { template, content, format, sizeLock = null }) {
  if (template.category === 'chat') { drawChat(b, { template, content, format }); return }
  const p = resolvePiece(template, content)
  const { w: W, h: H } = format
  const safe = safeRect(format)
  const ref = Math.min(W, H)
  const onPhoto = p.surface === 'photo'
  const dens = DENSITY[p.density] || DENSITY.normal
  // con placa opaca (banda/tarjeta) el texto vive sobre la superficie de
  // marca, no sobre la foto: el color tiene que seguir a la placa.
  const opaquePlate = (p.plate === 'band' || p.plate === 'card')
  const textColor = onPhoto && !opaquePlate ? '#FFFFFF' : p.scheme.onSurface
  const mutedColor = onPhoto && !opaquePlate ? 'rgba(255,255,255,.82)' : p.scheme.muted

  // ---- superficie ----
  if (onPhoto) {
    b.imageCover({
      x: 0, y: 0, w: W, h: H,
      href: p.photo?.src, natural: p.photo?.natural, focal: p.photo?.focal,
      grayscale: p.treatment === 'bw',
      dim: p.photoDim, blur: p.photoBlur * (ref / 1000),
    })
  } else {
    b.rect({ x: 0, y: 0, w: W, h: H, fill: p.scheme.surface })
    if (p.motif && MOTIF_ESTRATOS) {
      const mw = W * 0.46
      const mh = mw * (250 / 360)
      b.asset({ x: W - mw + W * 0.02, y: H * 0.04, w: mw, h: mh, href: getAsset(MOTIF_ESTRATOS), opacity: 0.9 })
    }
  }

  // ---- degradé overlay (por encima del fondo) ----
  if (p.gradient && p.gradient.preset && GRADIENTS[p.gradient.preset]) {
    const g = GRADIENTS[p.gradient.preset]
    b.gradientOverlay({
      w: W, h: H,
      angle: p.gradient.angle ?? g.angle,
      stops: g.stops,
      opacity: p.gradient.opacity ?? 1,
    })
  }

  // ---- viñeta (sube el contraste del centro) ----
  if (p.vignette > 0) b.vignette({ w: W, h: H, strength: p.vignette })

  // ---- stack de texto ----
  const blocks = []
  const maxTextW = safe.w * (onPhoto && !opaquePlate ? 0.92 : 0.8) * dens.w
  const pushBlock = (role, txt, opts = {}) => {
    if (txt === undefined || txt === null || String(txt).trim() === '') return
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const hand = role === 'kicker' && p.handAccent
    // tamaño elegido a mano (multiplicador por bloque o por rol)
    const elegido = opts.size || p.sizes?.[role] || null
    const manual = elegido || 1
    const startPx = ref * st.sizeRel * (hand ? 1.9 : 1) * p.scale * manual
    const value = (st.upper && !hand) ? String(txt).toUpperCase() : String(txt)
    const maxLines = role === 'title' || role === 'quote' ? 4 : role === 'kicker' || role === 'cta' ? 1 : 3
    // Si elegiste un tamaño a mano, ese MANDA. Antes el auto-ajuste lo
    // deshacía apenas el texto era largo: "tamaño grande no me lo toma".
    // Ahora el texto baja de línea en vez de achicarse; el único techo es
    // que no se vaya de la pieza.
    const fijo = elegido ? startPx : (sizeLock && sizeLock[role])
    const fit = fitText(value, {
      weight: hand ? 700 : st.weight, tracking: hand ? 0 : (st.tracking || 0),
      maxWidth: maxTextW, maxHeight: fijo ? H * 0.86 : H * 0.5, startPx: fijo || startPx,
      lineHeight: st.lineHeight || 1.15, maxLines: fijo ? 99 : maxLines,
    })
    blocks.push({ role, st, value, px: fit.px, lines: fit.lines, lineHeight: st.lineHeight || 1.15, hand, hl: opts.hl || null, eid: opts.eid || null })
  }
  // roles de la plantilla (piezas clásicas)
  for (const role of STACK_ORDER) {
    if (p.roles.includes(role)) pushBlock(role, p.text[role], { eid: `role:${role}` })
  }
  // bloques de texto sumados por el usuario (freeform / componentes)
  p.textBlocks.forEach((tb, idx) => {
    pushBlock(tb.style || 'title', tb.text, { hl: (HIGHLIGHTS[tb.highlight] || {}).value, eid: `tb:${idx}`, size: tb.size })
  })
  // pasos numerados (plantilla "método")
  ;(p.steps || []).forEach((st, idx) => {
    if (String(st || '').trim()) pushBlock('step', `${String(idx + 1).padStart(2, '0')}  ${st}`, { eid: `step:${idx}` })
  })

  // altura total del stack (con gaps proporcionales a la densidad)
  const gap = ref * 0.022 * dens.gap
  let stackH = 0
  let stackW = 0
  blocks.forEach((bl, i) => {
    stackH += bl.lines.length * bl.px * bl.lineHeight
    if (i < blocks.length - 1) stackH += gap
    const wgt = bl.hand ? 700 : bl.st.weight
    const trk = bl.hand ? 0 : (bl.st.tracking || 0)
    bl.lines.forEach((ln) => { stackW = Math.max(stackW, measure(ln, { px: bl.px, weight: wgt, tracking: trk })) })
  })

  // posición del stack según ancla
  const [vAnchor, hAnchor] = p.anchor.split('-')
  let cursorY
  if (vAnchor === 'bottom') cursorY = safe.y + safe.h - stackH
  else if (vAnchor === 'center') cursorY = safe.y + (safe.h - stackH) / 2
  else cursorY = safe.y + (onPhoto ? 0 : safe.h * 0.12)
  const textX = hAnchor === 'center' ? W / 2 : safe.x
  const textAnchor = hAnchor === 'center' ? 'middle' : 'start'

  // ---- PLACA: qué hay detrás del texto (eje `plate` del Bloque B) ----
  const ruleH = Math.max(3, ref * 0.006)
  let plateRect = null // si hay placa opaca, el logo entra ADENTRO (B4)
  if (p.plate === 'band') {
    // banda de ancho completo que baja hasta el borde (el clásico zócalo)
    const pad = ref * 0.045
    const by = cursorY - pad
    plateRect = { x: 0, y: by, w: W, h: H - by, textW: stackW }
    b.rect({ ...plateRect, fill: p.scheme.surface, opacity: onPhoto ? 0.94 : 1 })
    if (p.rule !== 'none') b.rect({ x: safe.x, y: by, w: ref * 0.12, h: ruleH, fill: p.accent })
  } else if (p.plate === 'card') {
    // tarjeta ajustada al texto: la variante más "editorial"
    const padX = ref * 0.05, padY = ref * 0.045
    const cx0 = hAnchor === 'center' ? W / 2 - stackW / 2 : textX
    plateRect = {
      x: Math.max(ref * 0.02, cx0 - padX), y: cursorY - padY,
      w: Math.min(W - ref * 0.04, stackW + padX * 2), h: stackH + padY * 2,
    }
    b.rect({ ...plateRect, rx: ref * 0.028, fill: p.scheme.surface, opacity: onPhoto ? 0.95 : 1 })
    if (!onPhoto) b.rect({ x: plateRect.x, y: plateRect.y, w: plateRect.w, h: ruleH, rx: ruleH / 2, fill: p.accent })
  } else if (p.plate === 'scrim' && onPhoto) {
    b.scrim({ x: 0, y: H * 0.4, w: W, h: H * 0.6, dir: 'bottom', to: 'rgba(0,0,0,0.68)' })
  }
  // regla de acento arriba del stack (sólo si no la puso ya la placa)
  if (p.rule === 'top' && (p.plate === 'none' || (p.plate === 'scrim' && !onPhoto))) {
    b.rect({ x: hAnchor === 'center' ? W / 2 - ref * 0.06 : safe.x, y: cursorY - gap, w: ref * 0.12, h: ruleH, fill: p.accent })
  }

  // ---- objetos DETRÁS del texto (profundidad) ----
  drawObjects(b, { objects: (p.objects || []).filter((o) => !o.front), W, H, ref, accent: p.accent, scheme: p.scheme })

  // dibujar bloques
  for (const bl of blocks) {
    const isKicker = bl.role === 'kicker'
    const isCta = bl.role === 'cta'
    const isAccentRole = bl.role === 'metric'
    const weight = bl.hand ? 700 : bl.st.weight
    const tracking = bl.hand ? 0 : (bl.st.tracking || 0)

    // fondo del texto: CTA (pill acento) o resaltado (marcador).
    // Geometría basada en la línea de base real que usa b.text (y + px*0.8).
    const lineH = bl.px * bl.lineHeight
    const CAP = 0.72 // altura de mayúscula aprox (Manrope)
    if (isCta || bl.hl) {
      const bgFill = isCta ? p.accent : bl.hl
      const padX = bl.px * (isCta ? 0.7 : 0.24)
      const padY = bl.px * (isCta ? 0.42 : 0.14)
      bl.lines.forEach((ln, li) => {
        const w = measure(ln, { px: bl.px, weight, tracking })
        const baseline = cursorY + bl.px * 0.8 + li * lineH
        const glyphTop = baseline - bl.px * CAP
        const rh = bl.px * CAP + bl.px * 0.14 + padY * 2 // cap + descendente + aire
        const ry0 = glyphTop - padY
        const rx0 = textAnchor === 'middle' ? textX - w / 2 - padX : textX - padX
        b.rect({ x: rx0, y: ry0, w: w + padX * 2, h: rh, rx: isCta ? rh / 2 : bl.px * 0.12, fill: bgFill })
      })
    }

    const fill = isCta ? contrastOn(p.accent)
      : bl.hl ? contrastOn(bl.hl)
      : isKicker || isAccentRole ? p.accent
      : bl.role === 'author' || bl.role === 'subtitle' || bl.role === 'metricLabel' ? mutedColor
      : textColor
    b.text({
      x: textX, y: cursorY, lines: bl.lines, px: bl.px,
      weight, fill, anchor: textAnchor,
      tracking, lineHeight: bl.lineHeight,
      fontFamily: bl.hand ? FONT_HAND_STACK : undefined,
      eid: bl.eid,
    })
    // B4 · lockup "volanta con línea": la regla sale AL LADO de la volanta,
    // no arriba del stack. Sube mucho el nivel editorial y no mueve el texto.
    if (isKicker && p.rule === 'side' && textAnchor !== 'middle') {
      const kw = measure(bl.lines[0] || '', { px: bl.px, weight, tracking })
      const lx = textX + kw + bl.px * 0.7
      const lw = Math.min(ref * 0.16, Math.max(0, safe.x + safe.w - lx))
      if (lw > ref * 0.02) b.rect({ x: lx, y: cursorY + bl.px * 0.5, w: lw, h: Math.max(2, ref * 0.004), fill: p.accent })
    }
    cursorY += bl.lines.length * lineH + gap + (isCta ? bl.px * 0.5 : 0)
  }

  // ---- logo ----
  if (p.showLogo) drawLogo(b, { p, W, H, safe, ref, textAnchor, hAnchor, vAnchor, plateRect })

  // ---- objetos DELANTE del texto (profundidad) ----
  drawObjects(b, { objects: (p.objects || []).filter((o) => o.front), W, H, ref, accent: p.accent, scheme: p.scheme })
}

// Qué tamaño le toca a cada estilo en esta pieza, sin dibujar nada.
// Con esto se calcula el tamaño común de un carrusel: el MÍNIMO entre las
// slides, que es el único que entra en todas.
export function medirPieza(template, content, format) {
  if (template.category === 'chat') return {}
  const p = resolvePiece(template, content)
  const { w: W, h: H } = format
  const safe = safeRect(format)
  const ref = Math.min(W, H)
  const onPhoto = p.surface === 'photo'
  const dens = DENSITY[p.density] || DENSITY.normal
  const opaquePlate = (p.plate === 'band' || p.plate === 'card')
  const maxTextW = safe.w * (onPhoto && !opaquePlate ? 0.92 : 0.8) * dens.w
  const out = {}
  const medir = (role, txt, size) => {
    if (txt === undefined || txt === null || String(txt).trim() === '') return
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const hand = role === 'kicker' && p.handAccent
    const elegido = size || p.sizes?.[role] || null
    if (elegido) return            // no participa del tamaño común
    const startPx = ref * st.sizeRel * (hand ? 1.9 : 1) * p.scale
    const value = (st.upper && !hand) ? String(txt).toUpperCase() : String(txt)
    const maxLines = role === 'title' || role === 'quote' ? 4 : role === 'kicker' || role === 'cta' ? 1 : 3
    const fit = fitText(value, {
      weight: hand ? 700 : st.weight, tracking: hand ? 0 : (st.tracking || 0),
      maxWidth: maxTextW, maxHeight: H * 0.5, startPx,
      lineHeight: st.lineHeight || 1.15, maxLines,
    })
    out[role] = Math.min(out[role] ?? Infinity, fit.px)
  }
  for (const role of STACK_ORDER) if (p.roles.includes(role)) medir(role, p.text[role])
  ;(p.textBlocks || []).forEach((tb) => medir(tb.style || 'title', tb.text, tb.size))
  return out
}

// El tamaño común de un carrusel: por estilo, el más chico de todas las
// slides. Es el único que entra en la que más texto tiene.
export function tamanoComun(slides, format) {
  const lock = {}
  for (const s of slides || []) {
    const m = medirPieza(s.template, s.content, format)
    for (const [k, v] of Object.entries(m)) lock[k] = Math.min(lock[k] ?? Infinity, v)
  }
  return lock
}

// ---- renderer de chat (WhatsApp) ----
function drawChat(b, { template, content, format }) {
  const { w: W, h: H } = format
  const ref = Math.min(W, H)
  const c = content || {}
  const d = template.defaults || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = (ACCENTS[c.accent || d.accent] || { value: scheme.accent }).value
  const objects = c.objects || d.objects || []
  const messages = c.messages || d.messages || []
  const chatName = c.chatName ?? d.chatName ?? 'Magoya'
  const chatStatus = c.chatStatus ?? d.chatStatus ?? 'en línea'

  // fondo de marca
  b.rect({ x: 0, y: 0, w: W, h: H, fill: scheme.surface })

  // degradé y viñeta son de la PIEZA, no de la foto: el chat también los usa
  const grad = c.gradient !== undefined ? c.gradient : d.gradient || null
  if (grad && grad.preset && GRADIENTS[grad.preset]) {
    const g = GRADIENTS[grad.preset]
    b.gradientOverlay({ w: W, h: H, angle: grad.angle ?? g.angle, stops: g.stops, opacity: grad.opacity ?? 1 })
  }

  // panel del chat
  const px = W * 0.06, py = H * 0.055, pw = W * 0.88, ph = H * 0.89
  const R = ref * 0.045
  b.rect({ x: px, y: py, w: pw, h: ph, fill: '#E7E0D6', rx: R }) // fondo tipo WhatsApp (beige)

  // header verde
  const hh = ref * 0.13
  b.rect({ x: px, y: py, w: pw, h: hh, fill: '#0F5132', rx: R })
  b.rect({ x: px, y: py + hh - R, w: pw, h: R, fill: '#0F5132' }) // cuadrar la base del header
  // avatar
  const av = hh * 0.58, avx = px + ref * 0.03, avy = py + (hh - av) / 2
  b.rect({ x: avx, y: avy, w: av, h: av, fill: accent, rx: av / 2 })
  b.text({ x: avx + av / 2, y: avy + av * 0.24, lines: ['m'], px: av * 0.52, weight: 800, fill: '#0F5132', anchor: 'middle' })
  b.text({ x: avx + av + ref * 0.022, y: py + hh * 0.22, lines: [chatName], px: ref * 0.038, weight: 700, fill: '#FFFFFF' })
  b.text({ x: avx + av + ref * 0.022, y: py + hh * 0.56, lines: [chatStatus], px: ref * 0.026, weight: 500, fill: 'rgba(255,255,255,.82)' })

  // Objetos "detrás": detrás de los MENSAJES, pero encima del panel. Si van
  // antes del panel quedan 100% tapados (el panel es opaco y cubre casi toda
  // la pieza): era el mismo bug de antes, sólo que más difícil de ver.
  drawObjects(b, { objects: objects.filter((o) => !o.front), W, H, ref, accent, scheme })

  // mensajes (burbujas)
  let cy = py + hh + ref * 0.045
  const maxBubbleW = pw * 0.74
  const padX = ref * 0.03, padY = ref * 0.022
  const fpx = ref * 0.032
  const lh = 1.32
  for (const m of messages) {
    if (!m || !String(m.text || '').trim()) continue
    const mine = m.from === 'me'
    const lines = wrapText(m.text, { px: fpx, weight: 500, tracking: 0, maxWidth: maxBubbleW - padX * 2 })
    const contentW = Math.max(...lines.map((l) => measure(l, { px: fpx, weight: 500 })))
    const tw = Math.min(maxBubbleW, contentW + padX * 2)
    const th = lines.length * fpx * lh + padY * 2
    const bx = mine ? px + pw - ref * 0.03 - tw : px + ref * 0.03
    b.rect({ x: bx, y: cy, w: tw, h: th, fill: mine ? '#DcF8C6' : '#FFFFFF', rx: ref * 0.024 })
    b.text({ x: bx + padX, y: cy + padY, lines, px: fpx, weight: 500, fill: '#111111', lineHeight: lh })
    cy += th + ref * 0.022
    if (cy > py + ph - ref * 0.06) break
  }

  // objetos DELANTE del panel + logo, igual que en cualquier otra pieza
  drawObjects(b, { objects: objects.filter((o) => o.front), W, H, ref, accent, scheme })
  const vig = c.vignette ?? d.vignette ?? 0
  if (vig > 0) b.vignette({ w: W, h: H, strength: vig })
  const mostrarLogo = c.showLogo !== undefined ? c.showLogo : d.showLogo !== false
  if (mostrarLogo) {
    const safe = safeRect(format)
    drawLogo(b, {
      p: { logo: c.logo || d.logo || 'cream', logoPos: c.logoPos || d.logoPos || 'left', logoScale: c.logoScale || d.logoScale || 1, plate: 'none' },
      W, H, safe, ref, hAnchor: 'left', vAnchor: 'top', plateRect: null,
    })
  }
}

function drawObjects(b, { objects, W, H, ref, accent, scheme }) {
  for (const o of objects || []) {
    // ---- FORMAS generativas (flecha, sparkle, badge, barras, bocadillo) ----
    if (o.kind === 'shape') { drawShape(b, { o, W, H, ref, accent, scheme }); continue }
    const size = ref * (o.scale || 0.28)
    const cx = W * (o.x ?? 0.72)
    const cy = H * (o.y ?? 0.5)
    const rotation = o.rotation || 0
    const flipX = !!o.flipX
    const shadow = o.shadow !== false
    const opacity = o.opacity ?? 1
    // DISPOSITIVO: marco + foto adentro de la pantalla (automático)
    if (o.kind === 'device') {
      const dev = ICONS_BY_ID[o.deviceId]
      if (!dev) continue
      const sc = dev.screen || { x: 0.1, y: 0.1, w: 0.8, h: 0.8, r: 0.02, ratio: 0.5 }
      const dw = ref * (o.scale || 0.5)
      const dh = dw / (sc.ratio || 1)
      const dx = cx - dw / 2, dy = cy - dh / 2
      // 1) pantalla (foto) por debajo del marco
      if (o.src) {
        b.framedImage({
          cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh,
          w: sc.w * dw, h: sc.h * dh, rotation, flipX, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: sc.r * sc.w * dw, zoom: o.zoom || 1, shadow: false, opacity,
        })
      } else {
        b.framedImage({ cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh, w: sc.w * dw, h: sc.h * dh, rotation, href: null, radius: sc.r * sc.w * dw })
      }
      // 2) marco del dispositivo encima, con sombra de objeto físico
      const frameUrl = getAsset(dev.url) || dev.url
      const devShadow = shadow ? b.filter({ kind: 'device', k: (dw / ref) * 1.6 }) : null
      b.object({ cx, cy, size: dw, rotation, flipX, href: frameUrl, tile: false, shadow: false, opacity, aspect: 1 / (sc.ratio || 1), extraFilter: devShadow })
      // 3) reflejo de la pantalla: lo que lo termina de sacar de "ícono"
      if (o.glare !== false) {
        b.screenGlare({
          cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh,
          w: sc.w * dw, h: sc.h * dh, radius: sc.r * sc.w * dw,
          rotation, strength: o.glare ?? 1,
        })
      }
      continue
    }
    if (o.kind === 'image' && o.src) {
      if (o.frame) {
        // imagen enmascarada en un marco (pantalla/mockup)
        const fw = ref * (o.scale || 0.4)
        const fh = fw * (o.ratio || 0.6)
        b.framedImage({
          cx, cy, w: fw, h: fh, rotation, flipX, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: (o.radius || 0) * Math.min(fw, fh),
          zoom: o.zoom || 1, shadow, opacity,
        })
      } else {
        // efectos del recorte: contorno / glow / sombra dura
        let extraFilter = null
        if (o.fx === 'outline') extraFilter = b.filter({ kind: 'outline', r: ref * 0.008, color: o.fxColor || '#FFFFFF' })
        else if (o.fx === 'glow') extraFilter = b.filter({ kind: 'glow', r: ref * 0.05, color: o.fxColor || accent, opacity: 0.85 })
        else if (o.fx === 'hard') extraFilter = b.filter({ kind: 'hard', dx: ref * 0.018, dy: ref * 0.018, color: o.fxColor || '#0D0C0C' })
        b.object({ cx, cy, size, rotation, flipX, href: o.src, tile: false, shadow: shadow && !extraFilter, opacity, extraFilter })
      }
      continue
    }
    const icon = ICONS_BY_ID[o.iconId]
    if (!icon) continue
    const tint = o.tint === 'accent' ? accent : (o.tint || null)
    if (o.style === 'plain') {
      // trazos y marcas: sin tile, sin sombra y con grosor de trazo ajustable
      // antes: shadow forzada a false en los trazos → el toggle no hacía nada
      b.object({ cx, cy, size, rotation, flipX, href: coloredIcon(icon.url, tint || icon.color, o.sw || 1), tile: false, shadow, opacity })
    } else {
      // tile app-icon: squircle color de marca + glifo blanco
      b.object({ cx, cy, size, rotation, flipX, href: coloredIcon(icon.url, '#FFFFFF'), tile: true, tileColor: o.tileColor || icon.color, shadow, opacity })
    }
  }
}

// ---- formas paramétricas (Bloque A: alto impacto) ----
function drawShape(b, { o, W, H, ref, accent, scheme }) {
  const size = ref * (o.scale || 0.3)
  const cx = W * (o.x ?? 0.5), cy = H * (o.y ?? 0.5)
  const rot = o.rotation || 0
  const flipX = !!o.flipX
  const color = o.tint === 'accent' ? accent : (o.tint || accent)
  const op = o.opacity ?? 1
  const swMul = o.sw || 1 // grosor de trazo ajustable por el usuario
  const hardShadow = o.shadow ? b.filter({ kind: 'hard', dx: ref * 0.012, dy: ref * 0.012, color: '#0D0C0C', opacity: 0.9 }) : null
  const g = { rotation: rot, cx, cy, flipX, opacity: op }

  if (o.shape === 'arrow' || o.shape === 'handArrow') {
    const w = size, h = size * 0.5
    const tx = cx - w / 2, ty = cy - h / 2
    if (o.shape === 'arrow') {
      b.path({ d: arrowPath(w, h), fill: color, tx, ty, ...g, filterId: hardShadow })
    } else {
      const { body, head } = handArrowPath(w, h)
      const sw = Math.max(3, ref * 0.012 * swMul)
      b.path({ d: body, stroke: color, sw, tx, ty, ...g, filterId: hardShadow })
      b.path({ d: head, stroke: color, sw, tx, ty, ...g, filterId: hardShadow })
    }
    return
  }
  if (o.shape === 'sparkle') {
    b.path({ d: sparklePath(size / 2), fill: color, tx: cx, ty: cy, ...g, filterId: hardShadow })
    return
  }
  if (o.shape === 'badge') {
    const txt = String(o.text || 'NUEVO').toUpperCase()
    const px = size * 0.26
    const w = measure(txt, { px, weight: 800, tracking: 0.06 }) + px * 1.5
    const h = px * 2
    const solid = o.style !== 'outline'
    // la etiqueta ignoraba rotación y reflejo: los controles estaban y no
    // hacían nada. Se dibuja como path para poder girarla entera.
    b.path({ d: roundRect(cx - w / 2, cy - h / 2, w, h, h / 2), fill: solid ? color : 'none',
      stroke: solid ? null : color, sw: Math.max(2, ref * 0.006 * swMul), ...g, filterId: hardShadow })
    b.text({ x: cx, y: cy - px * 0.62, lines: [txt], px, weight: 800, tracking: 0.06,
      fill: solid ? contrastOn(color) : color, anchor: 'middle', opacity: op, rotation: rot, rcx: cx, rcy: cy })
    return
  }
  if (o.shape === 'bars') {
    const vals = o.values || [3, 5, 4, 7, 9]
    const w = size, h = size * 0.62
    const x0 = cx - w / 2, y0 = cy - h / 2
    // Tres cosas estaban mal acá y me las comí en el barrido anterior porque
    // comparaba strings de SVG: el filtro de sombra se CREA aunque no se
    // aplique, así que el string cambiaba y el test daba verde.
    //   1. ninguna de las dos capas llevaba filterId → la sombra no se veía
    //   2. el color pintaba sólo la última barra (el resto usaba el gris del
    //      esquema, así que el swatch parecía no hacer nada)
    //   3. `...g` iba DESPUÉS de opacity y lo pisaba → el atenuado se perdía
    const rects = barsRects(w, h, vals)
    const dResto = rects.slice(0, -1).map((r) => roundRect(x0 + r.x, y0 + r.y, r.w, r.h, r.rx)).join(' ')
    const ultima = rects[rects.length - 1]
    if (dResto) b.path({ d: dResto, fill: color, ...g, opacity: 0.42 * op, filterId: hardShadow })
    if (ultima) b.path({ d: roundRect(x0 + ultima.x, y0 + ultima.y, ultima.w, ultima.h, ultima.rx), fill: color, ...g, opacity: op, filterId: hardShadow })
    return
  }
  if (o.shape === 'sparkline') {
    const vals = o.values || [2, 3, 3, 5, 4, 7, 9]
    const w = size, h = size * 0.5
    const x0 = cx - w / 2, y0 = cy - h / 2
    const { line, last } = sparkline(w, h, vals)
    b.path({ d: line, stroke: color, sw: Math.max(3, ref * 0.01 * swMul), tx: x0, ty: y0, ...g, filterId: hardShadow })
    b.path({ d: roundRect(x0 + last[0] - ref * 0.012, y0 + last[1] - ref * 0.012, ref * 0.024, ref * 0.024, ref * 0.012), fill: color, ...g })
    return
  }
  if (o.shape === 'window') {
    // A6 · la "prueba visual": una captura dentro de un marco de ventana.
    // La foto entra sola abajo de la barra; sin foto queda el esqueleto.
    const w = size, h = w * (o.ratio || 0.62)
    const x0 = cx - w / 2, y0 = cy - h / 2
    const barH = Math.max(ref * 0.018, h * 0.1)
    const r = ref * 0.014
    const soft = o.shadow !== false ? b.filter({ kind: 'soft', r: ref * 0.02, dy: ref * 0.012, opacity: 0.32 }) : null
    // el color elegido pinta el marco (antes las swatches no hacían nada)
    const marco = o.fill || color || '#FFFFFF'
    const cromo = contrastOn(marco) === '#0D0C0C' ? '#D8DBDE' : 'rgba(255,255,255,.35)'
    b.path({ d: roundRect(x0, y0, w, h, r), fill: marco, rotation: rot, cx, cy, flipX, opacity: op, filterId: soft })
    b.framedImage({
      cx, cy: y0 + barH + (h - barH) / 2, w: w - ref * 0.006, h: h - barH - ref * 0.004,
      rotation: rot, flipX, href: o.src, natural: o.natural, focal: o.focal || { x: 0.5, y: 0.5 },
      radius: r * 0.5, zoom: o.zoom || 1, opacity: op,
    })
    // 7 · el chrome también rota: antes el marco giraba y los puntitos no
    const dCromo = windowChrome(w, barH).map((c) => roundRect(x0 + c.cx - c.r, y0 + c.cy - c.r, c.r * 2, c.r * 2, c.r)).join(' ')
    b.path({ d: dCromo, fill: cromo, rotation: rot, cx, cy, flipX, opacity: op })
    if (o.text) {
      const px = barH * 0.5
      b.text({ x: cx, y: y0 + (barH - px) / 2 - px * 0.05, lines: [String(o.text)], px, weight: 600,
        fill: contrastOn(marco) === '#0D0C0C' ? '#8A9096' : 'rgba(255,255,255,.7)', anchor: 'middle',
        opacity: op, rotation: rot, rcx: cx, rcy: cy })
    }
    return
  }
  if (o.shape === 'callout') {
    // el bocadillo se ajusta AL TEXTO (como una burbuja de verdad): el ancho
    // lo fija el usuario con el tamaño, el alto sale de las líneas que entran.
    const w = size
    const px = w * 0.115
    const padX = w * 0.09, padY = w * 0.075
    const txt = String(o.text || '').trim()
    const lines = txt ? wrapText(txt, { px, weight: 600, maxWidth: w - padX * 2 }) : []
    const lh = 1.28
    // se descuenta medio interlineado: si no, el aire de abajo se ve mayor
    const h = Math.max(w * 0.42, lines.length * px * lh + padY * 2 - px * (lh - 1) * 0.5)
    const x0 = cx - w / 2, y0 = cy - h / 2
    const soft = o.shadow ? b.filter({ kind: 'soft', r: ref * 0.012, dy: ref * 0.008, opacity: 0.28 }) : null
    // el color elegido pinta la burbuja (antes se ignoraba y siempre salía
    // blanca) y el texto se adapta para que se lea
    const burbuja = o.fill || color || '#FFFFFF'
    b.path({ d: calloutPath(w, h, { r: w * 0.09 }), fill: burbuja, tx: x0, ty: y0, ...g, filterId: soft })
    if (lines.length) {
      b.text({ x: x0 + padX, y: y0 + padY, lines, px, weight: 600, fill: contrastOn(burbuja), lineHeight: lh, opacity: op })
    }
    return
  }
}
function roundRect(x, y, w, h, r) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
}

function drawLogo(b, { p, W, H, safe, ref, hAnchor, vAnchor, plateRect }) {
  const wm = WORDMARKS[p.logo] || WORDMARKS.cream
  const logoUrl = getAsset(wm.url)
  if (!logoUrl) return
  const lw = ref * 0.2 * (p.logoScale || 1)
  const lh = lw / WORDMARK_RATIO
  const onRight = p.logoPos === 'right'
  // B4 · con banda, el logo va ADENTRO de la placa, del lado libre (hoy
  // flotaba aparte y la pieza se leía como dos cosas pegadas). Sólo si el
  // texto no llega hasta ahí: nunca se pisan.
  if (plateRect && p.plate === 'band' && hAnchor !== 'center'
      && safe.x + plateRect.textW + lw + ref * 0.06 <= W - safe.x) {
    b.asset({ x: W - safe.x - lw, y: plateRect.y + (plateRect.h - lh) / 2, w: lw, h: lh, href: logoUrl })
    return
  }
  // vertical: opuesto al stack de texto; horizontal: elegido por el usuario
  const lx = onRight ? W - safe.x - lw : safe.x
  const ly = vAnchor === 'top' ? safe.y + safe.h - lh : safe.y
  b.asset({ x: lx, y: ly, w: lw, h: lh, href: logoUrl })
}
