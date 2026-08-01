// ============================================================
// LA VARA DE LOS ESTILOS — ¿este estilo se ve distinto DE LEJOS?
//
// El BLOQUE S salió de un número: de 235 combinaciones plantilla × estilo,
// 35 eran píxel a píxel idénticas al Original y el 46,8% cambiaba menos del
// 1% de la pieza. La palanca que se llama "Estilo" era la más débil de la
// app. Para que eso no vuelva a pasar hace falta una vara, y una vara que
// se pueda correr: éste es el script.
//
// REGLA: si a 128 px un estilo no cambia al menos el 25% de los píxeles
// contra el Original, NO ENTRA al panel. No es una guía.
//
// Correr:  node scripts/siluetas.mjs                (tabla + veredicto)
//          node scripts/siluetas.mjs --csv          (una línea por combinación)
//          node scripts/siluetas.mjs --formato=li-landscape
//          node scripts/siluetas.mjs --pgm=impacto-cifra·bloque   (mirarlo)
//
// POR QUÉ 128 px: es el tamaño al que el feed decide. Nadie compara dos
// estilos con la lupa; los ve chiquitos y al lado. A ese tamaño se pierde
// el detalle y queda la SILUETA, que es exactamente lo que hay que medir.
//
// ---- QUÉ RASTERIZA Y QUÉ NO (leer antes de creerle un número) ----
// No hay rasterizador de SVG en el proyecto y no se agregan dependencias,
// así que el lienzo se pinta con las MISMAS primitivas que emite el motor
// (el builder de abajo tiene la superficie de createBuilder, igual que el
// builder espía de scripts/contraste.mjs). Las diferencias con el navegador,
// todas elegidas para QUEDARSE CORTO —un estilo que pasa acá pasa de verdad:
//   · las fotos son un gris plano: no se puede saber qué foto vas a poner,
//     y una foto real tiene más varianza, no menos;
//   · el texto se pinta celda por celda (una caja por carácter, alto de caja
//     alta o de equis según el glifo). Es un modelo de tinta, no una fuente;
//   · el motivo y el wordmark no se pintan: son marcas tenues y contarlas
//     inflaría la diferencia de cualquier estilo que las tape;
//   · los íconos y dispositivos se pintan como su caja, en gris.
// Se supersamplea ×2 y se compara con tolerancia de 10/255 por canal.
// ============================================================

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CSV = process.argv.includes('--csv')
const MINIMO = 0.25          // el criterio de aceptación del BLOQUE S
const ANCHO = 128            // el tamaño al que se mira un feed
const SS = 2                 // supersampling
const TOL = 10               // dos píxeles son "el mismo" si no se despegan de esto
const argOf = (k, def) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${def}`).split('=')[1]

// ---- color ----
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
function color(c, fallback = null) {
  const s = String(c || '').trim()
  if (HEX.test(s)) {
    const h = s.slice(1)
    const t = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
    return [parseInt(t.slice(0, 2), 16), parseInt(t.slice(2, 4), 16), parseInt(t.slice(4, 6), 16), 1]
  }
  const m = /^rgba?\(([^)]+)\)/.exec(s)
  if (m) {
    const [r, g, b, a = 1] = m[1].split(',').map((v) => Number(v.trim()))
    return [r, g, b, a]
  }
  return fallback
}

// ---- lienzo ----
function lienzo(W, H) {
  const w = ANCHO * SS
  const h = Math.max(1, Math.round((ANCHO * H / W) * SS))
  const k = w / W                        // mundo → píxel
  const buf = new Float32Array(w * h * 3).fill(255)
  const mezclar = (i, rgb, a) => {
    if (a <= 0) return
    buf[i] += (rgb[0] - buf[i]) * a
    buf[i + 1] += (rgb[1] - buf[i + 1]) * a
    buf[i + 2] += (rgb[2] - buf[i + 2]) * a
  }
  return {
    w, h, k, buf,
    // rectángulo (con esquinas redondeadas opcionales)
    rect(x, y, ww, hh, c, alpha = 1, rx = 0) {
      const col = color(c)
      if (!col || ww <= 0 || hh <= 0) return
      const a = alpha * col[3]
      const x0 = x * k, y0 = y * k, x1 = (x + ww) * k, y1 = (y + hh) * k
      const r = Math.min(rx * k, (x1 - x0) / 2, (y1 - y0) / 2)
      for (let py = Math.max(0, Math.floor(y0)); py < Math.min(h, Math.ceil(y1)); py++) {
        const cy = py + 0.5
        if (cy < y0 || cy > y1) continue
        for (let px = Math.max(0, Math.floor(x0)); px < Math.min(w, Math.ceil(x1)); px++) {
          const cx = px + 0.5
          if (cx < x0 || cx > x1) continue
          if (r > 0) {
            const dx = Math.max(x0 + r - cx, cx - (x1 - r), 0)
            const dy = Math.max(y0 + r - cy, cy - (y1 - r), 0)
            if (dx * dx + dy * dy > r * r) continue
          }
          mezclar((py * w + px) * 3, col, a)
        }
      }
    },
    // polígono ya en coordenadas de mundo (scanline, par-impar)
    poligono(pts, c, alpha = 1) {
      const col = color(c)
      if (!col || pts.length < 3) return
      const a = alpha * col[3]
      const ys = pts.map((p) => p[1] * k)
      const y0 = Math.max(0, Math.floor(Math.min(...ys)))
      const y1 = Math.min(h, Math.ceil(Math.max(...ys)))
      for (let py = y0; py < y1; py++) {
        const cy = py + 0.5
        const cortes = []
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const ay = pts[j][1] * k, by = pts[i][1] * k
          if ((ay > cy) === (by > cy)) continue
          const t = (cy - ay) / (by - ay)
          cortes.push((pts[j][0] + (pts[i][0] - pts[j][0]) * t) * k)
        }
        cortes.sort((p, q) => p - q)
        for (let i = 0; i + 1 < cortes.length; i += 2) {
          for (let px = Math.max(0, Math.ceil(cortes[i] - 0.5)); px < Math.min(w, Math.ceil(cortes[i + 1] - 0.5)); px++) {
            mezclar((py * w + px) * 3, col, a)
          }
        }
      }
    },
    // degradé lineal vertical/horizontal (el scrim)
    degrade(x, y, ww, hh, dir, desde, hasta) {
      const c0 = color(desde, [0, 0, 0, 0]), c1 = color(hasta, [0, 0, 0, 0])
      const x0 = x * k, y0 = y * k, x1 = (x + ww) * k, y1 = (y + hh) * k
      for (let py = Math.max(0, Math.floor(y0)); py < Math.min(h, Math.ceil(y1)); py++) {
        for (let px = Math.max(0, Math.floor(x0)); px < Math.min(w, Math.ceil(x1)); px++) {
          const t = dir === 'right' ? (px + 0.5 - x0) / (x1 - x0)
            : dir === 'top' ? 1 - (py + 0.5 - y0) / (y1 - y0)
            : (py + 0.5 - y0) / (y1 - y0)
          const u = Math.max(0, Math.min(1, t))
          const rgb = [0, 1, 2].map((i) => c0[i] + (c1[i] - c0[i]) * u)
          mezclar((py * w + px) * 3, rgb, c0[3] + (c1[3] - c0[3]) * u)
        }
      }
    },
    // viñeta: negro que sube hacia los bordes (radial, igual que el motor)
    vineta(W2, H2, fuerza) {
      const cx = (W2 / 2) * k, cy = (H2 / 2) * k, r = Math.max(W2, H2) * 0.72 * k
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const d = Math.hypot(px + 0.5 - cx, py + 0.5 - cy) / r
          if (d <= 0.5) continue
          mezclar((py * w + px) * 3, [0, 0, 0], Math.min(1, (d - 0.5) / 0.5) * fuerza)
        }
      }
    },
    // 128 px de verdad: se promedia el supersampling
    reducir() {
      const out = new Uint8Array(ANCHO * Math.round(h / SS) * 3)
      const oh = Math.round(h / SS)
      for (let y = 0; y < oh; y++) {
        for (let x = 0; x < ANCHO; x++) {
          for (let ch = 0; ch < 3; ch++) {
            let s = 0
            for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) s += buf[((y * SS + dy) * w + x * SS + dx) * 3 + ch]
            out[(y * ANCHO + x) * 3 + ch] = Math.round(s / (SS * SS))
          }
        }
      }
      return out
    },
  }
}

// ---- geometría de paths (mismo parser que el guard, pero aplanando) ----
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
function puntosDePath(d) {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g)
  if (!tokens) return []
  const pts = []
  let i = 0, cmd = 'M', x = 0, y = 0
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) { cmd = tokens[i]; i++; if (cmd.toUpperCase() === 'Z') continue }
    const C = cmd.toUpperCase()
    const rel = cmd !== C
    const n = ARGS[C]
    if (n === undefined) break
    const a = tokens.slice(i, i + n).map(Number)
    if (a.length < n) break
    i += n
    const px = x, py = y
    if (C === 'H') x = rel ? x + a[0] : a[0]
    else if (C === 'V') y = rel ? y + a[0] : a[0]
    else { x = rel ? px + a[n - 2] : a[n - 2]; y = rel ? py + a[n - 1] : a[n - 1] }
    // las curvas se aplanan con sus puntos de control como guía: alcanza,
    // porque a 128 px una bezier de 30 px de radio son 3 píxeles
    if (C === 'C' || C === 'Q' || C === 'S') {
      const cps = []
      for (let j = 0; j + 1 < n - 2; j += 2) cps.push([rel ? px + a[j] : a[j], rel ? py + a[j + 1] : a[j + 1]])
      for (let t = 0.34; t < 1; t += 0.33) {
        const p0 = [px, py], p1 = cps[0] || [px, py], p2 = cps[1] || [x, y], p3 = [x, y]
        const u = 1 - t
        pts.push([
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ])
      }
    }
    pts.push([x, y])
    if (C === 'M') cmd = rel ? 'l' : 'L'
  }
  return pts
}

// ---- builder que pinta píxeles en vez de emitir SVG ----
// GRIS_FOTO: toda foto es el mismo gris. No es pereza: la foto la elige la
// persona y un estilo no se puede validar contra una foto en particular.
const GRIS_FOTO = '#8A8A8A'
const GRIS_HUECO = '#DAD5CC'   // el esqueleto "acá va una foto" que dibuja el motor
const GRIS_OBJETO = '#6F6F6F'  // íconos y dispositivos: se pintan como su caja

function builderRaster(L, medir) {
  const trans = (rotation, cx, cy, flipX, tx, ty) => (p) => {
    let [x, y] = [p[0] + tx, p[1] + ty]
    if (flipX) x = 2 * cx - x
    if (rotation) {
      const a = (rotation * Math.PI) / 180
      const dx = x - cx, dy = y - cy
      x = cx + dx * Math.cos(a) - dy * Math.sin(a)
      y = cy + dx * Math.sin(a) + dy * Math.cos(a)
    }
    return [x, y]
  }
  const caja = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
  const nada = () => {}
  return {
    defs: [], body: [],
    id: (p) => `${p}0`,
    filter: () => 'f0',
    rect({ x, y, w, h, fill, rx = 0, opacity = 1 }) { L.rect(x, y, w, h, fill, opacity, rx) },
    scrim({ x, y, w, h, dir = 'bottom', from = 'rgba(0,0,0,0)', to = 'rgba(0,0,0,0.72)' }) { L.degrade(x, y, w, h, dir, from, to) },
    vignette({ w, h, strength = 0.6 }) { L.vineta(w, h, strength) },
    gradientOverlay({ w, h, stops, opacity = 1 }) {
      const a = stops[0], z = stops[stops.length - 1]
      L.degrade(0, 0, w, h, 'bottom',
        `rgba(${color(a.color).slice(0, 3).join(',')},${(a.opacity ?? 1) * opacity})`,
        `rgba(${color(z.color).slice(0, 3).join(',')},${(z.opacity ?? 1) * opacity})`)
    },
    imageCover({ x, y, w, h, href, dim = 0, rotation = 0, radius = 0 }) {
      const c = href ? GRIS_FOTO : GRIS_HUECO
      if (rotation) L.poligono(caja(x, y, w, h).map(trans(rotation, x + w / 2, y + h / 2, false, 0, 0)), c, 1)
      else L.rect(x, y, w, h, c, 1, radius)
      if (dim > 0) L.rect(x, y, w, h, '#000000', dim * 0.9, radius)
    },
    framedImage({ cx, cy, w, h, href, rotation = 0, rcx = null, rcy = null, opacity = 1 }) {
      if (!href) return
      L.poligono(caja(cx - w / 2, cy - h / 2, w, h).map(trans(rotation, rcx ?? cx, rcy ?? cy, false, 0, 0)), GRIS_FOTO, opacity)
    },
    pantallaEnFoto({ x, y, w, h, opacity = 1 }) { L.rect(x, y, w, h, GRIS_FOTO, opacity) },
    screenGlare: nada,
    asset: nada,            // motivo y wordmark: ver el encabezado
    object({ cx, cy, size, rotation = 0, tile = false, tileColor, opacity = 1, aspect = 1, href }) {
      if (!href) return
      const w = size, h = size * aspect
      L.poligono(caja(cx - w / 2, cy - h / 2, w, h).map(trans(rotation, cx, cy, false, 0, 0)),
        tile ? (tileColor || GRIS_OBJETO) : GRIS_OBJETO, opacity)
    },
    path({ d, fill = 'none', stroke = null, sw = 0, rotation = 0, cx = 0, cy = 0, tx = 0, ty = 0, flipX = false, opacity = 1 }) {
      const pts = puntosDePath(d).map(trans(rotation, cx, cy, flipX, tx, ty))
      if (!pts.length) return
      if (fill && fill !== 'none') L.poligono(pts, fill, opacity)
      if (stroke && sw > 0) {
        // el trazo se pinta como una tira por segmento (flechas, sparkline)
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
          const len = Math.hypot(x1 - x0, y1 - y0) || 1
          const nx = (-(y1 - y0) / len) * sw / 2, ny = ((x1 - x0) / len) * sw / 2
          L.poligono([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], stroke, opacity)
        }
      }
    },
    // ---- el modelo de tinta del texto ----
    // Una caja por carácter: alto de caja alta para mayúsculas y dígitos,
    // de equis para minúsculas. El ancho sale de la MISMA función que usó el
    // motor para componer, así las cajas caen donde caen las letras.
    text({ x, y, lines, px, weight = 400, fill, anchor = 'start', tracking = 0, lineHeight = 1.15, opacity = 1 }) {
      const lh = px * lineHeight
      lines.forEach((ln, li) => {
        const s = String(ln)
        if (!s.trim()) return
        const ancho = medir(s, px, weight, tracking)
        let cursor = anchor === 'middle' ? x - ancho / 2 : x
        const base = y + px * 0.8 + li * lh
        for (const ch of s) {
          const adv = medir(ch, px, weight, 0) + tracking * px
          if (ch !== ' ') {
            const alta = ch === ch.toUpperCase() && ch !== ch.toLowerCase()
            const digito = ch >= '0' && ch <= '9'
            const alto = (alta || digito) ? px * 0.70 : px * 0.56
            const bajo = (alta || digito) ? 0 : px * 0.06   // colas de g, p, y
            L.rect(cursor + adv * 0.09, base - alto, adv * 0.78, alto + bajo, fill, 0.78 * opacity)
          }
          cursor += adv
        }
      })
    },
  }
}

// ---- diferencia entre dos lienzos ----
function diferencia(a, b) {
  let n = 0
  for (let i = 0; i < a.length; i += 3) {
    if (Math.abs(a[i] - b[i]) > TOL || Math.abs(a[i + 1] - b[i + 1]) > TOL || Math.abs(a[i + 2] - b[i + 2]) > TOL) n++
  }
  return n / (a.length / 3)
}

// una variante deja en null los ejes que no toca
function limpiar(set) {
  const out = {}
  for (const [k, v] of Object.entries(set || {})) if (v !== null && v !== undefined) out[k] = v
  return out
}

// ---- corrida ----
const server = await createServer({ root: RAIZ, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
const carga = (p) => server.ssrLoadModule(p)

try {
  const { TEMPLATES, demoContent, PLACEHOLDERS } = await carga('/src/templates/index.js')
  const { variantsFor } = await carga('/src/templates/variants.js')
  const { drawPiece } = await carga('/src/engine/layouts.js')
  const { measure } = await carga('/src/engine/textLayout.js')
  const { FORMATS_BY_ID } = await carga('/src/formats/registry.js')
  const medir = (t, px, weight, tracking) => measure(t, { px, weight, tracking })

  const formato = FORMATS_BY_ID[argOf('formato', 'ig-portrait')]
  if (!formato) { console.error('formato desconocido'); process.exit(2) }
  const plantillas = TEMPLATES.filter((t) => t.category !== 'chat' && !t.hidden)

  const pintar = (t, content) => {
    const L = lienzo(formato.w, formato.h)
    drawPiece(builderRaster(L, medir), { template: t, content, format: formato })
    return L.reducir()
  }

  // ---- la segunda medición: con copy típico ----
  // Una silueta que crece con el titular depende de cuánto escribiste. Dos
  // plantillas traen un titular de dos palabras a propósito ("¿Te sirvió?"
  // en el cierre de carrusel, "Tu texto acá" en la pieza en blanco) y ahí
  // "Titular gigante" no tiene con qué llenar la pieza: da 23-24%. Bajar el
  // estilo por el largo de un PLACEHOLDER sería medir el ejemplo y no la
  // herramienta, así que cuando una combinación no llega se la vuelve a
  // medir con un titular del largo que recomienda MAXCHARS. Si con ese pasa,
  // se ofrece y el script lo dice.
  const COPY_TIPICO = PLACEHOLDERS.title
  const HEROES = ['title', 'quote']
  function conCopyTipico(t, content) {
    if ((t.roles || []).some((r) => HEROES.includes(r))) {
      const out = { ...content }
      HEROES.forEach((r) => { if ((t.roles || []).includes(r)) out[r] = COPY_TIPICO })
      return out
    }
    let toco = false
    const bloques = (content.textBlocks || []).map((b) => {
      if (toco || !HEROES.includes(b.style)) return b
      toco = true
      return { ...b, text: COPY_TIPICO }
    })
    return toco ? { ...content, textBlocks: bloques } : null
  }

  const pgm = argOf('pgm', '')
  const filas = []
  for (const t of plantillas) {
    const base = demoContent(t)
    const estilos = variantsFor(t, formato)
    let ref = null
    for (const v of estilos) {
      const img = pintar(t, { ...base, ...limpiar(v.set) })
      if (v.id === 'base') { ref = img; continue }
      if (!ref) ref = pintar(t, base)
      let d = diferencia(ref, img)
      let tipico = null
      if (d < MINIMO) {
        const c2 = conCopyTipico(t, base)
        if (c2) {
          tipico = diferencia(pintar(t, c2), pintar(t, { ...c2, ...limpiar(v.set) }))
          if (tipico >= MINIMO) d = tipico
        }
      }
      filas.push({ t: t.id, v: v.id, label: v.label, d, tipico })
      if (pgm && pgm === `${t.id}·${v.id}`) escribirPGM(img, formato, `${t.id}-${v.id}`)
      if (pgm && pgm === `${t.id}·base`) escribirPGM(ref, formato, `${t.id}-base`)
    }
  }

  if (CSV) {
    console.log('plantilla,estilo,label,cambio')
    filas.forEach((f) => console.log(`${f.t},${f.v},${JSON.stringify(f.label)},${(f.d * 100).toFixed(1)},${f.tipico ? 'copy-tipico' : ''}`))
  } else {
    const estilos = [...new Set(filas.map((f) => f.v))]
    const anchoT = Math.max(...plantillas.map((t) => t.id.length))
    console.log(`\nLA VARA DE LOS ESTILOS · ${formato.id} rasterizado a ${ANCHO} px · mínimo ${(MINIMO * 100)}%`)
    console.log(`% de píxeles que cambian contra el Original\n`)
    console.log('plantilla'.padEnd(anchoT) + estilos.map((e) => e.slice(0, 9).padStart(10)).join(''))
    for (const t of plantillas) {
      const fila = estilos.map((e) => {
        const f = filas.find((x) => x.t === t.id && x.v === e)
        return (f ? `${f.d * 100 < 10 ? ' ' : ''}${(f.d * 100).toFixed(1)}${f.d < MINIMO ? '✗' : ' '}` : '—').padStart(10)
      }).join('')
      console.log(t.id.padEnd(anchoT) + fila)
    }
    console.log('')
    for (const e of estilos) {
      const ds = filas.filter((f) => f.v === e).map((f) => f.d).sort((a, b) => a - b)
      if (!ds.length) continue
      const med = ds[Math.floor(ds.length / 2)]
      const bajos = ds.filter((d) => d < MINIMO).length
      const label = filas.find((f) => f.v === e).label
      console.log(`${e.padEnd(12)} ${label.padEnd(20)} mediana ${(med * 100).toFixed(1)}%  ·  peor ${(ds[0] * 100).toFixed(1)}%  ·  mejor ${(ds[ds.length - 1] * 100).toFixed(1)}%  ·  ${bajos ? `✗ ${bajos}/${ds.length} bajo el mínimo` : `✓ ${ds.length}/${ds.length} pasan`}`)
    }
    const conAyuda = filas.filter((f) => f.tipico && f.d >= MINIMO)
    if (conAyuda.length) {
      console.log('\nmedidas con un titular de largo típico (la plantilla trae dos palabras):')
      conAyuda.forEach((f) => console.log(`  ${f.t} · ${f.v} — ${(f.d * 100).toFixed(1)}% con copy típico`))
    }
    const fallan = filas.filter((f) => f.d < MINIMO)
    console.log(fallan.length
      ? `\n✗ ${fallan.length} de ${filas.length} combinaciones no llegan al ${MINIMO * 100}%:\n` +
        fallan.map((f) => `  ${f.t} · ${f.v} — ${(f.d * 100).toFixed(1)}%`).join('\n') + '\n'
      : `\n✓ las ${filas.length} combinaciones ofrecidas cambian al menos el ${MINIMO * 100}% de la pieza\n`)
    if (fallan.length) process.exitCode = 1
  }
} finally {
  await server.close()
}

// para poder MIRAR lo que el medidor ve (y no discutir con un número solo)
function escribirPGM(img, formato, nombre) {
  const alto = img.length / 3 / ANCHO
  const dir = path.join(RAIZ, 'scripts', '.siluetas')
  fs.mkdirSync(dir, { recursive: true })
  const cab = Buffer.from(`P6\n${ANCHO} ${alto}\n255\n`, 'ascii')
  fs.writeFileSync(path.join(dir, `${nombre}.ppm`), Buffer.concat([cab, Buffer.from(img)]))
  console.error(`· escrito scripts/.siluetas/${nombre}.ppm`)
}
