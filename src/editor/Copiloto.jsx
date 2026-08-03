// ============================================================
// EL COPILOTO — la conversación.
//
// Facu: "quiero que sea casi una LLM: que recomiende, que si le hablás te
// responda, que si le pedís ideas te dé ideas — pero todo desde las
// posibilidades que tiene la herramienta. Que te muestre las funciones
// como cuando interactúo acá con vos."
//
// Este archivo NO piensa: el loop vive en lib/copiloto.js y las
// capacidades en lib/capabilities.js. Acá sólo pasan tres cosas, y las
// tres son de la persona:
//   1. lo que escribe,
//   2. VER lo que el copiloto está haciendo mientras lo hace — no un
//      spinner mudo, la lista de funciones con su nombre,
//   3. decidir sobre cada texto que el modelo escribe: Aceptar, Descartar
//      o Pedir otra. Nada se aplica solo. Nunca.
//
// El invariante 3 (degradación honesta) está en la primera línea del
// render: si no hay copiloto, esto devuelve null y Gallery.jsx sigue con
// el buscador de reglas de siempre. El peor caso es el producto de ayer.
// ============================================================
import React from 'react'
import Icon from '../ui/Icon.jsx'
import { checkCopy } from '../lib/copyCheck.js'
import { MAXCHARS, TEMPLATES } from '../templates/index.js'
// Namespace a propósito: si algún día copiloto.js deja de exportar
// hayCopiloto(), la app tiene que seguir andando igual — un import
// nombrado que no existe revienta el bundle entero, y eso es exactamente
// la pantalla muerta que el invariante 3 prohíbe.
import * as motor from '../lib/copiloto.js'

const hayCopiloto = motor.hayCopiloto || (() => true)
// La frase de la caída vive en copiloto.js, al lado del código que la
// provoca. Acá sólo se dibuja — con una copia de respaldo por si el módulo
// del día de mañana no la exporta, que es la misma desconfianza del import
// de arriba: esto nunca puede ser la razón de una pantalla en blanco.
const SIN_COPILOTO = motor.SIN_FUNCION
  || 'El copiloto no está disponible ahora mismo. La galería y el buscador andan igual que siempre.'

// Un refresh accidental no borra la conversación. De la sesión, no del
// equipo: mañana es otra charla, y la memoria de largo plazo (qué se hizo,
// qué funcionó) vive en lib/memoria.js, no acá.
const CLAVE = 'magoya_copiloto_v1'

// Cómo se llama cada rol cuando hay que decírselo a una persona. Son las
// mismas palabras del inspector: si el copiloto dice "el titular", la
// persona sabe qué campo va a cambiar.
// Se exporta porque App.jsx dibuja la MISMA propuesta cuando llega por
// fuera del chat: dos listas de nombres para los mismos campos era la
// forma segura de que un día dijeran cosas distintas.
export const ROL = {
  kicker: 'Etiqueta', title: 'Titular', subtitle: 'Bajada', body: 'Texto',
  metric: 'Cifra', metricLabel: 'Descripción del dato', quote: 'Cita',
  author: 'Autor', cta: 'Botón', step: 'Paso',
}

let contador = 0
const nuevoId = () => `c${Date.now().toString(36)}${(contador++).toString(36)}`

// ------------------------------------------------------------
// EL ANTES.
// La propuesta que arma capabilities.js dice qué texto propone, no qué
// texto pisa: eso lo sabe el cliente, que es el que tiene el proyecto
// abierto. Se busca igual que en la capacidad estado_actual — primero el
// rol, y si la pieza es libre, el bloque suelto con ese estilo.
function textoActual(ctx, rol) {
  const p = ctx?.proyecto
  if (!p || !p.pieces?.length) return ''
  const i = Number.isInteger(p.slideActual) ? p.slideActual : 0
  const c = (p.pieces[i] || p.pieces[0])?.content || {}
  if (String(c[rol] ?? '').trim()) return String(c[rol]).trim()
  const b = (c.textBlocks || []).find((x) => (x.style || 'title') === rol && String(x.text || '').trim())
  return b ? String(b.text).trim() : ''
}

// ------------------------------------------------------------
// Lo que llega del modelo se mira con desconfianza antes de dibujarlo.
// Si la propuesta no trae ni un texto usable, no se muestra la card: una
// card vacía con dos botones es peor que nada.
function normalizarPropuesta(cruda, ctx) {
  if (!cruda || typeof cruda !== 'object') return null
  const lista = Array.isArray(cruda.textos)
    ? cruda.textos
    : Object.entries(cruda.campos || {}).map(([rol, texto]) => ({ rol, texto }))
  const usables = lista.filter((t) => t && t.rol && String(t.texto ?? '').trim())
  if (!usables.length) return null
  // capabilities.js manda los avisos agrupados por rol; los tomamos de ahí
  // para que la card diga lo mismo que vio el modelo. Si no vinieron, se
  // calculan acá: la card nunca sale sin chequear.
  const porRol = new Map((Array.isArray(cruda.avisos) ? cruda.avisos : []).map((a) => [a.rol, a.avisos || []]))
  // El chequeo mira los textos hermanos: la ventana temporal de una cifra
  // puede estar en la bajada, no en la cifra.
  const alrededor = Object.fromEntries(usables.map((t) => [t.rol, String(t.texto)]))
  return {
    id: cruda.id || nuevoId(),
    motivo: String(cruda.motivo || '').trim(),
    plantillaId: cruda.plantillaId || null,
    textos: usables.map((t) => ({
      rol: t.rol,
      texto: String(t.texto).trim(),
      antes: String(t.antes ?? '').trim() || textoActual(ctx, t.rol),
      avisos: porRol.get(t.rol) || checkCopy(t.rol, t.texto, alrededor),
    })),
  }
}

// ============================================================
// LA CONVERSACIÓN, SEPARADA DE LA PANTALLA QUE LA MUESTRA.
//
// Antes todo esto vivía adentro del componente, y el componente vivía
// adentro de Gallery: o sea, adentro de la vista "home". El flujo más
// común del copiloto termina en `abrir_plantilla`, que navega al editor
// — y ahí React desmontaba el chat EN EL MEDIO de su propia respuesta.
// El texto de cierre (el que explica qué hizo y qué sigue) no se veía
// nunca, y los turnos posteriores al desmontaje ni siquiera se guardaban,
// porque el efecto que escribe en sessionStorage no corre desmontado.
//
// La cura no es mover el componente: es sacarle el estado. El hilo vive
// en App.jsx, que no se desmonta jamás; el componente de abajo pasó a ser
// una pantalla que lo dibuja, y se puede montar en la home, en el editor,
// en los dos o en ninguno sin que la conversación se entere. El fetch en
// curso tampoco se corta: lo maneja este hook, no el árbol que se fue.
//
// Lo que NO cambió: las propuestas siguen necesitando Aceptar, y Aceptar
// sigue siendo lo único que escribe en una pieza (invariante 1).
// ============================================================
export function useCopiloto({ ctx, onPropuesta, onSinCopiloto, onVuelveCopiloto } = {}) {
  // `turnos` es lo que se VE; `mensajes` es lo que se le manda al modelo.
  // Son dos cosas distintas a propósito: el modelo necesita los bloques
  // de tool_use y tool_result crudos, la persona necesita "buscando
  // plantillas… listo, 3".
  const [turnos, setTurnos] = React.useState([])
  const [mensajes, setMensajes] = React.useState([])
  const [pensando, setPensando] = React.useState(false)

  // Lo que la persona tiene tipeado sin mandar. Es un ref y no un estado a
  // propósito: el estado vive en App.jsx, así que una tecla acá haría
  // re-renderizar el editor entero (o las 30 previsualizaciones de la
  // galería) en cada letra. El input mantiene su propia copia local; esto
  // es sólo para que el borrador sobreviva al cambio de pantalla y para
  // podérselo pasar al buscador viejo si el copiloto se apaga.
  const borradorRef = React.useRef('')
  const cortarRef = React.useRef(null)
  const ctxRef = React.useRef(ctx)
  ctxRef.current = ctx
  // Lo que hay que contarle al modelo antes del próximo mensaje ("descarté
  // eso"). No se empuja a `mensajes` como turno suelto: dos mensajes de
  // usuario seguidos no son una conversación válida para la API. Viaja
  // pegado adelante del siguiente pedido y la persona no lo ve.
  const notasRef = React.useRef([])
  // Lo último que la persona mandó, y la última explicación de por qué no
  // salió. Los dos son para el traspaso: si el copiloto se apaga, ese texto
  // tiene que aparecer en el buscador viejo y esa frase tiene que leerse en
  // algún lado. Escribir un pedido y que se lo trague la pantalla es la
  // peor versión de este producto.
  const ultimoDichoRef = React.useRef('')
  const caidaRef = React.useRef('')
  // Para poder guardar la sesión fuera del efecto (ver `marcar`): lo que
  // hay que escribir junto a los turnos, sin depender de un render.
  const mensajesRef = React.useRef(mensajes)
  mensajesRef.current = mensajes

  // ---- sesión ----
  // Se lee una sola vez y recién después se empieza a guardar: si las dos
  // cosas corren en el mismo montaje, el guardado con el estado todavía
  // vacío le pasa el trapo a lo que estábamos por leer.
  const cargadoRef = React.useRef(false)
  React.useEffect(() => {
    try {
      const g = JSON.parse(sessionStorage.getItem(CLAVE) || 'null')
      if (g && Array.isArray(g.turnos) && Array.isArray(g.mensajes)) {
        // Una acción que quedó "corriendo" cuando se recargó la página no
        // está corriendo: se muestra cortada, no girando para siempre.
        setTurnos(g.turnos.map((t) => (t.estado === 'corriendo' ? { ...t, estado: 'cortada' } : t)))
        setMensajes(g.mensajes)
      }
    } catch { /* sesión ilegible: se arranca limpio */ }
    cargadoRef.current = true
  }, [])

  React.useEffect(() => {
    if (!cargadoRef.current) return
    if (!turnos.length && !mensajes.length) { try { sessionStorage.removeItem(CLAVE) } catch {} ; return }
    try { sessionStorage.setItem(CLAVE, JSON.stringify({ turnos, mensajes })) } catch {}
  }, [turnos, mensajes])

  const agregar = React.useCallback((t) => setTurnos((prev) => [...prev, { id: nuevoId(), ...t }]), [])

  // Una propuesta se muestra UNA vez. Llega por ctx.acciones.proponer, que
  // es por donde la manda capabilities; el id desempata si alguna vez
  // entrara dos veces.
  const encolarPropuesta = React.useCallback((p) => {
    setTurnos((prev) => (prev.some((t) => t.tipo === 'propuesta' && t.p.id === p.id)
      ? prev
      : [...prev, { id: nuevoId(), tipo: 'propuesta', p, estado: 'pendiente' }]))
  }, [])

  // ------------------------------------------------------------
  // Los eventos del loop, traducidos a algo que se lee.
  const manejarEvento = React.useCallback((ev) => {
    if (!ev || !ev.tipo) return
    if (ev.tipo === 'accion') {
      // Los `args` no se dibujan a propósito: un `{"plantillaId":"evento"}`
      // en pantalla convierte esto en un log de debug, y lo que se pidió
      // fue ver las funciones, no el JSON.
      agregar({ tipo: 'accion', nombre: ev.nombre, etiqueta: ev.etiqueta || ev.nombre, estado: 'corriendo' })
      return
    }
    if (ev.tipo === 'resultado') {
      // Se cierra la última acción abierta con ese nombre. El loop llama
      // de a una herramienta por vez, así que alcanza.
      setTurnos((prev) => {
        const i = [...prev].reverse().findIndex((t) => t.tipo === 'accion' && t.estado === 'corriendo' && (t.nombre === ev.nombre || !ev.nombre))
        if (i < 0) return prev
        const idx = prev.length - 1 - i
        return prev.map((t, j) => (j === idx ? { ...t, estado: ev.ok ? 'ok' : 'falla', resumen: ev.resumen || '' } : t))
      })
      return
    }
    if (ev.tipo === 'texto') {
      const t = String(ev.texto || '').trim()
      if (!t) return
      // Si el último turno ya es del copiloto, se le pega: un párrafo que
      // llega en dos pedazos es un solo párrafo.
      setTurnos((prev) => {
        const ultimo = prev[prev.length - 1]
        if (ultimo && ultimo.tipo === 'copiloto') {
          return prev.map((x, j) => (j === prev.length - 1 ? { ...x, texto: `${x.texto}\n${t}` } : x))
        }
        return [...prev, { id: nuevoId(), tipo: 'copiloto', texto: t }]
      })
      return
    }
    // El loop avisa cosas que no son errores: por ejemplo que recortó la
    // conversación para que entrara. Se dibujan igual que un aviso pero no
    // ensucian `caidaRef`, que es la razón del apagado y no cualquier cosa.
    if (ev.tipo === 'aviso') {
      const t = String(ev.texto || '').trim()
      if (t) agregar({ tipo: 'aviso', texto: t, reset: true })
      return
    }
    if (ev.tipo === 'error') {
      const dicho = ev.mensaje || 'No pude terminar. Probá de nuevo en un rato — la home sigue andando sin mí.'
      // Un 4xx no apaga nada: el servidor contestó, y lo que estaba mal era
      // el pedido. Guardarlo como "la caída" sería dejar preparada una
      // explicación falsa para un apagado que este error no provoca.
      if (!['pedido', 'largo', 'permiso'].includes(ev.motivo)) caidaRef.current = dicho
      // Cuando la conversación no entra, el botón va pegado al aviso: la
      // salida existe, es una sola, y hacerla buscar arriba a la derecha es
      // pedirle que resuelva ella un problema de cuentas nuestro.
      agregar({ tipo: 'aviso', texto: dicho, reset: ev.motivo === 'largo' })
    }
  }, [agregar])

  // ------------------------------------------------------------
  const enviar = React.useCallback(async (crudo) => {
    const dicho = String(crudo || '').trim()
    if (!dicho || pensando) return
    borradorRef.current = ''
    // El input se vacía acá, así que si la respuesta a ESTE pedido es la
    // que apaga el copiloto, sin esta línea el pedido no existiría en
    // ninguna parte para pasárselo al buscador.
    ultimoDichoRef.current = dicho
    agregar({ tipo: 'persona', texto: dicho })

    const notas = notasRef.current.splice(0)
    const conElUsuario = [...mensajes, { role: 'user', content: notas.length ? `${notas.join(' ')}\n${dicho}` : dicho }]
    setMensajes(conElUsuario)

    const corte = new AbortController()
    cortarRef.current = corte
    setPensando(true)
    try {
      // El ctx que ve el copiloto es el de App.jsx con UNA sola cosa
      // cambiada: `proponer` desemboca en esta conversación. La propuesta
      // se dibuja como card acá y no toca la pieza hasta que la persona
      // apriete Aceptar — invariante 1, y es el único lugar donde se
      // hace cumplir.
      const base = ctxRef.current || {}
      const ctxDelLoop = {
        ...base,
        acciones: {
          ...(base.acciones || {}),
          proponer: (propuesta) => {
            const p = normalizarPropuesta(propuesta, ctxRef.current)
            if (p) encolarPropuesta(p)
            return { encolada: !!p }
          },
        },
      }
      const r = await motor.conversar({
        mensajes: conElUsuario,
        ctx: ctxDelLoop,
        onEvento: manejarEvento,
        signal: corte.signal,
        // El primer pedido de la conversación. El loop puede tener que
        // recortar el historial que le manda al modelo, y el hilo de acá es
        // el único lugar donde queda entero: en pantalla no se recorta nada.
        // `turnos` todavía no tiene el mensaje de recién, así que si no hay
        // ninguno anterior, el original es este.
        original: turnos.find((t) => t.tipo === 'persona')?.texto || dicho,
      })
      // Nos quedamos con el historial que el loop realmente mandó (`base`):
      // si recortó los intercambios más viejos, guardar acá la versión larga
      // haría que el próximo turno vuelva a recortar desde cero y a avisar de
      // nuevo. Si no hubo recorte, `base` es lo mismo que mandamos.
      if (r && Array.isArray(r.mensajes)) {
        setMensajes([...(Array.isArray(r.base) ? r.base : conElUsuario), ...r.mensajes])
      }
      // `corto` no se dibuja acá: cuando el loop se queda sin vueltas ya
      // manda un evento 'texto' explicándolo. Decirlo dos veces sería
      // ruido, y el segundo no lo escribió el copiloto.
    } catch {
      // Parar ya deja su propio rastro; acá sólo caen las caídas de verdad.
      if (!corte.signal.aborted) {
        agregar({ tipo: 'aviso', texto: 'Se cortó la conexión con el copiloto. Podés seguir con las plantillas de siempre.' })
      }
      setTurnos((prev) => prev.map((t) => (t.estado === 'corriendo' ? { ...t, estado: 'cortada' } : t)))
    } finally {
      cortarRef.current = null
      setPensando(false)
    }
  }, [mensajes, turnos, pensando, agregar, manejarEvento, encolarPropuesta])

  // ------------------------------------------------------------
  // Las tres respuestas posibles a una propuesta.
  //
  // El estado de una card se escribe en sessionStorage ACÁ MISMO y no en el
  // efecto de más arriba: aplicar desde la home navega al editor, este árbol
  // se desmonta en el mismo commit y el efecto ya no corre. Sin esto, al
  // volver a la home la card aparecía otra vez "pendiente" y se podía
  // aceptar dos veces el mismo texto.
  const marcar = (idTurno, estado, extra = {}) => setTurnos((prev) => {
    const next = prev.map((t) => (t.id === idTurno ? { ...t, estado, falla: null, abrirCon: null, nota: null, ...extra } : t))
    try { sessionStorage.setItem(CLAVE, JSON.stringify({ turnos: next, mensajes: mensajesRef.current })) } catch {}
    return next
  })

  // Aceptar es lo único que mete el texto del modelo en una pieza, así que
  // esta card no puede cantar victoria por su cuenta: dice lo que contestó
  // el que aplica. `onPropuesta` devuelve { ok:true, puestos:[…], nota? } o
  // { ok:false, motivo, abrirCon? }; si no salió, la card queda abierta con
  // los botones — la propuesta sigue siendo aceptable en cuanto haya dónde
  // ponerla, y perderla por un error nuestro es lo peor que podría pasar.
  // `nota` es el caso del medio: entró parte del texto y parte no, así que
  // la card se cierra pero no dice sólo "Aceptada." — dice qué quedó afuera.
  const aceptar = (turno, abrir = false) => {
    if (typeof onPropuesta !== 'function') {
      marcar(turno.id, 'error', { falla: 'Desde esta pantalla no hay dónde aplicar el texto. Copialo a mano por ahora.' })
      return
    }
    let r
    try {
      r = onPropuesta(turno.p, { abrir })
    } catch (e) {
      // Nada de `catch {}`: si escribir en la pieza explota, se ve. Un error
      // tragado acá es un texto perdido con cara de aplicado.
      marcar(turno.id, 'error', { falla: `No se pudo aplicar: ${e?.message || 'falló al escribir en la pieza'}.` })
      return
    }
    if (r && r.ok) {
      marcar(turno.id, 'aceptada', { nota: r.nota || null })
      // Que el modelo se entere de lo que NO entró: si no, en el turno
      // siguiente sigue hablando de un titular que la pieza nunca mostró.
      if (r.nota) notasRef.current.push(`(${r.nota})`)
      return
    }
    // Un handler que no contesta no es un handler que aplicó. Antes que
    // mentir con un "Aceptada.", se dice que no sabemos.
    marcar(turno.id, 'error', r && r.motivo
      ? { falla: r.motivo, abrirCon: r.abrirCon || null }
      : { falla: 'No pude confirmar que el texto se aplicara. Mirá la pieza antes de seguir.' })
  }
  const descartar = (turno) => {
    // Descartar sí es cierto apenas se hace: no depende de nadie de afuera.
    marcar(turno.id, 'descartada')
    // Que el modelo se entere en el próximo pedido: si no, vuelve a
    // proponer lo mismo con otras palabras.
    notasRef.current.push(`(Descarté tu propuesta para ${turno.p.textos.map((t) => ROL[t.rol] || t.rol).join(', ').toLowerCase()}.)`)
  }
  const pedirOtra = (turno) => {
    // `enviar` no manda nada mientras el copiloto está pensando. Marcar la
    // card como descartada ahí sería tirar la propuesta a la basura sin
    // haber pedido nada a cambio: se queda pendiente y se dice por qué.
    if (pensando) {
      marcar(turno.id, 'pendiente', { falla: 'Esperá a que termine lo de arriba y volvé a pedírsela.' })
      return
    }
    marcar(turno.id, 'descartada')
    const roles = turno.p.textos.map((t) => ROL[t.rol] || t.rol).join(' y ')
    enviar(`Esa no me convence. Dame otra opción para ${roles.toLowerCase()}, con otro ángulo.`)
  }

  // Parar tiene que parar de verdad: el signal viaja hasta el fetch. Y el
  // corte se dice acá mismo, porque el loop vuelve en silencio cuando lo
  // cancelan — quedarse sin respuesta y sin explicación se lee como que la
  // app se colgó.
  const parar = () => {
    cortarRef.current?.abort()
    setTurnos((prev) => [
      ...prev.map((t) => (t.estado === 'corriendo' ? { ...t, estado: 'cortada' } : t)),
      { id: nuevoId(), tipo: 'aviso', texto: 'Lo corté acá. Lo que ya se abrió queda como está.' },
    ])
  }

  // Empezar de nuevo es lo único que le queda a la persona cuando la
  // conversación es el problema: se hizo demasiado larga, o venía fallando y
  // el motor dejó de insistir. Así que además de vaciar la pantalla, pide
  // que se levante el apagado. Un apagado que sobrevive al "arranquemos de
  // cero" no es una protección, es una condena: el chat no volvía ni
  // vaciando el hilo, había que recargar la página — y eso no lo sabe nadie.
  const empezarDeNuevo = () => {
    cortarRef.current?.abort()
    notasRef.current = []
    caidaRef.current = ''
    ultimoDichoRef.current = ''
    borradorRef.current = ''
    const volvio = typeof motor.reintentarCopiloto === 'function' && motor.reintentarCopiloto()
    setTurnos([]); setMensajes([])
    try { sessionStorage.removeItem(CLAVE) } catch {}
    if (volvio) {
      // Que el próximo apagado se vuelva a avisar hacia arriba, y que la
      // home saque el buscador de reemplazo: si el chat vuelve y el buscador
      // se queda, quedan dos campos para lo mismo y ninguno explica nada.
      avisadoRef.current = false
      onVuelveCopiloto?.()
    }
  }

  // ============================================================
  // Invariante 3: sin copiloto no hay chat. Gallery.jsx dibuja el buscador
  // de reglas y la home queda como estaba. Nada de "el asistente no está
  // disponible" ocupando media pantalla.
  //
  // Devolver null no alcanza: `hayCopiloto()` puede pasar a false a mitad
  // de sesión (404, o tres caídas seguidas) y ahí la home se quedaría sin
  // chat Y sin buscador, que es peor que cualquiera de los dos. Por eso se
  // avisa hacia arriba y quien nos dibuja repone el buscador de reglas.
  //
  // Y el aviso NO va vacío. Se lleva dos cosas: lo que la persona tenía
  // escrito —o lo último que mandó, porque el input ya se vació— para que
  // aparezca en el buscador viejo, y la frase que explica qué pasó. Antes
  // acá desaparecía el chat con el pedido adentro y aparecía otro input,
  // sin una palabra: la persona no tenía forma de saber si se rompió algo
  // o si la app se volvió loca.
  const sinCopiloto = !hayCopiloto() || typeof motor.conversar !== 'function'
  // ¿El apagado tiene vuelta? Sólo el de las fallas seguidas: ahí volver a
  // intentar es razonable. El 404 no vuelve por insistir y prometerlo sería
  // el mismo tipo de mentira que este archivo evita en todo lo demás.
  const puedeRevivir = sinCopiloto
    && typeof motor.apagadoReintentable === 'function'
    && motor.apagadoReintentable()
  const avisadoRef = React.useRef(false)
  React.useEffect(() => {
    if (!sinCopiloto || avisadoRef.current) return
    avisadoRef.current = true
    onSinCopiloto?.({
      texto: borradorRef.current.trim() || ultimoDichoRef.current || '',
      motivo: caidaRef.current || SIN_COPILOTO,
      // Si queda hilo en pantalla, la explicación la damos nosotros abajo
      // del hilo, que es el lugar donde estaba el chat. `explicado` evita
      // que Gallery repita la misma frase diez píxeles más abajo.
      explicado: turnos.length > 0,
    })
  }, [sinCopiloto, onSinCopiloto, turnos.length])

  return {
    turnos, pensando, borradorRef,
    enviar, parar, empezarDeNuevo,
    aceptar, descartar, pedirOtra,
    sinCopiloto, puedeRevivir,
    // `caida` se lee en el render de quien nos dibuja, igual que antes se
    // leía en el render de este mismo archivo: es la frase de por qué se
    // apagó, no un estado que tenga que disparar nada.
    caida: caidaRef.current,
  }
}

// ============================================================
// LA PANTALLA DEL COPILOTO.
//
// No tiene estado propio más que el borrador del input: todo lo que
// importa llega en `cop` (lo devuelve useCopiloto, arriba). Por eso se
// puede montar en la home, en el panel del editor o en ninguna parte sin
// que la conversación se corte — que es exactamente el defecto que esto
// vino a arreglar.
//
// `onCerrar` sólo lo pasa el panel del editor: en la home el copiloto es
// parte de la página y no hay nada que cerrar.
// ============================================================
export default function Copiloto({ cop, sugerenciasIniciales = [], onAbrirPieza, onCerrar }) {
  const { turnos, pensando, borradorRef, sinCopiloto, puedeRevivir, caida } = cop
  // El borrador se siembra del ref: si venías escribiendo en la home y el
  // copiloto te abrió una pieza, lo que tenías a medio tipear sigue ahí.
  const [texto, setTexto] = React.useState(() => borradorRef.current)
  const escribir = (v) => { borradorRef.current = v; setTexto(v) }
  const enviar = (t) => { const s = String(t || '').trim(); if (!s || pensando) return; escribir(''); cop.enviar(s) }
  const empezarDeNuevo = () => { cop.empezarDeNuevo(); setTexto('') }

  const finRef = React.useRef(null)
  // Siempre a la vista lo último. Sin `smooth` mientras piensa: los
  // eventos llegan de a uno y el scroll animado los persigue temblando.
  // Corre también al montar, así el panel del editor abre mostrando el
  // final de la conversación y no el principio.
  React.useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'end', behavior: pensando ? 'auto' : 'smooth' })
  }, [turnos, pensando])

  // Sin conversación en pantalla no hay nada que explicar desde acá: la
  // línea la pone Gallery arriba del buscador y la home queda limpia.
  if (sinCopiloto && !turnos.length) return null

  const vacia = turnos.length === 0

  return (
    <section className="cop" aria-label="Copiloto de Magoya Studio">
      <div className="cop-head">
        <span className="cop-title"><Icon n="sparkle" size={15} /> Copiloto</span>
        {!vacia && (
          <button type="button" className="linklike cop-reset" onClick={empezarDeNuevo}>Empezar de nuevo</button>
        )}
        {onCerrar && (
          <button type="button" className="cop-cerrar" onClick={onCerrar}
            title="Cerrar el copiloto" aria-label="Cerrar el copiloto"><Icon n="close" size={14} /></button>
        )}
      </div>

      {!vacia && (
        <div className="cop-hilo" role="log" aria-live="polite" aria-relevant="additions text">
          {turnos.map((t) => {
            if (t.tipo === 'persona') return <p key={t.id} className="cop-vos">{t.texto}</p>
            if (t.tipo === 'copiloto') return <p key={t.id} className="cop-dice">{t.texto}</p>
            if (t.tipo === 'aviso') {
              // El aviso que trae salida se la ofrece ahí mismo. Es el caso
              // de la conversación demasiado larga: no hay nada que
              // reintentar, hay que arrancar de nuevo, y el botón es la
              // diferencia entre una explicación y una solución.
              return (
                <p key={t.id} className="cop-aviso">
                  {t.texto}
                  {t.reset && (
                    <>
                      {' '}
                      <button type="button" className="linklike" onClick={empezarDeNuevo}>Empezar de nuevo</button>
                    </>
                  )}
                </p>
              )
            }
            if (t.tipo === 'accion') return <LineaAccion key={t.id} a={t} />
            if (t.tipo === 'propuesta') {
              return (
                <CardPropuesta key={t.id} turno={t}
                  onAceptar={() => cop.aceptar(t)}
                  onAbrirYAceptar={() => cop.aceptar(t, true)}
                  onDescartar={() => cop.descartar(t)}
                  onOtra={() => cop.pedirOtra(t)}
                  onVer={onAbrirPieza ? () => onAbrirPieza(t.p) : null} />
              )
            }
            return null
          })}
          {pensando && (
            <p className="cop-pensando"><span className="ia-spinner" aria-hidden="true" /> Pensando…</p>
          )}
          <div ref={finRef} />
        </div>
      )}

      {/* El chat se apagó pero la conversación no se evapora: queda a la
          vista, con una línea que dice qué pasó y adónde seguir. Sin la
          barra de escribir, porque escribir acá ya no manda a ningún lado
          y un input muerto es una promesa falsa. */}
      {sinCopiloto ? (
        <p className="cop-aviso cop-apagado">
          {/* Sin eco. El evento de error que apaga el chat escribe la MISMA
              frase dos veces: como aviso en el hilo (manejarEvento) y en
              `caida`. Facu la vio repetida en producción, una arriba de la
              otra. La regla: el hilo conserva el aviso — es donde pasó — y
              este cartel dice sólo lo que AGREGA: adónde seguir. La frase
              va acá únicamente cuando el hilo no la tiene (una recarga con
              la sesión restaurada, donde `caida` vuelve vacía y el cartel
              es el único lugar donde quedaría explicado el apagado). */}
          {!turnos.some((t) => t.tipo === 'aviso' && t.texto === (caida || SIN_COPILOTO)) && (
            <>{caida || SIN_COPILOTO}{' '}</>
          )}
          Te dejo la conversación para releerla. Para seguir,{' '}
          {/* El buscador de reemplazo vive en la home. Desde el editor,
              mandar a "acá abajo" sería mandar a un lugar que no existe:
              se dice dónde está de verdad. */}
          {onCerrar
            ? <>volvé al inicio: ahí está el buscador de siempre, corre en tu navegador, con las reglas de siempre, y ya tiene tu pedido puesto.</>
            : <>usá el buscador de acá abajo: corre en tu navegador, con las reglas de siempre, y ya tiene tu pedido puesto.</>}
          {/* Y si el apagado fue por fallas, se puede intentar otra vez: se
              dice sólo cuando es verdad. Con la función sin desplegar, el
              botón no trae nada de vuelta y ofrecerlo sería puro ruido. */}
          {puedeRevivir && (
            <>
              {' '}Si querés darle otra chance,{' '}
              <button type="button" className="linklike" onClick={empezarDeNuevo}>empezá de nuevo</button>
              {' '}y vuelvo a intentar.
            </>
          )}
        </p>
      ) : (
      <div className="cop-barra">
        <textarea className="cop-input" rows={1} value={texto}
          placeholder="Contame qué necesitás. Ej: armame un carrusel del caso de Los Álamos para LinkedIn"
          aria-label="Escribile al copiloto"
          onChange={(e) => escribir(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda, Shift+Enter hace salto de línea. Es lo que ya
            // hace todo el mundo en cualquier chat: no hay nada que aprender.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) }
          }} />
        {pensando ? (
          <button type="button" className="btn cop-parar" onClick={cop.parar} aria-label="Parar al copiloto">
            Parar
          </button>
        ) : (
          <button type="button" className="cop-enviar" onClick={() => enviar(texto)}
            disabled={!texto.trim()} aria-label="Enviar">
            <Icon n="up" size={16} />
          </button>
        )}
      </div>
      )}

      {vacia && sugerenciasIniciales.length > 0 && (
        <div className="cop-chips">
          {sugerenciasIniciales.map((s) => (
            <button key={s} type="button" className="cop-chip" onClick={() => enviar(s)}>{s}</button>
          ))}
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------
// UNA FUNCIÓN, MIENTRAS PASA.
// Esto es lo que Facu pidió ver. La etiqueta viene en gerundio desde el
// contrato ("buscando plantillas"), así que la línea se lee como una
// oración y no como un log: nombre de función, spinner, tilde.
function LineaAccion({ a }) {
  const estado = a.estado || 'corriendo'
  return (
    <div className={'cop-accion is-' + estado}>
      <span className="cop-acc-ico" aria-hidden="true">
        {estado === 'corriendo' ? <span className="ia-spinner" />
          : estado === 'ok' ? <Icon n="check" size={13} />
          : <Icon n="close" size={13} />}
      </span>
      <span className="cop-acc-txt">
        {a.etiqueta}
        {estado === 'ok' && a.resumen && <span className="cop-acc-res"> · {a.resumen}</span>}
        {estado === 'falla' && <span className="cop-acc-res"> · {a.resumen || 'no salió'}</span>}
        {estado === 'cortada' && <span className="cop-acc-res"> · cortada</span>}
      </span>
    </div>
  )
}

// ------------------------------------------------------------
// UNA PROPUESTA DE TEXTO.
// Todo lo que el modelo escribe pasa por acá. Se ve el rol, el texto, y si
// había algo antes se ve lo que se pisa — nadie acepta a ciegas. Los avisos
// de copyCheck se muestran pero no bloquean: la app avisa, no discute.
function CardPropuesta({ turno, onAceptar, onAbrirYAceptar, onDescartar, onOtra, onVer }) {
  const { p, estado, falla, abrirCon, nota } = turno
  // Una card se cierra cuando la decisión ya está tomada de verdad. Que
  // FALLE al aplicar no es una decisión: los botones se quedan, porque la
  // propuesta sigue siendo aceptable en cuanto haya dónde ponerla.
  const cerrada = estado === 'aceptada' || estado === 'descartada'
  // El id de la plantilla no le dice nada a nadie: se muestra el nombre, y
  // si no lo encontramos no se muestra nada. Nunca el id crudo.
  const donde = TEMPLATES.find((t) => t.id === p.plantillaId)?.name
  return (
    <div className={'cop-prop' + (estado === 'aceptada' ? ' ok' : estado === 'descartada' ? ' off' : '')}>
      <div className="cop-prop-head">
        <span className="cop-prop-tag">Propuesta</span>
        {donde && <span className="cop-prop-donde">{donde}</span>}
        {onVer && <button type="button" className="linklike cop-prop-ver" onClick={onVer}>Ver la pieza</button>}
      </div>
      {p.motivo && <p className="cop-prop-why">{p.motivo}</p>}

      {p.textos.map((t, i) => {
        const tope = MAXCHARS[t.rol]
        const largo = t.texto.length
        return (
          <div key={i} className="cop-campo">
            <div className="cop-campo-rol">
              {ROL[t.rol] || t.rol}
              {tope && <span className={'cop-campo-n' + (largo > tope ? ' over' : '')}>{largo}/{tope}</span>}
            </div>
            {t.antes && <p className="cop-antes">{t.antes}</p>}
            <p className="cop-despues">{t.texto}</p>
            {t.avisos.map((av, j) => <p key={j} className="cop-warn">{av}</p>)}
          </div>
        )
      })}

      {/* Por qué no se aplicó, con las palabras del que lo intentó. Va antes
          de los botones porque es lo que explica por qué siguen ahí. */}
      {falla && <p className="cop-warn" role="alert">{falla}</p>}

      {cerrada ? (
        <>
          <p className="cop-prop-cerrada">{estado === 'aceptada' ? (nota ? 'Aceptada, pero no entera.' : 'Aceptada.') : 'Descartada.'}</p>
          {/* "Aceptada" a secas sobre una pieza a la que le faltó la mitad
              del texto es una mentira chica y una mentira igual. */}
          {nota && <p className="cop-warn">{nota}</p>}
        </>
      ) : (
        <div className="cop-prop-acts">
          {/* Aceptar es lo ÚNICO que escribe en la pieza. Y cuando no hay
              pieza abierta, abrir la plantilla que la propuesta ya eligió es
              la salida: el texto entra en algún lado en vez de perderse. */}
          {abrirCon && onAbrirYAceptar && (
            <button type="button" className="btn primary" onClick={onAbrirYAceptar}>
              Abrir «{abrirCon.nombre}» y aplicar
            </button>
          )}
          <button type="button" className={'btn' + (abrirCon ? '' : ' primary')} onClick={onAceptar}>
            {falla ? 'Reintentar' : 'Aceptar'}
          </button>
          <button type="button" className="btn" onClick={onOtra}>Pedir otra</button>
          <button type="button" className="btn" onClick={onDescartar}>Descartar</button>
        </div>
      )}
    </div>
  )
}
