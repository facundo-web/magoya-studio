// ============================================================
// CARRUSELES ARMADOS
//
// "Carrusel" abría tres slides en blanco. Eso es justo lo que hace que
// alguien que no diseña se empantane: Aye — "siento que voy a tardar un
// montón, me cuesta sentir que tengo que tomar todas las decisiones";
// Inés — "si vos dejás la plantilla, ahí se elimina un poco la decisión".
//
// Inés lo pidió con estructura exacta: "una portada, tres internos y un
// cierre. Y yo el slide interno lo multiplico por la cantidad que tenga
// ese carrusel". Eso es lo que arma esto.
//
// Un carrusel armado NO es una plantilla nueva: es una secuencia de las
// que ya hay, con un diseño compartido (para que combinen entre sí, que
// era el otro reclamo) y el copy de cada slide calibrado para que se vea
// de qué va antes de escribir.
// ============================================================

import { TEMPLATES_BY_ID, placeholderContent } from './index.js'
import { PHOTOS } from '../brand/photoLibrary.js'

export const CAROUSELS = [
  {
    id: 'guia',
    name: 'Guía paso a paso',
    purpose: 'Enseñás algo en tres pasos. Es el formato que más se guarda.',
    // el interno se repite: es el que multiplicás con "Duplicar"
    slides: ['carrusel-portada', 'tech-titular', 'tech-titular', 'tech-titular', 'carrusel-cierre'],
    design: { accent: 'lime', scheme: 'ink' },
    // la portada es la única slide con foto: sin esto arranca en el esqueleto
    // gris mientras las otras cuatro ya tienen color (ver buildCarousel)
    foto: 'agronomo-libreta',
    copy: [
      { kicker: 'GUÍA RÁPIDA', title: '3 formas de usar IA en el campo' },
      { kicker: 'PASO 01', title: 'Empezá por los datos que ya tenés', subtitle: 'Suelo, rinde, aplicaciones. No hace falta sensor nuevo.' },
      { kicker: 'PASO 02', title: 'Poné el modelo donde ya se trabaja', subtitle: 'Si hay que abrir otra app, no se usa.' },
      { kicker: 'PASO 03', title: 'Medí contra la decisión, no contra el modelo', subtitle: 'La métrica es si el agrónomo cambió lo que iba a hacer.' },
      { textBlocks: [
        { style: 'title', text: '¿Cuál vas a probar primero?' },
        { style: 'subtitle', text: 'Guardalo y compartilo con tu equipo' },
        { style: 'cta', text: 'Seguinos para más' },
      ] },
    ],
  },
  {
    id: 'caso',
    name: 'Caso de cliente',
    purpose: 'Contexto, resultado y la voz del cliente. Para probar que funciona.',
    slides: ['carrusel-portada', 'caso-cliente', 'dato', 'cita', 'carrusel-cierre'],
    design: { accent: 'emerald', scheme: 'deep' },
    foto: 'productor-tablet',
    copy: [
      { kicker: 'CASO', title: 'Cómo bajamos 70% el scouting en 4 meses' },
      { kicker: 'EL CONTEXTO', metric: '400', metricLabel: 'lotes en seis planillas distintas', subtitle: 'Los datos ya estaban. Nadie podía leerlos juntos.' },
      { kicker: 'EL RESULTADO', metric: '−70%', metricLabel: 'recorridas a campo, en 4 meses' },
      { quote: 'Se integraron en dos semanas y desde ahí no los tratamos como proveedor.', author: 'VP Product · Apeel Sciences' },
      { textBlocks: [
        { style: 'title', text: '¿Tenés un caso parecido?' },
        { style: 'subtitle', text: 'Contanos en qué estás y lo miramos juntos' },
        { style: 'cta', text: 'Agendá 30 minutos' },
      ] },
    ],
  },
  {
    id: 'webinar',
    name: 'Webinar / evento',
    purpose: 'Invitación, qué se lleva, quién lo da y cuándo.',
    slides: ['evento', 'tech-titular', 'tech-titular', 'retrato', 'carrusel-cierre'],
    design: { accent: 'emerald', scheme: 'ink' },
    copy: [
      { textBlocks: [
        { style: 'kicker', text: 'WEBINAR' },
        { style: 'title', text: 'IA en campo: del dato a la decisión', highlight: 'lime' },
        { style: 'subtitle', text: '11 de junio · 11hs ARG · en vivo por YouTube' },
        { style: 'cta', text: 'Inscribite gratis' },
      ] },
      { kicker: 'QUÉ TE LLEVÁS', title: 'Cómo leer un histórico de suelo sin ser agrónomo', subtitle: 'Con datos reales de campaña, no de demo.' },
      { kicker: 'QUÉ TE LLEVÁS', title: 'Qué proyectar y qué no', subtitle: 'Dónde el modelo ayuda y dónde todavía decide la persona.' },
      { quote: 'Nombre Apellido', author: 'Rol · Magoya' },
      { textBlocks: [
        { style: 'title', text: 'Anotate, es gratis' },
        { style: 'subtitle', text: 'Queda grabado, pero en vivo se pregunta' },
        { style: 'cta', text: 'magoya.com/ai-en-campo' },
      ] },
    ],
  },
]

// Arma las piezas de un carrusel: plantilla + copy calibrado + el mismo
// diseño en todas (que combinen es el punto).
//
// Y con la foto puesta. `placeholderContent` borra la foto a propósito —una
// pieza suelta la elige la persona—, pero acá eso hacía que el carrusel
// armado abriera desparejo: la portada en el esqueleto gris de "acá va una
// foto" y las otras cuatro ya con color. La primera impresión de lo que
// vendemos como "ya encarado" era un placeholder roto. Es la misma idea de
// `demoContent` en la galería, sólo que acá la foto la elige el preset: en
// una guía va alguien trabajando, en un caso va el cliente con la tablet.
function fotoDelPreset(preset) {
  const p = PHOTOS.find((x) => x.slug === preset.foto) || PHOTOS[0]
  return p ? { src: p.url, natural: null, focal: { x: 0.5, y: 0.5 } } : null
}

export function buildCarousel(preset) {
  return preset.slides.map((id, i) => {
    const t = TEMPLATES_BY_ID[id]
    if (!t) return null
    // el copy de una slide libre viaja en textBlocks; el de una clásica,
    // en roles. Cada plantilla lee el suyo.
    const copy = preset.copy?.[i] || {}
    const content = { ...placeholderContent(t), ...(preset.design || {}), ...copy }
    if (copy.textBlocks) content.textBlocks = copy.textBlocks.map((b) => ({ ...b }))
    if (t.surface === 'photo') {
      // La del preset GANA sobre la de muestra: placeholderContent ahora
      // trae una foto del banco por hash, pero la del preset la eligió
      // una persona para esta secuencia. Antes la guarda era
      // `!content.photo?.src` y con la muestra puesta el preset no
      // llegaba a aplicar la suya nunca.
      const foto = fotoDelPreset(preset)
      if (foto) content.photo = foto
    }
    return { template: t, content }
  }).filter(Boolean)
}
