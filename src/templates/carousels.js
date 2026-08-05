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
  {
    // ============================================================
    // "AI EN CAMPO · EDUCATIVO" — la pieza que Facu armó con GPT,
    // revisada con Aye (5/8) y corregida a marca:
    //   · verde-crema-negro-negro-crema-verde (el verde vivo de la pieza
    //     es el emerald de Magoya → esquema 'emerald'; el crema es el
    //     esquema 'cream' de siempre; el negro es el esquema 'ink' a
    //     sangre). Ronda 3 de Facu (5/8): "las que tienen negro no me
    //     gusta que sea un contenedor sobre otro" — las placas 3/4 eran
    //     una tarjeta negra sobre campo crema (silueta 'tarjeta' +
    //     siluetaCampo) y ahora son fondo negro pleno, la cita directo
    //     sobre la pieza. Es además más fiel a la pieza original. Con eso
    //     `siluetaCampo` quedó sin usuarios acá (el knob del motor queda:
    //     es genérico de la silueta tarjeta).
    //   · sin los "1/6" ("eso lo sacaría")
    //   · el lockup "AI en Campo" queda como logo de la serie
    //     (marks:aiencampo-ink/-cream) y CONVIVE con el wordmark real del
    //     kit, que es el que estaba mal en la pieza original. Ronda 2 de
    //     Facu (5/8): sin el "por Magoya" debajo (el wordmark ya está
    //     arriba) y siempre en la MISMA posición — alineado al margen
    //     izquierdo del texto, borde inferior a ~1334 de 1350. Ronda 3:
    //     sin el doble subrayado bajo el "en" (las rayitas del "AI"
    //     quedan); el viewBox recortado achica apenas el alto y la y de
    //     los lockups pasa de 0.912 a 0.913 para sostener ese borde.
    //   · la trama de circulitos se FUE (ronda 2: "los puntitos eliminalos";
    //     hay una lógica pendiente para puntitos+flecha — las flechas quedan)
    //   · comillas UNIFICADAS: el mismo glifo (") abre y cierra la cita —
    //     en la pieza original eran dos distintas
    //
    // ESCALA DE LA SERIE (ronda 2: "todos tienen distintos tamaños
    // tipográficos y contenedores, ajustalo"). TODOS los bloques llevan
    // `size` explícito: un tamaño elegido a mano no participa de
    // tamanoComun ni del auto-ajuste, así que la escala queda CLAVADA por
    // diseño y no depende de cuánto copy tenga cada placa.
    //   título portada/cierre  0.9   (85,5 px — abren y cierran más fuerte)
    //   título interno (2/5)   0.8   (76 px)
    //   cuerpo                 1     (32,4 px — también los steps de la 5,
    //                                 vía sizes.step = 32,4/38,9)
    //   cita corta (3)         0.9   (64,2 px — el mismo px de la ronda 2,
    //                                 que salía de 1 × el peso 0,9 de la
    //                                 tarjeta; sin tarjeta el 0,9 va
    //                                 explícito)
    //   cita larga (4)         0.495 (35 px: ídem, era 0,55 × 0,9; más
    //                                 chica pero mismo estilo, arriba del
    //                                 cuerpo, que para eso es la
    //                                 protagonista)
    //   kicker (3/4)           0.86  (26 px, entra en una línea en ambas)
    //   CTA/pill (2/6)         1     (43 px, pastillas idénticas)
    //
    // Este preset NO lleva `design` compartido a propósito: en los otros
    // carruseles el diseño único es lo que hace que las slides combinen,
    // pero esta serie alterna esquemas POR PLACA (decisión de la reunión)
    // y ese diseño ya viene puesto en los defaults de cada plantilla aiec-*.
    //
    // Los `steps` de la placa 5 tampoco viajan en el copy: viven en los
    // defaults de aiec-lista (que ya son el copy real). Pasarlos por acá
    // compartiría el MISMO array entre el preset y la pieza abierta
    // (buildCarousel clona textBlocks pero no steps) y editar la pieza
    // mutaría el preset.
    //
    // LÍMITES DEL MOTOR, verificados y decididos acá:
    //   · resaltado inline ("una palabra de este renglón") NO existe: el
    //     marcador y el color son POR BLOQUE. Por eso "prompt." y "en tu
    //     prompt" van como bloque propio resaltado, y los datos de la
    //     placa 4 (Pergamino, 15/11, RECSO…) van SIN resaltar dentro de
    //     la cita — resaltar la cita entera sería mentirle a la pieza.
    //     El cierre "Está en preguntar mejor." sí se resalta (bloque
    //     entero), en verde y no en negro: sobre el fondo negro un
    //     marcador negro no existe.
    // ============================================================
    id: 'aiencampo',
    name: 'AI en Campo · educativo',
    purpose: 'La serie educativa del ciclo: por qué la IA te contesta cualquier cosa y cómo preguntar mejor.',
    slides: ['aiec-portada', 'aiec-texto', 'aiec-cita', 'aiec-cita', 'aiec-lista', 'aiec-cierre'],
    copy: [
      { textBlocks: [
        { style: 'title', size: 0.9, text: 'Le preguntaste algo de tu lote a la IA y te contestó cualquier cosa.' },
        { style: 'title', size: 0.9, text: '¿Sabés por qué?' },
      ] },
      { textBlocks: [
        { style: 'title', size: 0.8, text: 'El problema fue el' },
        { style: 'title', size: 0.8, text: 'prompt.', highlight: 'ink' },
        { style: 'body', size: 1, text: 'Pensalo así: la IA es como alguien que leyó muchísimo, pero nunca pisó un lote.' },
        { style: 'body', size: 1, text: 'Sabe teoría, pero no conoce tu campo.' },
        { style: 'cta', size: 1, text: 'Eso se lo tenés que contar vos.', color: 'ink' },
      ] },
      { textBlocks: [
        { style: 'kicker', size: 0.86, text: 'Esto es lo que la mayoría pregunta' },
        { style: 'quote', size: 0.9, text: '"Para mi lote de soja del bajo, ¿qué fertilizante uso y con qué dosis?"' },
        { style: 'body', size: 1, text: 'El problema: faltan datos clave.' },
      ] },
      { textBlocks: [
        { style: 'kicker', size: 0.86, text: 'Esto es lo mismo, pero con contexto' },
        { style: 'quote', size: 0.495, text: '"Tengo un lote de soja de primera en Pergamino, sembrado el 15/11, teniendo en cuenta los resultados de la RECSO que te adjunto y con un análisis de suelo que marca 7 ppm de fósforo. Mi rinde objetivo es de 35 qq/ha. Decime qué fertilizante y dosis aplicar, en una tabla con producto, dosis y momento de aplicación."' },
        { style: 'body', size: 1, text: 'La diferencia no está en preguntar más.' },
        { style: 'body', size: 1, text: 'Está en preguntar mejor.', highlight: 'emerald' },
      ] },
      { textBlocks: [
        { style: 'title', size: 0.8, text: 'Los 4 elementos que no pueden faltar' },
        { style: 'title', size: 0.8, text: 'en tu prompt', highlight: 'ink' },
      ] },
      { textBlocks: [
        { style: 'title', size: 0.9, text: '¿Querés aprender a armar prompts que realmente te sirvan?' },
        { style: 'body', size: 1, text: 'En "AI en Campo", nuestro ciclo de webinars gratuitos, te mostramos cómo usar la IA con información real, mejores preguntas y criterio agronómico.' },
        { style: 'cta', size: 1, text: 'Sumate al próximo encuentro.', color: 'ink' },
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
