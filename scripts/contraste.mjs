// ============================================================
// GUARD DE CONTRASTE — el punto 9 del BLOQUE S.
//
// Existe porque los otros ocho arreglos no se pueden verificar mirando:
// son 30 plantillas × 6 estilos × 8 esquemas y nadie abre 1440 piezas.
// El script dibuja cada combinación con el motor DE VERDAD (no una
// maqueta) contra un builder espía que anota qué rectángulo quedó abajo
// de qué texto, y falla si algún par baja del mínimo legible.
//
// Correr:  node scripts/contraste.mjs            (también anda con npx vite-node)
//          node scripts/contraste.mjs --todos    (lista todas las fallas)
//          node scripts/contraste.mjs --csv      (una línea por par, para medir)
//
// No usa vite-node como dependencia: levanta Vite en modo SSR con la
// misma config del proyecto, así los import de .json y .svg resuelven
// igual que en la app. Un motor que sólo se puede correr en el browser
// es un motor que no se puede auditar.
// ============================================================

import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TODOS = process.argv.includes('--todos')
const CSV = process.argv.includes('--csv')

// ---- deuda declarada ----
// Fallas que NO son un error de paleta: el estilo centra el stack justo
// encima de un objeto que la plantilla ya tenía puesto (un gráfico de
// barras, dos retratos). El color no las puede arreglar —el texto está
// pisando un dibujo— y la decisión es de diseño: o la variante mueve el
// objeto, o esa variante no se ofrece para esa plantilla. Va acá anotada y
// no escondida: si aparece una falla NUEVA, el guard igual se pone rojo.
// Cerrada en U3: el estilo "Centrado" era el que plantaba el texto encima
// del gráfico de `impacto-pantalla` y de los dos retratos de `speakers`, y
// ya no existe —el ancla se elige ahora en el panel Texto—. Las siluetas
// nuevas que colisionaban se resolvieron por el otro camino que decía la
// consigna: no se ofrecen para esa plantilla (ver NO_VA / NO_VA_EN en
// templates/variants.js, cada una con su motivo). La tabla queda porque el
// mecanismo sirve, no porque haya deuda.
const CONOCIDAS = {}

// ---- mínimos (WCAG AA sobre la pieza a 1080) ----
// display = titulares y cifras, que perdonan menos contraste porque el
// trazo es grueso; el resto es texto chico y va a 4,5:1.
const MIN_CHICO = 4.5
const MIN_DISPLAY = 3
const esDisplay = (px, weight, ref) => px >= ref * 0.03 || (px >= ref * 0.022 && weight >= 700)

// ---- color ----
const rgb = (h) => { const s = String(h || '#000').replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0) }
function lum(hex) {
  const c = rgb(hex).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
const mezcla = (a, b, t) => { const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b); const k = Math.max(0, Math.min(1, t)); const c = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0'); return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}` }

// rgba(...) también aparece como fill (los muted sobre foto): se aplana
// contra el fondo que tenga abajo.
function normalizar(fill, debajo) {
  const s = String(fill || '')
  const m = /^rgba?\(([^)]+)\)/.exec(s)
  if (!m) return s.startsWith('#') ? s : null
  const [r, g, b, a = 1] = m[1].split(',').map((v) => Number(v.trim()))
  const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  return a >= 0.999 ? hex : (debajo ? mezcla(debajo, hex, a) : hex)
}

// ---- builder espía ----
// Implementa la misma superficie que createBuilder pero en vez de emitir
// SVG anota geometría. Cada op sabe si es opaca (tapa lo de abajo) o no.
function builderEspia() {
  const ops = []
  const nada = () => {}
  return {
    ops,
    defs: [], body: [],
    id: (p) => `${p}0`,
    filter: () => 'f0',
    rect({ x, y, w, h, fill, opacity = 1 }) { ops.push({ t: 'rect', x, y, w, h, fill, opacity }) },
    scrim({ x, y, w, h }) { ops.push({ t: 'foto', x, y, w, h, motivo: 'scrim' }) },
    vignette: nada,
    gradientOverlay({ w, h, stops, opacity = 1 }) { ops.push({ t: 'grad', x: 0, y: 0, w, h, stops, opacity }) },
    imageCover({ x, y, w, h, href }) { ops.push({ t: href ? 'foto' : 'rect', x, y, w, h, fill: '#DAD5CC', opacity: 1, motivo: 'foto' }) },
    framedImage({ cx, cy, w, h, href }) { if (href) ops.push({ t: 'foto', x: cx - w / 2, y: cy - h / 2, w, h }) },
    pantallaEnFoto({ x, y, w, h }) { ops.push({ t: 'foto', x, y, w, h }) },
    screenGlare: nada,
    asset: nada,             // logo y motivo: no son texto ni fondo de texto
    object: nada,            // íconos: se auditan aparte (punto 8), no llevan texto
    path({ d, fill, opacity = 1, tx = 0, ty = 0 }) {
      // una forma rellena (panel, bocadillo, ventana, etiqueta) es fondo de
      // todo lo que se dibuje después encima
      const caja = cajaDePath(d, tx, ty)
      if (caja && fill && fill !== 'none') ops.push({ t: 'rect', ...caja, fill, opacity, aprox: true })
    },
    text({ x, y, lines, px, weight = 400, fill, anchor = 'start', tracking = 0, lineHeight = 1.15, opacity = 1 }) {
      ops.push({ t: 'text', x, y, lines, px, weight, fill, anchor, tracking, lineHeight, opacity })
    },
  }
}
// Caja envolvente de un path. Hay que leer los COMANDOS y no sólo los
// números: un `A r,r 0 0 1 x,y` mete tres banderas en el medio, y tomando
// los números de a pares el arco corría todos los puntos siguientes — el
// primer guard daba por tapado un texto que estaba a media pieza del panel.
// Los puntos de control de las curvas se ignoran a propósito: subestimar la
// caja hace perder una falla, sobreestimarla hace inventar una.
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
function cajaDePath(d, tx = 0, ty = 0) {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g)
  if (!tokens) return null
  const xs = [], ys = []
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
    if (C === 'H') x = rel ? x + a[0] : a[0]
    else if (C === 'V') y = rel ? y + a[1 - 1] : a[0]
    else {
      const [dx, dy] = [a[n - 2], a[n - 1]]
      x = rel ? x + dx : dx
      y = rel ? y + dy : dy
    }
    xs.push(x); ys.push(y)
    if (C === 'M') cmd = rel ? 'l' : 'L'   // un M implícito encadena líneas
  }
  if (!xs.length) return null
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  return { x: x0 + tx, y: y0 + ty, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }
}

// ¿qué hay abajo de este punto, mirando de arriba hacia abajo?
// Devuelve un color, o null si lo que hay es una foto (no se puede decidir).
function fondoEn(ops, hasta, px, py) {
  for (let i = hasta - 1; i >= 0; i--) {
    const o = ops[i]
    if (o.t === 'text' || o.t === 'grad') continue
    if (px < o.x || px > o.x + o.w || py < o.y || py > o.y + o.h) continue
    if (o.t === 'foto') return null
    const color = normalizar(o.fill, null)
    if (!color) continue
    if ((o.opacity ?? 1) >= 0.999) return color
    const debajo = fondoEn(ops, i, px, py)
    if (debajo === null) return null
    return mezcla(debajo, color, o.opacity)
  }
  return null
}

// El ancho de la línea se mide con la MISMA función que usó el motor para
// dibujar la pastilla del CTA o la tarjeta. Con una estimación propia los
// puntos de sondeo caían afuera de la placa y el guard inventaba fallas.
let medir = (t, px) => String(t).length * px * 0.52

function auditar(ops, ref, alto) {
  const pares = []
  ops.forEach((o, i) => {
    if (o.t !== 'text') return
    const lh = o.px * o.lineHeight
    o.lines.forEach((ln, li) => {
      if (!String(ln).trim()) return
      const w = medir(ln, o.px, o.weight, o.tracking)
      const x0 = o.anchor === 'middle' ? o.x - w / 2 : o.x
      const cy = o.y + li * lh + o.px * 0.45
      // tres sondeos por línea: si el texto se sale de la placa, el borde lo delata
      const puntos = [x0 + o.px * 0.2, x0 + w / 2, x0 + w - o.px * 0.2]
      let peor = null
      for (const pxx of puntos) {
        const f = fondoEn(ops, i, pxx, cy)
        if (f === null) { peor = 'foto'; break }
        const tinta = normalizar(o.fill, f)
        if (!tinta) continue
        const r = ratio(tinta, f)
        if (!peor || r < peor.r) peor = { r, fondo: f, tinta }
      }
      // De paso, lo que el ojo ve antes que el contraste: texto que se fue
      // del lienzo (punto 6, el stack que se sale por arriba con `roomy`).
      if (cy < 0 || cy > alto) pares.push({ fuera: true, texto: ln, y: Math.round(cy) })
      if (!peor) return
      if (peor === 'foto') { pares.push({ foto: true, texto: ln }); return }
      const min = esDisplay(o.px, o.weight, ref) ? MIN_DISPLAY : MIN_CHICO
      pares.push({ ...peor, min, texto: ln, px: Math.round(o.px), weight: o.weight, ok: peor.r >= min })
    })
  })
  return pares
}

// ---- corrida ----
const server = await createServer({ root: RAIZ, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
const carga = (p) => server.ssrLoadModule(p)

try {
  // `demoContent` y no `placeholderContent`: la plantilla de foto SIN foto
  // dibuja el esqueleto gris, y auditar contra un gris que no va a existir
  // en la pieza publicada es medir otra cosa. Con la foto puesta, el texto
  // encima queda como "no evaluable", que es la verdad: contra una foto
  // cualquiera no se puede prometer un ratio.
  const { TEMPLATES, demoContent } = await carga('/src/templates/index.js')
  const { variantsFor } = await carga('/src/templates/variants.js')
  const { COLOR_SCHEMES } = await carga('/src/brand/brandKit.js')
  const { drawPiece } = await carga('/src/engine/layouts.js')
  const { measure } = await carga('/src/engine/textLayout.js')
  medir = (t, px, weight, tracking) => measure(t, { px, weight, tracking })
  const { FORMATS_BY_ID } = await carga('/src/formats/registry.js')

  // Por defecto 1080×1350, que es el que más se usa. `--formatos` barre los
  // 13: el desborde del stack no aparece en el cuadrado, aparece en los
  // apaisados —1200×627 tiene la mitad de alto y el mismo texto—, y ésa es
  // justo la clase de falla que nadie ve hasta que la publica.
  const FORMATOS = process.argv.includes('--formatos')
    ? Object.values(FORMATS_BY_ID)
    : [FORMATS_BY_ID['ig-portrait']]
  const esquemas = Object.keys(COLOR_SCHEMES)
  const plantillas = TEMPLATES.filter((t) => t.category !== 'chat')

  let total = 0, fallas = [], sobreFoto = 0, piezas = 0, fuera = []
  for (const t of plantillas) {
    const base = demoContent(t)
    const estilos = variantsFor(t)
    for (const v of (estilos.length ? estilos : [{ id: 'base', label: 'Original', set: {} }])) {
      for (const esquema of esquemas) {
        for (const formato of FORMATOS) {
          // el catálogo depende del formato: tres siluetas sólo rompen en
          // algunas proporciones y ahí no se ofrecen (NO_VA_EN en variants.js)
          if (!variantsFor(t, formato).some((x) => x.id === v.id)) continue
          const content = { ...base, ...limpiar(v.set), scheme: esquema }
          const b = builderEspia()
          const donde = { t: t.id, v: v.id, esquema, f: formato.id }
          try { drawPiece(b, { template: t, content, format: formato }) }
          catch (e) { fallas.push({ ...donde, error: String(e.message || e) }); continue }
          piezas++
          for (const par of auditar(b.ops, Math.min(formato.w, formato.h), formato.h)) {
            if (par.fuera) { fuera.push({ ...donde, ...par }); continue }
            if (par.foto) { sobreFoto++; continue }
            total++
            if (!par.ok) fallas.push({ ...donde, ...par })
            if (CSV) console.log([t.id, v.id, esquema, formato.id, par.px, par.tinta, par.fondo, par.r.toFixed(2), par.min, par.ok ? 'ok' : 'FALLA', JSON.stringify(par.texto)].join(','))
          }
        }
      }
    }
  }

  if (!CSV) {
    console.log(`\nGUARD DE CONTRASTE · ${plantillas.length} plantillas × estilos × ${esquemas.length} esquemas × ${FORMATOS.length} formato(s)`)
    console.log(`${piezas} piezas · ${total} pares texto/fondo evaluados · ${sobreFoto} sobre foto (no evaluables)`)
    const rotas = fallas.filter((f) => f.error)
    if (rotas.length) console.log(`${rotas.length} piezas que ni dibujan`)
    const todosMalos = fallas.filter((f) => !f.error)
    const deuda = todosMalos.filter((f) => CONOCIDAS[`${f.t}·${f.v}`])
    const malos = todosMalos.filter((f) => !CONOCIDAS[`${f.t}·${f.v}`])
    if (deuda.length) {
      console.log(`\n· ${deuda.length} pares de deuda declarada (no rompen el guard):`)
      const porCaso = new Map()
      for (const f of deuda) { const k = `${f.t}·${f.v}`; porCaso.set(k, (porCaso.get(k) || 0) + 1) }
      for (const [k, n] of porCaso) console.log(`  ${n}×  ${k} — ${CONOCIDAS[k]}`)
    }
    console.log(malos.length ? `\n✗ ${malos.length} pares por debajo del mínimo:` : '\n✓ todos los pares pasan el mínimo')
    const muestra = TODOS ? malos : malos.slice(0, 40)
    for (const f of muestra) {
      console.log(`  ${f.t} · ${f.v} · ${f.esquema} · ${f.f} — ${f.tinta} sobre ${f.fondo} = ${f.r.toFixed(2)}:1 (min ${f.min}) · ${f.px}px · ${JSON.stringify(String(f.texto).slice(0, 40))}`)
    }
    if (!TODOS && malos.length > muestra.length) console.log(`  … y ${malos.length - muestra.length} más (--todos para verlas)`)
    for (const f of rotas) console.log(`  ✗ ${f.t} · ${f.v} · ${f.esquema} · ${f.f} — ${f.error}`)
    // resumen por causa, que es lo que sirve para arreglar
    const porPar = new Map()
    for (const f of malos) { const k = `${f.tinta} sobre ${f.fondo}`; porPar.set(k, (porPar.get(k) || 0) + 1) }
    if (malos.length) {
      console.log('\npares más repetidos:')
      ;[...porPar.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => console.log(`  ${n}×  ${k}`))
    }
    // 6 · lo otro que no perdona: texto dibujado afuera del lienzo
    if (fuera.length) {
      console.log(`\n✗ ${fuera.length} líneas fuera del lienzo:`)
      for (const f of (TODOS ? fuera : fuera.slice(0, 12))) {
        console.log(`  ${f.t} · ${f.v} · ${f.esquema} · ${f.f} — y=${f.y} · ${JSON.stringify(String(f.texto).slice(0, 40))}`)
      }
      if (!TODOS && fuera.length > 12) console.log(`  … y ${fuera.length - 12} más`)
    } else {
      console.log('✓ ninguna línea se sale del lienzo')
    }
    console.log('')
    if (malos.length || rotas.length || fuera.length) process.exitCode = 1
  }
} finally {
  await server.close()
}

// una variante deja los ejes que no toca en null: null significa "no lo
// piso", no "ponelo en null"
function limpiar(set) {
  const out = {}
  for (const [k, v] of Object.entries(set || {})) if (v !== null && v !== undefined) out[k] = v
  return out
}
