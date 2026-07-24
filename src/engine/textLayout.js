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

export function setFont({ px, weight = 400 }) {
  ctx().font = `${weight} ${px}px ${FONT_FAMILY}, system-ui, sans-serif`
}

// ancho de un string aplicando tracking (letter-spacing) manual
export function measure(text, { px, weight, tracking = 0 }) {
  setFont({ px, weight })
  const base = ctx().measureText(text).width
  const spacing = tracking * px * Math.max(0, text.length - 1)
  return base + spacing
}

// parte un texto en líneas que entran en maxWidth
export function wrapText(text, { px, weight, tracking = 0, maxWidth }) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let line = words[0]
  for (let i = 1; i < words.length; i++) {
    const test = line + ' ' + words[i]
    if (measure(test, { px, weight, tracking }) <= maxWidth) {
      line = test
    } else {
      lines.push(line)
      line = words[i]
    }
  }
  lines.push(line)
  return lines
}

// auto-encaja un texto en un box: baja el tamaño hasta que entra en
// maxWidth (con wrap) y maxLines. Devuelve { px, lines }.
export function fitText(text, { weight, tracking = 0, maxWidth, maxHeight, startPx, lineHeight = 1.15, maxLines = 6, minPx = 8 }) {
  let px = startPx
  while (px > minPx) {
    const lines = wrapText(text, { px, weight, tracking, maxWidth })
    const height = lines.length * px * lineHeight
    if (lines.length <= maxLines && height <= maxHeight) {
      return { px, lines }
    }
    px = Math.floor(px * 0.94)
  }
  const lines = wrapText(text, { px, weight, tracking, maxWidth }).slice(0, maxLines)
  return { px, lines }
}
