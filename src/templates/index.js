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

// Orden por OBJETIVO de marketing (auditoría): primero lo que prueba y
// educa; "en blanco" al final — arrancar en blanco es donde se rompe la marca.
export const TEMPLATES = [
  impCifra, impApps, impPantalla, impPregunta, // AI en campo · alto impacto
  casoCliente, dato, insight, cita, retrato,          // prueba social y resultados
  metodo, contraste, techTitular, evento, bloqueColor,  // autoridad y anuncios
  carruselPortada, carruselCierre, whatsapp, // carrusel
  zocaloPlaca, fotoTitular, fotoCentrada,    // foto + texto
  blank,                                      // último a propósito
]

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))
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
  metricLabel: 'tickets de soporte en campo, en 4 meses',
  quote: 'Se integraron en dos semanas y desde ahí no los tratamos como proveedor.',
  author: 'VP Product · Apeel Sciences',
  cta: 'Agendá 30 minutos',
  step: 'Entendemos el ciclo agronómico',
}

// máximo recomendado por rol (se muestra como contador en el editor)
export const MAXCHARS = {
  kicker: 18, title: 60, subtitle: 70, body: 140,
  metric: 6, metricLabel: 44, quote: 120, author: 32, cta: 28, step: 52,
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
  if (d.steps) c.steps = [...d.steps]
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
  impacto: 'AI en campo · alto impacto',
}
