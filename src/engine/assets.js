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
  let colored
  if (text.includes('currentColor')) {
    // trazos/doodles (stroke o fill = currentColor): solo reemplazar el color,
    // NO tocar el fill del <svg> (rompería los trazos abiertos con fill="none")
    colored = text.replace(/currentColor/g, color)
  } else {
    // simple-icons monocromo: el path hereda el fill del <svg>
    colored = text.replace(/<svg([^>]*)>/, (m, attrs) => {
      const cleaned = attrs.replace(/\sfill="[^"]*"/g, '')
      return `<svg${cleaned} fill="${color}">`
    })
  }
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

// comprime una foto subida (máx 2048px, JPEG .85) → dataURL liviano
export function compressImage(file, maxSide = 2048, quality = 0.85) {
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        if (scale === 1 && r.result.length < 1.2e6) return resolve(r.result)
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth * scale)
        c.height = Math.round(img.naturalHeight * scale)
        const ctx = c.getContext('2d')
        // fondo blanco por si el PNG tiene transparencia y vamos a JPEG
        const hasAlpha = /image\/png|image\/webp/.test(file.type)
        if (!hasAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) }
        ctx.drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL(hasAlpha ? 'image/png' : 'image/jpeg', quality))
      }
      img.onerror = () => resolve(r.result)
      img.src = r.result
    }
    r.readAsDataURL(file)
  })
}

// quita el fondo de una foto (persona/objeto) 100% en el navegador.
// El modelo (~5MB) se baja la primera vez y queda cacheado.
export async function removeBackground(dataURL, onProgress) {
  const { removeBackground: rb } = await import('@imgly/background-removal')
  const blob = await (await fetch(dataURL)).blob()
  const out = await rb(blob, {
    output: { format: 'image/png' },
    progress: (key, cur, total) => onProgress && onProgress(Math.round((cur / Math.max(total, 1)) * 100)),
  })
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(out) })
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
