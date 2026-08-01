// ============================================================
// COPILOTO (cliente) — el loop del agente corre ACÁ, en el navegador.
//
// La función de Supabase es un proxy fino: manda el mensaje al modelo y
// devuelve lo crudo. No sabe qué plantillas hay, no sabe qué proyecto
// está abierto y no ejecuta nada. Todo eso vive de este lado porque el
// estado real —proyectos, fotos, uso, lo que estás mirando ahora mismo—
// vive en localStorage y en IndexedDB, no en la nube. Si el loop corriera
// en el servidor, el copiloto hablaría de una herramienta imaginaria.
//
// Las tres reglas del producto, traducidas a este archivo:
//   1. PROPONE, NO IMPONE   — acá no se escribe en ninguna pieza. Las
//      capacidades que tocan texto del modelo encolan una propuesta y la
//      persona acepta o descarta. Este archivo sólo la anuncia.
//   2. SÓLO EXISTE LO QUE EXISTE — las herramientas son exactamente las de
//      capabilities.js. Si el modelo pide una que no está, se le contesta
//      que no existe y sigue; no se inventa nada para taparlo.
//   3. DEGRADACIÓN HONESTA — cualquier falla sale como un evento 'error'
//      con una frase en castellano y la conversación queda usable. La app
//      no depende de que esto ande: sin copiloto, la home es la de ayer.
// ============================================================
import { supabase } from './supabase.js'
import { plano } from './entender.js'
import { herramientasParaModelo, ejecutarCapacidad, capacidadPorNombre } from './capabilities.js'

const URL_COPILOTO = 'https://otdbwfoydofzwtkcgfqf.supabase.co/functions/v1/copiloto'

// Tope duro de vueltas al modelo. Ocho alcanza para "buscá, abrí y
// proponeme el copy" con margen; más que eso, en la práctica, es el
// modelo dando vueltas en círculo y quemando plata y paciencia.
export const MAX_VUELTAS = 8

// ------------------------------------------------------------
// LA CUENTA QUE NADIE HABÍA HECHO.
//
// La edge function corta la conversación en MAX_MENSAJES y contesta 400.
// Ese número está allá, pero el que puede EVITAR el 400 es este lado, así
// que acá tiene que estar escrito el mismo, con la cuenta al lado:
//
//   - un turno de la persona son 1 mensaje suyo + hasta 2 por vuelta (lo
//     que pide el modelo + el tool_result que le devolvemos);
//   - en la vuelta v mandamos historial + 2 × (v − 1), porque el par de la
//     vuelta en curso se suma DESPUÉS de la respuesta. Con 8 vueltas, lo
//     máximo en vuelo es historial + 14.
//
// Entonces el historial con el que arranca un turno no puede pasar de
// TOPE_SERVIDOR − 14, y así el pedido más grande que sale de acá cae justo
// en el tope de allá. Con los números viejos (40 allá, sin recorte acá)
// tres turnos con herramientas cruzaban el tope y a partir de ahí TODOS los
// pedidos morían en 400: la conversación quedaba muerta sin que nadie
// hubiera hecho nada mal.
const TOPE_SERVIDOR = 60
const TOPE_HISTORIAL = TOPE_SERVIDOR - 2 * (MAX_VUELTAS - 1)

// entender.js espera 7s porque clasifica una frase corta. Acá el modelo
// piensa y escribe: con thinking adaptive y 8192 de max_tokens, una vuelta
// puede irse a 30s legítimamente. Cortar antes sería abortar respuestas
// buenas. Igual hay botón Parar, así que la espera nunca es una trampa.
const ESPERA_MAX = 45000

// Cuánto texto puede devolverle una herramienta al modelo, por vuelta.
// listar_plantillas con 26 plantillas y sus defaults completos son ~40k
// caracteres: entra, pero se paga en cada vuelta siguiente porque el
// historial se remanda entero. Recortar acá es la diferencia entre una
// conversación que se puede sostener y una que se encarece sola. Cuando
// recortamos lo DECIMOS en el propio tool_result: el modelo tiene que
// saber que vio una parte, para poder pedir el resto filtrado.
const TOPE_RESULTADO = 6000

// Igual que en entender.js: si la función no está desplegada, el primer
// intento lo aprende y no volvemos a golpear la puerta en cada mensaje.
// Arranca en null = optimista hasta que se demuestre lo contrario.
let disponible = null
// Y POR QUÉ se apagó, que no es un detalle de log: el 404 es para siempre
// —la función no está desplegada— y el apagado por fallas seguidas es una
// protección contra el loop. Sólo el segundo se puede levantar, y lo levanta
// reintentarCopiloto() cuando la persona pide empezar de nuevo.
let noDesplegada = false

// Pero "no está desplegada" (404), "se cayó" y "este pedido está mal" son
// TRES cosas distintas, y confundir la tercera con la segunda es lo que
// apagaba el copiloto solo.
// El 404 es definitivo: la función no existe, insistir no la trae. El 502
// —que es lo que devuelve la edge function ante CUALQUIER excepción: clave
// vencida, rate limit, error del modelo— y el fallo de red pueden ser un
// hipo de treinta segundos o una caída de dos días, y desde acá no se
// distinguen. Así que se cuentan.
//
// Lo que NO se cuenta es un 4xx. Un 400 o un 413 son el servidor
// contestando: está vivo, nos escuchó y lo que rechazó es ESTE pedido. La
// función devuelve 400 por "demasiados turnos", así que contar eso como
// caída significaba que tres pedidos largos apagaban el chat con un cartel
// que decía que no había contestado nadie —y había contestado las tres
// veces—. Un pedido mal armado se explica, se ofrece la salida y se sigue:
// no gasta intentos, no toca `disponible` y no apaga nada.
//
// Tres, y no una: un timeout del proveedor o el wifi que parpadea no
// pueden llevarse puesto el chat con la conversación adentro. Y tres
// tampoco es mucho, porque no son reintentos automáticos: cada falla es un
// mensaje que la persona escribió y esperó. Al tercero ya no es mala
// suerte, y lo que corresponde es devolverle el buscador de reglas, que
// corre entero en el navegador y anda hasta sin internet.
const TOPE_FALLAS = 3
let fallasSeguidas = 0

// El primer éxito borra la cuenta: lo que importa es que fallen SEGUIDAS.
// Dos caídas sueltas en la semana no son una caída.
function registrarFalla() {
  fallasSeguidas += 1
  if (fallasSeguidas >= TOPE_FALLAS) disponible = false
  return fallasSeguidas >= TOPE_FALLAS
}

/** Para que la UI pueda ofrecer el buscador de siempre en vez del chat. */
export function hayCopiloto() {
  return disponible !== false
}

/**
 * ¿Este apagado se puede revertir? Sirve para no prometer un botón que no
 * hace nada: con la función sin desplegar, reintentar es mentirle a la
 * persona; con tres caídas seguidas, no.
 */
export function apagadoReintentable() {
  return disponible === false && !noDesplegada
}

/**
 * Empezar de nuevo también reinicia esto. El apagado por fallas es una
 * protección contra el loop —tres pedidos seguidos sin respuesta, no
 * insistimos más— y no una condena: si la persona decide arrancar limpio,
 * la próxima ya no arrastra la conversación que fallaba y merece su
 * intento. El 404 no se perdona acá, porque no depende de nosotros.
 * Devuelve si el chat vuelve, para que la home sepa qué dibujar.
 */
export function reintentarCopiloto() {
  fallasSeguidas = 0
  if (noDesplegada) return false
  disponible = null
  return true
}

// ------------------------------------------------------------
// Cómo se ve una acción en pantalla.
//
// Facu lo pidió así: "que te muestre las funciones". El chip que aparece
// mientras el copiloto trabaja es la única ventana a lo que está haciendo,
// así que dice el gerundio de la acción real, no "procesando…".
//
// La etiqueta NO se escribe acá: vive en capabilities.js, pegada a la
// capacidad. Este archivo tenía un mapa paralelo y pasó lo que pasa
// siempre con los mapas paralelos — se desincronizó y hubo que arreglarlo
// a mano. Ahora una capacidad nueva trae su etiqueta puesta o no la trae,
// y si no la trae el fallback muestra el nombre crudo antes que mentir.
// ------------------------------------------------------------
const etiquetaDe = (nombre) =>
  capacidadPorNombre(nombre)?.etiqueta || `Usando ${String(nombre).replace(/_/g, ' ')}…`

// ------------------------------------------------------------
// Errores con motivo, para poder decir cosas distintas.
// El `motivo` es para nosotros; el `message` es lo que lee la persona y
// por eso está en castellano y nombra siempre la salida: qué SÍ podés
// hacer aunque esto se haya caído.
// ------------------------------------------------------------
const fallo = (motivo, mensaje) => Object.assign(new Error(mensaje), { motivo })

// Se exporta porque la UI la muestra cuando el chat se apaga: la frase que
// explica la caída tiene que ser una sola y estar escrita al lado del
// código que la provoca, no repetida en cada componente que la dibuje.
export const SIN_FUNCION = 'El copiloto todavía no está disponible. La galería y el buscador andan igual que siempre.'
const MUY_LENTO = 'El copiloto tardó demasiado y corté la espera. Probá de nuevo, o seguí a mano: no se perdió nada.'
const SE_CAYO = 'El copiloto se cayó a mitad de camino. Lo que hiciste hasta acá está intacto, probá de nuevo en un rato.'
const SIN_RED = 'No pude llegar al copiloto. Puede ser la conexión: la herramienta sigue funcionando sin él.'
// La que se dice cuando dejamos de insistir. Nombra el número de intentos
// porque la persona los vivió: escribió tres veces y tres veces no pasó
// nada. Y nombra la salida, que es lo único accionable que le queda.
const ME_RINDO = `Van ${TOPE_FALLAS} intentos seguidos sin respuesta del copiloto, así que dejo de insistir. Te devuelvo el buscador de siempre: corre en tu navegador, no necesita internet y arma la pieza igual.`
// Las dos del 4xx. No hablan de caídas porque no hubo ninguna: el servidor
// contestó. Y las dos nombran la salida, que en este caso existe y está a un
// clic —empezar de nuevo—, no como en una caída, donde lo único que queda es
// esperar.
const MUY_LARGA = 'Esta conversación se hizo demasiado larga para mandarla entera y el servidor la rechazó. No se rompió nada: empezá de nuevo y contame en una frase qué necesitás. Las piezas que armaste quedan como están.'
const PEDIDO_RECHAZADO = 'El copiloto rechazó este pedido. No se cayó: contestó, pero algo de lo que le mandé no le entró. Probá de nuevo más corto, o empezá la conversación de nuevo.'
// 401/403 también son 4xx y tampoco son una caída, pero mandar de nuevo el
// mismo pedido no arregla una sesión vencida: la salida es otra y hay que
// decir cuál, en vez de dejarla adentro del cajón de "pedido rechazado".
const SIN_PERMISO = 'El copiloto no me dejó entrar: puede ser que la sesión se haya vencido. Recargá la página y probá otra vez. El buscador de acá abajo anda igual, sin sesión.'
// El 424 es la falla permanente del proveedor (ver el catch de la edge
// function): la clave, la cuenta o el pedido en sí no van a pasar por más
// que insistas. Es la única falla que se rinde en el PRIMER intento, y se
// rinde a propósito: hacerle escribir tres mensajes y esperar tres veces
// por algo que no va a andar nunca es peor que decirle la verdad de una.
// No se nombra el motivo de adentro —"tu balance de créditos es bajo" no
// es una noticia para alguien que vino a hacer un posteo— pero tampoco se
// finge un misterio: se dice que no se arregla reintentando.
const SIN_MODELO = 'El copiloto no está pudiendo hablar con el modelo, y esto no se arregla reintentando: es un problema de la cuenta, no de tu pedido. Te devuelvo el buscador de siempre, que corre en tu navegador y arma la pieza igual.'

// El cuerpo del error de la edge function es { error: "..." }. Lo leemos
// para poder distinguir "demasiados turnos" de cualquier otro 400: uno tiene
// una salida obvia que hay que ofrecer, el otro no.
async function motivoDelServidor(r) {
  try {
    const t = await r.text()
    try { return String(JSON.parse(t)?.error || '').slice(0, 200) } catch { return t.slice(0, 200) }
  } catch { return '' }
}

// ------------------------------------------------------------
// El posteo al proxy. Una vuelta del loop, nada más.
// ------------------------------------------------------------
async function llamar({ mensajes, herramientas, sistema, signal }) {
  const corte = new AbortController()
  // Distinguimos "se acabó el tiempo" de "la persona apretó Parar": son el
  // mismo AbortError pero una es un error y la otra es una decisión.
  let porTiempo = false
  const reloj = setTimeout(() => { porTiempo = true; corte.abort() }, ESPERA_MAX)
  const propagar = () => corte.abort()
  signal?.addEventListener('abort', propagar, { once: true })

  try {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
    const r = await fetch(URL_COPILOTO, {
      method: 'POST',
      signal: corte.signal,
      headers: {
        'Content-Type': 'application/json',
        // la publishable key ya es pública por diseño; la clave del modelo
        // vive del lado del servidor y nunca baja al navegador
        Authorization: `Bearer ${data?.session?.access_token || supabase.supabaseKey}`,
      },
      body: JSON.stringify({ mensajes, herramientas, sistema }),
    })
    if (!r.ok) {
      // 404 es la única que se apaga de una: significa "no está
      // desplegada", y eso no cambia porque insistas.
      if (r.status === 404) { disponible = false; noDesplegada = true; throw fallo('nodesplegada', SIN_FUNCION) }
      // 4xx: el servidor está y nos dijo que no. Eso no es una caída, así
      // que no suma a la cuenta ni apaga nada — se explica y la persona
      // decide. El 413 (cuerpo enorme) y el 400 por turnos son el mismo
      // problema visto desde dos lados: la conversación no entra.
      if (r.status < 500) {
        // La única que se rinde sola. No es una caída —el servidor contestó—
        // pero tampoco tiene arreglo del lado de la persona, así que se apaga
        // el chat ya y aparece el buscador con la explicación. Queda
        // reintentable (noDesplegada sigue en false): si mañana la cuenta se
        // arregla, "Empezar de nuevo" lo revive.
        if (r.status === 424) { disponible = false; throw fallo('proveedor', SIN_MODELO) }
        if (r.status === 401 || r.status === 403) throw fallo('permiso', SIN_PERMISO)
        const dice = await motivoDelServidor(r)
        if (r.status === 413 || /turnos|grande/i.test(dice)) throw fallo('largo', MUY_LARGA)
        throw fallo('pedido', PEDIDO_RECHAZADO)
      }
      // Todo el resto —502 incluido, que es el cajón de sastre del proxy—
      // suma a la cuenta. Puede ser pasajero; tres veces seguidas no.
      if (registrarFalla()) throw fallo('nodisponible', ME_RINDO)
      throw fallo('servidor', SE_CAYO)
    }
    disponible = true
    fallasSeguidas = 0
    return await r.json()
  } catch (e) {
    if (e?.motivo) throw e
    // El timeout NO cuenta: que el modelo piense más de 45 segundos no
    // quiere decir que el copiloto esté caído, y apagar el chat por lento
    // sería castigar a la persona por una respuesta que quizás estaba por
    // llegar. Cuenta lo que no llegó a ningún lado: la red.
    if (e?.name === 'AbortError') throw fallo(porTiempo ? 'tiempo' : 'cancelado', porTiempo ? MUY_LENTO : 'Listo, paré.')
    if (registrarFalla()) throw fallo('nodisponible', ME_RINDO)
    throw fallo('red', SIN_RED)
  } finally {
    clearTimeout(reloj)
    signal?.removeEventListener('abort', propagar)
  }
}

// ------------------------------------------------------------
// Recorte del resultado de una herramienta.
//
// Si lo que vuelve es una lista, cortamos ELEMENTOS y no caracteres: media
// plantilla en JSON no le sirve a nadie, veinte plantillas enteras sí.
// Para todo lo demás cortamos y avisamos. El modelo lee esto como texto,
// no lo parsea, así que un corte al medio no rompe nada — pero sin el
// aviso el modelo cree que vio todo y ahí sí delira.
// ------------------------------------------------------------
function recortar(datos) {
  const entero = JSON.stringify(datos ?? null)
  if (entero.length <= TOPE_RESULTADO) return entero

  // ¿la lista es el dato, o está adentro de un objeto? los dos casos pasan
  const lista = Array.isArray(datos)
    ? datos
    : Object.values(datos || {}).find((v) => Array.isArray(v) && v.length > 3)

  if (lista) {
    let n = lista.length
    while (n > 1 && JSON.stringify(lista.slice(0, n)).length > TOPE_RESULTADO) n = Math.floor(n * 0.7)
    const parte = JSON.stringify(lista.slice(0, n))
    return `${parte}\n\n[RECORTADO: te muestro ${n} de ${lista.length}. Si necesitás el resto, volvé a pedir con un filtro más angosto en vez de pedir todo.]`
  }
  return `${entero.slice(0, TOPE_RESULTADO)}\n\n[RECORTADO: esto es el principio de ${entero.length} caracteres. Pedí algo más específico si te falta el final.]`
}

// ------------------------------------------------------------
// Una línea para el chip de "hecho". No es para el modelo, es para la
// persona: tiene que poder leer de reojo qué pasó.
//
// Esto lo armaba ACÁ una heurística que buscaba la primera clave con un
// array adentro del objeto de datos y escribía "N " + el nombre crudo de
// la clave. Con `plantillas`, `roles` o `avisos` daba una frase decente de
// pura casualidad; con el primer campo en camelCase salió a pantalla
// "1 palabrasQueLoDicen". Y había otra puerta igual de accidental: si el
// objeto traía una clave `resumen` se mostraba tal cual, así que
// memoria_equipo volcaba el párrafo entero de la bitácora en el chip.
//
// La heurística se fue completa. Un objeto de datos no se convierte en
// castellano contándole las claves: la frase la escribe quien conoce el
// resultado, y eso es la capacidad. Vive en capabilities.js al lado de la
// `etiqueta`, por el mismo motivo por el que la etiqueta se mudó allá.
//
// Sin `resumir` declarado, "listo". No es un fallback pobre: es la única
// cosa honesta que se puede decir de un resultado que nadie describió.
// ------------------------------------------------------------
function resumirResultado(nombre, datos) {
  if (datos == null) return 'listo'
  const escribir = capacidadPorNombre(nombre)?.resumir
  if (typeof escribir !== 'function') return 'listo'
  try {
    // Un resumen que rompe no puede tirar abajo la vuelta: la acción ya
    // corrió y el resultado ya está en camino al modelo. Lo único que se
    // pierde es la línea del chip.
    const texto = escribir(datos)
    return typeof texto === 'string' && texto.trim() ? texto.trim() : 'listo'
  } catch { return 'listo' }
}

// ------------------------------------------------------------
// EL POOL DE LO QUE DIJO LA PERSONA — el invariante 1, del lado del loop.
//
// Hay una sola puerta por la que un texto entra a una pieza sin pasar por
// Aceptar: `textosDeRegla` en abrir_plantilla, que existe para reubicar
// pedazos LITERALES de la frase de la persona. Para que esa puerta sea
// verificable y no una promesa escrita en la descripción, la capacidad
// necesita saber qué tipeó la persona. Eso se junta acá y viaja en
// `ctx.dicho`.
//
// Sólo entra texto de la persona. Los tool_result también viajan con
// role:'user' —así lo pide la API, no porque los haya escrito nadie— y si
// entraran al pool tendríamos una lavandería perfecta: el modelo llama
// sugerir_plantillas con una frase que inventó, la frase vuelve adentro
// del tool_result, y en la vuelta siguiente "la dijo la persona". Por eso
// se filtra por forma: string suelto, o bloque {type:'text'}.
//
// Se normaliza con el plano() de entender.js a propósito: es la MISMA
// aduana que ya valida el tema del buscador, no una parecida.
// ------------------------------------------------------------
function frasesDeLaPersona(mensajes) {
  const partes = []
  for (const m of mensajes || []) {
    if (m?.role !== 'user') continue
    if (typeof m.content === 'string') { partes.push(m.content); continue }
    if (Array.isArray(m.content)) {
      m.content.forEach((b) => {
        if (b?.type === 'text' && typeof b.text === 'string') partes.push(b.text)
      })
    }
  }
  return partes
}

// El pool sigue existiendo para todo lo que no sea meter texto en una
// pieza. Los turnos se unen con un separador que NINGUNA frase puede
// contener: con un espacio, el final de un mensaje y el principio del
// siguiente formaban una frase que nadie escribió y que igual validaba.
function loQueDijoLaPersona(mensajes) {
  return frasesDeLaPersona(mensajes).map((t) => plano(t)).filter(Boolean).join(' \n| ')
}

// ------------------------------------------------------------
// EL RECORTE DEL HISTORIAL — evitar el 400 en vez de explicarlo.
//
// Podríamos dejar que la edge function conteste "demasiados turnos" y
// ofrecer empezar de nuevo, y de hecho eso también está (ver el 4xx de
// arriba). Pero esa salida le cobra a la persona el precio entero: perder
// la conversación por una cuenta interna que nunca vio. Recortar acá es
// mejor porque la charla sigue, y la degradación se puede DECIR: se
// mandaron los últimos intercambios y no todos.
//
// El 400 igual se queda como red: el cliente es un bundle estático en
// GitHub Pages y la función se despliega aparte, así que los dos topes
// pueden quedar desalineados por unas horas. Cuando eso pasa, el que
// contesta es el servidor y la salida tiene que existir igual.
//
// Se corta en el arranque de un turno de la persona y en ningún otro lado:
// ahí no hay ningún tool_use esperando su tool_result. Cortar al medio de
// una vuelta deja un tool_use huérfano y la API contesta 400 — cambiaríamos
// un error previsible por otro, que es la peor forma de arreglar algo.
// ------------------------------------------------------------
function esDeLaPersona(m) {
  if (m?.role !== 'user') return false
  if (typeof m.content === 'string') return true
  // Los tool_result viajan con role:'user' porque así lo pide la API, no
  // porque los haya escrito nadie. Son justo los que no se pueden separar.
  return Array.isArray(m.content) && !m.content.some((b) => b?.type === 'tool_result')
}

function textoDe(m) {
  if (typeof m?.content === 'string') return m.content
  return (Array.isArray(m?.content) ? m.content : [])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join(' ')
}

function recortarHistorial(mensajes, original) {
  const h = [...(mensajes || [])]
  const nada = { mensajes: h, turnosFuera: 0, pedidoOriginal: '' }
  if (h.length <= TOPE_HISTORIAL) return nada

  const arranques = []
  h.forEach((m, i) => { if (esDeLaPersona(m)) arranques.push(i) })
  // Un solo turno adentro y ya no entra: es un turno gigante y no hay nada
  // viejo que sacar. Se manda igual y que conteste el servidor: ese 400 ya
  // no apaga nada y trae el botón de empezar de nuevo.
  if (arranques.length < 2) return nada

  let k = arranques.findIndex((i) => h.length - i <= TOPE_HISTORIAL)
  if (k < 0) k = arranques.length - 1 // el último es el mensaje recién escrito
  const corte = arranques[k]

  return {
    mensajes: h.slice(corte),
    turnosFuera: arranques.filter((i) => i < corte).length,
    // El pedido original no se pierde: viaja al prompt de estado, que es el
    // único lugar donde entra sin romper la secuencia de mensajes. Es lo que
    // dice para qué empezó todo esto, y sin eso el modelo agarra la charla
    // por la mitad sin saber a dónde iba.
    //
    // Lo manda la UI (`original`), que muestra la conversación ENTERA aunque
    // nosotros mandemos un pedazo. Si lo sacáramos del historial recortado,
    // a la segunda poda "el original" ya sería el segundo pedido y estaríamos
    // afirmando algo falso con toda naturalidad.
    pedidoOriginal: (String(original || '').trim() || textoDe(h[arranques[0]]).trim()).slice(0, 300),
  }
}

// ------------------------------------------------------------
// Lo que el modelo no puede adivinar: el estado del navegador ahora mismo.
//
// Va como `sistema` y la función lo pega DESPUÉS de su propio prompt base
// (la personalidad y las reglas viven allá, esto es sólo el estado, que
// cambia turno a turno). Termina con la regla de los números a propósito:
// es la que más fácil se rompe cuando no hay datos.
// ------------------------------------------------------------
function estadoActual(ctx, recuerdo, recorte) {
  const l = []
  l.push('ESTADO REAL de la herramienta en este momento. No lo adivines ni lo contradigas:')
  l.push(`- Plantillas cargadas: ${ctx?.plantillas?.length ?? 0}.`)

  const p = ctx?.proyecto
  if (p) {
    const piezas = p.pieces?.length || 0
    const cual = p.carousel ? `, carrusel de ${piezas} slides (la activa es la ${(p.slideActual ?? 0) + 1})` : ''
    // Existir y estar a la vista son dos cosas distintas, y el chat vive en
    // la home: lo NORMAL es que la pieza exista y no la esté mirando. Igual
    // es la que recibe el texto que acepte, así que no se puede omitir; lo
    // que no se puede es llamarla "la que tenés abierta".
    l.push(p.enPantalla === false
      ? `- Hay una pieza armada, pero la persona está en la home y no la tiene delante: "${p.nombre || 'sin nombre'}", formato ${p.formatId}${cual}. Es la que va a recibir cualquier texto que acepte, así que sus roles son los que valen. Decile "la que armaste", nunca "la que tenés abierta".`
      : `- Hay algo abierto en pantalla: "${p.nombre || 'sin nombre'}", formato ${p.formatId}${cual}.`)
    const usadas = [...new Set((p.pieces || []).map((x) => x.templateId).filter(Boolean))]
    if (usadas.length) l.push(`- Plantillas en uso: ${usadas.join(', ')}.`)
  } else {
    l.push('- No hay ninguna pieza armada todavía: la persona está en la galería y no hay dónde poner un texto hasta que se abra algo.')
  }

  // Sólo se ofrece lo que existe: si App.jsx no pasó la acción, el modelo
  // no tiene que enterarse de que alguna vez existió.
  const puede = Object.entries(ctx?.acciones || {}).filter(([, f]) => typeof f === 'function').map(([k]) => k)
  if (puede.length) l.push(`- Acciones que podés disparar: ${puede.join(', ')}.`)

  // Si recortamos, el modelo tiene que saberlo. Un historial que arranca por
  // la mitad sin avisar es la misma trampa que un tool_result recortado sin
  // avisar: cree que vio todo y ahí delira.
  if (recorte?.turnosFuera) {
    l.push(`- OJO: la conversación venía larga y le saqué los ${recorte.turnosFuera} intercambios más viejos para que entrara. Lo que ves arranca por la mitad.${recorte.pedidoOriginal ? ` El pedido original de la persona, textual, fue: "${recorte.pedidoOriginal}".` : ''} Si te falta algo de lo que se habló antes, preguntá en vez de suponer.`)
  }

  // Tres estados y hay que decirlos distinto. El que falta acá es el que
  // duele: con la memoria caída, este renglón afirmaba "no tengo datos de
  // piezas publicadas" y el modelo se lo repetía a un equipo con la
  // bitácora llena. No inventar un número no alcanza si igual se afirma un
  // hecho falso sobre el mundo con la misma cara de certeza.
  if (!recuerdo?.ok) {
    l.push('- Bitácora: NO PUDE CONSULTARLA (la memoria del equipo no contesta). Ojo: eso NO es "no hay datos". Puede haber cien piezas cargadas. Si te preguntan qué funcionó, decí que ahora mismo no podés mirar la bitácora y ofrecé reintentar. Está prohibido decir que todavía no cargaron nada, y prohibido estimar.')
  } else if (recuerdo.texto) {
    l.push(`- Bitácora: ${recuerdo.texto}`)
  } else {
    l.push('- Bitácora: la consulté y está vacía: no hay piezas publicadas ni métricas cargadas. Decilo así, tal cual, si te preguntan qué funcionó. NO estimes ni inventes un número.')
  }
  return l.join('\n')
}

// ------------------------------------------------------------
// El loop.
//
// mensajes: [{ role, content }] — la conversación tal cual la tiene la UI.
// original: lo primero que pidió la persona en esta conversación, que la UI
//   sí tiene entero en pantalla. Sólo se usa si hay que recortar.
// Devuelve { mensajes: [...turnos NUEVOS...], base, corto }. `mensajes` son
// los turnos nuevos, para que la UI los concatene sin duplicar los viejos;
// `base` es el historial que efectivamente viajó — el mismo que entró, salvo
// que haya habido recorte. La UI se queda con base + mensajes: si guardara
// el historial entero, recortaríamos otra vez en el turno siguiente.
// ------------------------------------------------------------
export async function conversar({ mensajes, ctx, onEvento, signal, original }) {
  // Un handler que explota no puede matar el loop: el que muestra no manda.
  const avisar = (ev) => { try { onEvento?.(ev) } catch { /* la UI se arregla sola */ } }

  const nuevos = []
  // Antes de arrancar, el historial se recorta a lo que la edge function
  // acepta con el turno entero adentro (ver TOPE_HISTORIAL). `base` es lo
  // que efectivamente se manda, y vuelve en el resultado para que la UI se
  // quede con eso: si la UI siguiera guardando el historial completo,
  // recortaríamos de nuevo en cada turno y le avisaríamos a la persona lo
  // mismo cada vez.
  const recorte = recortarHistorial(mensajes, original)
  const base = recorte.mensajes
  const historial = [...base]

  // El pool de procedencia se calcula UNA vez, sobre los turnos que llegan
  // de la UI: adentro del loop no aparece texto nuevo de la persona, sólo
  // turnos del modelo y tool_results nuestros. Si se recalculara sobre
  // `historial` en cada vuelta, el pool se iría contaminando solo.
  // `frases` son los turnos de la persona SIN normalizar, con sus tildes y
  // su puntuación. Los necesita `abrir_plantilla` para correr `armar()` por
  // su cuenta: desde que el modelo no puede mandar el texto, lo tiene que
  // sacar el motor de reglas de la frase original.
  const ctxConDicho = {
    ...(ctx || {}),
    dicho: loQueDijoLaPersona(mensajes),
    frases: frasesDeLaPersona(mensajes),
  }

  // La memoria puede no estar (Supabase caído, tabla vacía, sin permisos).
  // Viene en un sobre { ok, texto } / { ok:false, motivo } justamente para
  // que "vacía" y "no la pude leer" no terminen siendo el mismo string
  // vacío: si acá se aplastan, el prompt de abajo miente. Sin memoria
  // inyectada tampoco pudimos leer, así que ok:false.
  let recuerdo = { ok: false }
  try {
    const r = await ctx?.memoria?.resumenParaCopiloto?.()
    if (r && typeof r === 'object') recuerdo = r
  } catch { recuerdo = { ok: false } }

  const herramientas = herramientasParaModelo()
  const sistema = estadoActual(ctx, recuerdo, recorte)

  // Y a la persona se le dice también. Que el copiloto "se olvide" de lo que
  // se habló hace veinte mensajes es raro; que se olvide EN SILENCIO es la
  // clase de misterio que hace desconfiar de toda la herramienta.
  if (recorte.turnosFuera) {
    const cuantos = recorte.turnosFuera === 1
      ? 'el intercambio más viejo'
      : `los ${recorte.turnosFuera} intercambios más viejos`
    avisar({
      tipo: 'aviso',
      texto: `La conversación se hizo larga: para que entrara le saqué ${cuantos} y le mandé el resto, con tu pedido original adelante. Si lo notás perdido, arrancá limpio:`,
    })
  }

  for (let vuelta = 1; vuelta <= MAX_VUELTAS; vuelta++) {
    if (signal?.aborted) { avisar({ tipo: 'fin', motivo: 'cancelado' }); return { mensajes: nuevos, base, corto: false } }

    avisar({ tipo: 'pensando', vuelta })

    let respuesta
    try {
      respuesta = await llamar({ mensajes: historial, herramientas, sistema, signal })
    } catch (e) {
      // Parar no es un error: es la persona diciendo basta.
      if (e.motivo === 'cancelado') { avisar({ tipo: 'fin', motivo: 'cancelado' }); return { mensajes: nuevos, base, corto: false } }
      avisar({ tipo: 'error', motivo: e.motivo, mensaje: e.message })
      avisar({ tipo: 'fin', motivo: e.motivo })
      // Devolvemos los turnos que sí se completaron: la conversación tiene
      // que poder seguir después del error, no arrancar de cero.
      return { mensajes: nuevos, base, corto: false }
    }

    const bloques = Array.isArray(respuesta?.content) ? respuesta.content : []
    if (!bloques.length) {
      avisar({ tipo: 'error', motivo: 'vacio', mensaje: 'El copiloto contestó en blanco. Probá reformulando el pedido.' })
      avisar({ tipo: 'fin', motivo: 'vacio' })
      return { mensajes: nuevos, base, corto: false }
    }

    // El turno del modelo entra al historial COMPLETO, con los bloques de
    // pensamiento incluidos: con thinking prendido, sacarlos rompe la
    // llamada siguiente cuando hay herramientas de por medio.
    const turnoModelo = { role: 'assistant', content: bloques }
    historial.push(turnoModelo)
    nuevos.push(turnoModelo)

    for (const b of bloques) {
      if (b.type === 'text' && b.text) avisar({ tipo: 'texto', texto: b.text })
    }

    const pedidos = bloques.filter((b) => b.type === 'tool_use')
    if (respuesta.stop_reason !== 'tool_use' || !pedidos.length) {
      avisar({ tipo: 'fin', motivo: respuesta.stop_reason || 'fin' })
      return { mensajes: nuevos, base, corto: false }
    }

    const resultados = []
    for (const t of pedidos) {
      // El chip aparece ANTES de ejecutar: si la acción tarda o abre una
      // pantalla, la persona ya sabe qué la abrió.
      avisar({ tipo: 'accion', nombre: t.name, etiqueta: etiquetaDe(t.name), args: t.input || {} })

      let salida
      try {
        salida = await ejecutarCapacidad(t.name, t.input || {}, ctxConDicho)
      } catch (e) {
        // Una capacidad que rompe es un bug nuestro, no del modelo: se lo
        // contamos como resultado y que decida, en vez de tirar el turno.
        salida = { ok: false, error: `La herramienta falló: ${String(e?.message || e)}` }
      }

      const ok = salida?.ok === true
      avisar({ tipo: 'resultado', nombre: t.name, ok, resumen: ok ? resumirResultado(t.name, salida.datos) : String(salida?.error || 'no se pudo') })

      // Acá había un evento 'propuesta' que no se disparaba nunca: miraba
      // `salida.datos.propuesta`, y la única capacidad que propone texto
      // (proponer_textos) devuelve { encolada, cuantos, estado, avisos } y
      // manda la propuesta por `ctx.acciones.proponer`, que es la puerta que
      // la UI escucha de verdad. Un camino muerto que parecía el importante.
      resultados.push({
        type: 'tool_result',
        tool_use_id: t.id,
        content: ok ? recortar(salida.datos) : String(salida?.error || 'no se pudo ejecutar'),
        // El error vuelve como tool_result y NO corta el loop: el modelo lo
        // lee, se corrige y reintenta. Para eso existe el loop; si cortáramos
        // acá, cada argumento mal puesto sería un callejón sin salida.
        ...(ok ? {} : { is_error: true }),
      })
    }

    const turnoHerramientas = { role: 'user', content: resultados }
    historial.push(turnoHerramientas)
    nuevos.push(turnoHerramientas)
  }

  // Se acabaron las vueltas con el modelo todavía pidiendo herramientas.
  // El historial queda cerrado y válido (los tool_result de la última
  // vuelta ya se agregaron), así que la persona puede seguir escribiendo.
  // Y se lo decimos: quedarse en silencio o fingir que terminó sería
  // exactamente la clase de delirio que este producto vino a evitar.
  const aviso = `Me quedé sin vueltas: encadené ${MAX_VUELTAS} acciones y todavía no llegué a algo presentable. Contame en una frase qué querés y voy más derecho.`
  avisar({ tipo: 'texto', texto: aviso })
  const cierre = { role: 'assistant', content: aviso }
  nuevos.push(cierre)
  avisar({ tipo: 'fin', motivo: 'corto' })
  return { mensajes: nuevos, base, corto: true }
}
