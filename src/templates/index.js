// ============================================================
// ÍNDICE DE TEMPLATES — se alimenta agregando un .json y un import.
// Los templates son composiciones reutilizables en CUALQUIER formato.
// ============================================================

import zocaloPlaca from './zocalo-placa.json'
import fotoTitular from './foto-titular.json'
import fotoCentrada from './foto-centrada.json'
import bloqueColor from './bloque-color.json'
import cita from './cita.json'
import dato from './dato.json'
import carruselPortada from './carrusel-portada.json'
import techTitular from './tech-titular.json'
import blank from './blank.json'
import whatsapp from './whatsapp.json'
import carruselCierre from './carrusel-cierre.json'
import casoCliente from './caso-cliente.json'
import evento from './evento.json'
import retrato from './retrato.json'
import metodo from './metodo.json'
import impCifra from './impacto-cifra.json'
import impPantalla from './impacto-pantalla.json'
import impApps from './impacto-apps.json'
import impPregunta from './impacto-pregunta.json'
import contraste from './contraste.json'
import insight from './insight.json'
// tanda que sale de las referencias que mandaron Aye e Inés (jul 2026)
import fotoLateral from './foto-lateral.json'
import ytMiniatura from './youtube-miniatura.json'
import speakers from './speakers.json'
import eventoTarjeta from './evento-tarjeta.json'
// tanda de referencias de Canva que trajo marketing (jul 2026): la
// decoración ya viene puesta, ellas sólo cambian texto y fotos
import celularNotif from './celular-notificaciones.json'
import cuentaRegresiva from './cuenta-regresiva.json'
import collageStickers from './collage-stickers.json'
import fechaMarcada from './fecha-marcada.json'

// Orden por OBJETIVO de marketing (auditoría): primero lo que prueba y
// educa; "en blanco" al final — arrancar en blanco es donde se rompe la marca.
export const TEMPLATES = [
  impCifra, impApps, impPantalla, impPregunta, ytMiniatura, celularNotif, // AI en campo · alto impacto
  casoCliente, dato, insight, cita, retrato,          // prueba social y resultados
  metodo, contraste, techTitular, evento, eventoTarjeta, speakers,
  cuentaRegresiva, fechaMarcada, collageStickers, bloqueColor, // autoridad y anuncios
  carruselPortada, carruselCierre, whatsapp, // carrusel
  fotoLateral, zocaloPlaca, fotoTitular, fotoCentrada,    // foto + texto
  blank,                                      // último a propósito
]

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))
// Nota: las plantillas con `hidden` siguen existiendo (hay proyectos
// guardados que las referencian) pero la galería y el selector de slides no
// las ofrecen: son variantes de otra plantilla, no plantillas propias.
export const BLANK_TEMPLATE = blank

// El copy NO vive en la plantilla: la plantilla es estructura. Estos son
// los textos de muestra (placeholders) que se ven en la galería y con los
// que arranca la edición — el usuario los reemplaza.
// Los placeholders ENSEÑAN: cada uno está calibrado al largo y al tono
// correctos, así el equipo ve el ejemplo antes de escribir (auditoría de
// marketing). Los límites de MAXCHARS son la regla de oro por rol.
export const PLACEHOLDERS = {
  kicker: 'CASO DE CLIENTE',
  title: 'El agrónomo decide. La IA le da el contexto.',
  subtitle: 'Cómo lo resolvimos con un retailer de insumos en Brasil.',
  body: 'Tres cosas que aprendimos integrando datos de suelo con el ERP del cliente.',
  metric: '−70%',
  metricLabel: 'tickets de soporte, en 4 meses',
  quote: 'Se integraron en dos semanas y desde ahí no los tratamos como proveedor.',
  author: 'VP Product · Apeel Sciences',
  cta: 'Agendá 30 minutos',
  step: 'Entendemos el ciclo agronómico',
}

// Largo recomendado por rol. Es una GUÍA, no un techo: pasarte no rompe
// nada, sólo que el texto entra más chico. Los números de antes salían de
// "la gente no lee tanto" y en la práctica no alcanzaban — Aye: "setenta es
// muy poco para una placa que explique un toquecito".
export const MAXCHARS = {
  kicker: 28, title: 90, subtitle: 140, body: 260,
  metric: 8, metricLabel: 60, quote: 200, author: 44, cta: 32, step: 80,
}

// K3 · en la galería, TODAS las plantillas con foto se veían como la misma
// tarjeta gris (el esqueleto de "acá va una foto"). Cada una lleva una foto
// de demo distinta para que la grilla se pueda mirar en vez de leer.
// Es sólo para la miniatura: al abrir la pieza la foto la ponés vos.
import { PHOTOS } from '../brand/photoLibrary.js'
export function demoContent(t) {
  const c = placeholderContent(t)
  if (t.surface !== 'photo' || !PHOTOS.length) return c
  let h = 0
  for (const ch of t.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const p = PHOTOS[h % PHOTOS.length]
  return { ...c, photo: { src: p.url, natural: null, focal: { x: 0.5, y: 0.5 } } }
}

// contenido inicial de una plantilla: mantiene el DISEÑO (colores, logo,
// motivo, objetos) pero reemplaza el copy por placeholders y limpia la foto.
export function placeholderContent(t) {
  const d = t.defaults || {}
  const c = { ...d }
  delete c.photo
  // si la plantilla trae su propio copy calibrado (ej: la volanta "AI EN
  // CAMPO" de las piezas de impacto) ese gana: es más específico que el
  // placeholder genérico. El genérico sólo llena los roles vacíos.
  ;(t.roles || []).forEach((r) => {
    if (c[r] === undefined || String(c[r]).trim() === '') c[r] = PLACEHOLDERS[r] ?? ''
  })
  // Los bloques de una pieza libre conservan lo que trae la plantilla —
  // igual que los roles. Antes se tiraban y se ponía el placeholder
  // genérico, así que en la galería el evento decía "Escribí tu título"
  // y no se entendía de qué era la plantilla: "los textos no son
  // representativos de lo que hay adentro".
  c.textBlocks = (d.textBlocks || []).map((b) => ({
    ...b,
    text: String(b.text || '').trim() ? b.text : (PLACEHOLDERS[b.style] || 'Tu texto acá'),
  }))
  c.objects = (d.objects || []).map((o) => ({ ...o }))
  if (d.messages) c.messages = d.messages.map((m) => ({ ...m }))
  if (d.steps) c.steps = [...d.steps]
  return c
}

// ============================================================
// QUÉ TEXTOS ENTRAN DE VERDAD EN ESTA PIEZA
//
// Una pieza lleva texto de dos formas y hay que mirar las dos:
//   · la clásica → los roles que la plantilla DECLARA. El motor dibuja
//                  `for (role of STACK_ORDER) if (p.roles.includes(role))`,
//                  así que un rol no declarado no se dibuja nunca.
//   · la libre   → el texto vive en bloques sueltos y el "rol" es el
//                  estilo del bloque (textBlocks[i].style).
// Escribir `content.title` en la plantilla Dato no rompe nada, y eso es lo
// malo: no se ve. Algo que no se ve se puede dar por aplicado, y ésa es
// justo la mentira que el Aceptar del copiloto no se puede permitir.
//
// `contenido` es opcional y manda cuando está: los bloques que la persona
// sumó sobre la marcha viven ahí, no en los defaults de la plantilla. El
// `||` en cascada es el MISMO que usa resolvePiece para elegir bloques; si
// un día cambia allá, tiene que cambiar acá.
//
// `step` queda afuera a propósito: los pasos son un array (`content.steps`),
// no un rol, así que no hay ningún `content.step` que el motor mire.
// ============================================================
export function rolesDePieza(template, contenido = null) {
  const t = template || {}
  const roles = new Set(t.roles || (t.freeform ? [] : ['kicker', 'title', 'subtitle']))
  const bloques = contenido?.textBlocks || t.defaults?.textBlocks || []
  bloques.forEach((b) => roles.add(b?.style || 'title'))
  return [...roles]
}

// ============================================================
// CAMBIAR EL DISEÑO SIN PERDER LO ESCRITO
//
// Aye eligió otro diseño para su slide y no pasó nada visible: "¿ahí
// cambiaste? — falló". No era la UI: `content` arrastra TODAS las
// decisiones de diseño (colores, fondo, degradé, logo, ejes) y en el
// motor el contenido siempre le gana a los defaults de la plantilla.
// O sea que cambiar de plantilla cambiaba el esqueleto y nada más.
//
// Acá se parte en dos lo que antes era una bolsa sola:
//   DISEÑO  → lo pone la plantilla nueva (o la slide que copiás)
//   COPY    → lo que escribió la persona, se conserva siempre
// ============================================================

// lo que es DISEÑO: si cambiás de plantilla, esto lo decide la plantilla
const DESIGN_KEYS = [
  'scheme', 'accent', 'logo', 'showLogo', 'logoPos', 'logoScale',
  'bg', 'hasPhoto', 'treatment', 'gradient', 'photoDim', 'photoBlur', 'vignette',
  'plate', 'anchor', 'density', 'scale', 'rule', 'sizes',
]

// lo que es COPY: sobrevive al cambio de diseño
const COPY_ROLES = ['kicker', 'title', 'subtitle', 'body', 'metric', 'metricLabel', 'quote', 'author', 'cta', 'step']

// Si el rol exacto no existe en la plantilla nueva, se busca el más
// parecido: nadie espera perder el titular porque el diseño nuevo lo
// llame "cita". Se consume de a uno para no duplicar el mismo texto en
// dos lugares.
const PARECIDOS = {
  kicker: ['kicker', 'author'],
  title: ['title', 'quote', 'subtitle', 'body'],
  quote: ['quote', 'title', 'body'],
  metric: ['metric'],
  metricLabel: ['metricLabel', 'subtitle', 'kicker'],
  subtitle: ['subtitle', 'body', 'metricLabel'],
  body: ['body', 'subtitle', 'quote'],
  author: ['author', 'kicker'],
  cta: ['cta'],
  step: ['step'],
}
// orden en que se reparte el copy (lo más importante primero)
const REPARTO = ['kicker', 'title', 'quote', 'metric', 'metricLabel', 'subtitle', 'body', 'author', 'cta', 'step']

// identidad floja de un objeto, para saber cuáles puso la persona y
// cuáles venían con la plantilla vieja (esos se van con ella)
const claveObj = (o) => JSON.stringify([o.kind, o.iconId, o.shape, o.src ? 1 : 0])

/**
 * Devuelve el content de una pieza con el DISEÑO de `nuevo` y el COPY de
 * `copyDe`.
 * @param nuevo          plantilla destino
 * @param copyDe         content actual (de ahí salen los textos y la foto)
 * @param o.disenoDe     content del que copiar el diseño (default: los de la plantilla)
 * @param o.plantillaVieja  para no arrastrar los objetos que traía puestos
 */
export function applyDesign(nuevo, copyDe = {}, o = {}) {
  const base = placeholderContent(nuevo)
  // si el diseño se copia de otra slide (y no de la plantilla pelada),
  // esa slide manda: puede tener el acento o el fondo ya tocados a mano
  if (o.disenoDe) DESIGN_KEYS.forEach((k) => { if (o.disenoDe[k] !== undefined) base[k] = o.disenoDe[k] })

  // NO heredar el copy de muestra de la plantilla nueva. `placeholderContent`
  // llena todos los roles con placeholders porque sirve para arrancar una
  // pieza; acá estamos cambiando el diseño de algo YA escrito, y dejarlos
  // hacía aparecer frases que nadie tipeó ("IA APLICADA" plantada en la
  // portada de un carrusel). Los roles se llenan sólo con lo que había.
  //
  // Van en '' y no borrados: el motor hace `pick(content[rol], defaults[rol])`,
  // así que un rol AUSENTE cae igual al texto de fábrica de la plantilla.
  // La cadena vacía es lo único que dice "acá no va nada".
  COPY_ROLES.forEach((r) => { base[r] = '' })

  // ---- juntar todo el copy que había, venga de roles o de bloques ----
  const bolsa = {}
  COPY_ROLES.forEach((r) => {
    const v = copyDe[r]
    if (v !== undefined && v !== null && String(v).trim() !== '') bolsa[r] = v
  })
  ;(copyDe.textBlocks || []).forEach((b) => {
    const k = b.style || 'title'
    if (bolsa[k] === undefined && String(b.text || '').trim() !== '') bolsa[k] = b.text
  })
  // Lo que quedó guardado de un cambio de diseño anterior vuelve a estar
  // disponible: si pasás de tres roles a dos y después volvés a tres, la
  // bajada tiene que reaparecer en vez de haberse perdido para siempre.
  Object.entries(copyDe.__guardado || {}).forEach(([k, v]) => {
    if (bolsa[k] === undefined && String(v || '').trim() !== '') bolsa[k] = v
  })
  const tomar = (rol) => {
    for (const k of (PARECIDOS[rol] || [rol])) {
      if (bolsa[k] !== undefined) { const v = bolsa[k]; delete bolsa[k]; return v }
    }
    return undefined
  }

  if (nuevo.freeform) {
    // en las piezas libres los bloques SON de la persona: se pasan tal
    // cual, con su tamaño, resaltado y color. Una pieza libre acepta
    // cualquier estilo, así que acá no se pierde nada.
    const suyos = (copyDe.textBlocks || []).filter((b) => String(b.text || '').trim() !== '')
    if (suyos.length) {
      base.textBlocks = suyos.map((b) => ({ ...b }))
      suyos.forEach((b) => delete bolsa[b.style || 'title'])
    } else {
      const desdeRoles = REPARTO.filter((r) => bolsa[r] !== undefined)
      if (desdeRoles.length) {
        base.textBlocks = desdeRoles.map((r) => ({ style: r, text: bolsa[r] }))
        desdeRoles.forEach((r) => delete bolsa[r])
      }
      // si no había NADA escrito, se quedan los bloques de muestra de la
      // plantilla: una pieza libre vacía no se puede ni ver
    }
  } else {
    const declarados = nuevo.roles || []
    REPARTO.filter((r) => declarados.includes(r)).forEach((r) => {
      const v = tomar(r)
      if (v !== undefined) base[r] = v
    })
  }

  // Lo que no encontró lugar en el diseño nuevo NO se tira: queda a un
  // costado. Antes desaparecía sin aviso — probabas un diseño con menos
  // roles, volvías, y esa frase ya no existía.
  const sobrante = {}
  Object.entries(bolsa).forEach(([k, v]) => { if (String(v || '').trim() !== '') sobrante[k] = v })
  if (Object.keys(sobrante).length) base.__guardado = sobrante

  // la foto es de la persona, no del diseño
  if (copyDe.photo) base.photo = copyDe.photo
  // el chat y los pasos también son copy
  if (copyDe.messages && (nuevo.category === 'chat' || nuevo.defaults?.messages)) base.messages = copyDe.messages.map((m) => ({ ...m }))
  if (copyDe.steps && (nuevo.defaults?.steps || (nuevo.roles || []).includes('step'))) base.steps = [...copyDe.steps]

  // los objetos que sumó la persona se quedan; los que traía la plantilla
  // vieja se van con ella (estaban compuestos para ESE diseño)
  const traidos = new Set((o.plantillaVieja?.defaults?.objects || []).map(claveObj))
  const mios = (copyDe.objects || []).filter((ob) => !traidos.has(claveObj(ob)))
  base.objects = [...(base.objects || []), ...mios]

  return base
}

// categorías para agrupar/filtrar en la galería
export const CATEGORIES = {
  libre: 'En blanco',
  zocalo: 'Foto + zócalo',
  post: 'Post / anuncio',
  quote: 'Cita',
  metric: 'Dato',
  chat: 'Chat / WhatsApp',
  impacto: 'AI en campo · alto impacto',
}
