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

export function resolvePiece(template, content) {
  const d = template.defaults || {}
  const c = content || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = (ACCENTS[c.accent || d.accent] || { value: scheme.accent }).value
  const freeform = !!template.freeform
  // en freeform el fondo lo decide el usuario (color/foto)
  const bg = c.bg || d.bg || 'color'
  return {
    scheme,
    accent,
    freeform,
    surface: freeform ? (bg === 'photo' ? 'photo' : 'solid') : (template.surface || (d.hasPhoto ? 'photo' : 'solid')),
    anchor: c.anchor || template.anchor || 'bottom-left',
    motif: freeform ? false : template.motif !== false,
    zocalo: template.zocalo || false,
    roles: template.roles || (freeform ? [] : ['kicker', 'title', 'subtitle']),
    textBlocks: c.textBlocks || d.textBlocks || [],
    showLogo: c.showLogo !== undefined ? c.showLogo : d.showLogo !== false,
    logoPos: c.logoPos || d.logoPos || 'left',
    logoScale: c.logoScale || d.logoScale || 1,
    logo: c.logo || d.logo || 'cream',
    treatment: c.treatment || d.treatment || 'bw',
    photo: c.photo || null,
    gradient: c.gradient !== undefined ? c.gradient : d.gradient || null,
    objects: c.objects || d.objects || [],
    steps: c.steps || d.steps || [],
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

// dibuja la pieza en el builder
export function drawPiece(b, { template, content, format }) {
  if (template.category === 'chat') { drawChat(b, { template, content, format }); return }
  const p = resolvePiece(template, content)
  const { w: W, h: H } = format
  const safe = safeRect(format)
  const ref = Math.min(W, H)
  const onPhoto = p.surface === 'photo'
  const textColor = onPhoto ? '#FFFFFF' : p.scheme.onSurface
  const mutedColor = onPhoto ? 'rgba(255,255,255,.82)' : p.scheme.muted

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
  const maxTextW = safe.w * (onPhoto ? 0.92 : 0.8)
  const pushBlock = (role, txt, opts = {}) => {
    if (txt === undefined || txt === null || String(txt).trim() === '') return
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const hand = role === 'kicker' && p.handAccent
    const startPx = ref * st.sizeRel * (hand ? 1.9 : 1)
    const value = (st.upper && !hand) ? String(txt).toUpperCase() : String(txt)
    const maxLines = role === 'title' || role === 'quote' ? 4 : role === 'kicker' || role === 'cta' ? 1 : 3
    const fit = fitText(value, {
      weight: hand ? 700 : st.weight, tracking: hand ? 0 : (st.tracking || 0),
      maxWidth: maxTextW, maxHeight: H * 0.5, startPx,
      lineHeight: st.lineHeight || 1.15, maxLines,
    })
    blocks.push({ role, st, value, px: fit.px, lines: fit.lines, lineHeight: st.lineHeight || 1.15, hand, hl: opts.hl || null, eid: opts.eid || null })
  }
  // roles de la plantilla (piezas clásicas)
  for (const role of STACK_ORDER) {
    if (p.roles.includes(role)) pushBlock(role, p.text[role], { eid: `role:${role}` })
  }
  // bloques de texto sumados por el usuario (freeform / componentes)
  p.textBlocks.forEach((tb, idx) => {
    pushBlock(tb.style || 'title', tb.text, { hl: (HIGHLIGHTS[tb.highlight] || {}).value, eid: `tb:${idx}` })
  })
  // pasos numerados (plantilla "método")
  ;(p.steps || []).forEach((st, idx) => {
    if (String(st || '').trim()) pushBlock('step', `${String(idx + 1).padStart(2, '0')}  ${st}`, { eid: `step:${idx}` })
  })

  // altura total del stack (con gaps proporcionales)
  const gap = ref * 0.022
  let stackH = 0
  blocks.forEach((bl, i) => {
    stackH += bl.lines.length * bl.px * bl.lineHeight
    if (i < blocks.length - 1) stackH += gap
  })

  // posición del stack según ancla
  const [vAnchor, hAnchor] = p.anchor.split('-')
  let cursorY
  if (vAnchor === 'bottom') cursorY = safe.y + safe.h - stackH
  else if (vAnchor === 'center') cursorY = safe.y + (safe.h - stackH) / 2
  else cursorY = safe.y + (onPhoto ? 0 : safe.h * 0.12)
  const textX = hAnchor === 'center' ? W / 2 : safe.x
  const textAnchor = hAnchor === 'center' ? 'middle' : 'start'

  // zócalo (placa) detrás del stack si aplica
  if (p.zocalo && onPhoto) {
    const pad = ref * 0.045
    b.rect({
      x: 0, y: cursorY - pad, w: W, h: H - (cursorY - pad),
      fill: p.scheme.surface, opacity: 0.9,
    })
    // regla de acento arriba de la placa
    b.rect({ x: safe.x, y: cursorY - pad, w: ref * 0.12, h: Math.max(3, ref * 0.006), fill: p.accent })
  } else if (onPhoto) {
    // scrim de legibilidad
    b.scrim({ x: 0, y: H * 0.4, w: W, h: H * 0.6, dir: 'bottom', to: 'rgba(0,0,0,0.68)' })
  } else {
    // acento sutil arriba del stack (rule) en solid
    b.rect({ x: hAnchor === 'center' ? W / 2 - ref * 0.06 : safe.x, y: cursorY - gap, w: ref * 0.12, h: Math.max(3, ref * 0.006), fill: p.accent })
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
    cursorY += bl.lines.length * lineH + gap + (isCta ? bl.px * 0.5 : 0)
  }

  // ---- logo ----
  if (p.showLogo) drawLogo(b, { p, W, H, safe, ref, textAnchor, hAnchor, vAnchor })

  // ---- objetos DELANTE del texto (profundidad) ----
  drawObjects(b, { objects: (p.objects || []).filter((o) => o.front), W, H, ref, accent: p.accent, scheme: p.scheme })
}

// ---- renderer de chat (WhatsApp) ----
function drawChat(b, { template, content, format }) {
  const { w: W, h: H } = format
  const ref = Math.min(W, H)
  const c = content || {}
  const d = template.defaults || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = (ACCENTS[c.accent || d.accent] || { value: scheme.accent }).value
  const messages = c.messages || d.messages || []
  const chatName = c.chatName ?? d.chatName ?? 'Magoya'
  const chatStatus = c.chatStatus ?? d.chatStatus ?? 'en línea'

  // fondo de marca
  b.rect({ x: 0, y: 0, w: W, h: H, fill: scheme.surface })

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
}

function drawObjects(b, { objects, W, H, ref, accent, scheme }) {
  for (const o of objects || []) {
    // ---- FORMAS generativas (flecha, sparkle, badge, barras, bocadillo) ----
    if (o.kind === 'shape') { drawShape(b, { o, W, H, ref, accent, scheme }); continue }
    const size = ref * (o.scale || 0.28)
    const cx = W * (o.x ?? 0.72)
    const cy = H * (o.y ?? 0.5)
    const rotation = o.rotation || 0
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
          w: sc.w * dw, h: sc.h * dh, rotation, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: sc.r * sc.w * dw, zoom: o.zoom || 1, shadow: false, opacity,
        })
      } else {
        b.framedImage({ cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh, w: sc.w * dw, h: sc.h * dh, rotation, href: null, radius: sc.r * sc.w * dw })
      }
      // 2) marco del dispositivo encima
      const frameUrl = getAsset(dev.url) || dev.url
      b.object({ cx, cy, size: dw, rotation, href: frameUrl, tile: false, shadow, opacity, aspect: 1 / (sc.ratio || 1) })
      continue
    }
    if (o.kind === 'image' && o.src) {
      if (o.frame) {
        // imagen enmascarada en un marco (pantalla/mockup)
        const fw = ref * (o.scale || 0.4)
        const fh = fw * (o.ratio || 0.6)
        b.framedImage({
          cx, cy, w: fw, h: fh, rotation, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: (o.radius || 0) * Math.min(fw, fh),
          zoom: o.zoom || 1, shadow, opacity,
        })
      } else {
        // efectos del recorte: contorno / glow / sombra dura
        let extraFilter = null
        if (o.fx === 'outline') extraFilter = b.filter({ kind: 'outline', r: ref * 0.008, color: o.fxColor || '#FFFFFF' })
        else if (o.fx === 'glow') extraFilter = b.filter({ kind: 'glow', r: ref * 0.05, color: o.fxColor || accent, opacity: 0.85 })
        else if (o.fx === 'hard') extraFilter = b.filter({ kind: 'hard', dx: ref * 0.018, dy: ref * 0.018, color: o.fxColor || '#0D0C0C' })
        b.object({ cx, cy, size, rotation, href: o.src, tile: false, shadow: shadow && !extraFilter, opacity, extraFilter })
      }
      continue
    }
    const icon = ICONS_BY_ID[o.iconId]
    if (!icon) continue
    const tint = o.tint === 'accent' ? accent : (o.tint || null)
    if (o.style === 'plain') {
      b.object({ cx, cy, size, rotation, href: coloredIcon(icon.url, tint || icon.color), tile: false, shadow: icon.isMark ? false : shadow, opacity })
    } else {
      // tile app-icon: squircle color de marca + glifo blanco
      b.object({ cx, cy, size, rotation, href: coloredIcon(icon.url, '#FFFFFF'), tile: true, tileColor: o.tileColor || icon.color, shadow, opacity })
    }
  }
}

// ---- formas paramétricas (Bloque A: alto impacto) ----
function drawShape(b, { o, W, H, ref, accent, scheme }) {
  const size = ref * (o.scale || 0.3)
  const cx = W * (o.x ?? 0.5), cy = H * (o.y ?? 0.5)
  const rot = o.rotation || 0
  const color = o.tint === 'accent' ? accent : (o.tint || accent)
  const op = o.opacity ?? 1
  const shadowF = o.shadow ? b.filter({ kind: 'hard', dx: ref * 0.012, dy: ref * 0.012, color: '#0D0C0C', opacity: 0.9 }) : null

  if (o.shape === 'arrow' || o.shape === 'handArrow') {
    const w = size, h = size * 0.5
    if (o.shape === 'arrow') {
      const d = arrowPath(w, h)
      b.path({ d: shiftPath(d, cx - w / 2, cy - h / 2), fill: color, rotation: rot, cx, cy, opacity: op, filterId: shadowF })
    } else {
      const { body, head } = handArrowPath(w, h)
      const sw = Math.max(3, ref * 0.012)
      b.path({ d: shiftPath(body, cx - w / 2, cy - h / 2), stroke: color, sw, rotation: rot, cx, cy, opacity: op })
      b.path({ d: shiftPath(head, cx - w / 2, cy - h / 2), stroke: color, sw, rotation: rot, cx, cy, opacity: op })
    }
    return
  }
  if (o.shape === 'sparkle') {
    b.path({ d: shiftPath(sparklePath(size / 2), cx, cy), fill: color, rotation: rot, cx, cy, opacity: op })
    return
  }
  if (o.shape === 'badge') {
    const txt = String(o.text || 'NUEVO').toUpperCase()
    const px = size * 0.26
    const w = measure(txt, { px, weight: 800, tracking: 0.06 }) + px * 1.5
    const h = px * 2
    const solid = o.style !== 'outline'
    b.rect({ x: cx - w / 2, y: cy - h / 2, w, h, rx: h / 2, fill: solid ? color : 'none' })
    if (!solid) b.path({ d: roundRect(cx - w / 2, cy - h / 2, w, h, h / 2), stroke: color, sw: Math.max(2, ref * 0.006) })
    b.text({ x: cx, y: cy - px * 0.62, lines: [txt], px, weight: 800, tracking: 0.06,
      fill: solid ? contrastOn(color) : color, anchor: 'middle' })
    return
  }
  if (o.shape === 'bars') {
    const vals = o.values || [3, 5, 4, 7, 9]
    const w = size, h = size * 0.62
    const x0 = cx - w / 2, y0 = cy - h / 2
    barsRects(w, h, vals).forEach((r, i) => {
      b.rect({ x: x0 + r.x, y: y0 + r.y, w: r.w, h: r.h, rx: r.rx,
        fill: i === vals.length - 1 ? color : (scheme?.muted || color), opacity: i === vals.length - 1 ? 1 : 0.45 })
    })
    return
  }
  if (o.shape === 'sparkline') {
    const vals = o.values || [2, 3, 3, 5, 4, 7, 9]
    const w = size, h = size * 0.5
    const x0 = cx - w / 2, y0 = cy - h / 2
    const { line, last } = sparkline(w, h, vals)
    b.path({ d: shiftPath(line, x0, y0), stroke: color, sw: Math.max(3, ref * 0.01) })
    b.rect({ x: x0 + last[0] - ref * 0.012, y: y0 + last[1] - ref * 0.012, w: ref * 0.024, h: ref * 0.024, rx: ref * 0.012, fill: color })
    return
  }
  if (o.shape === 'callout') {
    const w = size, h = size * 0.62
    const x0 = cx - w / 2, y0 = cy - h / 2
    b.path({ d: shiftPath(calloutPath(w, h, { r: ref * 0.03 }), x0, y0), fill: o.fill || '#FFFFFF', filterId: shadowF })
    if (o.text) {
      const px = size * 0.09
      const lines = wrapText(String(o.text), { px, weight: 600, maxWidth: w * 0.84 })
      b.text({ x: x0 + w * 0.08, y: y0 + h * 0.2, lines, px, weight: 600, fill: '#0D0C0C', lineHeight: 1.3 })
    }
    return
  }
}
// desplaza un path (los generadores dibujan en origen 0,0)
function shiftPath(d, dx, dy) {
  return d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (m, x, y) => `${(+x + dx).toFixed(2)},${(+y + dy).toFixed(2)}`)
}
function roundRect(x, y, w, h, r) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
}

function drawLogo(b, { p, W, H, safe, ref, hAnchor, vAnchor }) {
  const wm = WORDMARKS[p.logo] || WORDMARKS.cream
  const logoUrl = getAsset(wm.url)
  if (!logoUrl) return
  const lw = ref * 0.2 * (p.logoScale || 1)
  const lh = lw / WORDMARK_RATIO
  // vertical: opuesto al stack de texto; horizontal: elegido por el usuario
  const onRight = p.logoPos === 'right'
  const lx = onRight ? W - safe.x - lw : safe.x
  const ly = vAnchor === 'top' ? safe.y + safe.h - lh : safe.y
  b.asset({ x: lx, y: ly, w: lw, h: lh, href: logoUrl })

}
