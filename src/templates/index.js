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

export const TEMPLATES = [zocaloPlaca, fotoTitular, fotoCentrada, carruselPortada, techTitular, bloqueColor, cita, dato]

export const TEMPLATES_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]))

// categorías para agrupar/filtrar en la galería
export const CATEGORIES = {
  zocalo: 'Foto + zócalo',
  post: 'Post / anuncio',
  quote: 'Cita',
  metric: 'Dato',
}
