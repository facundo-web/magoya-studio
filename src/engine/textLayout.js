// ============================================================
// TEXT LAYOUT — medición y wrap con canvas measureText
// (misma técnica que el prototipo: measure → fillText)
// El texto se mide con Manrope ya cargada (ver main.jsx: font gate).
// ============================================================

import { FONT_FAMILY } from '../brand/brandKit.js'

let _ctx = null
function ctx() {
  if (!_ctx) {
    const c = document.createElement('canvas')
    _ctx = c.getContext('2d')
  }
  return _ctx
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
export function wrapText(text, { px, weight, tracking = 0, maxWidth, family }) {
  const opts = { px, weight, tracking, family }
  const parrafos = String(text).split(/\r?\n/)
  const lines = []
  for (const parrafo of parrafos) {
    const words = parrafo.split(/[ \t]+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
    let line = null
    for (const w of words) {
      const trozos = measure(w, opts) > maxWidth ? partirPalabra(w, opts, maxWidth) : [w]
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
export function fitText(text, { weight, tracking = 0, maxWidth, maxHeight, startPx, lineHeight = 1.15, maxLines = 6, minPx = 8, family }) {
  let px = startPx
  while (px > minPx) {
    const lines = wrapText(text, { px, weight, tracking, maxWidth, family })
    const height = lines.length * px * lineHeight
    if (lines.length <= maxLines && height <= maxHeight) {
      return { px, lines, cortado: false }
    }
    px = Math.floor(px * 0.94)
  }
  // Ni al mínimo entra: hay que recortar. Antes desaparecían líneas enteras
  // sin ninguna señal — mirabas la pieza y faltaba el final de la frase.
  // Los puntos suspensivos son la única forma de que se vea que se cortó.
  const todas = wrapText(text, { px, weight, tracking, maxWidth, family })
  if (todas.length <= maxLines) return { px, lines: todas, cortado: false }
  const lines = todas.slice(0, maxLines)
  lines[lines.length - 1] = String(lines[lines.length - 1]).replace(/[\s.,;:]+$/, '') + '…'
  return { px, lines, cortado: true }
}
