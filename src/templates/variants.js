// ============================================================
// VARIANTES DE PLANTILLA (Bloque B)
// Una variante NO es otra plantilla: es la MISMA pieza compuesta
// distinto. Cambia sólo los ejes de composición — nunca el copy,
// nunca la foto, nunca los objetos que sumaste.
// Por eso el patch de cada variante lista TODOS los ejes: aplicar
// una variante deja la pieza en un estado conocido (es idempotente
// y se puede volver a "Original" sin arrastrar restos).
// ============================================================

// los ejes que una variante puede tocar
export const VARIANT_AXES = ['plate', 'anchor', 'density', 'scale', 'rule']

function V(id, label, patch) {
  const set = {}
  VARIANT_AXES.forEach((k) => { set[k] = patch[k] ?? null })
  return { id, label, set }
}

// ---- catálogo genérico: sirve para cualquier plantilla clásica ----
const COMMON = [
  V('base', 'Original', {}),
  V('card', 'Texto en tarjeta', { plate: 'card' }),
  V('band', 'Texto en barra', { plate: 'band' }),
  V('center', 'Centrado', { anchor: 'center-center', rule: 'none' }),
  V('top', 'Arriba', { anchor: 'top-left' }),
  V('bottom', 'Abajo', { anchor: 'bottom-left' }),
  V('airy', 'Con aire', { density: 'roomy' }),
  V('big', 'Titular grande', { scale: 1.16, density: 'compact' }),
  V('kickerline', 'Etiqueta con línea', { rule: 'side' }),
]

// sobre foto se suman las placas que sólo tienen sentido con imagen
const PHOTO_EXTRA = [
  V('scrim', 'Sombreado abajo', { plate: 'scrim' }),
  V('clean', 'Texto sobre la foto', { plate: 'none' }),
]

// Devuelve las variantes de una plantilla. Si el JSON declara `variants`
// (curadas a mano) se usan esas; si no, se derivan de los ejes genéricos.
export function variantsFor(template) {
  if (!template) return []
  if (template.category === 'chat') return [] // el chat no usa el stack de texto
  if (Array.isArray(template.variants) && template.variants.length) {
    return template.variants.map((v) => V(v.id, v.label, v.set || v))
  }
  const onPhoto = template.surface === 'photo'
  let list = onPhoto ? [...COMMON.slice(0, 3), ...PHOTO_EXTRA, ...COMMON.slice(3)] : COMMON
  // "Etiqueta con línea" cuelga la línea de la volanta: si la plantilla no
  // tiene ese rol, la variante no hace nada (y en algunas hasta APAGA la
  // regla de acento, o sea saca la línea que promete).
  const tieneEtiqueta = (template.roles || []).includes('kicker')
    || (template.defaults?.textBlocks || []).some((b) => b.style === 'kicker')
  if (!tieneEtiqueta) list = list.filter((v) => v.id !== 'kickerline')

  // No ofrecer lo que no hace NADA. El catálogo se emitía a ciegas y medirlo
  // lo dejó a la vista: de 235 combinaciones plantilla × variante, 35 eran
  // píxel a píxel idénticas al Original. Una opción que no cambia nada no es
  // una opción: es la app diciéndole a alguien que no diseña que ya probó
  // todo lo que había.
  const propio = {
    anchor: template.anchor || 'bottom-left',
    plate: template.defaults?.plate ?? (template.zocalo ? 'band' : (template.surface === 'photo' ? 'scrim' : 'none')),
    density: template.defaults?.density ?? 'normal',
    scale: Number(template.defaults?.scale) || 1,
    rule: template.defaults?.rule ?? 'top',
  }
  // Si TODOS los ejes que toca la variante ya son los de la plantilla, la
  // pieza sale igual.
  list = list.filter((v) => {
    if (v.id === 'base') return true
    const tocados = VARIANT_AXES.filter((k) => v.set[k] !== null && v.set[k] !== undefined)
    if (!tocados.length) return true
    return tocados.some((k) => v.set[k] !== propio[k])
  })

  // Si la plantilla fija a mano la posición de TODOS sus bloques, no queda
  // stack: mover el ancla o la densidad no tiene sobre qué actuar y sólo
  // sobrevive el tamaño. Le pasa a Fecha marcada, Collage y Celular.
  const bloques = template.defaults?.textBlocks || []
  const posFijas = Object.keys(template.defaults?.pos || {}).length
  if (bloques.length && posFijas >= bloques.length) {
    list = list.filter((v) => v.id === 'base' || v.set.scale !== null)
  }
  return list
}

// ¿cuál está aplicada hoy? (compara los ejes, normalizando null/undefined)
export function activeVariantId(template, content) {
  const vs = variantsFor(template)
  const cur = (k) => {
    const v = content?.[k]
    return v === undefined || v === '' ? null : v
  }
  const match = vs.find((v) => VARIANT_AXES.every((k) => (v.set[k] ?? null) === cur(k)))
  return match ? match.id : null
}
