// ============================================================
// SHAPES — formas paramétricas para piezas de alto impacto.
// Todo generativo (no assets): escala con la pieza, se tiñe con el
// acento y viaja en el export sin depender de archivos externos.
// ============================================================

const n = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100

// ---- FLECHA GRUESA RELLENA (apunta a la cifra / al dashboard) ----
// Se dibuja en un box de w×h con la punta a la derecha; el rotation
// del objeto la orienta.
export function arrowPath(w, h, { headW = 0.55, headLen = 0.4, tail = 0.42 } = {}) {
  const hw = h * headW / 2
  const tw = h * tail / 2
  const hx = w * (1 - headLen)
  const cy = h / 2
  return `M0,${n(cy - tw)} L${n(hx)},${n(cy - tw)} L${n(hx)},${n(cy - hw)} L${n(w)},${n(cy)} ` +
         `L${n(hx)},${n(cy + hw)} L${n(hx)},${n(cy + tw)} L0,${n(cy + tw)} Z`
}

// ---- FLECHA CURVA "a mano" (trazo, tono educativo) ----
export function handArrowPath(w, h) {
  const d = `M${n(w * 0.04)},${n(h * 0.18)} C${n(w * 0.42)},${n(h * 0.06)} ${n(w * 0.78)},${n(h * 0.34)} ${n(w * 0.88)},${n(h * 0.78)}`
  const head = `M${n(w * 0.66)},${n(h * 0.64)} L${n(w * 0.9)},${n(h * 0.84)} L${n(w * 0.98)},${n(h * 0.54)}`
  return { body: d, head }
}

// ---- SPARKLE / destello de 4 puntas (señala "IA" sin robots) ----
export function sparklePath(r) {
  const k = r * 0.22
  return `M0,${n(-r)} C${n(k)},${n(-k)} ${n(k)},${n(-k)} ${n(r)},0 ` +
         `C${n(k)},${n(k)} ${n(k)},${n(k)} 0,${n(r)} ` +
         `C${n(-k)},${n(k)} ${n(-k)},${n(k)} ${n(-r)},0 ` +
         `C${n(-k)},${n(-k)} ${n(-k)},${n(-k)} 0,${n(-r)} Z`
}

// ---- BOCADILLO (pregunta del productor) ----
export function calloutPath(w, h, { r = 18, tail = 'bottom-left' } = {}) {
  const t = h * 0.16
  const base = `M${n(r)},0 H${n(w - r)} A${n(r)},${n(r)} 0 0 1 ${n(w)},${n(r)} V${n(h - r)} ` +
               `A${n(r)},${n(r)} 0 0 1 ${n(w - r)},${n(h)} `
  if (tail === 'bottom-left') {
    return base + `H${n(w * 0.28)} L${n(w * 0.16)},${n(h + t)} L${n(w * 0.2)},${n(h)} H${n(r)} ` +
           `A${n(r)},${n(r)} 0 0 1 0,${n(h - r)} V${n(r)} A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`
  }
  return base + `H${n(r)} A${n(r)},${n(r)} 0 0 1 0,${n(h - r)} V${n(r)} A${n(r)},${n(r)} 0 0 1 ${n(r)},0 Z`
}

// ---- GRÁFICO DE BARRAS ASCENDENTE (la prueba visual) ----
export function barsRects(w, h, values, { gap = 0.22, rx = 0.18 } = {}) {
  const max = Math.max(...values, 1)
  const bw = w / (values.length * (1 + gap) - gap)
  return values.map((v, i) => {
    const bh = (v / max) * h
    return { x: n(i * bw * (1 + gap)), y: n(h - bh), w: n(bw), h: n(bh), rx: n(bw * rx) }
  })
}

// ---- SPARKLINE (curva ascendente + área) ----
export function sparkline(w, h, values) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const rng = max - min || 1
  const pts = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * w,
    h - ((v - min) / rng) * h,
  ])
  let d = `M${n(pts[0][0])},${n(pts[0][1])}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [x, y] = pts[i]
    const cx = (px + x) / 2
    d += ` C${n(cx)},${n(py)} ${n(cx)},${n(y)} ${n(x)},${n(y)}`
  }
  const area = d + ` L${n(w)},${n(h)} L0,${n(h)} Z`
  return { line: d, area, last: pts[pts.length - 1] }
}

// ---- PUNTITOS DE CARRUSEL ----
// Antes eran un SVG fijo de 5 puntos: "los puntitos no les puse para que
// edites cuánta cantidad querés. Hay que sumarlo en la miscelánea".
// Ahora es paramétrico: cuántos son y cuál está activo.
export function dotsCircles(w, count = 5, active = 0) {
  const nn = Math.max(2, Math.min(12, Math.round(count)))
  const r = w / (nn * 3.2)
  const step = nn > 1 ? (w - r * 2) / (nn - 1) : 0
  return Array.from({ length: nn }, (_, i) => ({
    cx: n(r + i * step), cy: n(r), r: n(r),
    on: i === ((active % nn) + nn) % nn,
  }))
}

// ---- CHROME de captura (barra tipo ventana) ----
export function windowChrome(w, barH) {
  const r = barH * 0.18
  return [0.28, 0.62, 0.96].map((f) => ({ cx: n(barH * f), cy: n(barH / 2), r: n(r) }))
}
