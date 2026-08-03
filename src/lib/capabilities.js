// ============================================================
// CAPACIDADES — el contrato de lo que el copiloto PUEDE hacer.
//
// Este archivo es la aduana del segundo invariante del producto: sólo
// existe lo que existe. El copiloto no puede nombrar, ofrecer ni ejecutar
// nada que no esté declarado acá. Si alguien le pide "ponele un filtro
// sepia" y el filtro sepia no está en esta lista, la respuesta correcta
// es "eso no lo tengo", no una promesa linda.
//
// REGLA DE ORO: las listas se DERIVAN de los módulos reales. Nunca se
// escriben a mano. Un catálogo escrito a mano se desactualiza el primer
// martes: alguien agrega una plantilla, se olvida de tocar este archivo,
// y el copiloto queda mintiendo con cara de seguridad. Acá se importa
// TEMPLATES, FORMATS, CAROUSELS, PHOTOS, COLOR_SCHEMES y se cuenta lo
// que hay. Si mañana entra una plantilla nueva, el copiloto se entera solo.
//
// Cada capacidad tiene:
//   nombre       cómo la llama el modelo
//   etiqueta     el gerundio que ve la PERSONA mientras corre ("Mirando las
//                plantillas…"). Vive acá, al lado de la capacidad, y no en
//                un mapa aparte en copiloto.js: ese mapa ya se desincronizó
//                una vez y hubo que repararlo a mano. Es la misma deriva
//                que este archivo prohíbe. Si te olvidás de ponerla, el
//                copiloto muestra el nombre crudo antes que mentir.
//   descripcion  escrita PARA EL MODELO: cuándo usarla y cuándo NO
//   esquema      JSON Schema de los argumentos (enums derivados de datos)
//   muta         si toca la pieza de la persona
//   ejecutar     la función real, que corre en el navegador
//   resumir      la frase que ve la PERSONA cuando la acción termina. Vive
//                acá por la misma razón que `etiqueta` (ver más abajo).
// ============================================================

import {
  TEMPLATES, TEMPLATES_BY_ID, MAXCHARS, PLACEHOLDERS, placeholderContent, rolesDePieza,
} from '../templates/index.js'
import { variantsFor } from '../templates/variants.js'
import { CAROUSELS } from '../templates/carousels.js'
import { FORMATS, FORMATS_BY_ID, CAROUSEL_FORMATS, formatLabel } from '../formats/registry.js'
import { COLOR_SCHEMES, ACCENTS, GRADIENTS } from '../brand/brandKit.js'
import { PHOTOS } from '../brand/photoLibrary.js'
import { analizar, sugerirTodo, armar, aplicarArmado, ETIQUETA, normalizar } from './sugerir.js'
import { plano } from './entender.js'
import { checkCopy } from './copyCheck.js'

// ------------------------------------------------------------
// DERIVADOS — todo lo que el modelo puede nombrar sale de acá
// ------------------------------------------------------------

// La galería no ofrece las `hidden` (son variantes de otra plantilla) y
// "en blanco" no es una sugerencia: es la salida de emergencia. El
// copiloto ve lo mismo que ve la persona en la galería.
const visibles = () => TEMPLATES.filter((t) => !t.hidden && t.id !== 'blank')

const IDS_PLANTILLA = visibles().map((t) => t.id)
const IDS_FORMATO = FORMATS.map((f) => f.id)
const IDS_CARRUSEL = CAROUSELS.map((c) => c.id)
const SLUGS_FOTO = PHOTOS.map((p) => p.slug)
const REDES = [...new Set(FORMATS.map((f) => f.network))]
const OBJETIVOS = [...new Set(visibles().map((t) => t.objetivo).filter(Boolean))]
const ROLES = Object.keys(MAXCHARS)

// En una plantilla clásica los roles están declarados; en una libre el
// texto vive en bloques y el "rol" es el estilo del bloque. Para el
// modelo son la misma pregunta: ¿qué textos entran acá? La respuesta la
// da rolesDePieza, que es la MISMA que usa App.jsx al escribir: si acá
// dijéramos una cosa y allá se escribiera otra, el modelo propondría
// textos que la pieza no tiene dónde poner.
const rolesDe = (t) => rolesDePieza(t)

// El texto de muestra ENSEÑA el largo y el tono correctos. Dárselo al
// modelo vale más que cualquier instrucción sobre "sé conciso".
function ejemploDe(t, rol) {
  const d = t.defaults || {}
  if (d[rol]) return d[rol]
  const b = (d.textBlocks || []).find((x) => (x.style || 'title') === rol)
  if (b?.text) return b.text
  return PLACEHOLDERS[rol] || null
}

const fichaPlantilla = (t) => ({
  id: t.id,
  nombre: t.name,
  objetivo: t.objetivo,
  paraQue: ETIQUETA[t.objetivo] || t.objetivo,
  purpose: t.purpose,
  conFoto: t.surface === 'photo',
  roles: rolesDe(t),
})

const fichaFormato = (f) => ({
  id: f.id,
  red: f.network,
  label: f.label,
  nombreCompleto: formatLabel(f.id),
  w: f.w,
  h: f.h,
  admiteCarrusel: CAROUSEL_FORMATS.includes(f.id),
})

// ------------------------------------------------------------
// Helpers de ejecución
// ------------------------------------------------------------

// Un error tiene que servirle al modelo para CORREGIRSE en la vuelta
// siguiente, no para disculparse. Por eso siempre dice qué había válido.
const noExiste = (que, valor, validos) =>
  `No existe ${que} “${valor}”. Los que hay: ${validos.join(', ')}.`

function accion(ctx, nombre) {
  const fn = ctx?.acciones?.[nombre]
  return typeof fn === 'function' ? fn : null
}

// Sin formato explícito se hereda el de la pieza, pero SÓLO si la persona
// la está mirando. `ctx.proyecto` ahora también viaja con la persona parada
// en la home (es la pieza que recibe el texto que acepte, ver App.jsx), y
// ahí heredar su tamaño sería arrastrar una decisión que ella ya cerró:
// abrir una plantilla nueva desde la home tiene que salir con el formato
// elegido en la galería, igual que cuando la abre a mano. Devolver null es
// justamente eso — el que abre cae en su propio default.
function formatoDe(id, ctx) {
  if (id) return FORMATS_BY_ID[id] || null
  if (ctx?.proyecto?.enPantalla === false) return null
  const actual = ctx?.proyecto?.formatId
  return (actual && FORMATS_BY_ID[actual]) || null
}

// QUÉ DICE UNA PIEZA, rol por rol.
//
// Vive suelto porque lo necesitan dos capacidades y tienen que contestar lo
// MISMO. estado_actual siempre lo devolvió; abrir_plantilla no, y de ahí
// salía el peor bucle del run de U1: abrir_plantilla contestaba nombres de
// roles ("puse kicker y cta") sin decir qué quedó escrito, el modelo iba a
// buscarlo a detalle_plantilla, leía los `ejemplo` —que son los mismos
// defaults que la plantilla ya tiene puestos— y los proponía de vuelta
// palabra por palabra como trabajo suyo. La persona veía "antes: WEBINAR →
// después: WEBINAR" y gastaba un Aceptar en nada. Se reprodujo en 2 de 2
// pedidos de webinar y costaba 3 vueltas de 6.
//
// Los bloques de una plantilla libre entran también: para el modelo son la
// misma pregunta, y rolesDePieza ya los trata así.
function textosDe(content) {
  const c = content || {}
  const out = {}
  ROLES.forEach((r) => { if (c[r] !== undefined && String(c[r]).trim() !== '') out[r] = c[r] })
  ;(c.textBlocks || []).forEach((b) => {
    const k = b.style || 'title'
    if (out[k] === undefined && String(b.text || '').trim() !== '') out[k] = b.text
  })
  return out
}

// Los avisos de copy son los mismos que ve la persona en el inspector:
// las reglas editoriales de Magoya más el largo recomendado del rol.
function avisosDe(rol, texto) {
  const avisos = checkCopy(rol, texto)
  const tope = MAXCHARS[rol]
  const largo = String(texto ?? '').trim().length
  if (tope && largo > tope) {
    avisos.push(`Se pasa del largo recomendado para ${rol}: ${largo} caracteres contra ${tope}. Va a entrar más chico.`)
  }
  return avisos
}

// ------------------------------------------------------------
// POR QUÉ ACÁ YA NO HAY ADUANA DE PROCEDENCIA
//
// Hubo una: el modelo mandaba el texto para la pieza y nosotros
// verificábamos, después, que cada frase apareciera literal en lo que la
// persona había tipeado. Se cayó en la primera prueba adversarial seria y
// vale dejar escrito el caso, porque es el argumento entero:
//
//   la persona: "ojo que no puedo decir que el rinde subio 30%
//                porque no lo medimos"
//   el modelo:  cita = "el rinde subio 30%"
//
// Substring perfecto. Pasaba la aduana y entraba a la pieza sin Aceptar:
// una afirmación de impacto que la persona acababa de negar, impresa en
// material de marketing. Y no era el único agujero — plano() borra la
// puntuación, así que también se podía volver pregunta una afirmación o
// agregarle signos; y pedazos sueltos se podían recombinar en un orden que
// nadie escribió.
//
// La lección: verificar texto es un parche cuando el problema es QUIÉN lo
// elige. Comparar cadenas jamás va a entender una negación. Así que el
// modelo dejó de elegir: `abrir_plantilla` corre `armar()` —determinístico,
// regex sobre la frase original— y el modelo sólo dice si usarlo. Todo lo
// demás que quiera escribir va por `proponer_textos`, con Aceptar.
//
// `plano()` se sigue importando: lo usa `listar_fotos` para buscar por
// nombre, que es comparar cadenas para lo que comparar cadenas sirve.
// ------------------------------------------------------------

// ------------------------------------------------------------
// EL RESUMEN DE LA ACCIÓN — la línea que lee la PERSONA cuando termina.
//
// En el chip se ve "Mirando las plantillas… · 6 plantillas que sirven": la
// etiqueta en gerundio mientras corre, y esto cuando salió bien.
//
// Antes esta frase la armaba copiloto.js solo, contando las claves del
// objeto de datos y escupiendo el nombre CRUDO del campo. Con `plantillas`,
// `roles` o `avisos` zafaba de casualidad —son palabras sueltas que en
// castellano se leen— pero con el primer campo en camelCase salió a
// pantalla "1 palabrasQueLoDicen", que es basura de debug en la cara de
// alguien que vino a hacer un posteo.
//
// El camelCase era el síntoma. El problema es que un objeto de datos no se
// serializa a castellano: cuántos elementos tiene una clave interna no es
// lo que la persona quiere saber. Quiere saber QUÉ encontró. "1
// palabrasQueLoDicen" no le dice nada a nadie; "encontré fecha y formato"
// sí.
//
// Por eso el resumen se declara al lado de la capacidad, igual que
// `etiqueta` y por el mismo motivo escrito allá arriba: el mapa paralelo en
// copiloto.js ya se desincronizó una vez. Resolver el mismo problema dos
// veces de dos formas distintas sería peor que el bug. Si una capacidad
// nueva se olvida de traerlo, el chip dice "listo" y listo: callarse es
// honesto, inventar un conteo de claves no.
//
// Reglas para escribir uno: corto, en castellano, ningún nombre de campo, y
// que se lea pegado a la etiqueta sin repetirla.
// ------------------------------------------------------------
const plural = (n, uno, muchos) => `${n} ${n === 1 ? uno : muchos}`

// "fecha, hora y formato" — la coma serial no existe en castellano.
const enumerar = (xs) =>
  xs.length < 2 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`

// ============================================================
// LAS CAPACIDADES
// ============================================================

export const CAPACIDADES = [

  // ---------- LECTURA ----------

  {
    nombre: 'listar_plantillas',
    etiqueta: 'Mirando las plantillas…',
    descripcion: 'Devuelve el catálogo de plantillas de la herramienta con su objetivo, para qué sirve cada una y qué textos acepta. Usala antes de recomendar cualquier plantilla: es la única lista que existe y no podés nombrar una que no esté acá. Filtrá por objetivo o por red para no traer las 26 cuando ya sabés qué buscás. No incluye la slide en blanco (para eso está abrir_en_blanco).',
    esquema: {
      type: 'object',
      properties: {
        objetivo: { type: 'string', enum: OBJETIVOS, description: 'Para qué es la pieza. webinar=invitar a algo, prueba=mostrar un resultado, ensenar=explicar algo, anuncio=anunciar, equipo=mostrar al equipo, cierre=cerrar un carrusel.' },
        red: { type: 'string', enum: REDES, description: 'Filtra por red sólo para saber qué formatos hay disponibles; las plantillas sirven en cualquier formato.' },
        conFoto: { type: 'boolean', description: 'true = sólo las que llevan foto de fondo, false = sólo las de color plano.' },
      },
      required: [],
      additionalProperties: false,
    },
    muta: false,
    // "que sirven" y no "encontradas": con filtro son las que encajan, sin
    // filtro son todas las que hay, y en los dos casos es lo mismo que le
    // importa a la persona.
    resumir: (d) => (d.total
      ? plural(d.total, 'plantilla que sirve', 'plantillas que sirven')
      : 'ninguna plantilla con ese filtro'),
    ejecutar: async ({ objetivo, red, conFoto } = {}) => {
      let lista = visibles()
      if (objetivo) lista = lista.filter((t) => t.objetivo === objetivo)
      if (conFoto === true) lista = lista.filter((t) => t.surface === 'photo')
      if (conFoto === false) lista = lista.filter((t) => t.surface !== 'photo')
      const out = { total: lista.length, plantillas: lista.map(fichaPlantilla) }
      // la red no filtra plantillas, filtra formatos: se aclara para que el
      // modelo no crea que hay plantillas "de LinkedIn"
      if (red) {
        out.nota = 'Las plantillas no son de una red: la misma pieza se arma en cualquier formato.'
        out.formatosDeEsaRed = FORMATS.filter((f) => f.network === red).map(fichaFormato)
      }
      return out
    },
  },

  {
    nombre: 'detalle_plantilla',
    etiqueta: 'Mirando la plantilla en detalle…',
    descripcion: 'Todo sobre una plantilla: qué textos lleva, el largo recomendado de cada uno, el texto de muestra que trae, si va sobre foto y qué estilos de composición admite. Usala antes de proponer textos para una plantilla que TODAVÍA NO ESTÁ ABIERTA — los largos importan, un titular de 200 caracteres entra ilegible. Si la plantilla ya está abierta no la llames: `ejemplo` es el texto de muestra que la pieza YA tiene puesto, no lo que dice ahora; para eso está estado_actual, y abrir_plantilla también te lo devuelve al abrir. Proponer un `ejemplo` de acá tal cual es proponerle a la persona lo que ya está en pantalla.',
    esquema: {
      type: 'object',
      properties: { id: { type: 'string', enum: IDS_PLANTILLA, description: 'id de la plantilla' } },
      required: ['id'],
      additionalProperties: false,
    },
    muta: false,
    // "roles" es nuestro. Para la persona son lugares donde va texto. El
    // nombre de la plantilla no se repite: lo acaba de decir el modelo en la
    // frase de arriba, y varias lo traen con " · " adentro, que choca con el
    // separador del chip.
    resumir: (d) => plural(d.textos.length, 'lugar de texto', 'lugares de texto'),
    ejecutar: async ({ id }) => {
      const t = TEMPLATES_BY_ID[id]
      if (!t || t.hidden) throw new Error(noExiste('la plantilla', id, IDS_PLANTILLA))
      return {
        ...fichaPlantilla(t),
        surface: t.surface,
        freeform: !!t.freeform,
        textos: rolesDe(t).map((r) => ({
          rol: r,
          maxChars: MAXCHARS[r] ?? null,
          ejemplo: ejemploDe(t, r),
        })),
        estilos: variantsFor(t).map((v) => ({ id: v.id, label: v.label })),
      }
    },
  },

  {
    nombre: 'listar_formatos',
    etiqueta: 'Viendo los formatos…',
    descripcion: 'Los formatos (tamaños) disponibles, con su red, sus píxeles y si admiten carrusel. Usala cuando la persona menciona una red o duda del tamaño. Si ya hay una pieza abierta, mirá primero estado_actual: cambiar el formato de algo que ya está armado se hace con cambiar_formato.',
    esquema: {
      type: 'object',
      properties: { red: { type: 'string', enum: REDES } },
      required: [],
      additionalProperties: false,
    },
    muta: false,
    resumir: (d) => (d.total
      ? plural(d.total, 'formato', 'formatos')
      : 'ningún formato para esa red'),
    ejecutar: async ({ red } = {}) => {
      const lista = red ? FORMATS.filter((f) => f.network === red) : FORMATS
      return { total: lista.length, formatos: lista.map(fichaFormato), admitenCarrusel: CAROUSEL_FORMATS }
    },
  },

  {
    nombre: 'listar_carruseles',
    etiqueta: 'Viendo los carruseles armados…',
    descripcion: 'Los carruseles ya armados: secuencias completas de slides con el diseño compartido y el copy de muestra calibrado. Usala cuando la persona pide un carrusel, varias slides o una lista ("3 tips"). Es mejor recomendación que armar slide por slide: la persona no tiene que tomar todas las decisiones.',
    esquema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    muta: false,
    resumir: (d) => plural(d.total, 'carrusel ya armado', 'carruseles ya armados'),
    ejecutar: async () => ({
      total: CAROUSELS.length,
      carruseles: CAROUSELS.map((c) => ({
        id: c.id,
        nombre: c.name,
        purpose: c.purpose,
        cantidadSlides: c.slides.length,
        slides: c.slides.map((id, i) => ({
          n: i + 1,
          plantillaId: id,
          plantilla: TEMPLATES_BY_ID[id]?.name || id,
          copyDeMuestra: c.copy?.[i] || null,
        })),
        diseno: c.design,
      })),
      formatosQueLoAdmiten: CAROUSEL_FORMATS,
    }),
  },

  {
    nombre: 'analizar_pedido',
    etiqueta: 'Leyendo lo que pediste…',
    descripcion: 'Lee la frase de la persona con las expresiones regulares del buscador y devuelve las señales DURAS: fecha, hora, cifra, lista ("3 tips"), si pidió carrusel, qué formato nombró y qué objetivo detecta el lexicón. Usala SIEMPRE al arrancar sobre un pedido nuevo: estos datos los lee mejor una regex que vos, y son literales — están o no están en lo que la persona escribió. Si acá no hay fecha, no hay fecha: no la inventes.',
    esquema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'lo que escribió la persona, textual' } },
      required: ['texto'],
      additionalProperties: false,
    },
    muta: false,
    // ACÁ SALÍA "1 palabrasQueLoDicen". Y no es que faltara traducir el
    // nombre del campo: contar las palabras del lexicón que hicieron match
    // es una métrica interna del motor de reglas, no una noticia. Lo que la
    // persona quiere saber es qué se le entendió del pedido, así que se
    // enumeran las señales que aparecieron y nada más.
    resumir: (d) => {
      if (d.vacio) return 'el pedido es muy corto para leerlo'
      const hay = []
      if (d.fecha) hay.push('fecha')
      if (d.hora) hay.push('hora')
      if (d.cifra) hay.push('un número')
      if (d.lista) hay.push('una lista')
      if (d.carrusel) hay.push('carrusel')
      if (d.formatoId) hay.push('formato')
      if (d.paraQue) hay.push(`que es para ${d.paraQue}`)
      if (!hay.length) return 'no encontré ningún dato duro'
      // Un pedido cargado dispara las siete señales y la línea se vuelve un
      // inventario. Tres y el resto contado: alcanza para saber que se
      // entendió, y el detalle lo tiene el modelo, que es quien lo va a usar.
      // sin enumerar(): la "y" ya se la lleva el resto contado
      if (hay.length > 3) return `encontré ${hay.slice(0, 3).join(', ')} y ${hay.length - 3} datos más`
      return `encontré ${enumerar(hay)}`
    },
    ejecutar: async ({ texto }) => {
      const s = analizar(texto, FORMATS)
      return {
        vacio: s.vacio,
        fecha: s.fecha,
        hora: s.hora,
        cifra: s.cifra,
        lista: s.lista,
        carrusel: s.carrusel,
        diceCarrusel: s.diceCarrusel,
        hablaEnPasado: s.pasado,
        formatoId: s.formatoId,
        formatoDetectado: s.diceFormato,
        objetivo: s.objetivo,
        paraQue: s.objetivo ? ETIQUETA[s.objetivo] : null,
        palabrasQueLoDicen: s.palabras,
      }
    },
  },

  {
    nombre: 'sugerir_plantillas',
    etiqueta: 'Eligiendo plantillas…',
    descripcion: 'Corre el motor de reglas del buscador sobre la frase y devuelve hasta 3 plantillas con el motivo verificable de cada una, el formato detectado, el carrusel que corresponde y —lo importante— qué textos de la persona se pueden REUBICAR en cada plantilla (procedencia "regla"). Esos textos son pedazos literales de lo que tipeó: se pueden aplicar directo con abrir_plantilla. Usala antes de escribir vos una sola palabra: si las reglas ya resuelven el pedido, no hace falta que propongas copy.',
    esquema: {
      type: 'object',
      properties: { texto: { type: 'string', description: 'lo que escribió la persona, textual' } },
      required: ['texto'],
      additionalProperties: false,
    },
    muta: false,
    // Que las reglas se callen es un resultado, no un vacío: hay que poder
    // leerlo de reojo, porque es lo que explica que el copiloto pase a
    // escribir copy en vez de recomendar.
    resumir: (d) => {
      if (d.seCallo) return 'las reglas no se la jugaron por ninguna'
      const partes = []
      if (d.plantillas.length) partes.push(plural(d.plantillas.length, 'plantilla', 'plantillas'))
      if (d.carrusel) partes.push('un carrusel')
      return partes.length ? enumerar(partes) : 'nada para sugerir'
    },
    ejecutar: async ({ texto }) => {
      const r = sugerirTodo(texto,{ templates: TEMPLATES, formatos: FORMATS, carruseles: CAROUSELS })
      return {
        plantillas: r.plantillas.map((p) => {
          const a = armar(texto, p.template, FORMATS)
          return {
            id: p.id,
            nombre: p.template.name,
            motivo: p.motivo,
            score: p.score,
            // Qué va a poner `abrir_plantilla({usarTextoDelPedido:true})`
            // si elegís ésta. Es informativo: el modelo no puede copiarlo
            // ni editarlo para mandarlo de vuelta, porque ya no hay
            // parámetro por donde entre texto.
            loQueLeEntraria: a.campos,
            queSePondria: a.puestos,
          }
        }),
        formatoSugerido: r.formato ? fichaFormato(r.formato) : null,
        porQueEseFormato: r.diceFormato || null,
        carrusel: r.carrusel ? { id: r.carrusel.carrusel.id, nombre: r.carrusel.carrusel.name, motivo: r.carrusel.motivo } : null,
        // si viene vacío, las reglas se callaron a propósito: sugerir mal
        // es peor que no sugerir
        seCallo: !r.plantillas.length && !r.carrusel,
      }
    },
  },

  {
    nombre: 'estado_actual',
    etiqueta: 'Mirando lo que tenés abierto…',
    descripcion: 'Qué pieza hay armada en este momento: nombre del proyecto, formato, si es carrusel, cuántas slides y el contenido de la slide activa. Usala antes de proponer cualquier cambio sobre "esto" o "la pieza": sin esto no sabés de qué está hablando. Mirá `laEstaViendo`: si viene false, la pieza existe y es la que va a recibir cualquier texto que la persona acepte, pero ahora mismo está parada en la home y no la tiene delante — no le digas "la pieza que tenés abierta". Si no hay ninguna, lo dice, y ahí lo que corresponde es abrir algo.',
    esquema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    muta: false,
    // No se nombra acá si la está mirando o no: eso es para el modelo, que
    // tiene que elegir cómo hablarle. La persona ya sabe dónde está parada.
    resumir: (d) => {
      if (!d.hayAlgoAbierto) return 'todavía no hay nada armado'
      const que = d.esCarrusel
        ? `carrusel de ${plural(d.cantidadSlides, 'slide', 'slides')}`
        : (d.plantilla || 'una pieza')
      // "Evento / webinar, Evento / webinar". El proyecto se bautiza con
      // `inicial.title || template.name` (App.jsx, pickTemplate) y 16 de las
      // 26 plantillas visibles no traen defaults.title, así que el nombre del
      // proyecto ES el de la plantilla y la coma quedaba juntando dos veces
      // lo mismo. Decirlo una vez es la misma información.
      if (!d.nombre) return que
      if (d.nombre === que) return d.nombre
      return `${d.nombre}, ${que}`
    },
    ejecutar: async (_args, ctx) => {
      const p = ctx?.proyecto
      if (!p || !p.pieces?.length) {
        return { hayAlgoAbierto: false, nota: 'No hay ninguna pieza armada todavía. La persona está en la home y no hay dónde poner un texto: primero hay que abrir algo.' }
      }
      const i = Number.isInteger(p.slideActual) ? p.slideActual : 0
      const slide = p.pieces[i] || p.pieces[0]
      const t = TEMPLATES_BY_ID[slide?.templateId]
      const c = slide?.content || {}
      const textos = textosDe(c)
      return {
        hayAlgoAbierto: true,
        // Dos hechos distintos y los dos importan: que la pieza exista (y
        // que sea la que va a recibir el texto) no quiere decir que la
        // persona la tenga delante. El chat vive en la home, así que lo
        // normal es que NO la esté viendo.
        laEstaViendo: p.enPantalla !== false,
        ...(p.enPantalla === false
          ? { nota: 'La persona está en la home, no tiene esta pieza delante. Existe igual y es la que recibe cualquier texto que acepte, así que los roles de acá son los que valen. Hablá de "la que armaste", no de "la que tenés abierta", y si proponés texto decile en qué pieza va a caer.' }
          : {}),
        nombre: p.nombre,
        formatoId: p.formatId,
        formato: p.formatId ? formatLabel(p.formatId) : null,
        esCarrusel: !!p.carousel,
        cantidadSlides: p.pieces.length,
        slideActual: i + 1,
        plantillaId: slide?.templateId || null,
        plantilla: t?.name || null,
        textos,
        tieneFoto: !!c.photo,
        esquema: c.scheme || t?.defaults?.scheme || null,
        acento: c.accent || t?.defaults?.accent || null,
      }
    },
  },

  {
    nombre: 'memoria_equipo',
    etiqueta: 'Buscando en la bitácora…',
    descripcion: 'La bitácora del equipo: qué piezas se hicieron, qué se publicó y qué números trajeron. Usala cuando la persona pregunta qué funcionó, qué hicimos la última vez o pide una recomendación basada en resultados. Mirá SIEMPRE pudeLeer antes que hayDatos, son tres respuestas distintas y decirlas mal es mentir: pudeLeer:false = no pude consultar la memoria, no sé qué hay (decí eso, nunca "todavía no cargaron nada"); pudeLeer:true + hayDatos:false = consulté y no hay historial (decilo tal cual); pudeLeer:true + hayDatos:true = usá los datos. En ninguno de los tres estimes un número ni digas "suele funcionar mejor" sin respaldo.',
    esquema: {
      type: 'object',
      properties: {
        objetivo: { type: 'string', enum: OBJETIVOS },
        red: { type: 'string', enum: REDES },
        limite: { type: 'integer', minimum: 1, maximum: 50 },
      },
      required: [],
      additionalProperties: false,
    },
    muta: false,
    // Las mismas tres respuestas que se le exigen al modelo, dichas en el
    // chip: no pude mirar / miré y no hay / esto hay. Aplastarlas en "0
    // piezas" sería la misma mentira, sólo que más chiquita.
    //
    // Y ojo con el campo `resumen` que devuelve esta capacidad: es el texto
    // largo de la bitácora, escrito para el modelo. El resumidor viejo lo
    // agarraba de casualidad —miraba cualquier clave llamada `resumen`— y
    // volcaba el párrafo entero adentro del chip.
    resumir: (d) => {
      if (!d.pudeLeer) return 'no pude leer la bitácora'
      if (!d.hayDatos) return 'la bitácora está vacía'
      return d.total
        ? plural(d.total, 'pieza en la bitácora', 'piezas en la bitácora')
        : 'sólo el resumen de la bitácora'
    },
    ejecutar: async ({ objetivo, red, limite = 20 } = {}, ctx) => {
      const m = ctx?.memoria
      if (!m || typeof m.listarBitacora !== 'function') {
        return { pudeLeer: false, nota: 'La memoria del equipo no está disponible en esta sesión, así que no sé qué hay cargado. No es que no haya nada: no lo puedo ver.' }
      }
      // La memoria puede estar caída y la app no se rompe por eso. Pero
      // "caída" y "vacía" NO se contestan igual: antes las dos volvían
      // hayDatos:false y el copiloto le decía "todavía no cargaron nada" a
      // un equipo con la bitácora llena. Las lecturas ahora traen un sobre
      // con ok y acá se respeta.
      const sobre = async (fn, arg) => {
        if (typeof fn !== 'function') return { ok: false }
        try {
          const r = await fn(arg)
          return r && typeof r === 'object' ? r : { ok: false }
        } catch { return { ok: false } }
      }
      const bit = await sobre(m.listarBitacora, { objetivo, red, limite })
      const res = await sobre(m.resumenParaCopiloto)
      if (!bit.ok && !res.ok) {
        return { pudeLeer: false, nota: 'No pude consultar la memoria del equipo (puede estar caída la conexión). No sé si hay historial o no, así que no digas ninguna de las dos cosas: decí que ahora mismo no podés mirar la bitácora y ofrecé reintentar.' }
      }
      const bitacora = bit.ok && Array.isArray(bit.datos) ? bit.datos : []
      const resumen = res.ok && typeof res.texto === 'string' ? res.texto : ''
      // Una de las dos anduvo y la otra no: se dice cuál, y lo que falta no
      // se cuenta como cero.
      const parcial = !bit.ok
        ? 'No pude traer la lista de piezas; lo que sigue es sólo el resumen.'
        : !res.ok
          ? 'No pude armar el resumen; lo que sigue es sólo la lista de piezas.'
          : null
      if (!bitacora.length && !resumen) {
        return parcial
          // media lectura y sin contenido: tampoco se puede cerrar que no
          // haya historial, porque justo la mitad que falta es la que lo
          // diría
          ? { pudeLeer: false, nota: `${parcial} Y lo poco que leí no trae nada, así que no puedo afirmar ni que haya historial ni que no lo haya. Decí que no pudiste consultar bien la bitácora.` }
          : { pudeLeer: true, hayDatos: false, nota: 'Consulté la bitácora y está vacía: todavía no hay nada registrado. No hay con qué comparar.' }
      }
      return { pudeLeer: true, hayDatos: true, resumen, total: bitacora.length, bitacora, ...(parcial ? { nota: parcial } : {}) }
    },
  },

  {
    nombre: 'listar_fotos',
    etiqueta: 'Revisando el banco de fotos…',
    descripcion: 'El banco de fotos de Magoya, por nombre. Son las únicas fotos de marca que hay adentro de la herramienta (la persona también puede subir la suya). Usala cuando pregunten qué fotos hay, y para elegir el slug antes de llamar a poner_foto. No podés nombrar una foto que no esté en esta lista. Para PONERLA de fondo en la pieza abierta está poner_foto (sólo si la pieza lleva foto); lo que no existe es subir o poner fotos de la persona — ésas las maneja ella desde el panel Detrás del editor, y ahí también puede meterle foto a una pieza de color plano si insiste.',
    esquema: {
      type: 'object',
      properties: { buscar: { type: 'string', description: 'filtra por nombre: "campo", "persona", "trigo"…' } },
      required: [],
      additionalProperties: false,
    },
    muta: false,
    // Con filtro se dice "3 de 24": el total del banco es la referencia que
    // deja saber si la búsqueda fue angosta o si el banco es chico.
    resumir: (d) => {
      if (!d.total) return 'ninguna foto con ese nombre'
      return d.total === d.totalBanco
        ? plural(d.total, 'foto', 'fotos')
        : `${d.total} de ${d.totalBanco} fotos`
    },
    ejecutar: async ({ buscar } = {}) => {
      const q = normalizar(buscar || '')
      const lista = q
        ? PHOTOS.filter((p) => normalizar(p.label).includes(q) || normalizar(p.slug).includes(q))
        : PHOTOS
      return {
        total: lista.length,
        totalBanco: PHOTOS.length,
        fotos: lista.map((p) => ({ slug: p.slug, nombre: p.label })),
      }
    },
  },

  {
    nombre: 'listar_estilos_y_colores',
    etiqueta: 'Mirando los esquemas de color…',
    descripcion: 'Los esquemas de color, acentos, estilos de composición y degradés aprobados. Es la caja de marca: fuera de esto no hay color libre, ni hexadecimales, ni "un azul más corporativo". Usala cuando pregunten qué se puede cambiar del look de una pieza. OJO, es SÓLO PARA NOMBRAR: vos no podés cambiarle el esquema, el acento, el degradé ni el estilo a ninguna pieza — no hay capacidad para eso y no la va a haber por escribirla en una frase. Lo hace la persona desde los paneles del editor: el color de fondo en Detrás, el acento en Marca, la composición en Estilo. Nunca contestes "lo que sí puedo hacer es cambiarte el esquema o el acento": lo que corresponde es decirle cuáles hay y en qué panel los cambia.',
    esquema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    muta: false,
    // Cuatro números serían un inventario. Los dos que se cambian de verdad
    // desde el panel alcanzan.
    resumir: (d) => `${plural(d.esquemas.length, 'esquema', 'esquemas')} y ${plural(d.acentos.length, 'acento', 'acentos')}`,
    ejecutar: async () => {
      // los estilos salen de variantsFor() sobre TODAS las plantillas: es
      // el catálogo real, incluidos los dos que sólo existen sobre foto
      const estilos = new Map()
      visibles().forEach((t) => variantsFor(t).forEach((v) => { if (!estilos.has(v.id)) estilos.set(v.id, v.label) }))
      return {
        esquemas: Object.entries(COLOR_SCHEMES).map(([id, s]) => ({ id, nombre: s.label })),
        acentos: Object.entries(ACCENTS).map(([id, a]) => ({ id, nombre: a.label })),
        estilos: [...estilos].map(([id, nombre]) => ({ id, nombre })),
        degrades: Object.entries(GRADIENTS).map(([id, g]) => ({ id, nombre: g.label })),
        nota: 'No hay colores libres: la persona elige entre estos roles y nada más.',
      }
    },
  },

  {
    nombre: 'revisar_copy',
    etiqueta: 'Revisando el copy…',
    descripcion: 'Pasa UN texto por las reglas editoriales de Magoya (sin emojis, sin signos de exclamación, un solo idioma, toda métrica con su ventana temporal) y por el largo recomendado del rol. Usala sólo cuando estás dudando de un texto suelto y querés decidir antes de escribir el resto. NO hace falta pre-revisar lo que vas a proponer: proponer_textos ya pasa cada texto por estas mismas reglas y te devuelve los avisos, así que revisarlos de a uno acá es gastar una vuelta por texto para enterarte de lo mismo. Cuatro textos son cuatro llamadas y una sola de proponer_textos.',
    esquema: {
      type: 'object',
      properties: {
        rol: { type: 'string', enum: ROLES, description: 'dónde va ese texto en la pieza' },
        texto: { type: 'string' },
      },
      required: ['rol', 'texto'],
      additionalProperties: false,
    },
    muta: false,
    // "0 avisos" era correcto y sonaba a reporte. "sin avisos" es la misma
    // información dicha por alguien.
    resumir: (d) => (d.limpio ? 'sin avisos' : plural(d.avisos.length, 'aviso', 'avisos')),
    ejecutar: async ({ rol, texto }) => {
      // El enum del esquema no lo garantiza: la API no valida los argumentos
      // y esta capacidad los usaba crudos. Verificado en el run de U1, con
      // una llamada que llegó con el rol partido al medio —rol:'cta">Guardá
      // tu lugar'— y contestó `limpio: true, maxChars: null`. Un certificado
      // de buena salud falso, justo en la herramienta que existe para que el
      // modelo se autocorrija: con el rol mal escrito no hay MAXCHARS contra
      // qué medir y un titular de 300 caracteres pasa sin un aviso.
      // proponer_textos ya cruzaba el rol; ésta no.
      if (!ROLES.includes(rol)) throw new Error(noExiste('el rol de texto', rol, ROLES))
      const avisos = avisosDe(rol, texto)
      return {
        rol,
        largo: String(texto ?? '').trim().length,
        maxChars: MAXCHARS[rol] ?? null,
        limpio: avisos.length === 0,
        avisos,
      }
    },
  },

  // ---------- ESCRITURA ----------

  {
    nombre: 'abrir_plantilla',
    etiqueta: 'Abriendo la plantilla…',
    descripcion: 'Abre una plantilla en el editor y deja a la persona ahí adentro. REEMPLAZA POR COMPLETO la pieza que haya abierta: proyecto nuevo, se pierde todo su texto y no hay deshacer. Mirá estado_actual antes; si ya hay algo armado, avisale que eso se pierde y esperá que diga que sí. Y no la uses para "pasar la pieza a otra plantilla conservando el texto": eso NO es lo que hace. Con `usarTextoDelPedido: true` la pieza abre con lo que las REGLAS extraen de la frase de la persona (el tema al titular, la fecha a la bajada, la cifra al número). Vos no elegís ese texto y no lo podés escribir: lo saca el motor de reglas de sus propias palabras. Si querés poner algo distinto —tuyo, reformulado, o un pedazo suelto de lo que ella dijo— va por proponer_textos, que pasa por Aceptar/Descartar.',
    esquema: {
      type: 'object',
      properties: {
        plantillaId: { type: 'string', enum: IDS_PLANTILLA },
        formatoId: { type: 'string', enum: IDS_FORMATO, description: 'si no lo pasás, queda el formato que ya está elegido' },
        usarTextoDelPedido: {
          type: 'boolean',
          description: 'true para que la pieza abra con lo que las reglas extraen de la frase de la persona. No lleva texto: el texto lo saca el motor, no vos.',
        },
      },
      required: ['plantillaId'],
      additionalProperties: false,
    },
    muta: true,
    // Lo que no entró se dice SIEMPRE, y en la misma línea que lo que sí:
    // es la única señal de que la pieza se abrió con su texto de muestra y
    // no con lo que la persona escribió.
    //
    // Rechazado (no coincide con lo que tipeó) e ignorado (la plantilla no
    resumir: (d) => {
      const partes = [d?.abierta].filter(Boolean)
      if (d?.textosPuestos?.length) {
        partes.push(plural(d.textosPuestos.length, 'texto tuyo puesto', 'textos tuyos puestos'))
      }
      if (d?.rolesIgnorados?.length) {
        partes.push(plural(d.rolesIgnorados.length, 'texto sin lugar', 'textos sin lugar'))
      }
      return partes.join(', ') || 'listo'
    },
    ejecutar: async ({ plantillaId, formatoId, usarTextoDelPedido }, ctx) => {
      const t = TEMPLATES_BY_ID[plantillaId]
      if (!t || t.hidden) throw new Error(noExiste('la plantilla', plantillaId, IDS_PLANTILLA))
      if (formatoId && !FORMATS_BY_ID[formatoId]) throw new Error(noExiste('el formato', formatoId, IDS_FORMATO))
      const abrir = accion(ctx, 'abrirPlantilla')
      if (!abrir) throw new Error('Ahora mismo no puedo abrir plantillas desde acá. Decile a la persona qué plantilla te parece y que la abra desde la galería.')

      // ------------------------------------------------------------
      // EL MODELO NO ESCRIBE ACÁ. Ni una palabra.
      //
      // Antes esto recibía `textosDeRegla` —un objeto rol→texto que mandaba
      // el modelo— y lo auditábamos después: cada valor tenía que aparecer
      // literal en lo que la persona había tipeado. Parecía cerrado y no lo
      // estaba, porque comparar substrings nunca va a entender una frase.
      // El caso que lo tiró abajo, textual de una prueba real:
      //
      //   la persona: "ojo que no puedo decir que el rinde subio 30%
      //                porque no lo medimos"
      //   el modelo:  cita = "el rinde subio 30%"
      //
      // Es un substring perfecto de algo que ella escribió, así que pasaba
      // la aduana y entraba a la pieza sin Aceptar: una afirmación de
      // impacto que la persona había NEGADO explícitamente, publicada en
      // material de marketing. Lo mismo con la puntuación (plano() la
      // borra, así que el modelo podía volver pregunta una afirmación o
      // agregarle signos) y con recombinar pedazos sueltos.
      //
      // Ninguno de esos tres agujeros se tapa con un check mejor: el
      // problema era que el modelo elegía las palabras. Ahora no las elige.
      // `armar()` es una función determinística de la frase de la persona
      // —las regex deciden qué es fecha, qué es cifra y qué es tema— y
      // corre acá, del lado nuestro. El modelo sólo dice SI usarla.
      // ------------------------------------------------------------
      const acepta = new Set(rolesDe(t))
      const campos = {}
      const ignorados = []
      if (usarTextoDelPedido) {
        // Se prueba `armar()` sobre cada turno de la persona y gana el que
        // más campos llena: en una conversación, el pedido con la carne
        // puede ser el primero ("webinar de IA el 11 de junio") y el último
        // no decir nada por sí solo ("ahora para LinkedIn").
        let mejor = null
        for (const frase of ctx?.frases || []) {
          const a = armar(frase, t, FORMATS)
          const n = Object.keys(a?.campos || {}).length
          if (n && (!mejor || n > mejor.n)) mejor = { campos: a.campos, n }
        }
        Object.entries(mejor?.campos || {}).forEach(([rol, txt]) => {
          if (!String(txt ?? '').trim()) return
          if (acepta.has(rol)) campos[rol] = txt
          else ignorados.push(rol)
        })
      }

      const muestra = placeholderContent(t)
      const contenido = Object.keys(campos).length ? aplicarArmado(muestra, campos) : null
      const formato = formatoDe(formatoId, ctx)
      abrir(t, formato, contenido)

      const notas = []
      if (ignorados.length) notas.push(`Esta plantilla no tiene ${ignorados.join(', ')}: eso no se puso.`)
      if (usarTextoDelPedido && !Object.keys(campos).length) {
        notas.push('De la frase de la persona no salió ningún texto aprovechable, así que la plantilla abrió con su texto de muestra. No le digas que ya está puesto, porque no lo está.')
      }

      return {
        abierta: t.name,
        plantillaId: t.id,
        formato: formato ? formatLabel(formato.id) : 'el que ya estaba elegido',
        // Qué DICE la pieza ahora, no qué roles se tocaron. Sin esto el
        // modelo se iba a detalle_plantilla a averiguarlo, leía los `ejemplo`
        // —que son exactamente estos defaults— y los volvía a proponer como
        // si fueran suyos. Acá está la respuesta, así que no hay nada que ir
        // a buscar y no hay no-op que proponer.
        diceAhora: textosDe(contenido || muestra),
        notaDeLoQueDice: 'Eso es lo que la pieza YA tiene escrito, texto de muestra incluido. No lo propongas de vuelta: proponé sólo lo que querés cambiar.',
        textosPuestos: Object.keys(campos),
        rolesIgnorados: ignorados.length ? ignorados : undefined,
        notas: notas.length ? notas : undefined,
      }
    },
  },

  {
    nombre: 'abrir_carrusel',
    etiqueta: 'Armando el carrusel…',
    descripcion: 'Abre un carrusel completo: la secuencia de slides con el diseño compartido y el copy de muestra ya calibrado. REEMPLAZA POR COMPLETO la pieza que haya abierta: proyecto nuevo, se pierde todo su texto y no hay deshacer. No convierte lo que ya está en carrusel — eso no se puede hacer desde acá. Si la persona pide "mejor que sea carrusel" y ya venían trabajando una pieza, decíselo ANTES en una frase ("abro el carrusel nuevo pero perdés la fecha y el título que armamos, ¿va?") y esperá el sí. Sin presetId abre tres slides en blanco, que es lo peor que le podés hacer a alguien que no diseña — elegí un preset con listar_carruseles salvo que la persona pida explícitamente empezar de cero. El formato tiene que ser uno de los que admiten carrusel.',
    esquema: {
      type: 'object',
      properties: {
        presetId: { type: 'string', enum: IDS_CARRUSEL },
        formatoId: { type: 'string', enum: CAROUSEL_FORMATS },
      },
      required: [],
      additionalProperties: false,
    },
    muta: true,
    // Sin preset el nombre ya dice cuántas slides son ("Carrusel en blanco
    // (3 slides)"), así que repetirlo quedaría tartamudo.
    resumir: (d) => (d.presetId
      ? `${d.abierto}, ${plural(d.cantidadSlides, 'slide', 'slides')}`
      : d.abierto),
    ejecutar: async ({ presetId, formatoId } = {}, ctx) => {
      const preset = presetId ? CAROUSELS.find((c) => c.id === presetId) : null
      if (presetId && !preset) throw new Error(noExiste('el carrusel armado', presetId, IDS_CARRUSEL))
      if (formatoId && !CAROUSEL_FORMATS.includes(formatoId)) {
        throw new Error(`El formato ${formatoId} no admite carrusel. Los que sí: ${CAROUSEL_FORMATS.join(', ')}.`)
      }
      const abrir = accion(ctx, 'abrirCarrusel')
      if (!abrir) throw new Error('Ahora mismo no puedo abrir carruseles desde acá. Decile a la persona cuál le conviene y que lo abra desde la home.')
      const formato = formatoId ? FORMATS_BY_ID[formatoId] : null
      abrir(formato, preset)
      return {
        abierto: preset ? preset.name : 'Carrusel en blanco (3 slides)',
        presetId: preset?.id || null,
        cantidadSlides: preset ? preset.slides.length : 3,
        formato: formato ? formatLabel(formato.id) : 'LinkedIn · Carrusel (retrato)',
      }
    },
  },

  {
    nombre: 'abrir_en_blanco',
    etiqueta: 'Abriendo una pieza en blanco…',
    descripcion: 'Abre una slide en blanco. Es la última opción: arrancar en blanco es justo donde se rompe la marca y donde la gente se empantana. Usala sólo si la persona lo pide con todas las letras o si de verdad ninguna plantilla sirve. También REEMPLAZA POR COMPLETO la pieza que haya abierta, sin deshacer: si hay algo armado, avisá antes.',
    esquema: {
      type: 'object',
      properties: { formatoId: { type: 'string', enum: IDS_FORMATO } },
      required: [],
      additionalProperties: false,
    },
    muta: true,
    // El formato no se nombra: cuando no lo pasaron, `datos.formato` es la
    // frase "el que ya estaba elegido", que pegada acá no se lee.
    resumir: (d) => d.abierta.toLowerCase(),
    ejecutar: async ({ formatoId } = {}, ctx) => {
      if (formatoId && !FORMATS_BY_ID[formatoId]) throw new Error(noExiste('el formato', formatoId, IDS_FORMATO))
      const abrir = accion(ctx, 'abrirEnBlanco')
      if (!abrir) throw new Error('Ahora mismo no puedo abrir una pieza en blanco desde acá.')
      const formato = formatoDe(formatoId, ctx)
      abrir(formato)
      return { abierta: 'Slide en blanco', formato: formato ? formatLabel(formato.id) : 'el que ya estaba elegido' }
    },
  },

  {
    nombre: 'cambiar_formato',
    etiqueta: 'Cambiando el formato…',
    descripcion: 'Cambia el tamaño de la pieza que ya está abierta (por ejemplo pasar de LinkedIn a story). El texto y el diseño se conservan: la pieza se recompone sola. Usala cuando la persona dice "ahora para Instagram". Si no hay nada abierto, no sirve: abrí algo primero.',
    esquema: {
      type: 'object',
      properties: { formatoId: { type: 'string', enum: IDS_FORMATO } },
      required: ['formatoId'],
      additionalProperties: false,
    },
    muta: true,
    // Las medidas no van: el que cambia de formato eligió una red, no
    // 1080×1920.
    resumir: (d) => `ahora es ${d.formato}`,
    ejecutar: async ({ formatoId }, ctx) => {
      const f = FORMATS_BY_ID[formatoId]
      if (!f) throw new Error(noExiste('el formato', formatoId, IDS_FORMATO))
      if (!ctx?.proyecto?.pieces?.length) throw new Error('No hay ninguna pieza abierta para cambiarle el formato.')
      if (ctx.proyecto.carousel && !CAROUSEL_FORMATS.includes(f.id)) {
        throw new Error(`Es un carrusel y ${f.id} no admite varias slides. Los que sí: ${CAROUSEL_FORMATS.join(', ')}.`)
      }
      const cambiar = accion(ctx, 'cambiarFormato')
      if (!cambiar) throw new Error('Ahora mismo no puedo cambiar el formato desde acá. La persona lo cambia con el selector de arriba.')
      cambiar(f)
      return { formato: formatLabel(f.id), medidas: `${f.w}×${f.h}` }
    },
  },

  {
    nombre: 'poner_foto',
    etiqueta: 'Poniendo la foto…',
    // El fallo más repetido del estrés con pedidos reales era PROMETER esto
    // sin poder hacerlo: listar_fotos nombraba y nada ponía. Ahora existe el
    // camino entero, con la misma regla que cambiar_formato: es inmediato y
    // sin Aceptar, porque acá no hay texto del modelo que revisar — la foto
    // es del banco de la marca y la pidió la persona. Lo que NO se negocia
    // es contarlo: una mutación silenciosa es peor que una promesa vacía.
    descripcion: 'Pone una foto del banco de Magoya como foto de FONDO de la pieza abierta. El slug sale de listar_fotos: no inventes uno. Es un cambio inmediato, como cambiar_formato: NO pasa por Aceptar (la foto es de la marca, no es texto tuyo), así que después contale a la persona QUÉ foto pusiste y decile que ⌘Z la saca si prefiere otra. Sólo entra en piezas que llevan foto (las plantillas con foto, o una a la que ya le pusieron foto de fondo): sobre una de color plano no la uses, te va a volver el error con las plantillas que sí llevan. NO sube fotos de la persona (eso lo hace ella desde el panel Detrás del editor) y NO pone fotos encima de la pieza: fondo solamente. Si no hay pieza abierta, primero se abre una plantilla.',
    esquema: {
      type: 'object',
      properties: {
        slug: { type: 'string', enum: SLUGS_FOTO, description: 'la foto del banco, por su slug (sale de listar_fotos)' },
      },
      required: ['slug'],
      additionalProperties: false,
    },
    muta: true,
    // El nombre de la foto y nada más: "Poniendo la foto… · de fondo quedó
    // Maíz". Que se deshace con ⌘Z lo cuenta el modelo en su respuesta, que
    // para eso la descripcion se lo exige.
    resumir: (d) => `de fondo quedó ${d.foto}`,
    ejecutar: async ({ slug }, ctx) => {
      // El enum del esquema no lo garantiza (lección de revisar_copy: la API
      // no valida los argumentos): se cruza acá, con la lista de válidos.
      const foto = PHOTOS.find((p) => p.slug === slug)
      if (!foto) throw new Error(noExiste('la foto', slug, SLUGS_FOTO))

      const proyecto = ctx?.proyecto
      if (!proyecto?.pieces?.length) {
        throw new Error('No hay ninguna pieza abierta donde poner la foto. Primero se abre una plantilla (las que llevan foto salen de listar_plantillas con conFoto:true) y después se le pone la foto.')
      }
      const i = Number.isInteger(proyecto.slideActual) ? proyecto.slideActual : 0
      const slide = proyecto.pieces[i] || proyecto.pieces[0]
      const c = slide?.content || {}
      // La plantilla se busca primero en ctx.plantillas, que trae también las
      // guardadas por la persona: el catálogo (TEMPLATES_BY_ID) no las tiene
      // y decirle "esa pieza no existe" a una pieza real sería mentir.
      const t = (ctx?.plantillas || []).find((x) => x.id === slide?.templateId)
        || TEMPLATES_BY_ID[slide?.templateId]
        || null

      // ¿Esta pieza LLEVA foto? El mismo razonamiento que resolvePiece en el
      // motor (engine/layouts.js): el fondo explícito (content.bg) le gana a
      // todo, y sin fondo explícito manda la superficie de la plantilla
      // (surface 'photo' o el hasPhoto de sus defaults). Una plantilla de
      // foto con el fondo pisado a color sigue siendo elegible: poner la
      // foto vuelve a encender bg:'photo', igual que el botón "Una foto" del
      // panel. Lo que NO se promueve desde acá es una pieza de color plano:
      // el motor lo permite con bg, pero cambiarle la superficie a un diseño
      // pensado sin foto es una decisión de composición de la persona, no
      // del copiloto.
      const d = t?.defaults || {}
      const bg = c.bg || d.bg || null
      const llevaFoto = bg === 'photo' || (t ? (t.surface === 'photo' || !!d.hasPhoto) : false)
      if (!llevaFoto) {
        const conFoto = visibles().filter((x) => x.surface === 'photo').map((x) => x.id)
        throw new Error(
          `«${t?.name || slide?.templateId || 'Esta pieza'}» es de color plano: no lleva foto de fondo, así que acá no hay dónde ponerla. `
          + `Las plantillas que sí llevan foto: ${conFoto.join(', ')}. `
          + 'Ofrecele abrir una de ésas (ojo: abrir reemplaza lo armado) — o, si quiere la foto en ESTA pieza, lo puede hacer ella desde el panel Detrás del editor: esa decisión de composición es suya.',
        )
      }

      const poner = accion(ctx, 'ponerFoto')
      if (!poner) throw new Error('Ahora mismo no puedo poner la foto desde acá. Decile a la persona cuál va y que la elija en el panel Detrás del editor.')

      // El MISMO shape que escribe el panel Detrás y que trae fotoDeMuestra
      // (templates/index.js): {src, natural, focal}, más el nombre para que
      // el inspector no la llame "Imagen". natural:null es el mismo valor
      // con el que abren las plantillas con foto: el motor lo resuelve solo.
      // Si ya había una foto, su encuadre (focal) se conserva — la persona
      // pudo haberlo ajustado y cambiar la imagen no es pedir que se pierda.
      poner({ src: foto.url, natural: null, name: foto.label, focal: c.photo?.focal || { x: 0.5, y: 0.5 } })

      return {
        foto: foto.label,
        slug: foto.slug,
        reemplazo: !!c.photo?.src,
        estado: 'La foto YA quedó puesta de fondo, sin pasar por Aceptar. Contale a la persona cuál pusiste y que ⌘Z la deshace si prefiere otra.',
      }
    },
  },

  {
    nombre: 'proponer_textos',
    etiqueta: 'Escribiendo una propuesta…',
    descripcion: 'LA única forma de que un texto escrito por vos llegue a una pieza. NO lo aplica: lo encola como propuesta y la persona ve el antes y el después con Aceptar o Descartar. Después de llamarla, contale a la persona qué propusiste y por qué — no digas que ya lo cambiaste, porque no lo cambiaste. Los roles tienen que ser de los que TIENE la pieza abierta, no cualquiera de la lista: la de Dato lleva volanta, cifra y descripción, y no tiene titular. Si mandás uno que no está, te lo devuelvo con la lista de los que sí. Antes de encolar, cada texto pasa además por las reglas editoriales y por el largo del rol, y te devuelvo los avisos: si vuelven avisos, corregí y volvé a proponer. Por eso NO hace falta que pases los textos por revisar_copy antes: es la misma revisión, una vuelta por texto más cara. Mandá los textos de la pieza juntos en una sola llamada. Y sólo los que CAMBIAN algo: si un texto es igual al que la pieza ya dice, lo saco y te lo aviso.',
    esquema: {
      type: 'object',
      properties: {
        textos: {
          type: 'array',
          minItems: 1,
          description: 'un texto por rol de la pieza',
          items: {
            type: 'object',
            properties: {
              rol: { type: 'string', enum: ROLES },
              texto: { type: 'string' },
            },
            required: ['rol', 'texto'],
            additionalProperties: false,
          },
        },
        motivo: { type: 'string', description: 'por qué proponés esto, en una línea y en criollo. Lo lee la persona antes de aceptar.' },
        plantillaId: { type: 'string', enum: IDS_PLANTILLA, description: 'sobre qué plantilla, si no es la que ya está abierta' },
      },
      required: ['textos', 'motivo'],
      additionalProperties: false,
    },
    muta: true,
    // "falta que aceptes" no es decoración: es el invariante 1 dicho en la
    // línea del chip. Nada de esto está aplicado todavía, y el chip no puede
    // sonar a que sí.
    resumir: (d) => {
      const base = plural(d.cuantos, 'texto propuesto', 'textos propuestos')
      if (!d.avisos?.length) return `${base}, falta que aceptes`
      const conAvisos = d.avisos.length === 1 ? 'uno con avisos' : `${d.avisos.length} con avisos`
      return `${base}, ${conAvisos}`
    },
    ejecutar: async ({ textos, motivo, plantillaId }, ctx) => {
      const lista = Array.isArray(textos) ? textos : []
      if (!lista.length) throw new Error('No mandaste ningún texto para proponer.')
      const malos = lista.filter((x) => !ROLES.includes(x?.rol))
      if (malos.length) throw new Error(noExiste('el rol de texto', malos[0]?.rol, ROLES))

      // ---- ¿esos roles existen en la pieza donde va a caer esto? ----
      // El enum de arriba son los diez roles que EXISTEN EN EL PRODUCTO, no
      // los que tiene la pieza abierta. Sin este cruce, "mejorame el titular"
      // parado en Dato (volanta + cifra + descripción) encolaba un `title`
      // que la plantilla no dibuja: la persona tocaba Aceptar y la pieza no
      // cambiaba un píxel. Se cruza acá, ANTES de encolar, así el modelo se
      // corrige solo en vez de gastarle un Aceptar a nadie.
      //
      // Contra qué se cruza: si hay una pieza armada, es LA pieza —
      // aplicarPropuesta escribe ahí aunque le mandes otro plantillaId, así
      // que mirar el plantillaId sería mirar la plantilla equivocada. Recién
      // sin ninguna pieza manda la plantilla que trae la propuesta.
      //
      // Y "armada" no es "en pantalla". Este cruce nació muerto: el chat
      // vive en la home, y `ctx.proyecto` venía filtrado por
      // `view === 'editor'`, así que acá `abierta` era null SIEMPRE que el
      // copiloto estaba a la vista. El titular para Dato se encolaba igual,
      // la persona gastaba el Aceptar y recién ahí App.jsx le decía que no
      // entraba. Desde que el estado describe la pieza que VA A RECIBIR el
      // texto (y no la que se ve), el cruce corre de verdad.
      const abierta = ctx?.proyecto?.pieces?.[ctx?.proyecto?.slideActual || 0] || null
      const destino = abierta
        ? { t: TEMPLATES_BY_ID[abierta.templateId], c: abierta.content }
        : (plantillaId ? { t: TEMPLATES_BY_ID[plantillaId], c: null } : null)
      // Sin pieza abierta y sin plantilla en la propuesta no hay contra qué
      // cruzar, y una plantilla guardada por la persona tampoco está en el
      // catálogo. Ahí NO se filtra: inventar un "no existe" sería peor que
      // dejarlo pasar, y del otro lado igual está el filtro de App.jsx.
      if (destino?.t) {
        const existe = rolesDePieza(destino.t, destino.c)
        const fuera = [...new Set(lista.map((x) => x.rol).filter((r) => !existe.includes(r)))]
        if (fuera.length) {
          throw new Error(
            `«${destino.t.name}» no tiene ${fuera.join(', ')}, así que ${fuera.length === 1 ? 'ese texto no se vería' : 'esos textos no se verían'}. `
            + (existe.length
              ? `Los textos que sí entran en esta pieza: ${existe.join(', ')}. Volvé a proponer con esos, o si de verdad hace falta otro lugar, ofrecele cambiar de plantilla.`
              : 'Esta pieza no tiene ningún lugar de texto. Decíselo y ofrecele cambiar de plantilla.'),
          )
        }
      }

      // ---- ¿esto cambia algo? ----
      // Una propuesta que dice lo mismo que la pieza le cuesta a la persona
      // un Aceptar y una card de "antes: WEBINAR → después: WEBINAR". Pasó
      // en los dos pedidos de webinar del run de U1 y no es culpa del
      // modelo: hasta ahora abrir_plantilla no le decía qué había quedado
      // escrito, así que proponía los defaults de vuelta creyendo que los
      // estaba escribiendo. Eso ya se arregló allá; esto es la red, y es
      // barata. No aplica nada ni descarta trabajo: saca del camino lo que
      // no mueve un píxel.
      const yaDice = abierta ? textosDe(abierta.content) : {}
      const igual = (x) => yaDice[x.rol] !== undefined
        && String(yaDice[x.rol]).trim() === String(x.texto ?? '').trim()
      const repetidos = [...new Set(lista.filter(igual).map((x) => x.rol))]
      const cambian = lista.filter((x) => !igual(x))
      if (!cambian.length) {
        throw new Error(
          `La pieza ya dice exactamente eso en ${repetidos.join(', ')}, así que no encolé nada: aceptarlo no cambiaría un píxel. `
          + 'Si querés cambiar algo, proponé un texto distinto; si no, decile a la persona que eso ya está puesto y seguí.',
        )
      }

      const revisados = cambian.map(({ rol, texto }) => ({ rol, texto, avisos: avisosDe(rol, texto) }))
      const avisos = revisados.filter((r) => r.avisos.length).map((r) => ({ rol: r.rol, avisos: r.avisos }))

      const proponer = accion(ctx, 'proponer')
      if (!proponer) throw new Error('No puedo encolar propuestas en esta pantalla. Escribile los textos en el chat para que los copie a mano.')
      proponer({
        tipo: 'textos',
        procedencia: 'modelo',
        motivo: String(motivo || '').trim(),
        // Con una pieza armada, la plantilla es LA DE ELLA y no la que
        // mandó el modelo — por lo mismo que el cruce de arriba: el texto
        // va a caer ahí igual. La card muestra este nombre, así que dejar
        // ganar al `plantillaId` de la propuesta era ponerle a la card el
        // cartel de una plantilla que no es donde el texto termina.
        plantillaId: abierta?.templateId || plantillaId || null,
        textos: revisados.map(({ rol, texto }) => ({ rol, texto })),
        avisos,
      })

      return {
        encolada: true,
        cuantos: revisados.length,
        estado: 'Propuesta encolada. NO está aplicada: espera el sí de la persona.',
        // Que se hayan caído no se calla: si el modelo dijera "te propuse la
        // volanta y el CTA" y la card muestra uno solo, la persona ve otra
        // cosa de la que le contaron.
        ...(repetidos.length
          ? { yaDecianEso: repetidos, nota: `Saqué ${repetidos.join(', ')} de la propuesta: la pieza ya dice exactamente eso. No se lo cuentes como algo que propusiste.` }
          : {}),
        avisos: avisos.length ? avisos : undefined,
      }
    },
  },
]

// ============================================================
// LO QUE VE EL MODELO
// ============================================================

// Formato exacto de la API de Anthropic. Se genera de CAPACIDADES, así
// que agregar una capacidad es agregar un objeto arriba y nada más.
export function herramientasParaModelo() {
  return CAPACIDADES.map((c) => ({
    name: c.nombre,
    description: c.descripcion,
    input_schema: c.esquema,
  }))
}

export function capacidadPorNombre(nombre) {
  return CAPACIDADES.find((c) => c.nombre === nombre) || null
}

// ============================================================
// EJECUTAR
//
// Esta función NUNCA lanza. El loop del copiloto le manda el error de
// vuelta al modelo como tool_result y el modelo se corrige solo — un
// throw acá sería una conversación muerta a mitad de camino.
// ============================================================
export async function ejecutarCapacidad(nombre, args, ctx) {
  const cap = capacidadPorNombre(nombre)
  if (!cap) {
    return { ok: false, error: `No existe la capacidad “${nombre}”. Las que tengo: ${CAPACIDADES.map((c) => c.nombre).join(', ')}.` }
  }
  const entrada = args && typeof args === 'object' ? args : {}
  const faltan = (cap.esquema?.required || []).filter((k) => entrada[k] === undefined || entrada[k] === null || entrada[k] === '')
  if (faltan.length) {
    return { ok: false, error: `Le falta ${faltan.join(' y ')} a ${nombre}. Volvé a llamarla con eso.` }
  }
  try {
    const datos = await cap.ejecutar(entrada, ctx || {})
    return { ok: true, datos }
  } catch (e) {
    // el mensaje va tal cual al modelo: está escrito para que pueda
    // corregirse, no para un log
    return { ok: false, error: String(e?.message || e || 'No se pudo ejecutar.') }
  }
}
