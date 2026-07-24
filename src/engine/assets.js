// ============================================================
// ASSET CACHE — convierte URLs de assets bundleados a data-URLs.
// Necesario porque al rasterizar un SVG (img.src = blob), las
// referencias externas NO se cargan por seguridad. Todo lo visual
// debe ir embebido como data-URL.
// Los íconos (logos IA/redes) se guardan como TEXTO para poder
// recolorearlos (blanco en tiles, color de marca en plano).
// ============================================================

import { WORDMARKS, CLIENT_LOGOS, MOTIF_ESTRATOS } from '../brand/brandKit.js'
import { ICON_URLS } from '../brand/iconLibrary.js'

const cache = new Map() // url -> dataURL (assets simples)
const iconText = new Map() // url -> raw svg text (para recolorear)
const coloredCache = new Map() // url|color -> dataURL

export function getAsset(url) {
  if (!url) return null
  return cache.get(url) || null
}

function svgTextToDataURL(text) {
  const encoded = encodeURIComponent(text).replace(/'/g, '%27').replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

async function fetchDataURL(url) {
  const res = await fetch(url)
  const text = await res.text()
  return svgTextToDataURL(text)
}

// devuelve un data-URL del ícono coloreado (o blanco)
export function coloredIcon(url, color) {
  if (!url) return null
  const key = url + '|' + color
  if (coloredCache.has(key)) return coloredCache.get(key)
  let text = iconText.get(url)
  if (!text) return cache.get(url) || null // fallback sin recolorear
  // inyecta fill en el <svg ...> (simple-icons: path hereda fill del svg)
  let colored = text.replace(/<svg([^>]*)>/, (m, attrs) => {
    const cleaned = attrs.replace(/\sfill="[^"]*"/g, '')
    return `<svg${cleaned} fill="${color}">`
  })
  const dataUrl = svgTextToDataURL(colored)
  coloredCache.set(key, dataUrl)
  return dataUrl
}

// precarga todos los assets de marca + íconos (una vez, en el boot)
export async function preloadBrandAssets() {
  const simple = new Set()
  Object.values(WORDMARKS).forEach((w) => w.url && simple.add(w.url))
  Object.values(CLIENT_LOGOS).forEach((l) => l.url && simple.add(l.url))
  if (MOTIF_ESTRATOS) simple.add(MOTIF_ESTRATOS)

  await Promise.all([
    ...[...simple].map(async (url) => {
      if (cache.has(url)) return
      try {
        cache.set(url, await fetchDataURL(url))
      } catch (e) {
        console.warn('[assets] no se pudo precargar', url, e)
      }
    }),
    ...ICON_URLS.map(async (url) => {
      if (iconText.has(url)) return
      try {
        const res = await fetch(url)
        iconText.set(url, await res.text())
      } catch (e) {
        console.warn('[assets] ícono', url, e)
      }
    }),
  ])
}

// dims naturales de un data-URL de imagen (para cover con focal point)
export function imageSize(dataURL) {
  return new Promise((resolve) => {
    if (!dataURL) return resolve(null)
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = dataURL
  })
}
