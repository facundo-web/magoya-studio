// ============================================================
// ESTILOS DE PIEZA (Bloque B → Bloque S)
// Un estilo NO es otra plantilla: es la MISMA pieza compuesta
// distinto. Cambia sólo los ejes de composición — nunca el copy,
// nunca la foto, nunca los objetos que sumaste.
// Por eso el patch de cada estilo lista los ejes que toca: aplicarlo
// deja la pieza en un estado conocido (es idempotente y se puede volver
// a "Original" sin arrastrar restos). Los ejes que deja en `null` vuelven
// al valor que trae la plantilla.
//
// BLOQUE S — POR QUÉ SE CAYÓ LA MITAD DEL CATÁLOGO
// Facu: "los estilos de las piezas no parecen ajustar la pieza y son casi
// imperceptibles". Se midió (scripts/siluetas.mjs rasteriza la pieza a
// 128 px, que es el tamaño al que el feed decide, y cuenta píxeles): de las
// 178 combinaciones que ofrecía el panel, 141 cambiaban menos del 25% de la
// pieza. "Etiqueta con línea" movía el 0,2%. "Con aire", el 6,8%. Nueve
// opciones para elegir entre nueve cosas que se ven iguales no son nueve
// opciones: son la app diciéndole a alguien que no diseña que ya probó todo
// lo que había.
//
// El diagnóstico: los cinco ejes de antes (plate, anchor, density, scale,
// rule) son todos SUB-LAYOUT. Mueven el bloque de texto adentro de un marco
// que nunca cambia. Ahora el panel son SILUETAS: dónde caen las masas
// claras y oscuras, cuánta pieza es tinta y cuánta imagen (ver SILUETAS en
// engine/layouts.js).
//
// LA VARA, que no es una guía: si a 128 px un estilo no cambia al menos el
// 25% de los píxeles contra el Original, no se ofrece. Se corre con
// `node scripts/siluetas.mjs` y tiene que salir en verde.
//
// Lo que se retiró y dónde quedó:
//   · Arriba / Abajo / Centrado → el ancla ahora se elige en el panel Texto
//     ("Posición del bloque"), que es donde uno la busca. De paso arregla la
//     deuda que dejó el guard de contraste: "Centrado" era el único estilo
//     que plantaba el texto encima del gráfico de `impacto-pantalla` y de
//     los dos retratos de `speakers`.
//   · Con aire / Titular grande → los absorbe "Titular gigante", que hace en
//     serio lo que ellos insinuaban (el titular al doble, no un 16% más).
//   · Etiqueta con línea → 0,2%: no era un estilo, era un detalle.
//   · Texto en tarjeta / en barra → los absorben "Tarjeta" y "Bloque de
//     color", que son la misma idea llevada hasta la silueta.
// Ninguno se borró del motor: siguen siendo ejes, las plantillas los usan
// como default y el inspector los sigue tocando.
// ============================================================

// los ejes que un estilo puede tocar
export const VARIANT_AXES = ['silueta', 'plate', 'anchor', 'density', 'scale', 'rule']

function V(id, label, patch) {
  const set = {}
  VARIANT_AXES.forEach((k) => { set[k] = patch[k] ?? null })
  return { id, label, set }
}

// ---- las seis siluetas + el original ----
// El nombre que se ve es el que usaría alguien de marketing mirando la
// miniatura, no el del eje que mueve por dentro.
const SILUETAS_UI = [
  V('base', 'Original', {}),
  // la foto (o la tinta) ocupa todo y el texto se apoya contra el borde
  V('sangre', 'A sangre', { silueta: 'sangre', plate: 'none', anchor: 'bottom-left', rule: 'none', density: 'normal' }),
  // media pieza imagen, media pieza papel: el texto nunca compite con la foto
  V('mitad', 'Media pieza', { silueta: 'mitad', plate: 'none', anchor: 'top-left', rule: 'top', density: 'normal' }),
  // el acento como masa, a sangre, con el texto adentro
  V('bloque', 'Bloque de color', { silueta: 'bloque', plate: 'none', anchor: 'center-left', rule: 'none', density: 'normal' }),
  // la tipografía COMO imagen: el titular es la pieza
  V('gigante', 'Titular gigante', { silueta: 'gigante', plate: 'none', anchor: 'top-left', rule: 'none', density: 'compact' }),
  // toda la pieza adentro de una tarjeta, con el borde de la tinta alrededor
  V('tarjeta', 'Tarjeta', { silueta: 'tarjeta', plate: 'none', anchor: 'center-left', rule: 'top', density: 'normal' }),
  // marco grueso de acento y el centro intacto
  V('recuadro', 'Recuadro', { silueta: 'recuadro', plate: 'none', anchor: 'bottom-left', rule: 'top', density: 'normal' }),
]

// Estilos que NO se ofrecen en ciertas plantillas, con el motivo. No es una
// lista de gustos: cada línea salió de correr la vara o el guard.
// El héroe que "Titular gigante" puede agrandar. La cifra NO está: `metric`
// ya sale a sizeRel 0.2 —más del doble que un titular— y ocupa el ancho de
// la pieza, así que "Caso de cliente", "Dato" e "Insight" YA son un titular
// gigante. Medido: 19,8% / 17,6% / 20,7%, y no es una limitación del motor
// sino de la aritmética (una cifra tiene 8 caracteres: crece hasta el borde
// y ahí se termina).
const DISPLAY = ['title', 'quote']
// El único caso que no se puede deducir de la plantilla y hay que decir:
// la silueta planta el stack encima de algo que la plantilla ya tenía
// puesto. Es la deuda que U2 dejó declarada —"o la variante corre el objeto,
// o no se ofrece para esa plantilla"— resuelta por el segundo camino, que es
// el único que no rompe una composición ajena.
// Se descubren corriendo `node scripts/contraste.mjs`: una colisión sale
// como un par ilegible que ningún color arregla.
const NO_VA = {
  'speakers·mitad': 'el stack baja a la mitad de abajo y cae sobre los dos retratos (7 pares ilegibles en 5 esquemas)',
  // éste no lo encontró el guard sino el ojo: son dos textos encima, no un
  // texto encima de un color, y el contraste de los dos es perfecto
  'speakers·bloque': 'el stack se centra en el bloque y aterriza justo sobre los dos nombres',
}

// Y las colisiones que dependen del FORMATO. La misma silueta que en 4:5
// anda bien, en el cuadrado (donde el titular tiene más ancho y crece más)
// o en el story (donde el margen seguro es del 14% arriba y del 16% abajo)
// termina con el texto encima de un objeto de la plantilla. Se listan por
// familia de proporción, que es lo que de verdad manda.
// Salen del guard: `node scripts/contraste.mjs --formatos --todos`.
const NO_VA_EN = {
  'cuenta-regresiva·tarjeta': ['vertical916'],       // el 9:16 empuja el stack fuera de la tarjeta
  'impacto-apps·gigante': ['square'],                // el titular crecido tapa las tres apps
  // 24,4% a 128 px contra el 25% que pide la vara. Es poquísimo y por eso
  // vale decirlo: la vara se declaró como criterio duro, y un "por 0,6
  // puntos lo dejamos" la convierte en sugerencia. Además sólo se veía
  // corriendo el medidor en 9:16 — en el formato por defecto da 27,6% y
  // pasa. Una excepción que sólo aparece cuando la buscás es peor que la
  // excepción.
  'tech-titular·gigante': ['vertical916'],
}

function ofrecido(id, template, format) {
  const d = template.defaults || {}
  if (NO_VA[`${template.id}·${id}`]) return false
  if (format && (NO_VA_EN[`${template.id}·${id}`] || []).includes(format.group)) return false
  // ¿la plantilla clavó algo contra el borde? El marco de "Recuadro" y el
  // borde de "Tarjeta" ocupan el 8,5% del lado corto: un bloque puesto a mano
  // al 6% del borde queda debajo del marco, y el color no lo puede arreglar
  // porque la mitad de la palabra está sobre un campo y la otra mitad sobre
  // el otro. Medido con el guard: 24 pares ilegibles en Collage, 22 en
  // Celular, 19+14 en Quiénes hablan.
  const alBorde = Object.values(d.pos || {}).some((q) => q.x < 0.1 || q.y < 0.1 || q.x > 0.9 || q.y > 0.9)
  if ((id === 'recuadro' || id === 'tarjeta') && alBorde) return false
  // "Media pieza" en una plantilla que YA es media pieza de foto (Foto al
  // costado) parte lo que ya estaba partido: 0% de cambio y un texto que
  // termina sobre la imagen.
  if (id === 'mitad' && template.split) return false
  // Y en una con zócalo (Persona del equipo) es el zócalo un poco más alto:
  // 24,2% medido. La banda de la plantilla YA es la mitad de abajo.
  if (id === 'mitad' && template.zocalo) return false
  // "Titular gigante" necesita un titular al que agrandar. Si la pieza no
  // tiene rol de display —la pregunta de "Impacto · pregunta" vive adentro
  // de un bocadillo, que es un objeto— no hay nada que crecer: 2,7% medido.
  // Y si la plantilla le fija el tamaño a mano (Quiénes hablan lo usa para
  // que los dos nombres midan igual), ese tamaño manda y la silueta no lo
  // pisa: 9,6%.
  if (id === 'gigante') {
    const pos = d.pos || {}
    const enRoles = (template.roles || []).some((r) => DISPLAY.includes(r))
    const enBloques = (d.textBlocks || []).some((b, i) => DISPLAY.includes(b.style || 'title') && !pos[`tb:${i}`])
    if (!enRoles && !enBloques) return false
    if (DISPLAY.some((r) => d.sizes?.[r])) return false
  }
  return true
}

// Devuelve los estilos de una plantilla. Si el JSON declara `variants`
// (curadas a mano) se usan esas; si no, se ofrecen las siluetas que aplican.
// `format` es opcional: sin él se ofrece el catálogo de la pieza vertical,
// que es donde se edita. El panel del editor sí lo pasa, porque tres
// combinaciones sólo rompen en algunos formatos y no hay motivo para
// esconderlas en todos (ver NO_VA_EN).
export function variantsFor(template, format) {
  if (!template) return []
  if (template.category === 'chat') return [] // el chat no usa el stack de texto
  if (Array.isArray(template.variants) && template.variants.length) {
    return template.variants.map((v) => V(v.id, v.label, v.set || v))
  }
  return SILUETAS_UI.filter((v) => v.id === 'base' || ofrecido(v.id, template, format))
}

// ¿cuál está aplicada hoy? (compara los ejes, normalizando null/undefined)
export function activeVariantId(template, content) {
  // contra el catálogo completo y no contra el que se ofrece hoy: si un
  // proyecto guardado trae una silueta que en este formato no se ofrece, el
  // panel tiene que poder decir cuál es
  const vs = SILUETAS_UI
  const cur = (k) => {
    const v = content?.[k]
    return v === undefined || v === '' ? null : v
  }
  // La silueta alcanza para reconocer el estilo: los otros ejes son suyos y
  // si la persona corrió el ancla a mano después de elegirlo, el estilo
  // sigue siendo ése (antes cualquier retoque dejaba el panel sin nada
  // marcado, como si no hubieras elegido nada).
  const match = vs.find((v) => (v.set.silueta ?? null) === cur('silueta'))
  return match ? match.id : null
}
