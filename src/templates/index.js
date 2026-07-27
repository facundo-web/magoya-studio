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
