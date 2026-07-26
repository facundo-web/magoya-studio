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

export const TEMPLATES = [blank, zocaloPlaca, fotoTitular, fotoCentrada, carruselPortada, techTitular, bloqueColor, cita, dato, whatsapp, carruselCierre]

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))
export const BLANK_TEMPLATE = blank

// El copy NO vive en la plantilla: la plantilla es estructura. Estos son
// los textos de muestra (placeholders) que se ven en la galería y con los
// que arranca la edición — el usuario los reemplaza.
export const PLACEHOLDERS = {
  kicker: 'ETIQUETA',
  title: 'Escribí tu título',
  subtitle: 'Una bajada corta',
  body: 'Tu texto',
  metric: '00%',
  metricLabel: 'Qué mide el dato',
  quote: 'Tu cita acá',
  author: 'Autor · Fuente',
}

// contenido inicial de una plantilla: mantiene el DISEÑO (colores, logo,
// motivo, objetos) pero reemplaza el copy por placeholders y limpia la foto.
export function placeholderContent(t) {
  const d = t.defaults || {}
  const c = { ...d }
  delete c.photo
  ;(t.roles || []).forEach((r) => { c[r] = PLACEHOLDERS[r] ?? '' })
  if (t.freeform) {
    c.textBlocks = (d.textBlocks || []).map((b) => ({ style: b.style, text: PLACEHOLDERS[b.style] || 'Tu texto acá' }))
  } else {
    c.textBlocks = (d.textBlocks || []).map((b) => ({ ...b }))
  }
  c.objects = (d.objects || []).map((o) => ({ ...o }))
  if (d.messages) c.messages = d.messages.map((m) => ({ ...m }))
  return c
}

// categorías para agrupar/filtrar en la galería
export const CATEGORIES = {
  libre: 'En blanco',
  zocalo: 'Foto + zócalo',
  post: 'Post / anuncio',
  quote: 'Cita',
  metric: 'Dato',
  chat: 'Chat / WhatsApp',
}
