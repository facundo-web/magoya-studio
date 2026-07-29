// ============================================================
// SUGERIR PLANTILLAS A PARTIR DE UNA FRASE
//
// "Contame qué querés hacer y te digo qué plantillas te sirven."
//
// Esta herramienta existe para que la IA no delire. Así que acá la regla
// es al revés que en un chatbot: NO hay obligación de responder. Si la
// frase no trae ninguna señal clara, esto devuelve [] y la persona ve la
// galería de siempre. Sugerir mal es peor que no sugerir: rompe la única
// promesa que tiene el producto.
//
// Tres capas, de la más barata y confiable a la más floja:
//   1. SEÑALES DURAS   — fecha, hora, cifra, red/formato, "carrusel",
//                        "3 tips". Son literales: están o no están.
//   2. REGLAS A MANO   — un mapeo explícito de las intenciones que este
//                        equipo escribe de verdad → plantillas concretas.
//                        Es la capa que decide. Se lee, se discute y se
//                        corrige en un rato.
//   3. ECO DE PALABRAS — cuánto se parece la frase al copy que YA tienen
//                        las plantillas. Sólo desempata: está topeada a
//                        18 puntos y el umbral para mostrar algo es 45.
//                        Nunca puede sugerir sola.
//
// Todo es puro y sincrónico. Sin red, sin dependencias, sin API key.
// ============================================================

// ------------------------------------------------------------
// Cuánto tiene que sacar una plantilla para que valga la pena mostrarla.
// Está calibrado a mano contra los casos de sugerir.test.md: 45 es
// "coincide el objetivo (40) y algo más", o "disparó una regla propia".
const UMBRAL = 45
// Si la plantilla no disparó ninguna regla propia y sólo coincide el
// objetivo, el listón sube: el objetivo agrupa media docena de plantillas
// y elegir tres de ahí es tirar la moneda.
const UMBRAL_SOLO_OBJETIVO = 58
// Mejor tres buenas que veinte ordenadas.
const MAXIMO = 3
// Y si la primera es mucho mejor que la tercera, la tercera sobra.
const PISO_RELATIVO = 0.5

// ============================================================
// NORMALIZACIÓN
// La gente escribe rápido y sin tildes. "webinar de IA en campo el 11 de
// junio" y "Webinar de ía en Campo el 11 de Junio" tienen que ser lo
// mismo. Con NFD la ñ también pierde la tilde (enseñar → ensenar), y eso
// está bien: los lexicones están escritos así a propósito.
// ============================================================
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Un item de lexicón matchea como PALABRA ENTERA. Si termina en `*` es
// prefijo: 'inscrib*' agarra inscribite, inscripción, inscribirse.
// Sin esto, 'tip' agarraba "tipo de post" y 'dato' no agarraba "datos".
function coincide(txt, item) {
  const abierto = item.endsWith('*')
  const cuerpo = (abierto ? item.slice(0, -1) : item).replace(/ /g, '\\s+')
  const re = new RegExp('(^|[^a-z0-9])' + cuerpo + (abierto ? '' : '($|[^a-z0-9])'))
  return re.test(txt)
}
// devuelve las palabras del lexicón que efectivamente aparecieron: son
// las que después se citan en el motivo, así el motivo es verificable
function cuales(txt, lista) {
  return lista.filter((i) => coincide(txt, i)).map((i) => i.replace(/\*$/, ''))
}

// ============================================================
// SEÑALES DURAS
// ============================================================

const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic'
const DIAS = 'lunes|martes|miercoles|jueves|viernes|sabado|domingo'
// "11 de junio", "18 sep", "23/07", "jueves 18"
const RE_FECHA = new RegExp(`\\b\\d{1,2}\\s*(?:de\\s+)?(?:${MESES})\\b|\\b\\d{1,2}[\\/-]\\d{1,2}(?:[\\/-]\\d{2,4})?\\b|\\b(?:${DIAS})\\s+\\d{1,2}\\b`)
// "11 h", "11hs", "11:00", "a las 19"
const RE_HORA = /\b\d{1,2}\s*[:.]\s*\d{2}\b|\b\d{1,2}\s*(?:h|hs|horas)\b|\ba las \d{1,2}\b/
// una cifra que sea NOTICIA: porcentaje o multiplicador. Un "3" suelto no
// es un resultado, es una cantidad de tips.
const RE_CIFRA = /[−+-]?\d+(?:[.,]\d+)?\s*%|\b\d+\s*(?:x|veces)\b/
// "3 tips", "cinco claves", "4 pasos"
const RE_LISTA = /\b(\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(tips?|formas|claves|razones|pasos|motivos|ideas|cosas|errores|mitos|consejos|puntos|aprendizajes)\b/
// "carrusel" pero también "4 slides": es lo mismo pedido de otra forma
const RE_CARRUSEL = /carrusel|carousel|\d+ slides|varias slides|varias placas/

// Qué formato pide la frase. Es la señal más barata y la más fuerte: si
// dice "story", el tamaño ya está decidido y no hay nada que adivinar.
// El orden importa: primero lo específico.
const REDES = [
  { fmt: 'yt-thumb', dice: 'una miniatura de YouTube', test: (t) => /\bminiatura|thumbnail|\bthumb\b/.test(t) || (/youtube|\byt\b/.test(t) && /portada|tapa|caratula/.test(t)) },
  { fmt: 'wa-status', dice: 'un estado de WhatsApp', test: (t) => /estado de (whats|wsp)|whatsapp status/.test(t) },
  { fmt: 'ig-story', dice: 'una story', test: (t) => /\bstory\b|\bstories\b|\bstorie\b|\bhistoria\b|\breel/.test(t) },
  { fmt: 'li-carousel', dice: 'un carrusel de LinkedIn', test: (t) => /linkedin/.test(t) && RE_CARRUSEL.test(t) },
  { fmt: 'li-square', dice: 'LinkedIn', test: (t) => /linkedin/.test(t) },
  { fmt: 'ig-portrait', dice: 'Instagram', test: (t) => /instagram|\big\b|\binsta\b/.test(t) },
  { fmt: 'fb-post', dice: 'Facebook', test: (t) => /facebook|\bfb\b/.test(t) },
  { fmt: 'x-post', dice: 'X / Twitter', test: (t) => /\btwitter\b|\ben x\b/.test(t) },
]

// ============================================================
// OBJETIVO
// Los mismos seis objetivos con que ya están tagueadas las plantillas y
// con que ya filtra la galería. No inventamos taxonomía nueva: las
// etiquetas de abajo son, palabra por palabra, las de los filtros de
// Gallery.jsx. Si la sugerencia dice "es para invitar a algo", la persona
// puede ir al filtro "Invitar a algo" y ver lo mismo. Eso es verificable.
// ============================================================
export const ETIQUETA = {
  webinar: 'invitar a algo',
  prueba: 'mostrar un resultado',
  ensenar: 'explicar algo',
  anuncio: 'anunciar',
  equipo: 'mostrar al equipo',
  cierre: 'cerrar un carrusel',
}

const LEX = {
  webinar: ['webinar*', 'charla*', 'evento*', 'invit*', 'inscrib*', 'anotate', 'anotarse', 'registro',
    'feria', 'expo*', 'jornada*', 'desayuno*', 'taller*', 'workshop', 'meetup', 'en vivo', 'streaming',
    'cupos', 'se viene', 'faltan', 'cuenta regresiva', 'save the date', 'guarda la fecha', 'agendate',
    'sumate', 'conferencia', 'panel', 'stand', 'presencial'],
  prueba: ['caso*', 'cliente*', 'resultado*', 'logramos', 'bajamos', 'subimos', 'redujimos', 'metrica*',
    'dato*', 'numero*', 'cifra*', 'testimoni*', 'prueba*', 'impacto', 'roi', 'ahorro', 'dashboard',
    'tablero', 'captura*', 'grafico*', 'fuente', 'estudio', 'informe', 'encuesta', 'reporte',
    'exito', 'antes y despues'],
  ensenar: ['tip', 'tips', 'como', 'guia*', 'explic*', 'ensenar', 'paso a paso', 'pasos', 'metodo*',
    'aprend*', 'truco*', 'error*', 'mito*', 'realidad', 'pregunta*', 'duda*', 'consulta*', 'checklist',
    'educativo', 'tutorial', 'consejo*', 'clave*', 'que es', 'por que', 'para que'],
  anuncio: ['lanzamos', 'lanzamiento', 'novedad*', 'anunci*', 'presentamos', 'ya esta', 'disponible',
    'estrenamos', 'salio', 'comunicar', 'nueva version', 'lanzar'],
  equipo: ['equipo*', 'sumamos', 'se suma', 'bienvenid*', 'integrante*', 'contratamos', 'se une',
    'cultura', 'oficina', 'estuvimos', 'fuimos', 'participamos', 'recap', 'resumen', 'retrato*',
    'nuestra gente', 'quienes somos', 'buscamos', 'hiring', 'colega*'],
  cierre: ['cierre', 'ultima slide', 'seguinos', 'cta final'],
}

// "estuvimos en Expoagro" NO es una invitación: es un recap. Sin esto,
// 'expo' mandaba todo al objetivo "invitar" y sugeríamos la tarjeta de
// evento para algo que ya pasó. El tiempo verbal es la señal.
const RE_PASADO = /\b(estuvimos|fuimos|participamos|pasamos por|estuvo|asi fue|asi estuvo|gracias a todos|gracias por venir|gracias por|se hizo|terminamos|cerramos)\b|\brecap\b/

// ============================================================
// analizar(texto) → todo lo que se pudo LEER de la frase, sin interpretar.
// Se exporta aparte porque es lo único que hay que mirar cuando una
// sugerencia sale mal: si la señal no está acá, el problema es de lectura,
// no de ranking.
// ============================================================
export function analizar(texto, formatos = []) {
  const t = normalizar(texto)
  const s = {
    texto: t,
    vacio: t.length < 8,        // "algo lindo" no es un pedido
    fecha: (t.match(RE_FECHA) || [null])[0],
    hora: (t.match(RE_HORA) || [null])[0],
    cifra: (t.match(RE_CIFRA) || [null])[0],
    lista: (t.match(RE_LISTA) || [null])[0],
    carrusel: RE_CARRUSEL.test(t),
    // ¿lo dijo con esa palabra? El motivo tiene que citar lo que la
    // persona escribió de verdad: si puso "4 slides", decirle "dijiste
    // carrusel" es mentirle, aunque para nosotros sea lo mismo.
    diceCarrusel: /carrusel|carousel/.test(t),
    pasado: RE_PASADO.test(t),
    formatoId: null,
    formato: null,
    diceFormato: null,
    objetivo: null,
    palabras: [],
    puntajes: {},
  }

  // ---- formato / red ----
  for (const r of REDES) {
    if (!r.test(t)) continue
    // sólo si el formato existe de verdad en el registro que nos pasaron
    const f = formatos.find((x) => x.id === r.fmt)
    if (!f) continue
    s.formatoId = f.id
    s.formato = f
    s.diceFormato = r.dice
    break
  }

  // ---- objetivo ----
  for (const [k, lista] of Object.entries(LEX)) {
    const hits = cuales(t, lista)
    if (hits.length) s.puntajes[k] = hits
  }
  // el tiempo pasado le saca la invitación y se la da al equipo/recap
  if (s.pasado && s.puntajes.webinar) {
    s.puntajes.equipo = [...(s.puntajes.equipo || []), ...s.puntajes.webinar]
    delete s.puntajes.webinar
  }
  const orden = Object.entries(s.puntajes).sort((a, b) => b[1].length - a[1].length)
  if (orden.length) {
    s.objetivo = orden[0][0]
    s.palabras = orden[0][1]
  }
  return s
}

// ============================================================
// REGLAS A MANO
//
// Ésta es la capa que decide, y está escrita para leerse en voz alta en
// una reunión. Cada regla dice: cuándo se activa, a qué plantillas les da
// puntos y con qué motivo. El motivo tiene que ser VERDADERO — describe
// lo que la plantilla realmente hace, no una frase para sonar inteligente.
//
// `da` acepta `id: puntos` o `id: [puntos, 'motivo propio de esta pieza']`.
//
// `tema` sirve para que el motivo no diga dos veces lo mismo: si una regla
// ya explica que la pieza es para invitar, no hace falta agregarle "y es
// para invitar a algo". Las reglas con el mismo tema se pisan entre sí y
// gana la más específica.
// ============================================================
const REGLAS = [
  {
    id: 'miniatura',
    test: (s) => s.formatoId === 'yt-thumb',
    porque: (s) => `pediste ${s.diceFormato} y esta plantilla es exactamente eso (1280×720, titular a la izquierda y la persona a la derecha)`,
    da: { 'youtube-miniatura': 70 },
  },
  {
    id: 'speakers',
    test: (s) => /\b(dos|2) (personas|oradores|que )|quienes hablan|speakers?\b|expositor|disertante|panelista|presentar a (las|los|dos)|los que dan la charla|quien da la charla|quienes dan/.test(s.texto),
    porque: () => 'nombrás a las personas que dan la charla y esta plantilla pone dos retratos con nombre y rol',
    da: { speakers: 65 },
  },
  {
    id: 'cuenta-atras',
    test: (s) => !s.pasado && /faltan|se viene|ultimos dias|ultima semana|cierra la inscripcion|arranca en|en \d+ dias|\bmanana\b|\bhoy\b/.test(s.texto),
    porque: () => 'estás avisando cuánto falta, y esta plantilla es el número gigante de días',
    da: { 'cuenta-regresiva': 60 },
  },
  {
    id: 'save-the-date',
    tema: 'objetivo',
    // Sólo cuando lo pide TEXTUALMENTE. Antes también disparaba con
    // "hay fecha y no hay hora", y con eso "webinar el 11 de junio" te
    // devolvía primero el save-the-date en lugar de la invitación
    // completa. Un webinar con fecha quiere el botón de inscripción.
    test: (s) => /save the date|guarda(te)? la fecha|agenda(te)? la fecha|reserva la fecha|anota la fecha/.test(s.texto),
    porque: (s) => `estás pidiendo que agenden la fecha${s.fecha ? ` (${s.fecha})` : ''}, y esta plantilla la pone grande con el círculo dibujado a mano`,
    da: { 'fecha-marcada': 55 },
  },
  {
    id: 'evento-con-fecha',
    tema: 'objetivo',
    test: (s) => s.objetivo === 'webinar' && !s.pasado && (!!s.fecha || !!s.hora),
    porque: (s) => `es para invitar y ya tenés ${[s.fecha && `fecha (${s.fecha})`, s.hora && `hora (${s.hora})`].filter(Boolean).join(' y ')}`,
    da: {
      evento: [45, 'y esta plantilla tiene volanta, titular, la línea de fecha/lugar y el botón de inscripción'],
      'evento-tarjeta': [35, 'y esta pone la tarjeta con la fecha encima de una foto de ambiente'],
      'fecha-marcada': [25, 'y esta la pone grande con el círculo dibujado a mano'],
    },
  },
  {
    id: 'recap',
    tema: 'objetivo',
    test: (s) => s.pasado || /recap|resumen de la semana|asi fue|album|galeria de fotos/.test(s.texto),
    porque: () => 'estás contando algo que YA pasó',
    da: {
      'collage-stickers': [60, 'y esta plantilla es el collage de tres fotos con la etiqueta “recap”'],
      retrato: 15,
    },
  },
  {
    id: 'caso',
    tema: 'objetivo',
    test: (s) => /\bcaso\b|caso de exito|de cliente|del cliente|con el cliente|trabajamos con/.test(s.texto),
    porque: () => 'es un caso de cliente',
    da: {
      'caso-cliente': [55, 'y esta plantilla es la que lleva el resultado con el logo del cliente'],
      cita: [25, 'y podés contarlo con la frase textual del cliente'],
      dato: 20,
    },
  },
  {
    id: 'cifra',
    test: (s) => !!s.cifra,
    porque: (s) => `hay un número que es la noticia (${s.cifra.trim()})`,
    da: {
      dato: [45, 'y esta plantilla es el número solo, bien grande'],
      'caso-cliente': 35,
      'impacto-cifra': [30, 'y esta lo pone sobre la foto, con la persona recortada'],
      insight: 20,
    },
  },
  {
    id: 'fuente-externa',
    test: (s) => /\bfuente\b|segun (un|el|la)|un estudio|el informe|reporte de|usda|inta|encuesta de|paper/.test(s.texto),
    porque: () => 'citás un dato de afuera, y esta plantilla tiene el lugar para la fuente además de tu lectura',
    da: { insight: 55 },
  },
  {
    id: 'cita',
    test: (s) => /\bfrase\b|\bcita\b|testimoni|nos dijo|dijo (que|un)|palabras de|comentario de un cliente|lo que dijo/.test(s.texto),
    porque: () => 'querés poner algo textual que dijo alguien',
    da: { cita: 55, retrato: [20, 'y si la dijo alguien del equipo, va con su retrato'] },
  },
  {
    id: 'pantalla',
    test: (s) => /dashboard|tablero|captura|screenshot|pantalla|la demo|el producto en accion|grafico/.test(s.texto),
    porque: () => 'querés mostrar la pantalla o el gráfico, y esta plantilla tiene el lugar para la captura y las barras que suben',
    da: { 'impacto-pantalla': 55 },
  },
  {
    id: 'pregunta',
    test: (s) => /\bpregunta|\bduda|\bconsulta|nos preguntan|me preguntan|siempre preguntan|\?/.test(s.texto),
    porque: () => 'arranca de una pregunta real, y esta plantilla la pone en un bocadillo',
    da: { 'impacto-pregunta': 50, whatsapp: [30, 'o la resolvés como conversación de WhatsApp'] },
  },
  {
    id: 'chat',
    test: (s) => /whatsapp|\bwsp\b|\bchat\b|conversacion|mensaje del productor|un ida y vuelta/.test(s.texto),
    porque: () => 'lo pensás como conversación, y esta plantilla dibuja el chat',
    da: { whatsapp: 55 },
  },
  {
    id: 'pasos',
    test: (s) => /paso a paso|\bpasos\b|\bmetodo\b|como trabajamos|nuestro proceso|etapas|como lo hacemos/.test(s.texto),
    porque: () => 'lo estás contando en pasos, y esta plantilla los numera',
    da: { metodo: 55 },
  },
  {
    id: 'lista',
    test: (s) => !!s.lista,
    porque: (s) => `decís “${s.lista}”, o sea una lista`,
    da: {
      'carrusel-portada': 40,   // el porqué ya lo pone la regla 'carrusel'
      metodo: 30,
      'tech-titular': [25, 'y esta sirve para cada ítem de la lista'],
    },
  },
  {
    id: 'carrusel',
    test: (s) => s.carrusel,
    porque: (s) => (s.diceCarrusel ? 'dijiste carrusel' : 'pediste varias slides'),
    da: {
      'carrusel-portada': [45, 'y esta es la slide 1'],
      'carrusel-cierre': [30, 'y esta es la última, con el llamado a la acción'],
      'tech-titular': 20,
    },
  },
  {
    id: 'mito',
    test: (s) => /\bmito|lo que te venden|creencia|\bfalso\b|verdad o|\bversus\b|\bvs\b|contra lo que/.test(s.texto),
    porque: () => 'estás contraponiendo dos cosas, que es literalmente lo que hace esta plantilla',
    da: { contraste: 60 },
  },
  {
    id: 'persona-equipo',
    test: (s) => /sumamos|se suma|se sumo|bienvenid|nuevo integrante|nueva integrante|contratamos|se une|presentamos a|nuestro equipo|del equipo/.test(s.texto),
    porque: () => 'es sobre una persona del equipo, y esta plantilla es el retrato con su frase',
    da: { retrato: 55 },
  },
  {
    id: 'herramientas',
    test: (s) => /que herramienta|con cual|chatgpt|\bclaude\b|gemini|copilot|herramientas de ia|que ia\b|cual ia/.test(s.texto),
    porque: () => 'preguntás con qué herramienta, y esta plantilla tiene los logos de IA puestos',
    da: { 'impacto-apps': 55 },
  },
  {
    id: 'alertas',
    test: (s) => /notificacion|alerta|le llega al celular|al telefono|al celu|avisos? al/.test(s.texto),
    porque: () => 'hablás de algo que le llega al celular, y esta plantilla dibuja el teléfono con las notificaciones',
    da: { 'celular-notificaciones': 55 },
  },
  {
    id: 'anuncio',
    tema: 'objetivo',
    test: (s) => s.objetivo === 'anuncio',
    porque: (s) => `es un anuncio (decís “${s.palabras[0]}”)`,
    da: {
      'bloque-color': [45, 'y esta plantilla es el bloque de color con volanta, titular y bajada'],
      'tech-titular': 35,
    },
  },
  {
    id: 'con-foto',
    test: (s) => /\bfoto\b|\bfotos\b|\bimagen\b|con una imagen/.test(s.texto) && !/sin foto/.test(s.texto),
    porque: () => 'pediste foto, y esta plantilla parte la pieza en mitad foto y mitad texto',
    da: { 'foto-lateral': 45, 'evento-tarjeta': 15, 'carrusel-portada': 10 },
  },
]

// Plantillas que NO salen a menos que dispare su regla propia. Son las
// muy específicas: si aparecen "por objetivo" ensucian todas las
// respuestas (la miniatura de YouTube salía en cada anuncio).
// [] = nunca se sugiere.
const SOLO_SI = {
  'youtube-miniatura': ['miniatura'],
  whatsapp: ['chat', 'pregunta'],
  'carrusel-portada': ['carrusel', 'lista', 'con-foto'],
  'carrusel-cierre': ['carrusel'],
  'celular-notificaciones': ['alertas'],
  'collage-stickers': ['recap'],
  speakers: ['speakers'],
  'impacto-apps': ['herramientas'],
  'impacto-pantalla': ['pantalla'],
  'impacto-pregunta': ['pregunta'],
  'foto-lateral': ['con-foto'],
  blank: [],
}

// ============================================================
// ECO DE PALABRAS
//
// Última capa y la más floja: cuánto se parece la frase al copy que ya
// tiene la plantilla. Se descartan las palabras que están en casi todas
// (campo, datos, magoya…): esas no distinguen nada. Y el aporte se topea,
// porque el parecido léxico es la forma más fácil de delirar — "suelo"
// aparece en una plantilla y de golpe esa plantilla es "la del suelo".
// ============================================================
const ECO_TOPE = 18
const ECO_DF = 0.3   // si la palabra está en más del 30% de las plantillas, no sirve

const raiz = (w) => (w.length > 5 ? w.replace(/(es|s)$/, '') : w)

function palabrasDe(t) {
  const partes = [t.name, t.purpose]
  const d = t.defaults || {}
  for (const k of ['kicker', 'title', 'subtitle', 'body', 'metricLabel', 'quote', 'author', 'cta']) if (d[k]) partes.push(d[k])
  ;(d.textBlocks || []).forEach((b) => partes.push(b.text))
  ;(d.steps || []).forEach((x) => partes.push(x))
  ;(d.messages || []).forEach((m) => partes.push(m.text))
  ;(d.objects || []).forEach((o) => o.text && partes.push(o.text))
  return new Set(normalizar(partes.join(' ')).split(/[^a-z0-9]+/).filter((w) => w.length >= 5).map(raiz))
}

function indiceEco(templates) {
  const bolsas = new Map()
  const df = new Map()
  for (const t of templates) {
    const b = palabrasDe(t)
    bolsas.set(t.id, b)
    for (const w of b) df.set(w, (df.get(w) || 0) + 1)
  }
  const tope = Math.max(1, Math.floor(templates.length * ECO_DF))
  return { bolsas, sirve: (w) => (df.get(w) || 0) <= tope }
}

// ============================================================
// sugerir(texto, { templates, formatos })
//   → [{ template, id, score, motivo, motivos, reglas }]  (0 a 3)
// Pura: mismas entradas, misma salida. Sin red.
// ============================================================
export function sugerir(texto, { templates = [], formatos = [] } = {}) {
  const s = analizar(texto, formatos)
  if (s.vacio) return []

  // ---- qué reglas disparan ----
  const activas = []
  for (const r of REGLAS) {
    let ok = false
    try { ok = !!r.test(s) } catch { ok = false }
    if (ok) activas.push(r)
  }
  const idsActivas = new Set(activas.map((r) => r.id))

  // Confianza mínima: sin objetivo, sin regla y sin formato no hay nada
  // que sugerir. Acá es donde el módulo se calla la boca.
  if (!s.objetivo && !activas.length && !s.formatoId) return []

  const eco = indiceEco(templates)
  const palabrasTexto = new Set(s.texto.split(/[^a-z0-9]+/).filter((w) => w.length >= 5).map(raiz))

  const out = []
  for (const t of templates) {
    if (t.hidden) continue
    const veto = SOLO_SI[t.id]
    if (veto && !veto.some((r) => idsActivas.has(r))) continue

    let score = 0
    const motivos = []   // { pts, txt, tema, base }
    const reglas = []

    // 1 · objetivo (la señal más gruesa: la que ya usa el filtro de la galería)
    if (s.objetivo && t.objetivo === s.objetivo) {
      score += 40
      motivos.push({
        pts: 40, tema: 'objetivo', base: true,
        txt: `es para ${ETIQUETA[s.objetivo]}${s.palabras[0] ? ` (decís “${s.palabras[0]}”)` : ''}`,
      })
    }

    // 2 · reglas a mano
    for (const r of activas) {
      const v = r.da[t.id]
      if (v === undefined) continue
      const pts = Array.isArray(v) ? v[0] : v
      const propio = Array.isArray(v) ? v[1] : null
      score += pts
      reglas.push(r.id)
      // sólo se cita el motivo de las reglas que pesan: las de 20 puntos
      // están para ordenar, no para explicar
      if (pts >= 25) motivos.push({ pts, tema: r.tema || r.id, txt: propio ? `${r.porque(s)}, ${propio}` : r.porque(s) })
    }

    // 3 · eco (desempate, topeado)
    let ecoPts = 0
    const ecoW = []
    const bolsa = eco.bolsas.get(t.id)
    if (bolsa) {
      for (const w of palabrasTexto) {
        if (bolsa.has(w) && eco.sirve(w)) { ecoPts += 6; ecoW.push(w) }
      }
    }
    ecoPts = Math.min(ecoPts, ECO_TOPE)
    score += ecoPts
    if (ecoPts >= 12) motivos.push({ pts: ecoPts, tema: 'eco', txt: `esta plantilla ya habla de ${ecoW.slice(0, 2).map((w) => `“${w}”`).join(' y ')}` })

    // Una plantilla que sólo pega por OBJETIVO no es una sugerencia: es un
    // filtro. El objetivo agrupa de a cinco o seis plantillas y elegir tres
    // de ahí sería tirar la moneda. Para eso ya está el filtro "Explicar
    // algo" de la galería, que además la persona controla. Así que sin
    // regla propia, el listón sube.
    const bar = reglas.length ? UMBRAL : UMBRAL_SOLO_OBJETIVO
    if (score >= bar) out.push({ template: t, id: t.id, score, motivos: limpiarMotivos(motivos), reglas })
  }

  out.sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name))
  const mejor = out[0]?.score || 0
  return out
    .filter((x) => x.score >= mejor * PISO_RELATIVO)
    .slice(0, MAXIMO)
    .map((x) => ({
      template: x.template,
      id: x.id,
      score: x.score,
      reglas: x.reglas,
      // el motivo se arma con las razones más fuertes primero, y son las
      // que REALMENTE sumaron puntos: no hay forma de que diga algo que
      // no pasó
      motivo: 'porque ' + x.motivos.slice(0, 2).map((m) => m.txt).join(', y '),
      motivos: x.motivos.map((m) => m.txt),
    }))
}

// Un tema se dice una sola vez, y lo dice la razón más específica: entre
// "es un caso de cliente" (regla) y "es para mostrar un resultado"
// (objetivo), la primera. Sin esto el motivo repetía la misma señal con
// otras palabras y sonaba a relleno de IA — justo lo que no queremos.
function limpiarMotivos(motivos) {
  const porTema = new Map()
  for (const m of motivos) {
    const prev = porTema.get(m.tema)
    if (!prev) { porTema.set(m.tema, m); continue }
    const gana = (prev.base && !m.base) || (prev.base === m.base && m.pts > prev.pts)
    if (gana) porTema.set(m.tema, m)
  }
  return [...porTema.values()].sort((a, b) => b.pts - a.pts)
}

// ============================================================
// CARRUSELES ARMADOS
// Si la frase dice "carrusel", lo que corresponde no es una plantilla: es
// una de las secuencias ya armadas de carousels.js. Se elige por objetivo,
// que es exactamente para lo que están hechas.
// ============================================================
const CARRUSEL_POR_OBJETIVO = { ensenar: 'guia', prueba: 'caso', webinar: 'webinar', anuncio: 'guia' }

export function sugerirCarrusel(texto, carruseles = [], formatos = []) {
  const s = analizar(texto, formatos)
  if (!s.carrusel && !s.lista) return null
  const id = /\bcaso\b|de cliente/.test(s.texto) ? 'caso'
    : (CARRUSEL_POR_OBJETIVO[s.objetivo] || (s.lista ? 'guia' : null))
  if (!id) return null
  const c = carruseles.find((x) => x.id === id)
  if (!c) return null
  return {
    carrusel: c,
    motivo: s.diceCarrusel
      ? 'porque pediste un carrusel y éste ya viene con portada, internos y cierre'
      : s.carrusel
        ? 'porque pediste varias slides y éste ya viene con portada, internos y cierre'
        : `porque “${s.lista}” es una lista y esto ya viene con portada, internos y cierre`,
  }
}

// ============================================================
// Una sola llamada para la UI: plantillas + formato + carrusel.
// ============================================================
export function sugerirTodo(texto, { templates = [], formatos = [], carruseles = [] } = {}) {
  const senales = analizar(texto, formatos)
  return {
    plantillas: sugerir(texto, { templates, formatos }),
    formato: senales.formato,
    diceFormato: senales.diceFormato,
    carrusel: sugerirCarrusel(texto, carruseles, formatos),
    senales,
  }
}

// ============================================================
// ARMAR LA PIEZA, NO SÓLO SUGERIRLA
//
// "El buscador tiene que ser algo más cercano a un prompt que en base al
// pedido te devuelva un resultado dentro de la plataforma."
//
// La diferencia con un chatbot es la línea que este producto no cruza:
// acá NO se escribe copy. Se REUBICA el que la persona ya escribió. Si
// puso "webinar de IA en campo el 11 de junio", el titular dice "IA en
// campo" y la línea de fecha dice "11 de junio" — dos pedazos textuales
// de su frase, puestos donde van. Nada inventado, nada reescrito.
//
// Lo que la frase no dice, queda con el texto de muestra de la plantilla,
// que es lo que pasa hoy al abrir cualquier plantilla.
// ============================================================

// El TEMA es un PEDAZO TEXTUAL de la frase, no una bolsa de palabras.
// Primer intento: filtraba palabra por palabra y volvía a unir, y salía
// "Webinar ia campo" — un titular que nadie escribiría. Eso es delirio en
// miniatura, justo lo que esta herramienta viene a evitar. Ahora se le
// recorta el andamiaje a los BORDES y el medio se respeta tal cual, con
// sus preposiciones: "ia en campo".

// Lo que sobra al principio: la intención, el tipo de pieza, la red.
const BORDE_INICIO = /^(?:\s*(?:hola|che|quiero|queria|querria|necesito|dame|haceme|armame|generame|me\s+armas|podes|puedo|hacer|armar|crear|generar|un|una|unos|unas|el|la|los|las|algo|otro|otra|nuevo|nueva|pieza|piezas|placa|placas|posteo|posteos|post|publicacion|publicaciones|diseno|diseño|imagen|grafica|slide|slides|carrusel|carousel|story|stories|storie|reel|miniatura|thumbnail|para|de|del|sobre|en|con|a|al|que|contar|contando|mostrar|mostrando|avisar|anunciar|invitar|invitando|presentar|explicar|explicando|comunicar)\b\s*)+/i
// Y lo que sobra al final: conectores colgados.
const BORDE_FIN = /(?:\s*\b(?:de|del|para|por|con|en|y|e|o|a|al|que|sobre|nuestro|nuestra|mi|su|este|esta|el|la|los|las|un|una)\b\s*)+$/i

// Siglas que la gente escribe en minúscula y son mayúscula en la pieza.
const SIGLAS = { ia: 'IA', ai: 'AI', erp: 'ERP', roi: 'ROI', ceo: 'CEO', cto: 'CTO', pyme: 'PyME', fms: 'FMS', ndvi: 'NDVI' }

export function temaDe(senales, original = '') {
  // se trabaja sobre lo que ESCRIBIÓ la persona, no sobre la versión sin
  // tildes: el titular tiene que salir con sus acentos
  let t = String(original || senales.texto)
  for (const re of [RE_FECHA, RE_HORA, RE_CARRUSEL]) t = t.replace(new RegExp(re.source, 'i'), ' ')
  t = t.replace(/\b(?:instagram|linkedin|youtube|whatsapp|wsp|\big\b|\byt\b|redes)\b/gi, ' ')
  t = t.replace(/\s+/g, ' ').trim()
  t = t.replace(BORDE_INICIO, '').replace(BORDE_FIN, '').trim()
  if (t.length < 4) return null
  // una frase de una sola palabra rara vez es un titular
  if (!/\s/.test(t) && t.length < 6) return null
  const palabras = t.split(' ').map((w) => SIGLAS[w.toLowerCase()] || w)
  const frase = palabras.join(' ')
  return frase.charAt(0).toUpperCase() + frase.slice(1)
}

// La línea de cuándo: "11 de junio · 11 hs". Sólo con lo que dijo.
function cuandoDe(senales) {
  const partes = [senales.fecha, senales.hora].filter(Boolean)
  return partes.length ? partes.join(' · ') : null
}

/**
 * Devuelve los campos a completar en la plantilla, y de dónde salió cada
 * uno, para poder mostrárselo a la persona.
 * Nunca inventa: si no lo dijo, no va.
 */
export function armar(texto, template, formatos = []) {
  const s = analizar(texto, formatos)
  if (s.vacio || !template) return { campos: {}, puestos: [] }
  const tema = temaDe(s, texto)
  const cuando = cuandoDe(s)
  const roles = template.roles || []
  const estilos = (template.defaults?.textBlocks || []).map((b) => b.style)
  const acepta = (r) => roles.includes(r) || estilos.includes(r)

  const campos = {}
  const puestos = []
  // El tema va al titular. Es el único lugar donde va: es DE QUÉ se trata.
  if (tema && acepta('title')) { campos.title = tema; puestos.push(`el titular dice “${tema}”`) }
  else if (tema && acepta('quote')) { campos.quote = tema; puestos.push(`la cita dice “${tema}”`) }
  // La fecha y la hora van a la bajada, que es donde estas plantillas la
  // llevan. Si ya hay tema en el titular, no se pisan.
  if (cuando && acepta('subtitle')) { campos.subtitle = cuando; puestos.push(`la fecha dice “${cuando}”`) }
  // Una cifra que es noticia va al lugar de la cifra, no al titular.
  if (s.cifra && acepta('metric')) {
    campos.metric = s.cifra
    if (campos.title === tema && tema) delete campos.title  // el tema pasa a ser la bajada del dato
    if (tema && acepta('metricLabel')) campos.metricLabel = tema
    puestos.push(`la cifra es ${s.cifra}`)
  }
  return { campos, puestos, senales: s, formato: s.formato }
}

/** Aplica lo que armó sobre el contenido inicial de una plantilla. */
export function aplicarArmado(contenidoBase, campos) {
  const out = { ...contenidoBase }
  Object.entries(campos || {}).forEach(([k, v]) => {
    if (!v) return
    // en las piezas libres el texto vive en bloques, no en roles
    const i = (out.textBlocks || []).findIndex((b) => (b.style || 'title') === k)
    if (i >= 0) out.textBlocks = out.textBlocks.map((b, idx) => (idx === i ? { ...b, text: v } : b))
    else out[k] = v
  })
  return out
}
