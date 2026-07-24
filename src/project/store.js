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
  return saveProjects(list) ? list : loadProjects()
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
// Cualquiera puede sumar elementos; quedan guardados y reutilizables.
// ============================================================
const ELEMENTS_KEY = 'magoya_studio_elements_v1'

export function loadElements() {
  try {
    return JSON.parse(localStorage.getItem(ELEMENTS_KEY) || '[]')
  } catch {
    return []
  }
}

export function addElement({ name, src }) {
  const el = { id: newProjectId().replace('p_', 'el_'), name: name || 'Elemento', src }
  const list = [el, ...loadElements()]
  try {
    localStorage.setItem(ELEMENTS_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('[elements] no se pudo guardar (¿lleno?)', e)
    return { el, saved: false }
  }
  return { el, saved: true }
}

export function deleteElement(id) {
  const list = loadElements().filter((e) => e.id !== id)
  localStorage.setItem(ELEMENTS_KEY, JSON.stringify(list))
  return list
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

function stripPhotos(content) {
  if (!content) return content
  const c = { ...content }
  if (c.photo) c.photo = { note: 'foto no incluida en el link — usar archivo .magoya.json' }
  return c
}
