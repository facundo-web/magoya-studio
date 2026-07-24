// ============================================================
// LAYOUTS — composición responsiva por template.
// Un template declara: superficie (foto|solid), ancla del stack de
// texto, qué roles muestra, y toggles (motivo, zócalo, tratamiento).
// El engine reflowa a cualquier formato usando el rect seguro.
// Reglas de arte Magoya: equilibrio negro↔verde, foto B&N + acento,
// Manrope, marcas sutiles. Nunca un lienzo en blanco.
// ============================================================

import { safeRect } from '../formats/registry.js'
import { COLOR_SCHEMES, DEFAULT_SCHEME, ACCENTS, TEXT_STYLES, WORDMARKS, CLIENT_LOGOS, WORDMARK_RATIO, MOTIF_ESTRATOS, GRADIENTS } from '../brand/brandKit.js'
import { ICONS_BY_ID } from '../brand/iconLibrary.js'
import { getAsset, coloredIcon } from './assets.js'
import { fitText } from './textLayout.js'

// roles de texto en orden de stack
const STACK_ORDER = ['kicker', 'title', 'subtitle', 'body', 'metric', 'metricLabel', 'quote', 'author']

export function resolvePiece(template, content) {
  const d = template.defaults || {}
  const c = content || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = (ACCENTS[c.accent || d.accent] || { value: scheme.accent }).value
  return {
    scheme,
    accent,
    surface: template.surface || (d.hasPhoto ? 'photo' : 'solid'),
    anchor: template.anchor || 'bottom-left',
    motif: template.motif !== false,
    zocalo: template.zocalo || false,
    roles: template.roles || ['kicker', 'title', 'subtitle'],
    logo: c.logo || d.logo || 'cream',
    clientLogo: c.clientLogo || d.clientLogo || 'none',
    treatment: c.treatment || d.treatment || 'bw',
    photo: c.photo || null,
    gradient: c.gradient !== undefined ? c.gradient : d.gradient || null,
    objects: c.objects || d.objects || [],
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
  for (const role of STACK_ORDER) {
    if (!p.roles.includes(role)) continue
    const txt = p.text[role]
    if (txt === undefined || txt === null || String(txt).trim() === '') continue
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const startPx = ref * st.sizeRel
    const value = st.upper ? String(txt).toUpperCase() : String(txt)
    const maxLines = role === 'title' || role === 'quote' ? 4 : role === 'kicker' ? 1 : 3
    const fit = fitText(value, {
      weight: st.weight, tracking: st.tracking || 0,
      maxWidth: maxTextW, maxHeight: H * 0.5, startPx,
      lineHeight: st.lineHeight || 1.15, maxLines,
    })
    blocks.push({ role, st, value, px: fit.px, lines: fit.lines, lineHeight: st.lineHeight || 1.15 })
  }

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
  drawObjects(b, { objects: (p.objects || []).filter((o) => !o.front), W, H, ref })

  // dibujar bloques
  for (const bl of blocks) {
    const isKicker = bl.role === 'kicker'
    const isAccentRole = bl.role === 'metric'
    const fill = isKicker ? p.accent : isAccentRole ? p.accent : bl.role === 'author' || bl.role === 'subtitle' || bl.role === 'metricLabel' ? mutedColor : textColor
    b.text({
      x: textX, y: cursorY, lines: bl.lines, px: bl.px,
      weight: bl.st.weight, fill, anchor: textAnchor,
      tracking: bl.st.tracking || 0, lineHeight: bl.lineHeight,
    })
    cursorY += bl.lines.length * bl.px * bl.lineHeight + gap
  }

  // ---- logo ----
  drawLogo(b, { p, W, H, safe, ref, textAnchor, hAnchor, vAnchor })

  // ---- objetos DELANTE del texto (profundidad) ----
  drawObjects(b, { objects: (p.objects || []).filter((o) => o.front), W, H, ref })
}

function drawObjects(b, { objects, W, H, ref }) {
  for (const o of objects || []) {
    const size = ref * (o.scale || 0.28)
    const cx = W * (o.x ?? 0.72)
    const cy = H * (o.y ?? 0.5)
    const rotation = o.rotation || 0
    const shadow = o.shadow !== false
    if (o.kind === 'image' && o.src) {
      b.object({ cx, cy, size, rotation, href: o.src, tile: false, shadow })
      continue
    }
    const icon = ICONS_BY_ID[o.iconId]
    if (!icon) continue
    if (o.style === 'plain') {
      b.object({ cx, cy, size, rotation, href: coloredIcon(icon.url, icon.color), tile: false, shadow })
    } else {
      // tile app-icon: squircle color de marca + glifo blanco
      b.object({ cx, cy, size, rotation, href: coloredIcon(icon.url, '#FFFFFF'), tile: true, tileColor: o.tileColor || icon.color, shadow })
    }
  }
}

function drawLogo(b, { p, W, H, safe, ref, hAnchor, vAnchor }) {
  const wm = WORDMARKS[p.logo] || WORDMARKS.cream
  const logoUrl = getAsset(wm.url)
  if (!logoUrl) return
  const lw = ref * 0.2
  const lh = lw / WORDMARK_RATIO
  // logo arriba, opuesto verticalmente al stack de texto
  const lx = safe.x
  const ly = vAnchor === 'top' ? safe.y + safe.h - lh : safe.y
  b.asset({ x: lx, y: ly, w: lw, h: lh, href: logoUrl })

  // logo de cliente al lado (si hay)
  const cl = CLIENT_LOGOS[p.clientLogo]
  if (cl && cl.url) {
    const clUrl = getAsset(cl.url)
    if (clUrl) {
      const ch = lh * 1.1
      const cw = ch * 2.4
      b.asset({ x: W - safe.x - cw, y: ly, w: cw, h: ch, href: clUrl })
    }
  }
}
