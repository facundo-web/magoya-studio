// ============================================================
// QUÉ PLANTILLAS SE USAN DE VERDAD
//
// Lucho: "estaría bueno un historial, y que puedas volver sobre las
// piezas que más te sirvieron". Y: "capaz que necesitás que ella te
// alimente los resultados, una especie de entrenamiento de curaduría".
//
// La señal que usamos NO es un like. Es la DESCARGA. Si alguien se tomó
// el trabajo de bajar la pieza, esa plantilla le sirvió — y no hubo que
// pedirle nada. Un pulgar arriba es una encuesta más para alguien que ya
// nos dijo que le cuesta tomar decisiones; la descarga ya está pasando.
//
// Vive en localStorage y ocupa nada: un contador y una fecha por
// plantilla. No viaja en el proyecto ni en los links compartidos.
// ============================================================

const KEY = 'magoya_studio_uso_v1'

function leer() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}

/** Suma una descarga a una plantilla. `cuantas` > 1 para un carrusel. */
export function registrarUso(templateId, cuantas = 1) {
  if (!templateId) return
  try {
    const todo = leer()
    const prev = todo[templateId] || { veces: 0, ultima: 0 }
    todo[templateId] = { veces: prev.veces + cuantas, ultima: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(todo))
  } catch {
    // si el guardado está lleno esto es lo PRIMERO que se puede perder:
    // es una estadística, no el trabajo de nadie
  }
}

/**
 * Las plantillas más usadas, de más a menos.
 * Pide al menos dos descargas: con una sola no hay señal, hay una prueba.
 */
export function masUsadas(templates, tope = 6) {
  const todo = leer()
  return templates
    .map((t) => ({ t, ...(todo[t.id] || { veces: 0, ultima: 0 }) }))
    .filter((x) => x.veces >= 2)
    .sort((a, b) => (b.veces - a.veces) || (b.ultima - a.ultima))
    .slice(0, tope)
}

export function vecesUsada(templateId) {
  return (leer()[templateId] || {}).veces || 0
}
