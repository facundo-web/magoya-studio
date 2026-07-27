// ============================================================
// PROJECT STORE — persistencia local + export/import de proyecto.
// Fase 1 (sin backend): localStorage + archivo .magoya.json + link.
// Un "proyecto" = { templateId, formatId, content, slides? }.
// ============================================================

const KEY = 'magoya_studio_projects_v1'

export function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveProjects(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch (e) {
    console.warn('[store] no se pudo guardar (¿lleno?)', e)
    return false
  }
}

export function upsertProject(project) {
  const list = loadProjects()
  const i = list.findIndex((p) => p.id === project.id)
  if (i >= 0) list[i] = project
  else list.unshift(project)
  const ok = saveProjects(list)
  const out = ok ? list : loadProjects()
  out.saveOk = ok // el caller mira esto: si es false, el guardado FALLÓ
  return out
}

export function deleteProject(id) {
  const list = loadProjects().filter((p) => p.id !== id)
  saveProjects(list)
  return list
}

export function newProjectId() {
  const a = new Uint8Array(8)
  crypto.getRandomValues(a)
  return 'p_' + Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// BIBLIOTECA DE ELEMENTOS PROPIOS (logos / imágenes subidas)
//
// Los BYTES van a IndexedDB, igual que las fotos de las piezas. Antes se
// guardaban como data-URL dentro de localStorage: era lo que más rápido
// llenaba la cuota de ~5 MB del sitio, y una vez llena ya no se podía
// guardar NINGÚN proyecto. En localStorage queda sólo {id, name, kind, ref}.
// ============================================================
import { putPhoto, getPhoto, isRef } from './photoStore.js'

const ELEMENTS_KEY = 'magoya_studio_elements_v1'

function metaElements() {
  try {
    return JSON.parse(localStorage.getItem(ELEMENTS_KEY) || '[]')
  } catch {
    return []
  }
}

// Devuelve los elementos listos para usar (con el src real).
// Migra de paso lo que haya quedado en localStorage de la versión anterior.
export async function loadElements() {
  const meta = metaElements()
  let migro = false
  const out = []
  for (const e of meta) {
    if (e.src && !isRef(e.src)) {
      // versión vieja: los bytes estaban acá. Se mudan a IndexedDB.
      try {
        const ref = await putPhoto(e.src)
        out.push({ ...e, src: e.src, ref })
        migro = true
        continue
      } catch { out.push(e); continue }
    }
    const ref = e.ref || e.src
    const real = await getPhoto(ref)
    if (real) out.push({ ...e, ref, src: real })
    // si el blob no está, el elemento no se lista (y no se finge que existe)
  }
  if (migro) guardarMeta(out)
  return out
}

function guardarMeta(list) {
  const meta = list.map(({ id, name, kind, ref }) => ({ id, name, kind, ref }))
  try {
    localStorage.setItem(ELEMENTS_KEY, JSON.stringify(meta))
    return true
  } catch (e) {
    console.warn('[elements] no se pudo guardar el índice', e)
    return false
  }
}

// kind: 'photo' (fotos subidas) | 'element' (logos, PNG recortados, gráficos)
export async function addElement({ name, src, kind = 'element' }) {
  const el = { id: newProjectId().replace('p_', 'el_'), name: name || 'Elemento', src, kind }
  try {
    el.ref = await putPhoto(src)
  } catch (e) {
    console.warn('[elements] IndexedDB no disponible', e)
    return { el, saved: false }
  }
  const actuales = metaElements()
  const saved = guardarMeta([{ ...el }, ...actuales])
  return { el, saved }
}

export async function deleteElement(id) {
  const meta = metaElements().filter((e) => e.id !== id)
  guardarMeta(meta)
  return loadElements()
}

// las refs vivas de la biblioteca, para que el recolector no las borre
export function elementRefs() {
  return metaElements().map((e) => e.ref).filter(Boolean)
}

// ============================================================
// MIS PLANTILLAS — el usuario guarda sus propias plantillas
// (una pieza configurada → plantilla reutilizable). Sin código.
// ============================================================
const TEMPLATES_KEY = 'magoya_studio_templates_v1'

export function loadCustomTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]')
  } catch {
    return []
  }
}

// arma una plantilla a partir de la pieza actual (base + contenido)
export function buildTemplateFromPiece(base, content, name) {
  const defaults = { ...(base.defaults || {}), ...(content || {}) }
  delete defaults.photo // la foto no se hornea: cada uso sube la suya
  return {
    id: 'ct_' + newProjectId().slice(2),
    name: name || (content?.title ? String(content.title).slice(0, 40) : base.name),
    purpose: 'Tu plantilla guardada.',
    category: base.category,
    surface: base.surface,
    anchor: base.anchor,
    zocalo: base.zocalo || false,
    motif: base.motif,
    handAccent: base.handAccent || false,
    roles: base.roles,
    defaults,
    custom: true,
  }
}

export function saveCustomTemplate(tpl) {
  const list = [tpl, ...loadCustomTemplates()]
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))
    return true
  } catch (e) {
    console.warn('[templates] no se pudo guardar', e)
    return false
  }
}

export function deleteCustomTemplate(id) {
  const list = loadCustomTemplates().filter((t) => t.id !== id)
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))
  return list
}

// ---- export / import archivo ----
export function exportProjectFile(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (project.name || 'proyecto') + '.magoya.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function importProjectFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      try {
        resolve(JSON.parse(r.result))
      } catch (e) {
        reject(e)
      }
    }
    r.onerror = reject
    r.readAsText(file)
  })
}

// ---- share link liviano (sin fotos pesadas) ----
// mockup: si viene, el link abre en modo PREVIEW dentro de ese mockup.
export function toShareLink(project, mockup) {
  const light = {
    id: project.id,
    name: project.name,
    formatId: project.formatId,
    carousel: project.carousel,
    pieces: (project.pieces || []).map((p) => ({ templateId: p.templateId, content: stripPhotos(p.content) })),
    mockup: mockup || null,
    preview: !!mockup,
  }
  const json = JSON.stringify(light)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  const base = location.origin + location.pathname
  // los links muy largos los truncan WhatsApp y Slack: mejor decirlo
  if (b64.length > 60000) return { tooLong: true, size: b64.length }
  return `${base}#p=${b64}`
}

export function fromShareLink() {
  const m = location.hash.match(/[#&]p=([^&]+)/)
  if (!m) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(m[1]))))
  } catch {
    return null
  }
}

// Saca TODAS las fotos, no sólo la de fondo: las de los objetos (foto
// suelta, pantalla del dispositivo, captura, recortes) también son data-URL
// y hacían que el link pesara megas — se rompía al pegarlo y el aviso decía
// "sin foto" igual.
function stripPhotos(content) {
  if (!content) return content
  const c = { ...content }
  if (c.photo) c.photo = { note: 'foto no incluida en el link — usar archivo .magoya.json' }
  if (Array.isArray(c.objects)) {
    c.objects = c.objects.map((o) => (o.src && String(o.src).startsWith('data:') ? { ...o, src: null } : o))
  }
  return c
}

// ============================================================
// PIEZAS COMPARTIDAS (D4) — si perdés el link, perdés el feedback.
// Guardamos cada link de revisión que generás, con cuántos comentarios
// habías visto la última vez para poder avisar cuando hay nuevos.
// ============================================================
const SHARES_KEY = 'magoya_studio_shares_v1'

export function loadShares() {
  try {
    return JSON.parse(localStorage.getItem(SHARES_KEY) || '[]')
  } catch {
    return []
  }
}

function writeShares(list) {
  try { localStorage.setItem(SHARES_KEY, JSON.stringify(list)); return true } catch { return false }
}

export function rememberShare({ id, name, formatId }) {
  const list = loadShares().filter((s) => s.id !== id)
  list.unshift({ id, name: name || 'Sin título', formatId, at: new Date().toISOString(), seen: 0 })
  writeShares(list.slice(0, 30))
  return list
}

export function markShareSeen(id, count) {
  const list = loadShares().map((s) => (s.id === id ? { ...s, seen: count } : s))
  writeShares(list)
  return list
}

export function forgetShare(id) {
  const list = loadShares().filter((s) => s.id !== id)
  writeShares(list)
  return list
}

// Copiar al portapapeles sin mentir: si el navegador lo bloquea (pestaña sin
// foco, permiso denegado) se intenta el fallback y, si tampoco, se avisa.
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {}
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
