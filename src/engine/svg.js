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

// Los ids de <defs> (filtros, clips, degradés) viven en el namespace del
// DOCUMENTO, no del <svg>: con varias piezas inline en la misma página
// (galería, tira de slides, fila de variantes) `url(#f0)` resolvía al defs
// de OTRA pieza, con coordenadas de otro tamaño. Cada builder usa su propio
// prefijo para que eso no pueda pasar.
let builderSeq = 0

// Builder acumula defs + body
export function createBuilder() {
  const defs = []
  const body = []
  let uid = 0
  const ns = (builderSeq++).toString(36) + '_'
  const id = (p) => `${p}${ns}${uid++}`
  const filterCache = new Map()
  return {
    defs,
    body,
    id,
    // ---- registro de filtros reutilizables (cache por spec) ----
    filter(spec) {
      const key = JSON.stringify(spec)
      if (filterCache.has(key)) return filterCache.get(key)
      const fid = id('f')
      let inner = ''
      const box = ' x="-50%" y="-50%" width="200%" height="200%"'
      if (spec.kind === 'hard') {
        // sombra dura tipo sticker (sin blur)
        inner = `<feDropShadow dx="${n(spec.dx ?? 12)}" dy="${n(spec.dy ?? 12)}" stdDeviation="0" flood-color="${spec.color || '#0D0C0C'}" flood-opacity="${spec.opacity ?? 1}"/>`
      } else if (spec.kind === 'glow') {
        inner = `<feDropShadow dx="0" dy="0" stdDeviation="${n(spec.r ?? 30)}" flood-color="${spec.color}" flood-opacity="${spec.opacity ?? .8}"/>` +
                `<feDropShadow dx="0" dy="0" stdDeviation="${n((spec.r ?? 30) * .4)}" flood-color="${spec.color}" flood-opacity="${(spec.opacity ?? .8) * .7}"/>`
      } else if (spec.kind === 'outline') {
        // contorno alrededor del recorte: lo que lo "pega" al fondo
        inner = `<feMorphology in="SourceAlpha" operator="dilate" radius="${n(spec.r ?? 8)}" result="d"/>` +
                `<feFlood flood-color="${spec.color || '#FFFFFF'}"/><feComposite in2="d" operator="in" result="ring"/>` +
                `<feMerge><feMergeNode in="ring"/><feMergeNode in="SourceGraphic"/></feMerge>`
      } else if (spec.kind === 'device') {
        // Sombra de objeto físico: NO es una sombra, son varias.
        // Una sola siempre se lee como ícono; lo que da la sensación de
        // volumen es el apilado (contacto duro cerca + halo amplio lejos).
        const k = spec.k || 1
        const capas = [[2, .15], [4, .12], [8, .10], [16, .07], [32, .05], [64, .04]]
        inner = capas.map(([blur, op], i) =>
          `<feDropShadow in="SourceAlpha" dx="0" dy="${n(blur * 0.5 * k)}" stdDeviation="${n(blur * 0.5 * k)}" flood-color="#000000" flood-opacity="${op}" result="s${i}"/>`
        ).join('') +
        `<feMerge>${capas.map((_, i) => `<feMergeNode in="s${i}"/>`).join('')}<feMergeNode in="SourceGraphic"/></feMerge>`
      } else if (spec.kind === 'soft') {
        inner = `<feDropShadow dx="0" dy="${n(spec.dy ?? 20)}" stdDeviation="${n(spec.r ?? 24)}" flood-color="#000" flood-opacity="${spec.opacity ?? .45}"/>`
      } else if (spec.kind === 'blur') {
        inner = `<feGaussianBlur stdDeviation="${n(spec.r ?? 16)}" edgeMode="duplicate"/>`
      } else if (spec.kind === 'dim') {
        const k = spec.k ?? 0.55
        inner = `<feComponentTransfer><feFuncR type="linear" slope="${k}"/><feFuncG type="linear" slope="${k}"/><feFuncB type="linear" slope="${k}"/></feComponentTransfer>`
      } else if (spec.kind === 'bw') {
        inner = `<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>`
      }
      defs.push(`<filter id="${fid}"${box}>${inner}</filter>`)
      filterCache.set(key, fid)
      return fid
    },
    // ---- path genérico (flechas, badges, formas paramétricas) ----
    // tx/ty trasladan el path: los generadores dibujan en el origen y acá se
    // ubican. Antes se reescribían los números del `d` con una regex, y eso
    // también movía los RADIOS de los arcos (A r,r …) → formas rotas.
    path({ d, fill = 'none', stroke = null, sw = 0, cap = 'round', join = 'round', rotation = 0, cx = 0, cy = 0, tx = 0, ty = 0, flipX = false, opacity = 1, filterId = null, evenodd = false }) {
      const parts = []
      if (rotation) parts.push(`rotate(${n(rotation)} ${n(cx)} ${n(cy)})`)
      if (flipX) parts.push(`translate(${n(2 * cx)} 0) scale(-1 1)`)
      if (tx || ty) parts.push(`translate(${n(tx)} ${n(ty)})`)
      const t = parts.length ? ` transform="${parts.join(' ')}"` : ''
      const f = filterId ? ` filter="url(#${filterId})"` : ''
      const st = stroke ? ` stroke="${stroke}" stroke-width="${n(sw)}" stroke-linecap="${cap}" stroke-linejoin="${join}"` : ''
      const fr = evenodd ? ' fill-rule="evenodd"' : ''
      const op = opacity < 1 ? ` opacity="${opacity}"` : ''
      body.push(`<g${t}${f}${op}><path d="${d}" fill="${fill}"${fr}${st}/></g>`)
    },
    // ---- viñeta (oscurece los bordes, sube el contraste del centro) ----
    vignette({ w, h, strength = 0.6 }) {
      const gid = id('vig')
      defs.push(
        `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${n(w / 2)}" cy="${n(h / 2)}" r="${n(Math.max(w, h) * 0.72)}">` +
        `<stop offset="0.5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${strength}"/></radialGradient>`
      )
      body.push(`<rect x="0" y="0" width="${n(w)}" height="${n(h)}" fill="url(#${gid})"/>`)
    },
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
          : 'x1="0" y1="0" x2="1" y2="0"'
      defs.push(
        `<linearGradient id="${gid}" ${coords}><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`
      )
      body.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${gid})"/>`)
    },
    // imagen con cover + focal point + B&N opcional
    imageCover({ x, y, w, h, href, natural, focal = { x: 0.5, y: 0.5 }, grayscale = false, dim = 0, blur = 0 }) {
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
      if (grayscale || dim > 0 || blur > 0) {
        const fId = id('tr')
        let fx = ''
        if (blur > 0) fx += `<feGaussianBlur stdDeviation="${n(blur)}" edgeMode="duplicate"/>`
        if (grayscale) fx += `<feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>`
        if (dim > 0) { const k = 1 - dim; fx += `<feComponentTransfer><feFuncR type="linear" slope="${k}"/><feFuncG type="linear" slope="${k}"/><feFuncB type="linear" slope="${k}"/></feComponentTransfer>` }
        defs.push(`<filter id="${fId}">${fx}</filter>`)
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
    object({ cx, cy, size, rotation = 0, flipX = false, href, tile = false, tileColor = '#000', tileRadius = 0.22, shadow = true, iconInset = 0.22, opacity = 1, aspect = 1, extraFilter = null }) {
      if (!href) return
      const w = size
      const h = size * aspect
      const x = cx - w / 2
      const y = cy - h / 2
      const half = size / 2
      let filterAttr = extraFilter ? ` filter="url(#${extraFilter})"` : ''
      if (shadow && !extraFilter) {
        const fId = id('sh')
        const blur = size * 0.06
        defs.push(
          `<filter id="${fId}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="${n(size * 0.05)}" stdDeviation="${n(blur)}" flood-color="#000000" flood-opacity="0.35"/></filter>`
        )
        filterAttr = ` filter="url(#${fId})"`
      }
      const tp = []
      if (rotation) tp.push(`rotate(${n(rotation)} ${n(cx)} ${n(cy)})`)
      if (flipX) tp.push(`translate(${n(2 * cx)} 0) scale(-1 1)`)
      const transform = tp.length ? ` transform="${tp.join(' ')}"` : ''
      const op = opacity < 1 ? ` opacity="${opacity}"` : ''
      let inner = ''
      if (tile) {
        const r = size * tileRadius
        const pad = size * iconInset
        inner =
          `<rect x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" rx="${n(r)}" fill="${tileColor}"/>` +
          `<image href="${href}" x="${n(x + pad)}" y="${n(y + pad)}" width="${n(size - pad * 2)}" height="${n(size - pad * 2)}" preserveAspectRatio="xMidYMid meet"/>`
      } else {
        // OJO: usa w×h, no size×size. Con `aspect` (dispositivos) el alto no
        // es el ancho: dibujarlo cuadrado dejaba el objeto centrado en otro
        // lado que su caja, y la selección quedaba corrida respecto al dibujo.
        inner = `<image href="${href}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="xMidYMid meet"/>`
      }
      body.push(`<g${transform}${filterAttr}${op}>${inner}</g>`)
    },
    // ---- REFLEJO DE PANTALLA ----
    // Dos capas: un "glint" con CORTE DURO (el borde neto es lo que el ojo
    // lee como vidrio; un degradé suave se lee como plástico) y un lavado
    // tenue en la diagonal opuesta. Va recortado a la pantalla.
    screenGlare({ cx, cy, w, h, radius = 0, rotation = 0, strength = 1 }) {
      if (w <= 0 || h <= 0) return
      const x = cx - w / 2, y = cy - h / 2
      const clipId = id('gclip')
      defs.push(`<clipPath id="${clipId}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${n(radius)}"/></clipPath>`)
      const gid = id('glint')
      defs.push(
        `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(-18 0.5 0.5)">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="${n(0.16 * strength)}"/>` +
        `<stop offset="0.35" stop-color="#FFFFFF" stop-opacity="${n(0.10 * strength)}"/>` +
        `<stop offset="0.3501" stop-color="#FFFFFF" stop-opacity="0"/>` +
        `</linearGradient>`
      )
      const wid = id('wash')
      defs.push(
        `<linearGradient id="${wid}" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#FFFFFF" stop-opacity="${n(0.07 * strength)}"/>` +
        `<stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>` +
        `</linearGradient>`
      )
      const t = rotation ? ` transform="rotate(${n(rotation)} ${n(cx)} ${n(cy)})"` : ''
      body.push(
        `<g${t} clip-path="url(#${clipId})">` +
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${wid})"/>` +
        `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="url(#${gid})"/>` +
        `</g>`
      )
    },
    // imagen enmascarada en un marco rectangular (pantalla/mockup)
    framedImage({ cx, cy, w, h, rotation = 0, flipX = false, href, natural, focal = { x: 0.5, y: 0.5 }, radius = 0, zoom = 1, shadow = false, opacity = 1 }) {
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
      const ftp = []
      if (rotation) ftp.push(`rotate(${n(rotation)} ${n(cx)} ${n(cy)})`)
      if (flipX) ftp.push(`translate(${n(2 * cx)} 0) scale(-1 1)`)
      const transform = ftp.length ? ` transform="${ftp.join(' ')}"` : ''
      const op = opacity < 1 ? ` opacity="${opacity}"` : ''
      body.push(
        `<g${transform}${filterAttr}${op}><g clip-path="url(#${clipId})"><image href="${href}" x="${n(ix)}" y="${n(iy)}" width="${n(iw)}" height="${n(ih)}" preserveAspectRatio="${par}"/></g></g>`
      )
    },
    // texto multilínea con tracking
    text({ x, y, lines, px, weight = 400, fill, anchor = 'start', tracking = 0, lineHeight = 1.15, fontFamily = FONT_STACK, eid = null, stroke = null, strokeW = null, filterId = null, rotation = 0, rcx = 0, rcy = 0, opacity = 1 }) {
      const ls = tracking * px
      const tspans = lines
        .map((ln, i) => `<tspan x="${n(x)}" dy="${i === 0 ? 0 : n(px * lineHeight)}">${esc(ln)}</tspan>`)
        .join('')
      const eidAttr = eid ? ` data-eid="${esc(eid)}"` : ''
      // stroke: paint-order evita que el borde se coma el glifo
      const stAttr = stroke ? ` paint-order="stroke fill" stroke="${stroke}" stroke-width="${n(strokeW ?? px * 0.09)}" stroke-linejoin="round"` : ''
      const fAttr = filterId ? ` filter="url(#${filterId})"` : ''
      // rotación opcional: la usa la etiqueta, que gira entera con su fondo
      const rAttr = rotation ? ` transform="rotate(${n(rotation)} ${n(rcx)} ${n(rcy)})"` : ''
      const oAttr = opacity < 1 ? ` opacity="${n(opacity)}"` : ''
      body.push(
        `<text${eidAttr} x="${n(x)}" y="${n(y + px * 0.8)}" font-family="${fontFamily}" font-size="${n(px)}" font-weight="${weight}" letter-spacing="${n(ls)}" fill="${fill}" text-anchor="${anchor}"${stAttr}${fAttr}${rAttr}${oAttr} style="white-space:pre">${tspans}</text>`
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
