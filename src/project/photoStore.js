// ============================================================
// FOTOS EN INDEXEDDB — el arreglo de fondo del "se llenó el guardado".
//
// El problema: las fotos viajaban como data-URL (texto base64) DENTRO del
// JSON del proyecto, y ese JSON se guardaba en localStorage, que tiene ~5 MB
// para todo el sitio. Una sola foto de celular ya no entraba.
//
// La solución: los bytes de las fotos van a IndexedDB (cientos de MB, y
// guarda Blobs sin el +33% del base64). En el proyecto queda sólo una
// referencia corta. Así localStorage vuelve a guardar lo que sabe guardar:
// texto chico.
//
// En memoria las piezas siguen teniendo el data-URL real (el motor lo
// necesita para rasterizar): esto es sólo la capa de persistencia.
// ============================================================

const DB = 'magoya_photos'
const STORE = 'blobs'
let dbp = null

function open() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  }))
}

// hash del contenido: dos piezas con la misma foto la guardan una sola vez
async function hash(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return [...new Uint8Array(buf).slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const REF = 'idb:' // prefijo que marca "esto es una referencia, no una foto"

export function isRef(v) {
  return typeof v === 'string' && v.startsWith(REF)
}

export async function putPhoto(dataURL) {
  if (!dataURL || isRef(dataURL)) return dataURL
  const key = REF + (await hash(dataURL))
  await tx('readwrite', (s) => s.put(dataURL, key))
  return key
}

export async function getPhoto(key) {
  if (!isRef(key)) return key
  try {
    const v = await tx('readonly', (s) => s.get(key))
    return v || null
  } catch {
    return null
  }
}

// ---- recorrer un proyecto y cambiar fotos ⇄ referencias ----
// Los lugares donde vive una foto: content.photo.src y objects[].src
// (foto suelta, pantalla de dispositivo, captura, recorte).
async function walk(project, fn) {
  const out = JSON.parse(JSON.stringify(project))
  for (const piece of out.pieces || []) {
    const c = piece.content || {}
    if (c.photo?.src) c.photo.src = await fn(c.photo.src)
    for (const o of c.objects || []) {
      if (o.src) o.src = await fn(o.src)
    }
  }
  return out
}

// proyecto → versión liviana para localStorage (fotos en IndexedDB)
export async function dehydrate(project) {
  return walk(project, putPhoto)
}

// versión guardada → proyecto usable (fotos de vuelta en memoria)
export async function hydrate(project) {
  return walk(project, async (v) => (await getPhoto(v)) || v)
}

// borra las fotos que ya no usa ningún proyecto guardado
export async function collectGarbage(projects) {
  const vivos = new Set()
  for (const p of projects) {
    for (const piece of p.pieces || []) {
      const c = piece.content || {}
      if (isRef(c.photo?.src)) vivos.add(c.photo.src)
      for (const o of c.objects || []) if (isRef(o.src)) vivos.add(o.src)
    }
  }
  const claves = await tx('readonly', (s) => s.getAllKeys())
  const muertas = (claves || []).filter((k) => !vivos.has(k))
  if (muertas.length) await tx('readwrite', (s) => { muertas.forEach((k) => s.delete(k)); return null })
  return muertas.length
}

// cuánto espacio ocupa todo (para poder decirlo, no para adivinarlo)
export async function usage() {
  try {
    const est = await navigator.storage?.estimate?.()
    return est ? { usado: est.usage || 0, disponible: est.quota || 0 } : null
  } catch {
    return null
  }
}
