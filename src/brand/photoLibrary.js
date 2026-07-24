// ============================================================
// BIBLIOTECA DE FOTOS DE MAGOYA (del Drive, optimizadas)
// Para que el equipo no tenga que ir a buscar a una carpeta.
// ============================================================
const modules = import.meta.glob('./photos/*.jpg', { eager: true, query: '?url', import: 'default' })

const LABELS = {
  maiz: 'Maíz', 'maiz-2': 'Maíz 2', girasol: 'Girasol', soja: 'Soja',
  'trigo-campo': 'Trigo (campo)', trigo: 'Trigo', tractor: 'Tractor',
  logistica: 'Logística', 'campo-aereo': 'Campo (aéreo)', campo: 'Campo', produce: 'Produce',
}

export const PHOTOS = Object.entries(modules)
  .map(([path, url]) => {
    const slug = path.match(/([^/]+)\.jpg$/)[1]
    return { slug, url, label: LABELS[slug] || slug }
  })
  .sort((a, b) => a.label.localeCompare(b.label))
