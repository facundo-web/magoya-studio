// ============================================================
// ENTENDER (cliente) — le pide al modelo que traduzca la frase a señales,
// y si no puede, usa las reglas de siempre.
//
// La promesa que sostiene este archivo: el PEOR caso es el producto de
// ayer, nunca una pantalla muerta. Sin internet, sin la función
// desplegada, con el modelo caído o lento: caemos a las reglas y el
// buscador sigue funcionando exactamente como antes.
// ============================================================
import { supabase } from './supabase.js'

const URL_ENTENDER = 'https://otdbwfoydofzwtkcgfqf.supabase.co/functions/v1/entender'
// Medido contra la función ya desplegada: 3.2-3.5s incluso "en caliente"
// (edge function + llamada al modelo). 3500 cortaba justo antes de tener
// la respuesta — quedaba abortando siempre. 7000 da margen real.
const ESPERA_MAX = 7000

// Una frase escrita dos veces no se paga dos veces.
const cache = new Map()

// Si la función no está desplegada, el primer intento lo dice y no
// insistimos en cada tecla.
let disponible = null

const VACIO = { objetivo: 'ninguno', tema: '', carrusel: false, red: 'ninguna', confianza: 0 }
const OBJETIVOS = ['webinar', 'prueba', 'ensenar', 'anuncio', 'equipo', 'cierre', 'ninguno']
const REDES = { instagram: 'ig-post', linkedin: 'li-post', whatsapp: 'wa-status', youtube: 'yt-thumb', facebook: 'fb-post', x: 'x-post' }

// Normalizar para comparar: sin tildes, sin puntuación, minúsculas.
const plano = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * La aduana. Todo lo que vuelve del modelo pasa por acá antes de tocar la
 * pieza, y lo que no cumple se descarta en silencio.
 *
 * La regla que más importa: el `tema` tiene que estar CONTENIDO en lo que
 * la persona escribió. Si el modelo devuelve algo que ella no dijo —por
 * bien redactado que esté— es exactamente el delirio que la herramienta
 * viene a evitar, y lo tiramos.
 */
export function validar(crudo, textoOriginal) {
  if (!crudo || typeof crudo !== 'object') return VACIO
  const objetivo = OBJETIVOS.includes(crudo.objetivo) ? crudo.objetivo : 'ninguno'

  let tema = String(crudo.tema || '').trim().slice(0, 80)
  if (tema) {
    const dentro = plano(textoOriginal).includes(plano(tema))
    // dos o tres palabras sueltas tampoco: el tema tiene que ser un tramo
    if (!dentro) tema = ''
  }

  const red = Object.prototype.hasOwnProperty.call(REDES, crudo.red) ? crudo.red : 'ninguna'
  const confianza = Math.max(0, Math.min(1, Number(crudo.confianza) || 0))
  return { objetivo, tema, carrusel: crudo.carrusel === true, red, confianza, formatoId: REDES[red] || null }
}

/**
 * Le pregunta al modelo. Devuelve null si no se pudo — y null significa
 * "usá las reglas", no "no hay nada".
 */
export async function entender(texto) {
  const clave = plano(texto)
  if (clave.length < 4) return null
  if (cache.has(clave)) return cache.get(clave)
  if (disponible === false) return null

  const corte = new AbortController()
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAX)
  try {
    const { data } = await supabase.auth.getSession().catch(() => ({ data: null }))
    const r = await fetch(URL_ENTENDER, {
      method: 'POST',
      signal: corte.signal,
      headers: {
        'Content-Type': 'application/json',
        // la publishable key ya es pública por diseño; la clave del modelo
        // vive del lado del servidor y nunca baja al navegador
        Authorization: `Bearer ${data?.session?.access_token || supabase.supabaseKey}`,
      },
      body: JSON.stringify({ texto }),
    })
    if (!r.ok) { if (r.status === 404) disponible = false; return null }
    disponible = true
    const salida = validar(await r.json(), texto)
    cache.set(clave, salida)
    return salida
  } catch {
    return null // abortado, sin internet, o la función no existe
  } finally {
    clearTimeout(reloj)
  }
}

/**
 * Mezcla lo que entendió el modelo con lo que sacaron las reglas.
 *
 * Las reglas MANDAN sobre los datos duros —fecha, hora, cifra, red— porque
 * una expresión regular no se equivoca leyendo "11 de junio" y un modelo
 * puede. El modelo manda sólo donde las reglas se quedaron sin nada: el
 * objetivo, cuando ninguna palabra clave coincidió.
 */
export function combinar(senales, delModelo) {
  if (!delModelo || delModelo.confianza < 0.45) return senales
  const s = { ...senales }
  if (!s.objetivo && delModelo.objetivo !== 'ninguno') {
    s.objetivo = delModelo.objetivo
    s.loEntendioLaIA = true // para poder decirlo en el motivo, sin fingir
  }
  if (!s.formatoId && delModelo.formatoId) s.formatoId = delModelo.formatoId
  if (!s.carrusel && delModelo.carrusel) s.carrusel = true
  if (delModelo.tema) s.temaIA = delModelo.tema
  return s
}
