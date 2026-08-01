// ============================================================
// EXPORT — SVG → PNG/JPG (alta calidad a escala) + SVG vectorial
// + carrusel (ZIP de PNGs / PDF). Manrope embebida en base64 para
// que el raster salga con la tipografía correcta.
// ============================================================

import { renderPieceSVG } from './render.js'
import { registrarUso } from '../project/uso.js'
import { registrarPieza } from '../lib/memoria.js'

// woff2 de @fontsource (Vite los resuelve a URLs)
import w400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff2'
import w500 from '@fontsource/manrope/files/manrope-latin-500-normal.woff2'
import w600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff2'
import w700 from '@fontsource/manrope/files/manrope-latin-700-normal.woff2'
import w800 from '@fontsource/manrope/files/manrope-latin-800-normal.woff2'
import cav400 from '@fontsource/caveat/files/caveat-latin-400-normal.woff2'
import cav700 from '@fontsource/caveat/files/caveat-latin-700-normal.woff2'

const WEIGHTS = [
  [400, w400],
  [500, w500],
  [600, w600],
  [700, w700],
  [800, w800],
]
const HAND_WEIGHTS = [
  [400, cav400],
  [700, cav700],
]

let _fontFaceCss = null

async function fileToBase64(url) {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

// construye (y cachea) el CSS @font-face con Manrope embebida
export async function buildFontFaceCss() {
  if (_fontFaceCss) return _fontFaceCss
  const parts = await Promise.all([
    ...WEIGHTS.map(async ([weight, url]) => {
      const b64 = await fileToBase64(url)
      return `@font-face{font-family:'Manrope';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`
    }),
    ...HAND_WEIGHTS.map(async ([weight, url]) => {
      const b64 = await fileToBase64(url)
      return `@font-face{font-family:'Caveat';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`
    }),
  ])
  _fontFaceCss = parts.join('')
  return _fontFaceCss
}

// Safari en iPad/iPhone tiene un techo de ~16,7 megapíxeles por canvas. Al
// pasarlo NO siempre tira error: puede devolver un canvas vacío y un PNG en
// blanco perfectamente descargable. Un 16:9 a @3x son 18,7 MP, así que se
// llegaba de verdad. Se baja la escala lo justo para entrar.
const MAX_MP = 16e6
function escalaSegura(w, h, scale) {
  const mp = w * scale * h * scale
  if (mp <= MAX_MP) return scale
  return Math.max(1, Math.floor((scale * Math.sqrt(MAX_MP / mp)) * 100) / 100)
}

// SVG string → Blob PNG/JPG a escala
export function rasterize(svg, { w, h, scale = 2, type = 'image/png', quality = 0.95 }) {
  scale = escalaSegura(w, h, scale)
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob falló'))), type, quality)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo rasterizar el SVG'))
    }
    img.src = url
  })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function slugify(s) {
  return (
    String(s || 'magoya')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pieza'
  )
}

// El botón de exportar vive en el editor, que no conoce el nombre del
// proyecto: el ZIP salía siempre como "carrusel.zip" y tres carruseles en la
// carpeta de descargas eran carrusel.zip, carrusel(1).zip, carrusel(2).zip.
// App.jsx registra acá el nombre de la pieza abierta.
let _projectName = ''
export function setProjectExportName(name) {
  _projectName = String(name || '').trim()
}

// UN SOLO criterio de nombre para las dos salidas. Antes el PNG se bajaba con
// el título de la slide y el ZIP con el nombre del proyecto: la misma pieza
// aparecía en Descargas con dos apellidos distintos. Gana el NOMBRE DEL
// PROYECTO, y no el título, por dos razones: es lo que la persona tipeó y
// después busca (el título es copy de adentro de la pieza, y cambia cada vez
// que se edita), y en un carrusel las cinco slides tienen títulos distintos
// pero son una sola cosa. Si el proyecto todavía no tiene nombre cae al
// título y después a la plantilla, que es mejor que "pieza".
// El formato va al final en los dos: la misma pieza se baja en cuadrado y en
// 9:16, y sin el sufijo el segundo archivo entra como "(1)".
function nombreBase({ content, template, format, name }) {
  return slugify(name || _projectName || content?.title || template?.name) + (format?.id ? '-' + format.id : '')
}

// La misma señal que alimenta uso.js —bajarla es decir que sirvió— es la
// que le da al copiloto algo para leer. uso.js cuenta en localStorage,
// para esta pestaña; la bitácora es del equipo. Falla en silencio: la
// memoria es un lujo y descargar una pieza no puede depender de la red.
function anotarEnBitacora({ template, content, format, carrusel = false }) {
  try {
    registrarPieza({
      templateId: template?.id,
      formatId: format?.id,
      objetivo: template?.objetivo,
      titulo: content?.title || _projectName || template?.name,
      carrusel,
    })?.catch?.(() => {})
  } catch { /* la bitácora nunca frena una descarga */ }
}

// export de UNA pieza
export async function exportPiece({ template, content, format, kind = 'png', scale = 2, sizeLock = null }) {
  // bajarla ES la señal de que la plantilla sirvió (ver project/uso.js)
  registrarUso(template?.id)
  anotarEnBitacora({ template, content, format })
  const name = nombreBase({ content, template, format })
  if (kind === 'svg') {
    const fontFaceCss = await buildFontFaceCss()
    const svg = renderPieceSVG({ template, content, format, fontFaceCss, sizeLock })
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), name + '.svg')
    return
  }
  const fontFaceCss = await buildFontFaceCss()
  const svg = renderPieceSVG({ template, content, format, fontFaceCss, sizeLock })
  const type = kind === 'jpg' ? 'image/jpeg' : 'image/png'
  const blob = await rasterize(svg, { w: format.w, h: format.h, scale, type })
  downloadBlob(blob, name + '.' + kind)
}

// export de carrusel: varias slides (cada una {template,content}) mismo formato
// onProgress(hechas, total): un ZIP de 8 slides @3x tarda bastante y el
// aviso se iba a los 2 s — parecía colgado y la gente recargaba la página.
export async function exportCarousel({ slides, format, kind = 'zip', scale = 2, name, onProgress, sizeLock = null }) {
  // un carrusel usa varias plantillas: cuentan todas, cada una una vez
  const contadas = new Set()
  ;(slides || []).forEach((s) => { const id = s?.template?.id; if (id && !contadas.has(id)) { contadas.add(id); registrarUso(id) } })
  // En la bitácora un carrusel es UNA pieza, no cinco: lo que después se
  // publica y se mide es el carrusel entero. Se anota por su portada.
  if (slides?.[0]) anotarEnBitacora({ template: slides[0].template, content: slides[0].content, format, carrusel: true })
  const fontFaceCss = await buildFontFaceCss()
  // mismo criterio que la pieza suelta: proyecto → título de la portada →
  // plantilla de la portada (ver nombreBase)
  const base = nombreBase({ content: slides?.[0]?.content, template: slides?.[0]?.template, format, name })
  if (kind === 'pdf') {
    const { jsPDF } = await import('jspdf')
    const orientation = format.w >= format.h ? 'landscape' : 'portrait'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [format.w, format.h] })
    for (let i = 0; i < slides.length; i++) {
      const svg = renderPieceSVG({ template: slides[i].template, content: slides[i].content, format, fontFaceCss, sizeLock })
      const blob = await rasterize(svg, { w: format.w, h: format.h, scale, type: 'image/jpeg' })
      const dataUrl = await blobToDataURL(blob)
      if (i > 0) pdf.addPage([format.w, format.h], orientation)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, format.w, format.h)
      onProgress && onProgress(i + 1, slides.length)
    }
    pdf.save(base + '.pdf')
    return
  }
  // zip de PNGs
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (let i = 0; i < slides.length; i++) {
    const svg = renderPieceSVG({ template: slides[i].template, content: slides[i].content, format, fontFaceCss, sizeLock })
    const blob = await rasterize(svg, { w: format.w, h: format.h, scale, type: 'image/png' })
    zip.file(`${base}-${String(i + 1).padStart(2, '0')}.png`, blob)
    onProgress && onProgress(i + 1, slides.length)
  }
  const out = await zip.generateAsync({ type: 'blob' })
  downloadBlob(out, base + '.zip')
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(blob)
  })
}
