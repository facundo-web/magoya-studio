// ============================================================
// TEXT LAYOUT — medición y wrap con canvas measureText
// (misma técnica que el prototipo: measure → fillText)
// El texto se mide con Manrope ya cargada (ver main.jsx: font gate).
// ============================================================

import { FONT_FAMILY } from '../brand/brandKit.js'

let _ctx = null
function ctx() {
  if (!_ctx) {
    // Fuera del browser (el guard de contraste corre en Node) no hay canvas.
    // Se mide con una tabla de anchos aproximada de Manrope: alcanza para
    // decidir cuántas líneas entran, que es lo único que el guard necesita
    // para llegar a los colores. En el browser sigue midiendo el canvas real.
    _ctx = typeof document !== 'undefined'
      ? document.createElement('canvas').getContext('2d')
      : ctxAproximado()
  }
  return _ctx
}

// Medidor de emergencia: anchos relativos por clase de carácter (Manrope),
// con un plus por peso porque las bolds son más anchas.
function ctxAproximado() {
  const ANCHO = { angosto: 0.3, digito: 0.6, ancho: 0.86, normal: 0.53 }
  let px = 16, weight = 400
  return {
    set font(v) {
      const m = /^(\d+)\s+([\d.]+)px/.exec(v) || []
      weight = Number(m[1]) || 400
      px = Number(m[2]) || 16
    },
    measureText(t) {
      let w = 0
      for (const ch of String(t)) {
        if ('iljtIrf.,;:\'"!|()[]-'.includes(ch)) w += ANCHO.angosto
        else if (ch >= '0' && ch <= '9') w += ANCHO.digito
        else if ('mwMWQO@%–—−'.includes(ch)) w += ANCHO.ancho
        else if (ch === ' ') w += 0.26
        else w += ANCHO.normal + (ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 0.09 : 0)
      }
      return { width: w * px * (weight >= 700 ? 1.05 : 1) }
    },
  }
}

// `family` existe porque la volanta manuscrita se DIBUJA en Caveat pero se
// medía en Manrope, que es bastante más ancha: el texto entraba de sobra y
// aun así se bajaba de tamaño o se partía de más.
export function setFont({ px, weight = 400, family }) {
  ctx().font = `${weight} ${px}px ${family || FONT_FAMILY}, system-ui, sans-serif`
}

// ancho de un string aplicando tracking (letter-spacing) manual
export function measure(text, { px, weight, tracking = 0, family }) {
  setFont({ px, weight, family })
  const base = ctx().measureText(text).width
  const spacing = tracking * px * Math.max(0, text.length - 1)
  return base + spacing
}

// Parte una palabra que NO entra ni sola: una URL, un hashtag, el nombre
// largo de un producto. Antes se devolvía entera en una línea y el texto
// se iba de la pieza sin achicarse ni avisar — con
// "magoya.com/informes-agronomicos-automatizados" la caja llegaba a
// x=2408 en un lienzo de 1080.
function partirPalabra(w, opts, maxWidth) {
  const trozos = []
  let actual = ''
  for (const ch of String(w)) {
    const test = actual + ch
    if (actual && measure(test, opts) > maxWidth) { trozos.push(actual); actual = ch }
    else actual = test
  }
  if (actual) trozos.push(actual)
  return trozos.length ? trozos : ['']
}

// parte un texto en líneas que entran en maxWidth.
// Los saltos de línea que escribió la persona se respetan: antes `\n` se
// trataba como un espacio más y "Nombre\nRol" salía en un solo renglón.
// `sinPartir` = esta palabra es una UNIDAD y no se corta nunca. La cifra
// "−70%" partida en "−7" / "0%" deja de ser un número, y el botón
// "Agendá 30 minutos" partido a la mitad de una palabra deja de ser un
// botón. Cuando no entra, el que baja es el tamaño (ver fitText), no la
// palabra.
export function wrapText(text, { px, weight, tracking = 0, maxWidth, family, sinPartir = false }) {
  const opts = { px, weight, tracking, family }
  const parrafos = String(text).split(/\r?\n/)
  const lines = []
  for (const parrafo of parrafos) {
    const words = parrafo.split(/[ \t]+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
    let line = null
    for (const w of words) {
      const trozos = (!sinPartir && measure(w, opts) > maxWidth) ? partirPalabra(w, opts, maxWidth) : [w]
      for (const t of trozos) {
        if (line === null) { line = t; continue }
        const test = line + ' ' + t
        if (measure(test, opts) <= maxWidth) line = test
        else { lines.push(line); line = t }
      }
    }
    if (line !== null) lines.push(line)
  }
  return lines.length ? lines : ['']
}

// auto-encaja un texto en un box: baja el tamaño hasta que entra en
// maxWidth (con wrap) y maxLines. Devuelve { px, lines }.
export function fitText(text, { weight, tracking = 0, maxWidth, maxHeight, startPx, lineHeight = 1.15, maxLines = 6, minPx = 8, family, sinPartir = false }) {
  let px = startPx
  while (px > minPx) {
    const lines = wrapText(text, { px, weight, tracking, maxWidth, family, sinPartir })
    const height = lines.length * px * lineHeight
    // Con `sinPartir` el wrap ya no garantiza el ancho (una palabra sola
    // puede pasarse), así que el ancho pasa a ser condición de salida: es
    // lo que hace que la cifra se achique en vez de romperse.
    const entraAncho = !sinPartir || lines.every((l) => measure(l, { px, weight, tracking, family }) <= maxWidth)
    if (lines.length <= maxLines && height <= maxHeight && entraAncho) {
      return { px, lines, cortado: false }
    }
    px = Math.floor(px * 0.94)
  }
  // Ni al mínimo entra: hay que recortar. Antes desaparecían líneas enteras
  // sin ninguna señal — mirabas la pieza y faltaba el final de la frase.
  // Los puntos suspensivos son la única forma de que se vea que se cortó.
  // Acá sí se parte aunque sea una unidad: entre una cifra rota y una cifra
  // que se sale de la pieza, la rota al menos se ve entera.
  const todas = wrapText(text, { px, weight, tracking, maxWidth, family })
  if (todas.length <= maxLines) return { px, lines: todas, cortado: false }
  const lines = todas.slice(0, maxLines)
  lines[lines.length - 1] = String(lines[lines.length - 1]).replace(/[\s.,;:]+$/, '') + '…'
  return { px, lines, cortado: true }
}
