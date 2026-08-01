import React from 'react'
import { TEMPLATES } from '../templates/index.js'
import { formatLabel, formatsByNetwork } from '../formats/registry.js'
import {
  listarBitacora, registrarPublicacion, registrarMetricas,
  resumenParaCopiloto, importarCSV, local,
} from '../lib/memoria.js'
import Icon from '../ui/Icon.jsx'

// ============================================================
// PULSO — qué publicamos y cómo nos fue
//
// Esta pantalla existe por una razón sola: sin ella el copiloto no tiene
// nada que leer. Puede listar plantillas y proponer textos, pero cuando
// alguien le pregunta "¿qué funcionó la última vez?" la respuesta honesta
// es "no tengo datos" — para siempre. Acá es donde esos datos entran.
//
// La regla de la casa vale igual acá: NO se estima nada. Si hay tres
// piezas medidas, la pantalla dice que hay tres piezas medidas y no
// arma un ranking de "las que mejor funcionan". Un ranking de tres es
// exactamente el delirio que este producto vino a evitar, sólo que con
// números y por lo tanto más creíble.
//
// La bitácora NO se carga a mano: se llena sola cuando alguien descarga
// una pieza (registrarPieza). Lo único que se tipea acá es lo que la
// herramienta no puede saber — que salió, dónde, y cómo le fue.
// ============================================================

// Las redes de verdad, las del registro de formatos. "Genérico" no es una
// red: son medidas para una presentación, nadie publica ahí.
const REDES = Object.keys(formatsByNetwork()).filter((n) => n !== 'Genérico')

const NOMBRE_PLANTILLA = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name]))

const NUM = new Intl.NumberFormat('es-AR')
const fmtNum = (n) => (n == null || n === '' || Number.isNaN(Number(n)) ? '—' : NUM.format(Number(n)))

// La memoria puede venir con camelCase o con el snake_case crudo de la
// tabla. Leer las dos formas cuesta una línea y evita que la fila quede
// muda por un guión bajo.
const leer = (o, ...claves) => {
  for (const k of claves) if (o && o[k] != null && o[k] !== '') return o[k]
  return null
}

function fecha(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// El día de acá, con el helper de memoria.js. Esto ya estuvo roto una vez
// y se arregló allá: con toISOString() a partir de las 21 en Argentina la
// fecha es la de mañana, y el `max` del input terminaba habilitando una
// fecha futura que después el CSV no matcheaba contra nada. Se importa en
// vez de reescribirlo justamente para no volver a escribirlo mal.
const hoyISO = () => local(new Date())

// Un campo de métrica vacío es "no lo miré", no "cero". Devolver null en
// vez de 0 es la diferencia entre no saber y afirmar que no pasó nada.
const entero = (v) => {
  if (v == null || String(v).trim() === '') return null
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

const publicacionesDe = (p) => leer(p, 'publicaciones', 'publications') || []
const metricasDe = (pub) => leer(pub, 'metricas', 'metrics', 'ultimaMetrica') || null
const medida = (pub) => {
  const m = metricasDe(pub)
  return !!m && ['likes', 'comentarios', 'guardados', 'alcance'].some((k) => m[k] != null)
}

export default function Pulso({ onVolver }) {
  const [filas, setFilas] = React.useState([])
  const [resumen, setResumen] = React.useState('')
  const [cargando, setCargando] = React.useState(true)
  // La memoria falla en silencio por contrato (nunca tira). Antes eso hacía
  // este cartel inalcanzable: el catch no se ejecutaba nunca porque nada
  // rechazaba, y con Supabase caído la pantalla dibujaba "todavía no hay
  // piezas anotadas" — mentira dicha con toda seguridad. Ahora las lecturas
  // devuelven { ok } y el estado se prende mirando eso, no esperando una
  // excepción que no va a llegar.
  const [roto, setRoto] = React.useState(false)
  const [aviso, setAviso] = React.useState(null)

  const cargar = React.useCallback(async () => {
    setCargando(true)
    setRoto(false)
    try {
      const [b, r] = await Promise.all([listarBitacora({ limite: 50 }), resumenParaCopiloto()])
      // Con que una de las dos no se haya podido leer, la pantalla no puede
      // afirmar nada sobre lo que hay: se muestra el cartel y se vacía lo
      // que no se leyó, en vez de dejar un vacío que se lee como "no hay".
      setRoto(!b?.ok || !r?.ok)
      setFilas(b?.ok && Array.isArray(b.datos) ? b.datos : [])
      setResumen(r?.ok && typeof r.texto === 'string' ? r.texto : '')
    } catch {
      // No debería pasar (memoria.js no tira), pero si alguna vez pasa el
      // cartel correcto es el mismo.
      setRoto(true)
      setFilas([])
      setResumen('')
    } finally {
      setCargando(false)
    }
  }, [])

  React.useEffect(() => { cargar() }, [cargar])

  // Un formulario abierto por vez, a propósito: cargar métricas tiene que
  // durar treinta segundos, y para eso hace falta un solo lugar donde
  // mirar, no doce cajitas abiertas.
  const [publicando, setPublicando] = React.useState(null)   // { piezaId, red, dia, url }
  const [midiendo, setMidiendo] = React.useState(null)       // { publicacionId, likes, ... }
  const [guardando, setGuardando] = React.useState(false)

  // registrarPublicacion / registrarMetricas fallan en silencio: si algo
  // salió mal devuelven null. Un undefined (función que no devuelve nada)
  // se toma como éxito; un null, como el fracaso que la memoria no grita.
  const fallo = (r) => r === null || r === false

  async function guardarPublicacion(e) {
    e.preventDefault()
    if (!publicando?.red) return
    setGuardando(true)
    setAviso(null)
    try {
      const r = await registrarPublicacion({
        piezaId: publicando.piezaId,
        red: publicando.red,
        // el input ya da 'YYYY-MM-DD' en hora local: va tal cual. Pasarlo
        // por Date() sólo agrega la chance de que se corra un día.
        publicadoEl: publicando.dia,
        url: publicando.url?.trim() || null,
      })
      if (fallo(r)) throw new Error('sin respuesta')
      setPublicando(null)
      setAviso({ ok: true, txt: 'Anotado. Cuando tengas los números, cargalos acá mismo.' })
      await cargar()
    } catch {
      setAviso({ ok: false, txt: 'No pude guardarlo. Lo que escribiste sigue ahí — probá de nuevo en un rato.' })
    } finally {
      setGuardando(false)
    }
  }

  async function guardarMetricas(e) {
    e.preventDefault()
    if (!midiendo) return
    const datos = {
      likes: entero(midiendo.likes),
      comentarios: entero(midiendo.comentarios),
      guardados: entero(midiendo.guardados),
      alcance: entero(midiendo.alcance),
    }
    if (Object.values(datos).every((v) => v == null)) return
    setGuardando(true)
    setAviso(null)
    try {
      const r = await registrarMetricas({
        publicacionId: midiendo.publicacionId,
        ...datos,
        medidoEl: hoyISO(),
      })
      if (fallo(r)) throw new Error('sin respuesta')
      setMidiendo(null)
      setAviso({ ok: true, txt: 'Cargado. Ahora el copiloto puede mirar esto.' })
      await cargar()
    } catch {
      setAviso({ ok: false, txt: 'No pude guardar los números. Probá de nuevo en un rato.' })
    } finally {
      setGuardando(false)
    }
  }

  // ---- CSV ----
  const archivoRef = React.useRef(null)
  const [redCSV, setRedCSV] = React.useState(REDES[0] || '')
  const [csv, setCsv] = React.useState(null)   // { ok, txt }
  const [leyendo, setLeyendo] = React.useState(false)

  async function tomarCSV(file) {
    if (!file) return
    setLeyendo(true)
    setCsv(null)
    try {
      const texto = await file.text()
      const r = await importarCSV(texto, redCSV)
      const importadas = Number(r?.importadas ?? 0)
      const salteadas = Number(r?.salteadas ?? 0)
      // memoria.js devuelve `motivos` (son varios: filas sin fecha, filas
      // ambiguas, filas sin match). Se dicen todos: cada uno se arregla
      // distinto y "no importé nada" a secas no le sirve a nadie.
      const porQue = (Array.isArray(r?.motivos) ? r.motivos : []).join(' ')
      // El caso feo es el que hay que decir mejor: cero importadas casi
      // siempre significa que el archivo no era el que la función espera,
      // no que el archivo esté vacío.
      if (!r || (!importadas && !salteadas)) {
        // El motivo real puede no ser el formato: también cae acá cuando
        // todavía no hay ninguna publicación anotada en esa red. Decir
        // "no reconocí el archivo" ahí sería mandar a arreglar lo que no
        // está roto.
        setCsv({ ok: false, txt: porQue || `No reconocí el formato de ${file.name}. Tiene que ser el CSV que exporta ${redCSV}, con su fila de encabezados.` })
      } else if (!importadas) {
        setCsv({ ok: false, txt: `No importé nada de ${file.name}. ${porQue || 'Ninguna fila coincide con una publicación registrada en la bitácora.'}` })
      } else {
        setCsv({
          ok: true,
          txt: `Importé ${NUM.format(importadas)} ${importadas === 1 ? 'fila' : 'filas'}`
            + (salteadas ? `. Salteé ${NUM.format(salteadas)}: ${porQue || 'no las pude cruzar con ninguna pieza de la bitácora'}.` : '.'),
        })
        await cargar()
      }
    } catch {
      setCsv({ ok: false, txt: 'No pude leer el archivo. Tiene que ser un CSV de texto.' })
    } finally {
      setLeyendo(false)
      if (archivoRef.current) archivoRef.current.value = ''
    }
  }

  // ---- cuánto sabemos de verdad ----
  const pubs = filas.flatMap(publicacionesDe)
  const conMetricas = pubs.filter(medida).length

  return (
    <div className="gallery">
      <div className="pulso-head">
        <div>
          <h1>Pulso</h1>
          <p className="lead">
            Qué salió, dónde, y cómo le fue. Es de acá de donde el copiloto saca lo que sabe:
            si esto está vacío, cuando le preguntes qué funcionó te va a decir que no tiene datos.
          </p>
        </div>
        {onVolver && <button className="btn" onClick={onVolver}>← Volver</button>}
      </div>

      {roto && (
        <div className="pulso-error">
          No pude leer la memoria (puede estar caída la conexión). Lo demás de la app sigue andando.{' '}
          <button className="linklike" onClick={cargar}>Reintentar</button>
        </div>
      )}
      {aviso && <div className={'pulso-aviso' + (aviso.ok ? ' ok' : '')}>{aviso.txt}</div>}

      {/* ---- LO QUE SABEMOS ---- */}
      <div className="section-title">Lo que sabemos</div>
      <div className="pulso-saber">
        {/* Tres estados, no dos. El tercero —no pude leer— antes se
            disfrazaba del segundo y le decía "todavía no cargaron nada" a
            un equipo con cuarenta piezas cargadas. */}
        {roto
          ? <p className="pulso-resumen apagado">No sé qué hay: no pude leer la memoria. Ojo que no es lo mismo que "no hay nada" — puede haber todo cargado y ser la conexión. Reintentá arriba.</p>
          : resumen
            ? <p className="pulso-resumen">{resumen}</p>
            : <p className="pulso-resumen apagado">Todavía no hay nada que resumir. Esto se escribe solo cuando haya piezas publicadas con números cargados.</p>}
        {/* El tamaño de la muestra va SIEMPRE, no sólo cuando es cómodo.
            Es lo que separa "medimos" de "tenemos una anécdota". Salvo
            cuando no hay lectura: ahí no hay muestra de la que hablar. */}
        <p className="pulso-muestra">
          {roto
            ? 'Sin lectura de la memoria no hay muestra de la que hablar: no sé cuántas piezas hay ni cuántas están medidas. Un cero acá sería un número inventado.'
            : conMetricas === 0
              ? `${filas.length ? `${NUM.format(filas.length)} piezas en la bitácora, ` : ''}0 con métricas cargadas. Sin números no hay nada que comparar: acá no se estima.`
              : conMetricas < 5
                ? `${NUM.format(conMetricas)} ${conMetricas === 1 ? 'publicación medida' : 'publicaciones medidas'} sobre ${NUM.format(pubs.length)}. Es una muestra chica: sirve para mirar caso por caso, no para decir qué funciona mejor.`
                : `${NUM.format(conMetricas)} publicaciones medidas sobre ${NUM.format(pubs.length)}, en ${NUM.format(filas.length)} piezas.`}
        </p>
      </div>

      {/* ---- BITÁCORA ---- */}
      <div className="section-title">Bitácora</div>
      {cargando && <div className="pulso-vacio">Buscando…</div>}
      {/* El vacío sólo se puede llamar vacío cuando la lectura anduvo. Con
          la memoria caída esta misma caja decía "todavía no hay piezas
          anotadas" con total seguridad, que es lo único que no se puede
          hacer acá. */}
      {!cargando && !roto && filas.length === 0 && (
        <div className="pulso-vacio">
          <b>Todavía no hay piezas anotadas.</b>
          <span>Esta lista se llena sola: cada vez que alguien descarga una pieza, queda registrada acá con su plantilla y su formato. Después venís y marcás cuál salió.</span>
        </div>
      )}
      {!cargando && roto && (
        <div className="pulso-vacio">
          <b>No pude traer la bitácora.</b>
          <span>No sé si está vacía o llena: la consulta no volvió. Reintentá con el botón de arriba; lo que esté cargado sigue estando.</span>
        </div>
      )}

      <div className="pulso-lista">
        {filas.map((p) => {
          const id = leer(p, 'id', 'piezaId', 'pieza_id')
          const publicaciones = publicacionesDe(p)
          const cuando = fecha(leer(p, 'creadoEl', 'created_at', 'creado_el'))
          const tpl = leer(p, 'templateId', 'template_id')
          return (
            <div key={id} className="pulso-fila">
              <div className="pulso-f-main">
                <span className="pulso-f-t">{leer(p, 'titulo', 'title') || 'Sin título'}</span>
                <span className="pulso-f-meta">
                  {NOMBRE_PLANTILLA[tpl] || tpl || 'plantilla desconocida'}
                  {leer(p, 'formatId', 'format_id') && <> · {formatLabel(leer(p, 'formatId', 'format_id'))}</>}
                  {leer(p, 'carrusel', 'carousel') && <> · carrusel</>}
                  {cuando && <> · {cuando}</>}
                  {leer(p, 'autor', 'author') && <> · {leer(p, 'autor', 'author')}</>}
                </span>
              </div>

              <div className="pulso-f-acts">
                {publicaciones.length === 0 && <span className="pulso-badge">sin publicar</span>}
                <button className="btn" onClick={() => {
                  setMidiendo(null)
                  setPublicando(publicando?.piezaId === id ? null : { piezaId: id, red: REDES[0] || '', dia: hoyISO(), url: '' })
                }}>
                  <Icon n="check" size={13} /> Salió
                </button>
              </div>

              {/* marcar como publicada */}
              {publicando?.piezaId === id && (
                <form className="pulso-form" onSubmit={guardarPublicacion}>
                  <label className="pulso-campo">
                    <span>Red</span>
                    <select value={publicando.red} onChange={(e) => setPublicando({ ...publicando, red: e.target.value })}>
                      {REDES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="pulso-campo">
                    <span>Cuándo</span>
                    <input type="date" value={publicando.dia} max={hoyISO()}
                      onChange={(e) => setPublicando({ ...publicando, dia: e.target.value })} />
                  </label>
                  <label className="pulso-campo ancho">
                    <span>Link (opcional)</span>
                    <input type="url" placeholder="https://…" value={publicando.url}
                      onChange={(e) => setPublicando({ ...publicando, url: e.target.value })} />
                  </label>
                  <div className="pulso-form-acts">
                    <button type="submit" className="btn primary" disabled={guardando || !publicando.red}>Guardar</button>
                    <button type="button" className="linklike" onClick={() => setPublicando(null)}>Cancelar</button>
                  </div>
                </form>
              )}

              {/* publicaciones de esta pieza, con sus números */}
              {publicaciones.length > 0 && (
                <div className="pulso-pubs">
                  {publicaciones.map((pub) => {
                    const pid = leer(pub, 'id', 'publicacionId', 'publicacion_id')
                    const m = metricasDe(pub) || {}
                    const url = leer(pub, 'url')
                    return (
                      <div key={pid} className="pulso-pub">
                        <span className="pulso-pub-red">{leer(pub, 'red', 'network') || 'sin red'}</span>
                        <span className="pulso-pub-fecha">{fecha(leer(pub, 'publicadoEl', 'publicado_el', 'published_at')) || 'sin fecha'}</span>
                        {url && <a className="linklike" href={url} target="_blank" rel="noreferrer">ver</a>}
                        {medida(pub) ? (
                          <span className="pulso-nums">
                            <b>{fmtNum(m.likes)}</b> likes · <b>{fmtNum(m.comentarios)}</b> coment. ·{' '}
                            <b>{fmtNum(m.guardados)}</b> guardados · <b>{fmtNum(m.alcance)}</b> alcance
                          </span>
                        ) : (
                          <span className="pulso-nums apagado">sin números todavía</span>
                        )}
                        <button className="linklike" onClick={() => {
                          setPublicando(null)
                          setMidiendo(midiendo?.publicacionId === pid ? null : {
                            publicacionId: pid,
                            likes: m.likes ?? '', comentarios: m.comentarios ?? '',
                            guardados: m.guardados ?? '', alcance: m.alcance ?? '',
                          })
                        }}>
                          {medida(pub) ? 'Actualizar' : 'Cargar números'}
                        </button>

                        {midiendo?.publicacionId === pid && (
                          <form className="pulso-form nums" onSubmit={guardarMetricas}>
                            {[['likes', 'Likes'], ['comentarios', 'Comentarios'], ['guardados', 'Guardados'], ['alcance', 'Alcance']].map(([k, et]) => (
                              <label key={k} className="pulso-campo chico">
                                <span>{et}</span>
                                <input type="number" min="0" inputMode="numeric" placeholder="—"
                                  value={midiendo[k]} onChange={(e) => setMidiendo({ ...midiendo, [k]: e.target.value })} />
                              </label>
                            ))}
                            <div className="pulso-form-acts">
                              <button type="submit" className="btn primary"
                                disabled={guardando || ['likes', 'comentarios', 'guardados', 'alcance'].every((k) => entero(midiendo[k]) == null)}>
                                Guardar
                              </button>
                              <button type="button" className="linklike" onClick={() => setMidiendo(null)}>Cancelar</button>
                            </div>
                            {/* Nada es obligatorio salvo que haya algo: media
                                métrica cargada vale más que ninguna, y un cero
                                puesto para llenar el campo es un dato falso. */}
                            <p className="hint">Cargá lo que tengas a mano. Lo que dejes vacío queda como “no medido”, no como cero.</p>
                          </form>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- CSV ---- */}
      <div className="section-title">Importar desde un CSV</div>
      <div className="pulso-csv">
        <p className="panel-help" style={{ margin: 0 }}>
          Si bajás el export de estadísticas de la red, pegalo acá en vez de tipear pieza por pieza.
          Se cruza contra las publicaciones ya anotadas: lo que no matchee, se saltea y te lo digo.
        </p>
        <div className="pulso-csv-row">
          <label className="pulso-campo">
            <span>De qué red</span>
            <select value={redCSV} onChange={(e) => setRedCSV(e.target.value)}>
              {REDES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn" disabled={leyendo || !redCSV} onClick={() => archivoRef.current?.click()}>
            {leyendo ? 'Leyendo…' : 'Elegir archivo CSV'}
          </button>
          <input ref={archivoRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => tomarCSV(e.target.files?.[0])} />
        </div>
        {csv && <div className={'pulso-csv-res' + (csv.ok ? ' ok' : '')}>{csv.txt}</div>}
      </div>
    </div>
  )
}
