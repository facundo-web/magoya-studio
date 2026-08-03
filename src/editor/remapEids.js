// ============================================================
// LOS TEXTOS SUELTOS SE NOMBRAN POR ÍNDICE, Y ESO TIENE UN PRECIO.
//
// Un bloque de texto suelto es `tb:0`, `tb:1`… (y un paso numerado,
// `step:0`, `step:1`…): su nombre ES su posición en el array. Todo lo que
// la pieza sabe de él POR FUERA del array —hoy, sólo `content.pos`, la
// posición del que moviste a mano— vive en un mapa con esa clave.
//
// Borrar o reordenar bloques corre los índices, y ahí el nombre miente:
// tenías tb:0 y tb:1 con el tb:1 movido a mano, borrabas el tb:0, y el que
// quedaba pasaba a llamarse tb:0… pero su posición seguía guardada como
// tb:1. Resultado: el bloque saltaba a su lugar default y quedaba una pos
// huérfana apuntando a un bloque que ya no existe. Estas funciones remapean
// las claves en el MISMO parche que toca el array — nunca en dos pasos,
// porque dos set() seguidos se pisan y quedan como dos Deshacer.
//
// Si mañana aparece otro mapa indexado por eid (tamaños, colores por
// bloque), tiene que pasar por acá también.
// ============================================================

/**
 * Remapea las claves `<prefijo><N>` de un mapa según `nuevoIdx(N)`:
 * null = el bloque se borró y su entrada se va con él; otro número = el
 * bloque se corrió y la entrada lo sigue. Las claves de otros prefijos
 * (role:title, step:… cuando remapeás tb:) no se tocan.
 * Si no cambió nada devuelve el MISMO objeto (para no ensuciar el undo con
 * parches idénticos); si queda vacío devuelve undefined — mismo criterio
 * que volverAlStack: un {} vacío en el JSON del proyecto no dice nada.
 */
export function remapEidKeys(mapa, prefijo, nuevoIdx) {
  if (!mapa) return mapa
  let cambio = false
  const out = {}
  for (const [k, v] of Object.entries(mapa)) {
    if (!k.startsWith(prefijo)) { out[k] = v; continue }
    const viejo = +k.slice(prefijo.length)
    const nuevo = nuevoIdx(viejo)
    if (nuevo == null) { cambio = true; continue }
    if (nuevo !== viejo) cambio = true
    out[prefijo + nuevo] = v
  }
  if (!cambio) return mapa
  return Object.keys(out).length ? out : undefined
}

/** Índice nuevo de cada bloque después de borrar los del Set `borrados`:
 *  null si se borró; si no, el viejo menos cuántos borrados tenía antes. */
export const idxTrasBorrar = (borrados) => (i) => {
  if (borrados.has(i)) return null
  let n = i
  for (const b of borrados) if (b < i) n--
  return n
}

/** Índice nuevo después de intercambiar i y j (el "Subir/Bajar" del panel). */
export const idxTrasSwap = (i, j) => (k) => (k === i ? j : k === j ? i : k)

/**
 * La pos de las COPIAS de un duplicado/pegado. La decisión: la copia de un
 * bloque movido a mano HEREDA su posición, corrida un poquito — el mismo
 * gesto que enCascada con los objetos. "Duplicar" significa "otro igual, al
 * lado": sin esto la copia caía al stack, lejos del original, y parecía que
 * duplicar lo había movido de lugar. Si el original vive en el stack
 * (fuente null), la copia también: ahí el stack ES su lugar.
 * `fuentes[k]` es la pos original (o null) de la copia que se va a llamar
 * `tb:(base+k)`. Devuelve el mismo `pos` si no había nada que heredar.
 */
export function posConCopias(pos, base, fuentes) {
  let hay = false
  const out = { ...(pos || {}) }
  fuentes.forEach((p, k) => {
    if (!p) return
    hay = true
    out['tb:' + (base + k)] = { ...p, x: Math.min(0.92, p.x + 0.04), y: Math.min(0.92, p.y + 0.04) }
  })
  return hay ? out : pos
}
