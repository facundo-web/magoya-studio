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
  V('card', 'Tarjeta', { plate: 'card' }),
  V('band', 'Banda', { plate: 'band' }),
  V('center', 'Centrado', { anchor: 'center-center', rule: 'none' }),
  V('top', 'Arriba', { anchor: 'top-left' }),
  V('bottom', 'Abajo', { anchor: 'bottom-left' }),
  V('airy', 'Con aire', { density: 'roomy' }),
  V('big', 'Titular grande', { scale: 1.16, density: 'compact' }),
  V('kickerline', 'Volanta con línea', { rule: 'side' }),
]

// sobre foto se suman las placas que sólo tienen sentido con imagen
const PHOTO_EXTRA = [
  V('scrim', 'Degradé', { plate: 'scrim' }),
  V('clean', 'Sin placa', { plate: 'none' }),
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
  const list = onPhoto ? [...COMMON.slice(0, 3), ...PHOTO_EXTRA, ...COMMON.slice(3)] : COMMON
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
