// ============================================================
// MEMORIA — qué se hizo, qué salió publicado y qué midió
//
// Facu: "que recuerde qué hizo, qué sirvió, qué salió la última vez, qué
// está pasando en las redes de Magoya, si algunas piezas tienen más
// impacto". Este archivo es la mitad de abajo de eso: guarda y lee. La
// mitad de arriba —qué hace el copiloto con este dato— vive en otro lado.
//
// DOS REGLAS QUE MANDAN SOBRE TODO LO DEMÁS
//
// 1 · NADA DE ACÁ PUEDE ROMPER LA APP. Toda función va envuelta en
//     try/catch y nunca tira: registrar* devuelven false, las lecturas
//     devuelven un sobre que dice si pudieron leer. La memoria es un lujo.
//     Sin memoria el producto sigue siendo el producto; con una pantalla
//     en blanco no es nada.
//
// 1bis · PERO EL VACÍO TIENE QUE DECIR POR QUÉ ESTÁ VACÍO. Antes las
//     lecturas devolvían [] y '' tanto cuando no había nada como cuando
//     Supabase no contestaba, y los dos casos se veían idénticos aguas
//     abajo: con la base caída el copiloto le decía "todavía no cargaron
//     nada" a un equipo con cuarenta piezas cargadas. No inventaba un
//     número, pero afirmaba un hecho falso sobre el mundo con la misma
//     cara de certeza — el mismo pecado con otra ropa. Por eso ahora las
//     lecturas devuelven un sobre:
//       { ok: true,  datos: [...] } / { ok: true, texto: '...' }  → leí
//       { ok: false, motivo: 'no pude leer la memoria' }          → no leí
//     "leí y no hay nada" es ok:true con el contenido vacío. Quien consume
//     tiene que poder decir las dos cosas distinto, y en este repo las
//     dice: Pulso, memoria_equipo y el system prompt del copiloto.
//
// 2 · NUNCA UN NÚMERO QUE NO TENEMOS. resumenParaCopiloto() siempre dice
//     sobre cuántos casos está hablando, y cuando la muestra es chica lo
//     dice con todas las letras. Un promedio de tres piezas presentado
//     como "las de caso rinden mejor" es exactamente el delirio que este
//     producto vino a evitar, sólo que con cara de dato. Si no hay
//     métricas, la respuesta correcta es "no tengo datos", y esa frase
//     está escrita literal más abajo.
// ============================================================
import { supabase } from './supabase.js'

// Debajo de esto no hay muestra, hay anécdotas. Cinco tampoco es mucho:
// es el punto donde pasamos de "no digas nada" a "decilo con el n al lado".
const MUESTRA_MINIMA = 5

// Y el total no alcanza: el ranking se arma POR PLANTILLA, así que el piso
// también tiene que ser por plantilla. Con 6 mediciones —cinco de `dato`
// promediando 40 y una de `caso-cliente` con 300— el resumen decía "arriba
// del promedio: caso-cliente 300 (1 medición)" y el modelo lo leía como
// "el formato de caso viene rindiendo": una afirmación de rendimiento
// sostenida por un solo dato, con cara de dato.
//
// Por qué 3 y no 5: con 5 por grupo no habría ranking hasta las diez
// mediciones y la pantalla quedaría muda durante meses, que es otra forma
// de no servir. 3 es el punto exacto donde una sola medición deja de SER
// la media del grupo: con n=1 el outlier es el grupo, con n=2 lo empata,
// con n=3 recién lo empuja. Sigue sin ser estadística —por eso el n va
// pegado a cada número igual— pero ya no es una anécdota disfrazada.
const MUESTRA_MINIMA_PLANTILLA = 3

// Cuánta historia mira el resumen. Con más de esto el texto se vuelve
// ilegible para el modelo y para cualquiera.
const VENTANA = 200

const nro = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const red = (v) => String(v || '').trim().toLowerCase()

// ============================================================
// ESCRIBIR
// Devuelven el id (para poder encadenar pieza → publicación → métrica) o
// false. Nunca tiran.
// ============================================================

export async function registrarPieza({ templateId, formatId, objetivo, titulo, carrusel, autor } = {}) {
  if (!templateId) return false
  try {
    const { data, error } = await supabase
      .from('bitacora')
      .insert({
        template_id: templateId,
        format_id: formatId || null,
        objetivo: objetivo || null,
        // el título es para reconocer la pieza de un vistazo, no para
        // guardar el copy: se recorta y listo
        titulo: titulo ? String(titulo).slice(0, 200) : null,
        carrusel: !!carrusel,
        autor: autor || null,
      })
      .select('id')
      .single()
    if (error) return false
    return data.id
  } catch {
    return false
  }
}

export async function registrarPublicacion({ piezaId, red: laRed, publicadoEl, url } = {}) {
  if (!laRed) return false
  try {
    const { data, error } = await supabase
      .from('publicaciones')
      .insert({
        pieza_id: piezaId || null,
        red: red(laRed),
        publicado_el: aISO(publicadoEl) || hoy(),
        url: url || null,
      })
      .select('id')
      .single()
    if (error) return false
    return data.id
  } catch {
    return false
  }
}

export async function registrarMetricas({ publicacionId, likes, comentarios, guardados, alcance, medidoEl } = {}) {
  if (!publicacionId) return false
  try {
    const { error } = await supabase.from('metricas').insert({
      publicacion_id: publicacionId,
      // null y 0 no son lo mismo: "no lo reporta esa red" contra "no le
      // dio bola nadie". Si se pisa con 0 se pierde la diferencia para
      // siempre y el promedio queda mordido.
      likes: aEntero(likes),
      comentarios: aEntero(comentarios),
      guardados: aEntero(guardados),
      alcance: aEntero(alcance),
      medido_el: aISO(medidoEl) || hoy(),
    })
    return !error
  } catch {
    return false
  }
}

// ============================================================
// LEER
// ============================================================

/**
 * La bitácora, lo último primero. `red` filtra por dónde salió, que vive
 * en la tabla de al lado: con !inner el join deja afuera las piezas que
 * nunca se publicaron, que es justo lo que se está pidiendo.
 *
 * Devuelve un sobre, nunca una lista pelada:
 *   { ok: true,  datos: [...] }  → pude leer (y si viene vacío, no hay nada)
 *   { ok: false, motivo: '...' } → no pude leer, que es otra cosa
 * Antes devolvía [] en los dos casos y aguas abajo se veían idénticos.
 */
export async function listarBitacora({ objetivo, red: laRed, limite = 20 } = {}) {
  try {
    // Los números vienen en el mismo viaje: quien pregunta por la bitácora
    // pregunta por cómo le fue, no por la lista pelada. Sin esto Pulso
    // dibujaba "sin números todavía" para siempre, aun con las métricas
    // cargadas — y el copiloto leía una bitácora sin impacto.
    const cuerpo = `id, red, publicado_el, url, metricas(likes, comentarios, guardados, alcance, medido_el)`
    const join = laRed ? `publicaciones!inner(${cuerpo})` : `publicaciones(${cuerpo})`
    let q = supabase.from('bitacora').select(`*, ${join}`).order('created_at', { ascending: false }).limit(limite)
    if (objetivo) q = q.eq('objetivo', objetivo)
    if (laRed) q = q.eq('publicaciones.red', red(laRed))
    const { data, error } = await q
    if (error) return NO_PUDE
    return { ok: true, datos: (data || []).map(conUltimaMedicion) }
  } catch {
    return NO_PUDE
  }
}

// El sobre del fracaso, uno solo y siempre el mismo: quien lo recibe no
// tiene que adivinar si fue la red, la tabla o los permisos — no lo
// sabemos nosotros tampoco. Lo único que importa afuera es que NO se leyó,
// y que eso no se puede contar como "no hay nada".
const NO_PUDE = { ok: false, motivo: 'no pude leer la memoria' }

// De cada publicación interesa UNA medición: la más reciente. La serie
// entera obliga a que cada pantalla elija cuál mirar, y ahí es donde dos
// lugares de la misma app empiezan a citar números distintos del mismo
// hecho. Se elige una vez, acá.
function conUltimaMedicion(fila) {
  const pubs = (fila?.publicaciones || []).map((p) => {
    const serie = Array.isArray(p.metricas) ? p.metricas : []
    const ultima = serie.length
      ? [...serie].sort((a, b) => String(a.medido_el).localeCompare(String(b.medido_el))).pop()
      : null
    return { ...p, metricas: ultima }
  })
  return { ...fila, publicaciones: pubs }
}

/**
 * Lo que sabemos, en castellano y compacto, para meter en el contexto del
 * copiloto.
 *
 * Cada afirmación viene con su n pegado. El bloque de impacto tiene cuatro
 * estados y ninguno se saltea:
 *   no se pudo leer    → "no pude consultar las métricas" (≠ no hay)
 *   sin métricas       → "no tengo datos de impacto" (y punto)
 *   menos de 5         → los números crudos + "la muestra es chica"
 *   5 o más            → ranking SÓLO con las plantillas que tienen
 *                        mediciones propias suficientes, contra un promedio
 *                        calculado SÓLO con esas mismas mediciones; las
 *                        demás salen aparte, marcadas como casos sueltos.
 *                        Y si al filtrar no quedan 5 mediciones confiables,
 *                        no hay ranking ni promedio: números crudos y listo.
 *
 * Devuelve un sobre:
 *   { ok: true,  texto: '...' } → leí; texto '' es "todavía no sé nada de
 *                                 ustedes", que es la verdad y es útil
 *   { ok: false, motivo: '...' } → no pude leer, que NO es lo mismo y el
 *                                 que arma el prompt tiene que decirlo
 *                                 distinto
 * Las consultas de adentro fallan por separado: si la bitácora se lee pero
 * las métricas no, el texto lo dice en su renglón en vez de comerse el
 * hueco. Nada de esto tira: el sobre es la forma de contar el problema.
 */
export async function resumenParaCopiloto() {
  try {
    const bit = await traer('bitacora', (q) => q.select('*').order('created_at', { ascending: false }).limit(VENTANA))
    // Sin la bitácora no hay resumen posible: acá sí es todo o nada.
    if (!bit.ok) return NO_PUDE
    const piezas = bit.datos
    if (!piezas.length) return { ok: true, texto: '' }

    const ids = piezas.map((p) => p.id)
    const traidas = await traer('publicaciones', (q) => q.select('*').in('pieza_id', ids))
    const pubs = traidas.datos
    const medidas = pubs.length
      ? await traer('metricas', (q) => q.select('*').in('publicacion_id', pubs.map((p) => p.id)).order('medido_el', { ascending: true }))
      : { ok: traidas.ok, datos: [] }
    const mets = medidas.datos

    const lineas = []

    // ---- qué se hizo ----
    const desde = piezas[piezas.length - 1]?.created_at
    lineas.push(
      `Bitácora: ${piezas.length} pieza${piezas.length === 1 ? '' : 's'} registrada${piezas.length === 1 ? '' : 's'}` +
      (desde ? ` desde el ${enCriollo(desde)}` : '') + '.'
    )
    const plantillas = top(piezas.map((p) => p.template_id))
    if (plantillas.length) lineas.push(`Plantillas más repetidas: ${plantillas.map(([k, n]) => `${k} (${n})`).join(', ')}.`)
    const objetivos = top(piezas.map((p) => p.objetivo))
    if (objetivos.length) lineas.push(`Para qué: ${objetivos.map(([k, n]) => `${k} (${n})`).join(', ')}.`)
    const formatos = top(piezas.map((p) => p.format_id))
    if (formatos.length) lineas.push(`Formatos: ${formatos.map(([k, n]) => `${k} (${n})`).join(', ')}.`)

    // ---- qué salió ----
    if (!traidas.ok) {
      // Ojo con este renglón: es exactamente donde antes se colaba la
      // mentira. "No pude consultar" y "no hay ninguna" se escriben
      // distinto porque son cosas distintas.
      lineas.push('No pude leer la tabla de publicaciones, así que hoy no sé qué salió ni dónde. NO es que no haya nada publicado: es que no lo pude consultar. Decilo así si te preguntan.')
    } else if (!pubs.length) {
      lineas.push('Ninguna quedó marcada como publicada, así que no sé cuáles salieron de verdad ni dónde.')
    } else {
      const redes = top(pubs.map((p) => p.red), 6)
      lineas.push(`Publicadas: ${pubs.length} de ${piezas.length}, en ${redes.map(([k, n]) => `${k} (${n})`).join(', ')}.`)
      const ultima = [...pubs].sort((a, b) => String(b.publicado_el).localeCompare(String(a.publicado_el)))[0]
      if (ultima?.publicado_el) lineas.push(`La última salió el ${enCriollo(ultima.publicado_el)} en ${ultima.red}.`)
    }

    // ---- qué midió ----
    // Si no pude traer publicaciones o métricas, el bloque de impacto no se
    // arma: armarlo con lo que llegó daría "ninguna tiene métricas", que es
    // una afirmación sobre el mundo que no estoy en condiciones de hacer.
    lineas.push(traidas.ok && medidas.ok
      ? bloqueImpacto(piezas, pubs, mets)
      : 'Impacto: NO PUDE CONSULTAR las métricas ahora mismo. Eso no quiere decir que no haya: quiere decir que no las pude leer. Si te preguntan qué funcionó, decí que no podés mirar los números en este momento y ofrecé reintentar — no digas que todavía no cargaron nada, y mucho menos estimes.')
    return { ok: true, texto: lineas.join('\n') }
  } catch {
    return NO_PUDE
  }
}

// El bloque delicado. Todo lo que se afirma acá se puede contar con los
// dedos y el texto dice cuántos dedos son.
function bloqueImpacto(piezas, pubs, mets) {
  // una medición por publicación: la más reciente. Las anteriores son la
  // serie de tiempo, no sirven para comparar entre piezas.
  const ultimas = new Map()
  for (const m of mets) ultimas.set(m.publicacion_id, m)   // vienen ordenadas ascendente: gana la última

  const porPieza = new Map(piezas.map((p) => [p.id, p]))
  const casos = []
  for (const p of pubs) {
    const m = ultimas.get(p.id)
    if (!m) continue
    const pieza = porPieza.get(p.pieza_id)
    casos.push({
      plantilla: pieza?.template_id || 'plantilla desconocida',
      red: p.red,
      inter: nro(m.likes) + nro(m.comentarios) + nro(m.guardados),
      alcance: nro(m.alcance),
    })
  }

  if (!casos.length) {
    return 'Impacto: NO TENGO DATOS. Ninguna publicación tiene métricas cargadas, así que no sé qué rindió mejor. Si te preguntan cuál funcionó, decí que no hay datos todavía y ofrecé importar el CSV de la red — no estimes.'
  }

  const detalle = [...casos]
    .sort((a, b) => b.inter - a.inter)
    .slice(0, 5)
    .map((c) => `${c.plantilla} en ${c.red}: ${c.inter} interacciones${c.alcance ? ` sobre ${c.alcance} de alcance` : ''}`)
    .join('; ')

  if (casos.length < MUESTRA_MINIMA) {
    return `Impacto: hay métricas de ${casos.length} ${casos.length === 1 ? 'publicación' : 'publicaciones'} sobre ${pubs.length} publicadas. LA MUESTRA ES CHICA: con menos de ${MUESTRA_MINIMA} mediciones no alcanza para afirmar que una plantilla rinda más que otra. Los números crudos, para nombrarlos como casos sueltos y nunca como tendencia: ${detalle}.`
  }

  // Con 5 o más se puede comparar contra el promedio. Sigue sin ser
  // estadística: es "esto es lo que hay", con el n al lado de cada cosa.
  const porPlantilla = new Map()
  for (const c of casos) {
    const acc = porPlantilla.get(c.plantilla) || { total: 0, n: 0 }
    porPlantilla.set(c.plantilla, { total: acc.total + c.inter, n: acc.n + 1 })
  }
  const rank = [...porPlantilla.entries()]
    .map(([k, v]) => ({ k, media: Math.round(v.total / v.n), n: v.n, total: v.total }))
    .sort((a, b) => b.media - a.media)

  // El corte del piso. Las que no llegan NO entran al ranking ni por
  // arriba ni por abajo: se nombran aparte, con el número crudo y con el
  // cartel de que no se pueden comparar. Guardarles el número importa —el
  // caso que rindió 300 es interesante— lo que no se puede es presentarlo
  // como el rendimiento de esa plantilla.
  const comparables = rank.filter((r) => r.n >= MUESTRA_MINIMA_PLANTILLA)
  const sueltas = rank.filter((r) => r.n < MUESTRA_MINIMA_PLANTILLA)

  // Y acá la otra mitad del corte, que faltaba. El promedio se calcula SÓLO
  // con las mediciones que entran al ranking: lo que no es confiable para
  // rankear tampoco es confiable para mover la vara. Antes la suelta se
  // excluía de la comparación pero seguía adentro del promedio, y decidía
  // el resultado desde afuera: con 5 de `dato` en 300 y una de
  // `caso-cliente` en 40, el promedio caía a 257 y salía "arriba del
  // promedio: dato 300 (5 mediciones)" — una afirmación de rendimiento
  // fabricada íntegramente por la medición que descartamos por poco
  // confiable. Al revés pasaba lo mismo: la suelta en 300 empujaba el
  // promedio a 83 y mandaba a `dato` "abajo".
  const nComp = comparables.reduce((a, r) => a + r.n, 0)
  // el total crudo, no la suma de medias redondeadas: redondear dos veces
  // corre la vara unos puntos y esos puntos deciden quién está arriba
  const promComp = nComp ? Math.round(comparables.reduce((a, r) => a + r.total, 0) / nComp) : 0

  // Si al filtrar no queda muestra para un promedio con sentido, no hay
  // ranking: un promedio de tres mediciones usado como vara es el mismo
  // delirio con cara de dato. Los números igual se dicen —existen— pero
  // como lo que son, cada uno con su n y sin arriba ni abajo.
  if (nComp < MUESTRA_MINIMA) {
    const crudos = rank.map((r) => `${r.k} ${r.media} (${r.n} ${r.n === 1 ? 'medición' : 'mediciones'})`).join(', ')
    return [
      `Impacto: ${casos.length} publicaciones medidas sobre ${pubs.length} publicadas.`,
      comparables.length
        ? `Pero sólo ${nComp} de esas mediciones son de plantillas que llegan a ${MUESTRA_MINIMA_PLANTILLA} mediciones propias, y con menos de ${MUESTRA_MINIMA} confiables no hay promedio que sirva de vara.`
        : `Ninguna plantilla llega a ${MUESTRA_MINIMA_PLANTILLA} mediciones propias, así que no hay contra qué comparar.`,
      `NO HAY RANKING NI PROMEDIO DE REFERENCIA. Los números crudos, uno por plantilla, para nombrarlos como casos sueltos y jamás como tendencia: ${crudos}.`,
      'No digas que una plantilla rinde más que otra, ni que algo está arriba o abajo del promedio: acá ese promedio no existe.',
    ].join(' ')
  }

  const arriba = comparables.filter((r) => r.media > promComp).slice(0, 3)
  const abajo = comparables.filter((r) => r.media < promComp).slice(-2)

  return [
    `Impacto: ${casos.length} publicaciones medidas sobre ${pubs.length} publicadas.`,
    `Promedio de referencia ${promComp} interacciones (likes + comentarios + guardados), calculado SÓLO con las ${nComp} mediciones de plantillas que llegan a ${MUESTRA_MINIMA_PLANTILLA} mediciones propias: las sueltas no mueven la vara.`,
    arriba.length ? `Arriba del promedio: ${arriba.map((r) => `${r.k} ${r.media} (${r.n} ${r.n === 1 ? 'medición' : 'mediciones'})`).join(', ')}.` : '',
    abajo.length ? `Abajo: ${abajo.map((r) => `${r.k} ${r.media} (${r.n})`).join(', ')}.` : '',
    // Con una sola plantilla comparable el promedio ES esa plantilla, así
    // que nunca cae ni arriba ni abajo y el bloque queda mudo justo donde
    // el modelo va a querer llenar el hueco — restando contra los casos
    // sueltos, que es lo que acabamos de prohibir. Se dice en voz alta.
    comparables.length === 1
      ? `Ojo: la única plantilla con muestra suficiente es ${comparables[0].k}, y es ella misma la que define el promedio. No hay con qué compararla: no digas que rinde más ni menos que nada.`
      : '',
    sueltas.length
      ? `Casos sueltos, con menos de ${MUESTRA_MINIMA_PLANTILLA} mediciones cada uno y por eso AFUERA de la comparación y AFUERA del promedio: ${sueltas.map((r) => `${r.k} ${r.media} (${r.n} ${r.n === 1 ? 'medición' : 'mediciones'})`).join(', ')}. Son piezas, no rendimientos: nombralas como "esta pieza hizo tanto", nunca como "esta plantilla viene rindiendo", y no las ubiques arriba ni abajo del promedio.`
      : '',
    `Son ${casos.length} mediciones en total: alcanza para mirar, no para concluir. Cuando cites cualquiera de estos números, decí sobre cuántas piezas estás hablando.`,
  ].filter(Boolean).join(' ')
}

// ============================================================
// IMPORTAR EL CSV QUE BAJA DE LA RED
//
// Los exports de LinkedIn y Meta no se parecen en nada entre sí y cambian
// solos cada tanto: distinto separador, distinto encabezado, filas de
// título antes de las columnas, números con punto o con coma. Así que el
// parser es tolerante en la FORMA y estricto en el FONDO — prueba varios
// separadores, busca el encabezado donde esté y acepta un montón de
// alias, pero si no encuentra una columna de fecha y al menos una de
// números, se planta y lo dice. Adivinar qué columna es cuál sería meter
// datos inventados en la única tabla que después se usa para afirmar
// cosas. Antes cero que mal.
// ============================================================

// Los alias van de más específico a más genérico: se busca por igualdad
// primero y recién después por "contiene", y en ese segundo paso el orden
// evita que 'fecha' se coma a 'fecha de publicación'.
const COLUMNAS = {
  fecha: ['fecha de publicacion', 'fecha de creacion', 'fecha de la publicacion', 'publicado el', 'post publish date', 'publish date', 'created date', 'date', 'fecha', 'dia', 'day'],
  alcance: ['personas alcanzadas', 'cuentas alcanzadas', 'impresiones totales', 'impresiones', 'visualizaciones', 'alcance', 'accounts reached', 'impressions', 'views', 'reach'],
  likes: ['me gusta y otras reacciones', 'reacciones', 'me gusta', 'likes', 'reactions'],
  comentarios: ['comentarios', 'comments'],
  guardados: ['elementos guardados', 'guardados', 'saves', 'saved', 'bookmarks'],
}

const SEPARADORES = [',', ';', '\t']

export async function importarCSV(texto, laRed) {
  const motivos = []
  const nada = (motivo) => ({ importadas: 0, salteadas: 0, motivos: [motivo] })

  if (!texto || !String(texto).trim()) return nada('El archivo está vacío.')
  if (!laRed) return nada('No me dijiste de qué red es el CSV, y sin eso no sé contra qué publicaciones matchear.')

  try {
    // ---- forma ----
    const filas = mejorCorte(String(texto))
    if (!filas.length) return nada('No pude leer ninguna fila del archivo.')

    const cab = buscarEncabezado(filas)
    if (!cab) {
      return nada('No reconozco este formato: no encontré una fila de encabezados con una columna de fecha y al menos una de números (impresiones, alcance, reacciones, me gusta, comentarios o guardados). Revisá que sea el export tal cual lo baja la red, sin editar.')
    }
    const { i: iCab, cols } = cab

    // ---- contra qué matcheamos ----
    const { data, error } = await supabase
      .from('publicaciones')
      .select('id, red, publicado_el')
      .eq('red', red(laRed))
    if (error) return nada('No pude leer las publicaciones cargadas, así que no tengo contra qué comparar el CSV.')
    if (!data?.length) return nada(`No hay ninguna publicación registrada en ${red(laRed)}. Primero hay que marcar qué piezas salieron y cuándo; recién ahí el CSV tiene con qué matchear.`)

    const porFecha = new Map()
    for (const p of data) {
      if (!p.publicado_el) continue
      const k = String(p.publicado_el).slice(0, 10)
      porFecha.set(k, [...(porFecha.get(k) || []), p])
    }

    // ---- fila por fila ----
    const aInsertar = []
    const yaUsadas = new Set()
    let sinFecha = 0, sinPublicacion = 0, ambiguas = 0, sinNumeros = 0, repetidas = 0

    for (let i = iCab + 1; i < filas.length; i++) {
      const f = filas[i]
      if (!f.some((c) => String(c).trim())) continue   // línea en blanco

      const fecha = aISO(f[cols.fecha])
      if (!fecha) { sinFecha++; continue }

      const likes = aEntero(f[cols.likes])
      const comentarios = aEntero(f[cols.comentarios])
      const guardados = aEntero(f[cols.guardados])
      const alcance = aEntero(f[cols.alcance])
      if (likes === null && comentarios === null && guardados === null && alcance === null) { sinNumeros++; continue }

      const candidatas = porFecha.get(fecha)
      if (!candidatas) { sinPublicacion++; continue }
      // Dos piezas el mismo día en la misma red y no hay forma de saber
      // cuál es cuál: el CSV no trae el id de nuestra pieza. Se saltea. Un
      // número puesto en la publicación equivocada es peor que un hueco.
      if (candidatas.length > 1) { ambiguas++; continue }
      if (yaUsadas.has(candidatas[0].id)) { repetidas++; continue }
      yaUsadas.add(candidatas[0].id)

      aInsertar.push({
        publicacion_id: candidatas[0].id,
        likes, comentarios, guardados, alcance,
        // la medición es de HOY, no del día que se publicó: son los
        // números que la red muestra en el momento en que se bajó el export
        medido_el: hoy(),
      })
    }

    if (sinFecha) motivos.push(`${sinFecha} fila${sinFecha === 1 ? '' : 's'} sin una fecha que pueda leer.`)
    if (sinNumeros) motivos.push(`${sinNumeros} fila${sinNumeros === 1 ? '' : 's'} sin ningún número.`)
    if (sinPublicacion) motivos.push(`${sinPublicacion} fila${sinPublicacion === 1 ? '' : 's'} con fecha sin publicación registrada en ${red(laRed)}.`)
    if (ambiguas) motivos.push(`${ambiguas} fila${ambiguas === 1 ? '' : 's'} con más de una publicación ese mismo día: no puedo saber cuál es cuál y quedan afuera.`)
    if (repetidas) motivos.push(`${repetidas} fila${repetidas === 1 ? '' : 's'} apuntando a una publicación que ya tomó su número en este mismo import.`)

    const salteadas = sinFecha + sinNumeros + sinPublicacion + ambiguas + repetidas
    if (!aInsertar.length) {
      if (!motivos.length) motivos.push('El archivo no traía filas de datos debajo del encabezado.')
      return { importadas: 0, salteadas, motivos }
    }

    const { error: errIns } = await supabase.from('metricas').insert(aInsertar)
    if (errIns) return { importadas: 0, salteadas, motivos: [...motivos, 'Leí el archivo bien pero no pude guardar las métricas. Probá de nuevo.'] }

    return { importadas: aInsertar.length, salteadas, motivos }
  } catch {
    return nada('Algo se rompió leyendo el archivo. No se guardó nada.')
  }
}

// ------------------------------------------------------------
// Parser de CSV a mano. Sin dependencias nuevas, y las comillas dobles
// importan: los títulos de posts vienen entre comillas y adentro tienen
// comas, saltos de línea y comillas escapadas ("").
// ------------------------------------------------------------
function partir(texto, sep) {
  const out = []
  let fila = []
  let campo = ''
  let comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c !== '"') { campo += c; continue }
      if (texto[i + 1] === '"') { campo += '"'; i++; continue }
      comillas = false
      continue
    }
    if (c === '"') { comillas = true; continue }
    if (c === sep) { fila.push(campo); campo = ''; continue }
    if (c === '\n') { fila.push(campo); out.push(fila); fila = []; campo = ''; continue }
    if (c === '\r') continue
    campo += c
  }
  if (campo !== '' || fila.length) { fila.push(campo); out.push(fila) }
  return out
}

// Cuál separador es, sin preguntarle a nadie: se parte con los tres y gana
// el que produce más columnas. Un CSV con punto y coma partido por comas
// da una sola columna, así que la diferencia es obvia.
function mejorCorte(texto) {
  let mejor = []
  let ancho = 0
  for (const sep of SEPARADORES) {
    const filas = partir(texto, sep)
    const a = Math.max(...filas.slice(0, 12).map((f) => f.length), 0)
    if (a > ancho) { ancho = a; mejor = filas }
  }
  return ancho > 1 ? mejor : []
}

// Los exports meten título, cuenta y rango de fechas ANTES de las
// columnas, así que el encabezado no es la fila 0. Se busca en las
// primeras 15 la que tenga fecha + al menos un número.
function buscarEncabezado(filas) {
  for (let i = 0; i < Math.min(filas.length, 15); i++) {
    const cabs = filas[i].map(plano)
    const cols = {
      fecha: buscarCol(cabs, COLUMNAS.fecha),
      alcance: buscarCol(cabs, COLUMNAS.alcance),
      likes: buscarCol(cabs, COLUMNAS.likes),
      comentarios: buscarCol(cabs, COLUMNAS.comentarios),
      guardados: buscarCol(cabs, COLUMNAS.guardados),
    }
    if (cols.fecha === -1) continue
    if (cols.alcance === -1 && cols.likes === -1 && cols.comentarios === -1 && cols.guardados === -1) continue
    return { i, cols }
  }
  return null
}

function buscarCol(cabs, alias) {
  for (const a of alias) { const i = cabs.indexOf(a); if (i >= 0) return i }
  for (const a of alias) { const i = cabs.findIndex((c) => c.includes(a)); if (i >= 0) return i }
  return -1
}

// ============================================================
// Utilidades chicas
// ============================================================

// Mismo criterio de normalización que sugerir.js: sin tildes, en
// minúscula, espacios colapsados. Los encabezados vienen con acentos,
// mayúsculas y a veces con un espacio de más.
const plano = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const dos = (n) => String(n).padStart(2, '0')

// El día de acá, no el de Greenwich. Con toISOString(), a partir de las 21
// en Argentina la fecha ya es la de mañana: se guardaban publicaciones con
// fecha futura y después el CSV no matcheaba contra ninguna.
// Se exporta porque el bug se reintroduce solo: cualquier pantalla que
// necesite "hoy" vuelve a escribir toISOString().slice(0,10) y a las 21 ya
// está guardando mañana. Que haya UNA sola forma de decir qué día es acá.
export const local = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
const hoy = () => local(new Date())

// Fecha a 'YYYY-MM-DD'. Acepta lo que tiran los exports y también un Date
// o un ISO completo. Con dd/mm ambiguo mandamos día primero: es un equipo
// argentino bajando exports en castellano.
function aISO(v) {
  if (!v && v !== 0) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : local(v)
  const t = String(v).trim()
  if (!t) return null

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${dos(+m[2])}-${dos(+m[3])}`

  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    let dia = +m[1]
    let mes = +m[2]
    // si el primero no puede ser día y el segundo sí, venía en mm/dd
    if (dia <= 12 && mes > 12) { const x = dia; dia = mes; mes = x }
    if (mes > 12 || dia > 31 || !dia || !mes) return null
    const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return `${anio}-${dos(mes)}-${dos(dia)}`
  }
  return null
}

// Un entero, o null. null es "no vino"; 0 es "vino y era cero", y esa
// diferencia sostiene el promedio honesto del resumen.
// Se le sacan los separadores de miles vengan como vengan ("1.234" y
// "1,234" son mil doscientos treinta y cuatro): estas columnas son
// conteos, no hay decimales que perder.
function aEntero(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const t = String(v).trim()
  if (!t || !/\d/.test(t)) return null
  const n = parseInt(t.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

// Las tres consultas del resumen son independientes: que se caiga la de
// métricas no tiene por qué llevarse puesto el conteo de piezas. Pero cada
// una vuelve con su propio ok, porque el resumen tiene que poder decir
// "esta parte no la pude leer" en vez de hacerla pasar por vacía.
async function traer(tabla, armar) {
  try {
    const { data, error } = await armar(supabase.from(tabla))
    if (error) return { ok: false, datos: [] }
    return { ok: true, datos: data || [] }
  } catch {
    return { ok: false, datos: [] }
  }
}

function top(lista, tope = 3) {
  const cuenta = new Map()
  for (const x of lista) { if (!x) continue; cuenta.set(x, (cuenta.get(x) || 0) + 1) }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, tope)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// "3 de junio". El resumen lo lee un modelo pero también lo puede leer una
// persona en pantalla, y '2026-06-03' no se lee en voz alta.
function enCriollo(v) {
  const iso = aISO(v)
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  const nombre = MESES[+m - 1]
  const esteAnio = String(new Date().getFullYear())
  return `${+d} de ${nombre}${a === esteAnio ? '' : ` de ${a}`}`
}
