// ============================================================
// SVG SERIALIZER — primitivas → string SVG.
// Fuente única de la pieza: un <svg> con <image> (fotos/logos),
// <rect> (zócalos/scrim) y <text> (con tracking manual).
// ============================================================

import { FONT_STACK } from '../brand/brandKit.js'

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Builder acumula defs + body
export function createBuilder() {
  const defs = []
  const body = []
  let uid = 0
  const id = (p) => `${p}${uid++}`
  return {
    defs,
    body,
    id,
    rect({ x, y, w, h, fill, rx = 0, opacity = 1 }) {
      body.push(
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(rx)}" fill="${fill}" opacity="${opacity}"/>`
      )
    },
    // gradiente lineal (scrim de legibilidad)
    scrim({ x, y, w, h, dir = 'bottom', from = 'rgba(0,0,0,0)', to = 'rgba(0,0,0,0.72)' }) {
      const gid = id('scrim')
      // dir bottom → oscuro abajo
      const coords =
        dir === 'bottom'
          ? 'x1="0" y1="0" x2="0" y2="1"'
          : dir === 'top'
          ? 'x1="0" y1="1" x2="0" y2="0"'
          : 'x1="0" y1="0" x2="1" y2="0'
      defs.push(
        `<linearGradient id="${gid}" ${coords}><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`
      )
      body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${gid})"/>`)
    },
    // imagen con cover + focal point + B&N opcional
    imageCover({ x, y, w, h, href, natural, focal = { x: 0.5, y: 0.5 }, grayscale = false }) {
      if (!href) {
        // esqueleto estático (acá va una foto): fondo neutro + pictograma
        this.rect({ x, y, w, h, fill: '#DAD5CC' })
        const s = Math.min(w, h)
        const cx = x + w / 2, cy = y + h / 2
        // sol + montañas (glifo universal de imagen)
        body.push(`<circle cx="${n(cx - s * 0.1)}" cy="${n(cy - s * 0.12)}" r="${n(s * 0.055)}" fill="#B9B3A6"/>`)
        body.push(`<path d="M ${n(cx - s * 0.22)} ${n(cy + s * 0.14)} L ${n(cx - s * 0.06)} ${n(cy - s * 0.03)} L ${n(cx + s * 0.05)} ${n(cy + 0.07 * s)} L ${n(cx + s * 0.13)} ${n(cy - s * 0.01)} L ${n(cx + s * 0.22)} ${n(cy + s * 0.14)} Z" fill="#B9B3A6"/>`)
        body.push(`<rect x="${n(cx - s * 0.26)}" y="${n(cy - s * 0.2)}" width="${n(s * 0.52)}" height="${n(s * 0.38)}" rx="${n(s * 0.03)}" fill="none" stroke="#B9B3A6" stroke-width="${n(Math.max(2, s * 0.012))}"/>`)
        return
      }
      const clipId = id('clip')
      defs.push(`<clipPath id="${clipId}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`)
      let filterAttr = ''
      if (grayscale) {
        const fId = id('bw')
        defs.push(
          `<filter id="${fId}"><feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/></filter>`
        )
        filterAttr = ` filter="url(#${fId})"`
      }
      let ix = x
      let iy = y
      let iw = w
      let ih = h
      if (natural && natural.w && natural.h) {
        const scale = Math.max(w / natural.w, h / natural.h)
        iw = natural.w * scale
        ih = natural.h * scale
        ix = x - (iw - w) * focal.x
        iy = y - (ih - h) * focal.y
      }
      const par = natural ? 'none' : 'xMidYMid slice'
      body.push(
        `<g clip-path="url(#${clipId})"${filterAttr}><image href="${href}" x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" preserveAspectRatio="${par}"/></g>`
      )
    },
    // imagen de asset (logo/motivo), fit contain
    asset({ x, y, w, h, href, opacity = 1 }) {
      if (!href) return
      body.push(
        `<image href="${href}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}"/>`
      )
    },
    // degradé overlay a pantalla completa (por encima del fondo)
    gradientOverlay({ w, h, angle = 180, stops, opacity = 1 }) {
      const gid = id('grad')
      // ángulo → vector (0=arriba→abajo? usamos 180 = abajo)
      const rad = ((angle - 90) * Math.PI) / 180
      const x1 = 0.5 - Math.cos(rad) / 2
      const y1 = 0.5 - Math.sin(rad) / 2
      const x2 = 0.5 + Math.cos(rad) / 2
      const y2 = 0.5 + Math.sin(rad) / 2
      const stopsSvg = stops
        .map((s) => `<stop offset="${s.at}" stop-color="${s.color}" stop-opacity="${s.opacity ?? 1}"/>`)
        .join('')
      defs.push(
        `<linearGradient id="${gid}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${stopsSvg}</linearGradient>`
      )
      body.push(`<rect x="0" y="0" width="${n(w)}" height="${n(h)}" fill="url(#${gid})" opacity="${opacity}"/>`)
    },
    // objeto flotante: ícono en "tile" (app-icon) o imagen, con sombra + rotación
    object({ cx, cy, size, rotation = 0, href, tile = false, tileColor = '#000', tileRadius = 0.22, shadow = true, iconInset = 0.22, opacity = 1 }) {
      if (!href) return
      const half = size / 2
      const x = cx - half
      const y = cy - half
      let filterAttr = ''
      if (shadow) {
        const fId = id('sh')
        const blur = size * 0.06
        defs.push(
          `<filter id="${fId}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="${n(size * 0.05)}" stdDeviation="${n(blur)}" flood-color="#000000" flood-opacity="0.35"/></filter>`
        )
        filterAttr = ` filter="url(#${fId})"`
      }
      const transform = rotation ? ` transform="rotate(${n(rotation)} ${n(cx)} ${n(cy)})"` : ''
      const op = opacity < 1 ? ` opacity="${opacity}"` : ''
      let inner = ''
      if (tile) {
        const r = size * tileRadius
        const pad = size * iconInset
        inner =
          `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(r)}" fill="${tileColor}"/>` +
          `<image href="${href}" x="${n(x + pad)}" y="${n(y + pad)}" width="${n(size - pad * 2)}" height="${n(size - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`
      } else {
        inner = `<image href="${href}" x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" preserveAspectRatio="xMidYMid meet"/>`
      }
      body.push(`<g${transform}${filterAttr}${op}>${inner}</g>`)
    },
    // imagen enmascarada en un marco rectangular (pantalla/mockup)
    framedImage({ cx, cy, w, h, rotation = 0, href, natural, focal = { x: 0.5, y: 0.5 }, radius = 0, zoom = 1, shadow = false, opacity = 1 }) {
      if (!href) return
      const x = cx - w / 2
      const y = cy - h / 2
      const clipId = id('fclip')
      defs.push(`<clipPath id="${clipId}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(radius)}"/></clipPath>`)
      let filterAttr = ''
      if (shadow) {
        const fId = id('fsh')
        defs.push(`<filter id="${fId}" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${n(h * 0.03)}" stdDeviation="${n(Math.min(w, h) * 0.04)}" flood-color="#000000" flood-opacity="0.35"/></filter>`)
        filterAttr = ` filter="url(#${fId})"`
      }
      let ix = x, iy = y, iw = w, ih = h
      if (natural && natural.w && natural.h) {
        const scale = Math.max(w / natural.w, h / natural.h) * zoom
        iw = natural.w * scale
        ih = natural.h * scale
        ix = x - (iw - w) * focal.x
        iy = y - (ih - h) * focal.y
      }
      const par = natural ? 'none' : 'xMidYMid slice'
      const transform = rotation ? ` transform="rotate(${n(rotation)} ${n(cx)} ${n(cy)})"` : ''
      const op = opacity < 1 ? ` opacity="${opacity}"` : ''
      body.push(
        `<g${transform}${filterAttr}${op}><g clip-path="url(#${clipId})"><image href="${href}" x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" preserveAspectRatio="${par}"/></g></g>`
      )
    },
    // texto multilínea con tracking
    text({ x, y, lines, px, weight = 400, fill, anchor = 'start', tracking = 0, lineHeight = 1.15, fontFamily = FONT_STACK, eid = null }) {
      const ls = tracking * px
      const tspans = lines
        .map((ln, i) => `<tspan x="${n(x)}" dy="${i === 0 ? 0 : n(px * lineHeight)}">${esc(ln)}</tspan>`)
        .join('')
      const eidAttr = eid ? ` data-eid="${esc(eid)}"` : ''
      body.push(
        `<text${eidAttr} x="${n(x)}" y="${n(y + px * 0.8)}" font-family="${fontFamily}" font-size="${n(px)}" font-weight="${weight}" letter-spacing="${n(ls)}" fill="${fill}" text-anchor="${anchor}" style="white-space:pre">${tspans}</text>`
      )
    },
  }
}

function n(v) {
  return Math.round((Number(v) + Number.EPSILON) * 100) / 100
}

// arma el documento SVG completo
export function svgDoc({ w, h, builder, fontFaceCss = '' }) {
  const defs = builder.defs.join('')
  const style = fontFaceCss ? `<style>${fontFaceCss}</style>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    style +
    (defs ? `<defs>${defs}</defs>` : '') +
    builder.body.join('') +
    `</svg>`
  )
}
