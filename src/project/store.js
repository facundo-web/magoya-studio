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
export function toShareLink(project) {
  const light = {
    templateId: project.templateId,
    formatId: project.formatId,
    content: stripPhotos(project.content),
    slides: project.slides ? project.slides.map((s) => ({ ...s, content: stripPhotos(s.content) })) : undefined,
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
