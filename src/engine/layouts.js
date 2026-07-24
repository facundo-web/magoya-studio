// ============================================================
// LAYOUTS — composición responsiva por template.
// Un template declara: superficie (foto|solid), ancla del stack de
// texto, qué roles muestra, y toggles (motivo, zócalo, tratamiento).
// El engine reflowa a cualquier formato usando el rect seguro.
// Reglas de arte Magoya: equilibrio negro↔verde, foto B&N + acento,
// Manrope, marcas sutiles. Nunca un lienzo en blanco.
// ============================================================

import { safeRect } from '../formats/registry.js'
import { COLOR_SCHEMES, DEFAULT_SCHEME, ACCENTS, TEXT_STYLES, WORDMARKS, CLIENT_LOGOS, WORDMARK_RATIO, MOTIF_ESTRATOS, GRADIENTS, FONT_HAND_STACK, HIGHLIGHTS } from '../brand/brandKit.js'
import { ICONS_BY_ID } from '../brand/iconLibrary.js'
import { getAsset, coloredIcon } from './assets.js'
import { fitText, measure } from './textLayout.js'

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
    clientLogo: c.clientLogo || d.clientLogo || 'none',
    treatment: c.treatment || d.treatment || 'bw',
    photo: c.photo || null,
    gradient: c.gradient !== undefined ? c.gradient : d.gradient || null,
    objects: c.objects || d.objects || [],
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
  drawObjects(b, { objects: (p.objects || []).filter((o) => !o.front), W, H, ref, accent: p.accent })

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
  drawObjects(b, { objects: (p.objects || []).filter((o) => o.front), W, H, ref, accent: p.accent })
}

function drawObjects(b, { objects, W, H, ref, accent }) {
  for (const o of objects || []) {
    const size = ref * (o.scale || 0.28)
    const cx = W * (o.x ?? 0.72)
    const cy = H * (o.y ?? 0.5)
    const rotation = o.rotation || 0
    const shadow = o.shadow !== false
    const opacity = o.opacity ?? 1
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
        b.object({ cx, cy, size, rotation, href: o.src, tile: false, shadow, opacity })
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

  // logo de cliente del lado opuesto al de Magoya (si hay)
  const cl = CLIENT_LOGOS[p.clientLogo]
  if (cl && cl.url) {
    const clUrl = getAsset(cl.url)
    if (clUrl) {
      const ch = lh * 1.1
      const cw = ch * 2.4
      const cx = onRight ? safe.x : W - safe.x - cw
      b.asset({ x: cx, y: ly, w: cw, h: ch, href: clUrl })
    }
  }
}
