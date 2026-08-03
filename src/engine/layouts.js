// ============================================================
// LAYOUTS — composición responsiva por template.
// Un template declara: superficie (foto|solid), ancla del stack de
// texto, qué roles muestra, y toggles (motivo, zócalo, tratamiento).
// El engine reflowa a cualquier formato usando el rect seguro.
// Reglas de arte Magoya: equilibrio negro↔verde, foto B&N + acento,
// Manrope, marcas sutiles. Nunca un lienzo en blanco.
// ============================================================

import { safeRect } from '../formats/registry.js'
import { COLOR_SCHEMES, DEFAULT_SCHEME, ACCENTS, TEXT_STYLES, WORDMARKS, WORDMARK_RATIO, MOTIF_ESTRATOS, GRADIENTS, FONT_HAND_STACK, HIGHLIGHTS, TEXT_COLORS } from '../brand/brandKit.js'
import { ICONS_BY_ID, LIGHT_TILE, TILE_GRADIENT, GLYPH_GRADIENT, TILE_SHAPE, OFFSET_INK } from '../brand/iconLibrary.js'
import { getAsset, coloredIcon, gradientIcon } from './assets.js'
import { fitText, measure, wrapText } from './textLayout.js'
import { arrowPath, handArrowPath, sparklePath, calloutPath, barsRects, sparkline, windowChrome, dotsCircles } from './shapes.js'

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0))

// UN SOLO criterio de sombra para toda la app: la sombra se PIDE.
// Antes cada rama decidía distinto para un objeto sin la propiedad:
// la imagen y la ventana usaban `o.shadow !== false` (undefined = CON sombra)
// y la forma y el bocadillo usaban `o.shadow` (undefined = SIN sombra). La
// misma plantilla salía con sombra en un objeto y sin sombra en otro, y el
// toggle mostraba un estado que no era el que se dibujaba.
const conSombra = (o) => o.shadow === true

// luminancia relativa, para poder decidir contrastes sin adivinar
function lum(hex) {
  const h = String(hex || '#000').replace('#', '')
  if (h.length < 6) return 0
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

// El acento lo trae la plantilla, pero sobre los fondos verdes nuevos un
// acento verde desaparece (verde digital sobre verde digital). Si no se
// despega del fondo, gana el que el esquema define para sí mismo.
// `fondo` es el fondo REAL contra el que se va a ver, no siempre
// `scheme.surface`: con una tarjeta o una placa de acento el acento vive
// sobre la placa, y medir contra la superficie era medir otra pieza.
function acentoLegible(clave, scheme, fondo = scheme.surface) {
  const pedido = (ACCENTS[clave] || { value: scheme.accent }).value
  return ratio(pedido, fondo) >= 1.6 ? pedido : scheme.accent
}

// mezcla dos colores hex (t=0 → a, t=1 → b)
function mix(a, b, t) {
  const rgb = (h) => { const s = String(h || '#000').replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0) }
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b)
  const k = Math.max(0, Math.min(1, t))
  const c = (x, y) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}
// aleja `color` de `fondo` tirando hacia `hacia` hasta que se distingan.
// Es lo que evita que "teñir con el esquema" termine en dos verdes iguales
// pegados (el globo desaparecido sobre el papel del mismo tono).
function separar(color, fondo, min, hacia) {
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = mix(color, hacia, t)
    if (ratio(c, fondo) >= min) return c
  }
  return hacia
}

// ============================================================
// LOS CUATRO QUE DECIDEN UN COLOR CONTRA UN FONDO
//
// Antes esto estaba cableado a dos casos —sobre foto o sobre la superficie
// del esquema— y con cualquier tercera cosa abajo (una tarjeta, una banda,
// una placa de acento) el motor MENTÍA: seguía eligiendo el color como si
// el fondo fuera el de la pieza. Se midió: 389 pares de texto/fondo por
// debajo del mínimo legible en 1776 piezas (ver scripts/contraste.mjs).
//
// La regla ahora es una sola: nadie elige un color sin decir sobre QUÉ.
// `fondo === null` significa "abajo hay una foto": ahí no se puede medir
// nada y manda la regla de arte (blanco con scrim).
// ============================================================
const INK = '#0D0C0C'
const CREAM = '#F6F1EB'

// La tinta que MEJOR se lee sobre `fondo`, medida y no adivinada. Vivía
// adentro de `chatPalette` y era la única que acertaba: por umbral de
// luminancia, sobre el verde digital salía crema (1,6:1) teniendo negro a
// mano (10,5:1). Ahora la usa toda la app.
export function mejorTinta(fondo) {
  return ratio(INK, fondo) >= ratio(CREAM, fondo) ? INK : CREAM
}

// La tinta de MARCA sobre un fondo real. Se prefiere la del esquema porque
// es una decisión de arte (en crema la tinta es verde Magoya, no negra) y
// sólo se cambia cuando no llega al mínimo. Legibilidad primero, pero sin
// aplanar la paleta cuando no hace falta.
export function tintaSobre(fondo, scheme, min = 4.5) {
  if (!fondo) return '#FFFFFF'
  return ratio(scheme.onSurface, fondo) >= min ? scheme.onSurface : mejorTinta(fondo)
}

// El gris "suave" (autor, bajada, epígrafe). Salía del esquema y no del
// fondo real: el gris arena sobre la tarjeta arena daba 2,3:1 — el rol que
// menos se mira es el que primero se vuelve ilegible.
export function suaveSobre(fondo, scheme, tinta, min = 4.5) {
  if (!fondo) return 'rgba(255,255,255,.82)'
  const base = scheme.muted || tinta
  return ratio(base, fondo) >= min ? base : separar(base, fondo, min, tinta)
}

// Cualquier color que TIENE que verse sobre `fondo`: el acento como texto,
// la pastilla del CTA, el marcador, el color que elegiste a mano. Se
// conserva el tono y se lo empuja hacia la tinta lo mínimo indispensable.
export function visibleSobre(color, fondo, tinta, min = 3) {
  if (!color || !fondo) return color
  return ratio(color, fondo) >= min ? color : separar(color, fondo, min, tinta)
}

// El color de la PLACA (banda o tarjeta). Sobre foto, la superficie de
// marca contrasta sola. Sobre fondo sólido era `scheme.surface`, o sea
// EXACTAMENTE el color del fondo: "Texto en tarjeta" y "Texto en barra"
// dibujaban un rectángulo invisible en las 19 plantillas sólidas. Acá la
// placa se despega del fondo lo justo para leerse como una placa.
// Vive afuera de drawPiece porque el aviso de contraste de la UI
// (lib/copyCheck.js) tiene que medir contra la MISMA placa: mientras cada
// uno tenía su copia, la app avisaba de un fondo que no era el dibujado.
export function colorDePlaca(scheme, onPhoto) {
  return onPhoto
    ? scheme.surface
    : separar(mix(scheme.surface, scheme.onSurface, 0.1), scheme.surface, 1.22, scheme.onSurface)
}

// ¿este texto es display? Los titulares y las cifras tienen trazo grueso y
// aguantan 3:1; el texto chico necesita 4,5:1. Es el mismo corte que aplica
// el guard (scripts/contraste.mjs).
export function minTexto(px, weight, ref) {
  return (px >= ref * 0.03 || (px >= ref * 0.022 && weight >= 700)) ? 3 : 4.5
}

// ============================================================
// LA DECISIÓN DE COLOR DE UN BLOQUE, EN UN SOLO LUGAR
//
// Vivía adentro de `pintarBloque` y por eso el inspector no podía saber qué
// color iba a salir pintado: mostraba el swatch crudo mientras el motor
// empujaba el color por legibilidad. En la sesión del 3/8 eso se leyó como
// "los swatches mienten": Aye elegía Crema sobre una tarjeta clara y no
// pasaba nada visible, sin ninguna explicación. La regla no cambia —el color
// elegido a mano NUNCA gana contra la legibilidad— pero ahora la decisión es
// consultable: `colorEfectivo` devuelve lo que de verdad se pinta y si hubo
// ajuste, para que la UI lo DIGA en vez de dejar que parezca un bug.
//
// `role` acá es el estilo tipográfico (title, cta, …); `colorKey` es lo que
// eligió la persona ('auto' | 'accent' | 'strong' | 'muted' | clave de
// TEXT_COLORS); `hl` es el hex del marcador o null. `fondoBase` es lo que
// hay DEBAJO del bloque (null = foto, no se puede medir).
// ============================================================
function decidirColores({ role, colorKey, hl, px, weight }, fondoBase, scheme, accentTexto, ref) {
  const isCta = role === 'cta'
  // el mínimo depende del tamaño DIBUJADO, no del rol: un titular achicado
  // por falta de lugar dejó de ser display
  const min = minTexto(px, weight, ref)
  const tintaBase = tintaSobre(fondoBase, scheme, min)
  // 8 · el color elegido en un CTA pinta la PASTILLA, no la letra. Es lo que
  // cualquiera entiende por "el color del botón": antes la pastilla salía
  // SIEMPRE con el acento y la elección sólo llegaba a la letra, que encima
  // se volvía ilegible sobre la pastilla. La pastilla es una mancha: le
  // alcanza con despegarse 3:1 del fondo, igual que el marcador.
  const pedidoPastilla = isCta && colorKey && colorKey !== 'auto' ? (
    colorKey === 'accent' ? accentTexto
      : colorKey === 'strong' ? tintaBase
      : colorKey === 'muted' ? suaveSobre(fondoBase, scheme, tintaBase, min)
      : (TEXT_COLORS[colorKey] || {}).value || null
  ) : null
  const pastilla = isCta ? visibleSobre(pedidoPastilla || accentTexto, fondoBase, tintaBase, 3) : null
  const marcador = hl ? visibleSobre(hl, fondoBase, tintaBase, 3) : null
  // y el fondo REAL de las letras es la mancha cuando la hay
  const fondoLetra = pastilla || marcador || fondoBase
  const tinta = tintaSobre(fondoLetra, scheme, min)
  const suave = suaveSobre(fondoLetra, scheme, tinta, min)
  const acento = visibleSobre(accentTexto, fondoLetra, tinta, min)
  // El color elegido a mano gana… pero se tiene que ver: se conserva el tono
  // y se lo empuja hasta que se lee. Es la misma regla que ya se aplica al
  // acento; no hay motivo para que la elección de la persona sea la única
  // que la app no cuida. En el CTA la elección ya se fue a la pastilla.
  const elegidoCrudo = !isCta && colorKey && colorKey !== 'auto' ? (
    colorKey === 'accent' ? acento
      : colorKey === 'strong' ? tinta
      : colorKey === 'muted' ? suave
      : (TEXT_COLORS[colorKey] || {}).value || null
  ) : null
  const elegidoColor = elegidoCrudo ? visibleSobre(elegidoCrudo, fondoLetra, tinta, min) : null
  const fill = elegidoColor
    || (isCta || hl ? mejorTinta(fondoLetra)
    : role === 'kicker' || role === 'metric' ? acento
    : role === 'author' || role === 'subtitle' || role === 'metricLabel' ? suave
    : tinta)
  // lo que se pidió vs. lo que sale: el CTA se juzga por su pastilla,
  // el resto por la letra
  const pedido = isCta ? pedidoPastilla : elegidoCrudo
  const efectivo = isCta ? pastilla : fill
  return { fill, pastilla, marcador, fondoLetra, tinta, tintaBase, suave, acento, pedido, efectivo, ajustado: !!pedido && pedido !== efectivo }
}

// 10 · CONTRATO CON EL EDITOR: el color que DE VERDAD se pinta.
// `bloque` es el textBlock tal como lo guarda el editor ({ style, color,
// highlight, size }) o un rol clásico ({ role }); `fondo` es el fondo real
// detrás del texto (el `fondo` de `siluetaInfo`, o null sobre foto); `ctx`
// lleva el esquema y la CLAVE de acento de la pieza (content.accent).
// Devuelve { color, pastilla, marcador, pedido, ajustado }:
//   color     el hex que sale pintado (en un CTA, el de la pastilla)
//   pedido    lo que se había pedido antes del empuje (null si era 'auto')
//   ajustado  true si el motor tuvo que empujar el color para que se lea
// El px se aproxima con el tamaño de arranque del estilo: si el auto-ajuste
// achica el texto en el render, el corte display/no-display puede diferir en
// el borde — para el aviso "se ajustó para que se lea" alcanza y sobra.
export function colorEfectivo(bloque, fondo, { scheme, accent, ref = 1000 } = {}) {
  const role = bloque.style || bloque.role || 'body'
  const st = TEXT_STYLES[role] || TEXT_STYLES.body
  const px = ref * st.sizeRel * (Number(bloque.size) || 1)
  const accentTexto = acentoLegible(accent, scheme, fondo || scheme.surface)
  const hl = bloque.hl !== undefined ? bloque.hl : ((HIGHLIGHTS[bloque.highlight] || {}).value || null)
  const col = decidirColores({ role, colorKey: bloque.color, hl, px, weight: st.weight }, fondo, scheme, accentTexto, ref)
  return { color: col.efectivo, pastilla: col.pastilla, marcador: col.marcador, pedido: col.pedido, ajustado: col.ajustado }
}

// 9a/10 · CONTRATO CON EL EDITOR: el tinte que DE VERDAD lleva un objeto.
// Es el mismo empuje que hace `drawObjects` (el `seVe` de siempre): sólo se
// toca lo que de verdad no se distingue del fondo (< 1,2:1) y se lo separa
// hasta el 1,6 que ya usa `acentoLegible`. El inspector lo llama con el
// mismo fondo que recibe drawObjects (el campo de la pieza) para mostrar el
// swatch real y avisar del ajuste, en vez de que "elegir Blanco no haga nada".
export function tinteEfectivo(color, fondo) {
  if (!fondo || !color) return color
  return ratio(color, fondo) < 1.2 ? separar(color, fondo, 1.6, mejorTinta(fondo)) : color
}

// roles de texto en orden de stack
// `cta` faltaba: una plantilla clásica no podía tener botón, sólo las
// libres. Va último porque es el cierre del stack.
const STACK_ORDER = ['kicker', 'title', 'subtitle', 'body', 'metric', 'metricLabel', 'quote', 'author', 'cta']

// ---- Bloque B: ejes de composición ----
// densidad = cuánto aire respira el stack (gap entre bloques y ancho de línea)
const DENSITY = {
  compact: { gap: 0.68, w: 1.02 },
  normal: { gap: 1, w: 1 },
  roomy: { gap: 1.7, w: 0.84 },
}
// placa = qué hay DETRÁS del texto. Es el eje que más cambia la pieza.
const PLATES = ['none', 'scrim', 'band', 'card']

// ============================================================
// SILUETAS — el eje que sí se ve de lejos (BLOQUE S)
//
// Los cinco ejes de antes (plate, anchor, density, scale, rule) son todos
// SUB-LAYOUT: mueven el bloque de texto adentro de un marco que nunca
// cambia. Medido con scripts/siluetas.mjs a 128 px, que es el tamaño al que
// el feed decide: la mediana de "Centrado" era 9,9% de la pieza, la de "Con
// aire" 6,8% y la de "Etiqueta con línea" 0,2%. Lo que el ojo usa para decir
// "esto es otra cosa" —dónde están las masas claras y oscuras, cuánta pieza
// es tinta y cuánta imagen— no lo tocaba ninguno.
//
// Una silueta reparte las masas. La regla que la ordena y no se negocia:
// el ESQUEMA decide QUÉ colores hay, la SILUETA decide CUÁNTO de cada uno y
// DÓNDE. Ninguna silueta usa un color que el esquema no tenga — ya se probó
// que cambiar el esquema por slide rompe el carrusel en cinco marcas
// distintas y hace desaparecer el wordmark.
//
// Cada silueta devuelve una escena:
//   pintar(b)     las masas: arriba del fondo y de la viñeta, abajo del texto
//   caja          dónde vive el stack (reemplaza el rect seguro)
//   fondo         el color DETRÁS del texto (null = foto, no se puede medir)
//   campoEn(x,y)  qué color hay en un punto — para los bloques sueltos y el
//                 wordmark, que no viven en la caja del stack
//   pesos         multiplicador de tamaño por rol (lo usa Titular gigante)
//   anchoTexto    fracción de la caja que puede ocupar una línea
//   techo/lineas  hasta dónde puede crecer un bloque antes de achicarse
//
// Para agregar una: sumarla acá, sumarla a SILUETAS_UI en templates/
// variants.js y correr `node scripts/siluetas.mjs`. Si no cambia el 25% de
// los píxeles contra el Original, no entra al panel.
// ============================================================
export const SILUETAS = {
  // A SANGRE · no hay marco. Sobre foto se apaga el scrim y la mancha
  // oscura deja de estar abajo para estar en todos lados (la foto entera
  // baja un tono y el texto se apoya contra el borde). Sobre color, la
  // tinta del esquema inunda la pieza: la misma marca, al revés.
  sangre: ({ W, H, ref, onPhoto, p }) => {
    const campo = onPhoto ? null : p.scheme.onSurface
    const m = ref * 0.05
    return {
      pintar(b) {
        if (onPhoto) b.rect({ x: 0, y: 0, w: W, h: H, fill: INK, opacity: 0.34 })
        else b.rect({ x: 0, y: 0, w: W, h: H, fill: campo })
      },
      caja: { x: m, y: m, w: W - m * 2, h: H - m * 2 },
      fondo: campo,
      campoEn: () => campo,
      anchoTexto: 0.94,
      pesos: { title: 1.2, quote: 1.15, metric: 1.1 },
    }
  },

  // MEDIA PIEZA · la pieza partida por el medio: una mitad es la imagen (o
  // la tinta, si no hay foto) y la otra es papel con el texto. Es la
  // composición que más se repitió en las referencias de Aye e Inés, y la
  // única en la que el texto nunca compite con la imagen.
  // El corte es SIEMPRE horizontal, también en apaisado. Se probó partir la
  // pieza al medio a lo ancho y en los seis formatos horizontales el guard
  // se puso rojo de golpe (410 pares): un texto es una tira ancha y baja,
  // así que una línea vertical lo corta al medio y deja media palabra sobre
  // cada campo — y eso el color no lo arregla. Una línea horizontal, en
  // cambio, casi nunca cruza un renglón.
  mitad: ({ W, H, ref, onPhoto, p }) => {
    const corte = H * 0.5
    const papel = p.scheme.surface
    const masa = onPhoto ? null : p.scheme.onSurface
    const m = ref * 0.06
    return {
      pintar(b) {
        if (!onPhoto) {
          b.rect({ x: 0, y: 0, w: W, h: corte, fill: masa })
          // el motivo lo tapó la masa: se vuelve a dibujar ENCIMA, si no la
          // mitad de arriba queda como un rectángulo de color y nada más
          if (p.motif && MOTIF_ESTRATOS) {
            const mw = W * 0.46
            b.asset({ x: W - mw + W * 0.02, y: H * 0.04, w: mw, h: mw * (250 / 360), href: getAsset(MOTIF_ESTRATOS), opacity: 0.9 })
          }
        }
        b.rect({ x: 0, y: corte, w: W, h: H - corte, fill: papel })
      },
      caja: { x: m, y: corte + m, w: W - m * 2, h: H - corte - m * 2 },
      // el wordmark vive en la mitad de la imagen, no apretado contra el
      // último renglón del texto
      cajaLogo: { x: m, y: m, w: W - m * 2, h: corte - m * 2 },
      fondo: papel,
      campoEn: (x, y) => (y >= corte ? papel : masa),
      anchoTexto: 0.9,
      pesos: { title: 0.95, quote: 0.92 },
    }
  },

  // BLOQUE DE COLOR · el acento como MASA, no como detalle. Es la banda
  // llevada hasta donde tenía que llegar: media pieza de un solo color
  // pleno, a sangre, con el texto adentro. Sobre foto tapa la mitad de la
  // imagen a propósito: ahí está el cambio de silueta.
  bloque: ({ W, H, ref, p }) => {
    const masa = p.accent
    const caja0 = { x: 0, y: H * 0.54, w: W, h: H * 0.46 }
    const m = ref * 0.06
    return {
      pintar(b) { b.rect({ ...caja0, fill: masa }) },
      caja: { x: caja0.x + m, y: caja0.y + m, w: caja0.w - m * 2, h: caja0.h - m * 2 },
      // El wordmark NO va adentro del bloque. El motor lo pone en la punta
      // libre de la caja del texto, y acá esa caja es el bloque entero con el
      // stack centrado: la marca terminaba encima de la cita. Va arriba, en
      // el aire que deja el bloque, que además es donde tiene que estar.
      cajaLogo: { x: caja0.x + m, y: m, w: caja0.w - m * 2, h: caja0.y - m * 2 },
      fondo: masa,
      campoEn: (x, y) => (x >= caja0.x && y >= caja0.y ? masa : (p.surface === 'photo' ? null : p.scheme.surface)),
      anchoTexto: 0.92,
      pesos: { subtitle: 0.92 },
    }
  },

  // TITULAR GIGANTE · la tipografía como imagen. No hay masa de color: la
  // masa ES el titular, que ocupa la pieza y empuja a todo lo demás a un pie
  // chico. Sobre foto se baja la foto pareja para que el titular se lea
  // (sin eso, la mitad de las fotos se comen un titular blanco).
  gigante: ({ W, H, ref, onPhoto, p }) => {
    const m = ref * 0.035
    const campo = onPhoto ? null : p.scheme.surface
    return {
      pintar(b) { if (onPhoto) b.rect({ x: 0, y: 0, w: W, h: H, fill: INK, opacity: 0.42 }) },
      caja: { x: m, y: m, w: W - m * 2, h: H - m * 2 },
      fondo: campo,
      campoEn: () => campo,
      anchoTexto: 0.99,
      techo: 0.78,
      // el titular arranca ARRIBA DE TODO: el 12% de aire que el motor le
      // deja al ancla de arriba es justo lo contrario de lo que promete
      aire: 0,
      sinMotivo: true,
      lineas: { title: 6, quote: 6, metric: 2 },
      // a quién agrandar hasta llenar la caja, por orden de jerarquía
      llenar: ['title', 'quote', 'metric'],
      pesos: {
        title: 2.1, quote: 1.9, metric: 1.5,
        kicker: 0.85, subtitle: 0.68, body: 0.68, metricLabel: 0.8, author: 0.8, cta: 0.9, step: 0.75,
      },
    }
  },

  // TARJETA · toda la pieza adentro de una tarjeta, con el borde de la
  // tinta alrededor. No es la placa `card` (una cajita atrás del texto):
  // acá el marco es la pieza y la tarjeta es el escenario entero, así que
  // cambia el borde, el centro y el aire de una sola vez.
  tarjeta: ({ W, H, ref, onPhoto, p }) => {
    const m = ref * 0.085
    const pad = ref * 0.06
    const campo = onPhoto ? null : p.scheme.onSurface
    const papel = p.scheme.surface
    const card = { x: m, y: m, w: W - m * 2, h: H - m * 2 }
    return {
      pintar(b) {
        if (!onPhoto) b.rect({ x: 0, y: 0, w: W, h: H, fill: campo })
        b.rect({ ...card, rx: ref * 0.03, fill: papel })
      },
      caja: { x: card.x + pad, y: card.y + pad, w: card.w - pad * 2, h: card.h - pad * 2 },
      fondo: papel,
      campoEn: (x, y) => (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h ? papel : campo),
      anchoTexto: 0.92,
      pesos: { title: 0.92, quote: 0.9 },
    }
  },

  // RECUADRO · un marco grueso de acento y adentro la pieza intacta. Es la
  // silueta más barata de leer de lejos —el ojo ve el borde antes que
  // cualquier otra cosa— y la única que no toca el centro: sirve cuando la
  // plantilla ya tiene una composición armada adentro (un gráfico, dos
  // retratos, un collage) y moverla sería romperla.
  recuadro: ({ W, H, ref, onPhoto, p }) => {
    const t = ref * 0.085
    const pad = ref * 0.05
    const marco = p.accent
    const dentro = onPhoto ? null : p.scheme.surface
    return {
      pintar(b) {
        b.rect({ x: 0, y: 0, w: W, h: t, fill: marco })
        b.rect({ x: 0, y: H - t, w: W, h: t, fill: marco })
        b.rect({ x: 0, y: t, w: t, h: H - t * 2, fill: marco })
        b.rect({ x: W - t, y: t, w: t, h: H - t * 2, fill: marco })
        // adentro del marco la foto sigue siendo una foto: sin scrim el
        // texto queda librado a la suerte de la imagen que pongan
        if (onPhoto) b.scrim({ x: t, y: H * 0.45, w: W - t * 2, h: H * 0.55 - t, dir: 'bottom', to: 'rgba(0,0,0,0.68)' })
      },
      caja: { x: t + pad, y: t + pad, w: W - (t + pad) * 2, h: H - (t + pad) * 2 },
      fondo: dentro,
      campoEn: (x, y) => (x < t || y < t || x > W - t || y > H - t ? marco : dentro),
      anchoTexto: 0.94,
      pesos: { title: 0.95 },
    }
  },
}

function normalizePlate(v, template, onPhoto) {
  // 7 · el scrim es un degradé SOBRE LA FOTO: sin foto no hay nada que
  // sombrear y el motor dibujaba nada, en silencio. Un estilo que promete
  // algo que no puede dar es peor que no ofrecerlo: acá degrada a "sin
  // placa", que es exactamente lo que se ve, así el resto del motor (la
  // regla de acento, el color del texto) sabe la verdad.
  if (v === 'scrim' && !onPhoto) return 'none'
  if (PLATES.includes(v)) return v
  if (template.zocalo) return 'band'
  return onPhoto ? 'scrim' : 'none'
}

// Lo que hay que saber de una silueta SIN dibujar nada: el color que queda
// detrás del texto y cuánto agranda cada rol. Lo necesita el aviso de
// contraste de la UI (lib/copyCheck.js), que mide el mismo par que el motor:
// si mide contra la superficie del esquema cuando abajo hay un bloque de
// acento, avisa de una pieza que no existe. Es el error que ya se había
// cometido con las placas (389 pares medidos en U2); no hay motivo para
// repetirlo con las siluetas. La geometría es de mentira a propósito: el
// color y los pesos no dependen del formato.
export function siluetaInfo(id, { scheme, accent, onPhoto }) {
  const sil = SILUETAS[id]
  if (!sil) return null
  const esc = sil({ W: 1000, H: 1250, ref: 1000, onPhoto, p: { scheme, accent, surface: onPhoto ? 'photo' : 'solid' } })
  // `campo` = el color del CENTRO de la pieza, que es contra el que se ven
  // los objetos sueltos (drawObjects recibe exactamente esto). Lo necesita
  // el inspector para llamar a `tinteEfectivo` con el mismo fondo que el
  // motor y no avisar de un ajuste que no existe.
  return { fondo: esc.fondo, campo: esc.campoEn ? esc.campoEn(500, 625) : esc.fondo, pesos: esc.pesos || {} }
}

export function resolvePiece(template, content) {
  const d = template.defaults || {}
  const c = content || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = acentoLegible(c.accent || d.accent, scheme)
  const freeform = !!template.freeform
  // El fondo lo decide el usuario en CUALQUIER plantilla, no sólo en las
  // libres: "el estilo ese no tiene foto, es con fondo… pero debería poder
  // permitirte una vez que lo estás editando".
  const bg = c.bg || d.bg || null
  const propia = template.surface || (d.hasPhoto ? 'photo' : 'solid')
  const surface = bg === 'photo' ? 'photo' : bg === 'color' ? 'solid' : (freeform ? 'solid' : propia)
  const onPhoto = surface === 'photo'
  return {
    scheme,
    accent,
    freeform,
    surface,
    // ejes de composición (Bloque B) — los pisa la variante elegida
    plate: normalizePlate(c.plate ?? d.plate, template, onPhoto),
    // la silueta (Bloque S) no es un eje más: los otros cinco componen
    // ADENTRO del marco, ésta cambia el marco
    silueta: SILUETAS[c.silueta ?? d.silueta] ? (c.silueta ?? d.silueta) : null,
    density: DENSITY[c.density ?? d.density] ? (c.density ?? d.density) : 'normal',
    scale: Number(c.scale ?? d.scale) || 1,
    rule: c.rule ?? d.rule ?? 'top',
    anchor: c.anchor || template.anchor || 'bottom-left',
    motif: freeform ? false : template.motif !== false,
    zocalo: template.zocalo || false,
    roles: template.roles || (freeform ? [] : ['kicker', 'title', 'subtitle']),
    textBlocks: c.textBlocks || d.textBlocks || [],
    showLogo: c.showLogo !== undefined ? c.showLogo : d.showLogo !== false,
    logoPos: c.logoPos || d.logoPos || 'left',
    // 13 · la vertical del logo, elegible. 'auto' = la regla de siempre
    // (opuesto al stack de texto, o adentro de la banda): es un buen default
    // pero era el ÚNICO comportamiento, y en la sesión del 3/8 no hubo forma
    // de subir el logo sin mover todo lo demás.
    logoVPos: ['top', 'bottom'].includes(c.logoVPos || d.logoVPos) ? (c.logoVPos || d.logoVPos) : 'auto',
    logoScale: c.logoScale || d.logoScale || 1,
    // logo automático: lo decide el contraste con el fondo. Es la regla de
    // marca que menos debería depender del criterio de cada uno.
    logo: c.logo || d.logo || (onPhoto ? 'cream' : (COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]?.onSurface === '#0D0C0C' ? 'black' : 'cream')),
    // B&N es la regla de arte para las plantillas PENSADAS con foto. Si una
    // plantilla sólida recibe una foto porque la persona la puso, ponerla en
    // gris sin que nadie lo pida es una sorpresa, no una regla.
    treatment: c.treatment || d.treatment || (template.surface === 'photo' || d.hasPhoto ? 'bw' : 'color'),
    photo: c.photo || null,
    gradient: c.gradient !== undefined ? c.gradient : d.gradient || null,
    // posición libre por bloque de texto (eid → {x,y} relativo 0..1).
    // Los que no están acá van en el stack, como siempre.
    pos: c.pos || d.pos || null,
    objects: c.objects || d.objects || [],
    steps: c.steps || d.steps || [],
    sizes: c.sizes || d.sizes || null,
    // 8 · color por ROL (rol → clave de TEXT_COLORS), el gemelo de `sizes`.
    // Los textBlocks siempre tuvieron `color`; los roles clásicos no tenían
    // dónde enchufarlo, así que el CTA de una plantilla clásica no se podía
    // pintar ni queriendo.
    colors: c.colors || d.colors || null,
    vignette: c.vignette ?? d.vignette ?? 0,
    photoDim: c.photoDim ?? d.photoDim ?? 0,
    photoBlur: c.photoBlur ?? d.photoBlur ?? 0,
    handAccent: template.handAccent || false,
    text: {
      kicker: pick(c.kicker, d.kicker),
      title: pick(c.title, d.title),
      subtitle: pick(c.subtitle, d.subtitle),
      body: pick(c.body, d.body),
      metric: pick(c.metric, d.metric),
      metricLabel: pick(c.metricLabel, d.metricLabel),
      quote: pick(c.quote, d.quote),
      author: pick(c.author, d.author),
      // faltaba: sumé `cta` a STACK_ORDER pero no acá, así que una
      // plantilla clásica que declarara `cta` lo perdía sin decir nada
      // (le pasaba a "Foto al costado").
      cta: pick(c.cta, d.cta),
    },
  }
}
function pick(a, b) {
  return a !== undefined && a !== null ? a : b
}

// `sizeLock` = tamaño fijo por estilo, en px. Sirve para que en un carrusel
// el mismo rol mida IGUAL en todas las slides: si no, el auto-ajuste achica
// el texto según cuánto escribiste en cada una y la cita salta de 30 a 58 px
// entre la primera y la última. Se ve roto al scrollear.
export function drawPiece(b, { template, content, format, sizeLock = null }) {
  if (template.category === 'chat') { drawChat(b, { template, content, format }); return }
  const p = resolvePiece(template, content)
  const { w: W, h: H } = format
  const safe = safeRect(format)
  const ref = Math.min(W, H)
  // SPLIT: media pieza es foto y la otra media es color. Es la composición
  // que más se repitió en las referencias que mandaron Aye e Inés (foto a
  // un lado, texto al otro). Como el texto nunca cae encima de la imagen,
  // se lee sin scrim ni degradé, y el color lo sigue mandando el esquema.
  const split = template.split || null            // 'right' | 'left'
  const splitW = split ? W * (template.splitAt || 0.46) : 0
  const onPhoto = p.surface === 'photo' && !split
  if (split) {
    const pad = W * 0.055
    if (split === 'right') safe.w = Math.max(ref * 0.2, (W - splitW - pad) - safe.x)
    else { const nx = splitW + pad; safe.w = Math.max(ref * 0.2, safe.x + safe.w - nx); safe.x = nx }
  }
  const dens = DENSITY[p.density] || DENSITY.normal
  // La silueta se resuelve ACÁ —antes de medir nada— porque cambia la caja
  // donde vive el texto y los fondos contra los que se eligen los colores.
  // Se pinta más abajo (después del degradé y la viñeta, antes del stack).
  const esc = p.silueta ? SILUETAS[p.silueta]({ W, H, ref, safe, onPhoto, p }) : null
  if (esc?.caja) Object.assign(safe, esc.caja)
  // con placa opaca (banda/tarjeta) el texto vive sobre la superficie de
  // marca, no sobre la foto: el color tiene que seguir a la placa.
  const opaquePlate = (p.plate === 'band' || p.plate === 'card')
  const colorPlaca = colorDePlaca(p.scheme, onPhoto)
  // LOS DOS FONDOS QUE IMPORTAN. `null` = abajo hay foto y no se puede medir.
  //   fondoPieza → lo que hay en el lienzo (objetos, regla suelta, logo)
  //   fondoStack → lo que hay DETRÁS DEL TEXTO, que con placa NO es lo mismo
  // Con silueta el lienzo deja de ser de un solo color: `campoEn` contesta
  // punto por punto, y el "fondo de la pieza" pasa a ser el campo que rodea
  // al texto, que es contra el que se ven los objetos sueltos.
  const campoEn = esc?.campoEn || (() => (onPhoto ? null : p.scheme.surface))
  const fondoPieza = esc ? campoEn(W / 2, H / 2) : (onPhoto ? null : p.scheme.surface)
  const fondoStack = opaquePlate ? colorPlaca : (esc ? esc.fondo : fondoPieza)
  // El acento se elige contra el fondo del texto, no contra la superficie:
  // sobre una tarjeta clara el verde digital daba 1,8:1 y la volanta se
  // borraba. `p.accent` sigue siendo el de la pieza (lo usan los objetos).
  const accentTexto = acentoLegible(content?.accent || template.defaults?.accent, p.scheme, fondoStack || p.scheme.surface)

  // ---- superficie ----
  if (split) {
    b.rect({ x: 0, y: 0, w: W, h: H, fill: p.scheme.surface })
    b.imageCover({
      x: split === 'right' ? W - splitW : 0, y: 0, w: splitW, h: H,
      href: p.photo?.src, natural: p.photo?.natural, focal: p.photo?.focal,
      grayscale: p.treatment === 'bw',
      dim: p.photoDim, blur: p.photoBlur * (ref / 1000),
    })
  } else if (onPhoto) {
    b.imageCover({
      x: 0, y: 0, w: W, h: H,
      href: p.photo?.src, natural: p.photo?.natural, focal: p.photo?.focal,
      grayscale: p.treatment === 'bw',
      dim: p.photoDim, blur: p.photoBlur * (ref / 1000),
    })
  } else {
    b.rect({ x: 0, y: 0, w: W, h: H, fill: p.scheme.surface })
    // El motivo es una marca de agua: acompaña una composición, no compite
    // con ella. Con "Titular gigante" el titular pasa POR ENCIMA de los
    // estratos y las dos cosas se ensucian (se ve en la pieza, no en el
    // medidor: el medidor no pinta el motivo).
    if (p.motif && !esc?.sinMotivo && MOTIF_ESTRATOS) {
      const mw = W * 0.46
      const mh = mw * (250 / 360)
      b.asset({ x: W - mw + W * 0.02, y: H * 0.04, w: mw, h: mh, href: getAsset(MOTIF_ESTRATOS), opacity: 0.9 })
    }
  }

  // ---- degradé overlay (por encima del fondo) ----
  if (p.gradient && p.gradient.preset && GRADIENTS[p.gradient.preset]) {
    const g = GRADIENTS[p.gradient.preset]
    b.gradientOverlay({
      w: W, h: H,
      angle: p.gradient.angle ?? g.angle,
      stops: g.stops,
      opacity: p.gradient.opacity ?? 1,
    })
  }

  // ---- viñeta (sube el contraste del centro) ----
  if (p.vignette > 0) b.vignette({ w: W, h: H, strength: p.vignette })

  // ---- las masas de la silueta ----
  // Van después de la viñeta porque son OPACAS: una masa de color no se
  // oscurece en los bordes, es una decisión de composición y no una foto.
  if (esc) esc.pintar(b)

  // ---- stack de texto ----
  const blocks = []
  const maxTextW = safe.w * (esc ? esc.anchoTexto : (onPhoto && !opaquePlate ? 0.92 : 0.8)) * dens.w
  const pushBlock = (role, txt, opts = {}) => {
    if (txt === undefined || txt === null || String(txt).trim() === '') return
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const hand = role === 'kicker' && p.handAccent
    // tamaño elegido a mano (multiplicador por bloque o por rol)
    const elegido = opts.size || p.sizes?.[role] || null
    const manual = elegido || 1
    // el peso de la silueta multiplica ANTES del auto-ajuste: Titular
    // gigante no es "el mismo titular más grande", es otra jerarquía (el
    // titular al doble y todo lo demás a dos tercios)
    const peso = esc?.pesos?.[role] || 1
    const startPx = ref * st.sizeRel * (hand ? 1.9 : 1) * p.scale * manual * peso
    const value = (st.upper && !hand) ? String(txt).toUpperCase() : String(txt)
    const maxLines = esc?.lineas?.[role] ?? (role === 'title' || role === 'quote' ? 4 : role === 'kicker' || role === 'cta' ? 1 : 3)
    // Si elegiste un tamaño a mano, ese MANDA. Antes el auto-ajuste lo
    // deshacía apenas el texto era largo: "tamaño grande no me lo toma".
    // Ahora el texto baja de línea en vez de achicarse; el único techo es
    // que no se vaya de la pieza.
    const fijo = elegido ? startPx : (sizeLock && sizeLock[role])
    const family = hand ? FONT_HAND_STACK : undefined
    // 5 · la cifra y el botón NO se parten por caracteres. Cuando la columna
    // se angosta (una tarjeta, media pieza), "−70%" salía "−7" arriba y "0%"
    // abajo: deja de ser un número. Son unidades: o entran enteros o el
    // tamaño baja hasta que entren.
    const sinPartir = role === 'metric' || role === 'cta'
    const fitOpts = {
      weight: hand ? 700 : st.weight, tracking: hand ? 0 : (st.tracking || 0),
      maxWidth: maxTextW, family, sinPartir,
    }
    // `fitOpts` sale de acá y no al lado: el auto-ajuste de abajo y el
    // crecimiento de "Titular gigante" tienen que medir con EXACTAMENTE las
    // mismas opciones. Cuando estaban escritas dos veces, cambiar el peso o
    // el tracking en una sola dejaba las dos mediciones desalineadas y el
    // titular crecía contra un ancho que no era el suyo.
    const fit = fitText(value, {
      ...fitOpts,
      maxHeight: fijo ? H * 0.86 : H * (esc?.techo ?? 0.5), startPx: fijo || startPx,
      lineHeight: st.lineHeight || 1.15, maxLines: fijo ? 99 : maxLines,
    })
    blocks.push({ role, st, value, px: fit.px, lines: fit.lines, lineHeight: st.lineHeight || 1.15, hand, hl: opts.hl || null, color: opts.color || null, align: opts.align || null, eid: opts.eid || null, fijo: !!elegido, fitOpts })
  }
  // roles de la plantilla (piezas clásicas)
  for (const role of STACK_ORDER) {
    if (p.roles.includes(role)) pushBlock(role, p.text[role], { eid: `role:${role}`, color: p.colors?.[role] })
  }
  // bloques de texto sumados por el usuario (freeform / componentes)
  p.textBlocks.forEach((tb, idx) => {
    pushBlock(tb.style || 'title', tb.text, { hl: (HIGHLIGHTS[tb.highlight] || {}).value, color: tb.color, align: tb.align, eid: `tb:${idx}`, size: tb.size })
  })
  // pasos numerados (plantilla "método")
  ;(p.steps || []).forEach((st, idx) => {
    if (String(st || '').trim()) pushBlock('step', `${String(idx + 1).padStart(2, '0')}  ${st}`, { eid: `step:${idx}` })
  })

  // ---- bloques sueltos: los que la persona movió a mano ----
  // "el CTA está acá abajo y yo lo quería acá arriba, pero no me dejaba".
  // Un bloque con posición propia sale del stack y se dibuja donde lo
  // soltaste; el resto sigue apilándose como siempre.
  const posLibres = p.pos || {}
  const sueltos = blocks.filter((bl) => bl.eid && posLibres[bl.eid])
  const enStack = blocks.filter((bl) => !(bl.eid && posLibres[bl.eid]))

  // altura total del stack (con gaps proporcionales a la densidad)
  // 6 · CADA bloque entra solo (cada uno se auto-ajusta contra H*0.5), pero
  // NADIE medía el stack completo: con `roomy` los gaps crecen 70% y la
  // pila se sale por arriba de la pieza. No es hipotético, pasa hoy con la
  // cita larga en 4:5. Se recorta primero el aire —que es lo que sobra— y
  // recién después el tamaño, que es lo que duele.
  let gap = ref * 0.022 * dens.gap
  // El ancla arriba sobre color deja un 12% de aire antes de arrancar. Ese
  // aire NUNCA se descontaba del alto disponible: el stack se ajustaba
  // contra `safe.h` y después se lo empujaba 12% para abajo, así que se
  // salía por el pie. No saltaba porque ninguna composición llegaba a
  // llenar la caja; con "Titular gigante", que crece hasta llenarla, se
  // salían 40 líneas de 8 esquemas de una.
  const [vAnchor, hAnchor] = p.anchor.split('-')
  const aire = safe.h * (esc?.aire ?? ((vAnchor === 'top' && !onPhoto) ? 0.12 : 0))
  const dispo = safe.h - aire

  // TITULAR GIGANTE · el auto-ajuste sólo sabe ACHICAR: mide si el texto se
  // pasa y lo baja. Para que un titular SEA la pieza hace falta lo
  // contrario, crecer hasta llenar la caja, y eso no existía. Con un
  // multiplicador fijo el estilo dependía de cuánto habías escrito: la cita
  // corta de "Cita / testimonial" al 1,9× cambiaba el 19% de la pieza (o
  // sea, nada) y el titular largo de "Foto con titular" el 91%. Un estilo no
  // puede ser fuerte o imperceptible según el largo del copy.
  // Crece UN bloque —el de más jerarquía que haya— y el resto ya viene
  // achicado por los pesos de la silueta.
  if (esc?.llenar && enStack.length) {
    const bl = esc.llenar.map((r) => enStack.find((x) => x.role === r)).find(Boolean)
    // Si elegiste el tamaño a mano, ese manda: la silueta no te lo pisa.
    // El tamaño común del carrusel (`sizeLock`) SÍ se pisa: existe para que
    // una cita no salte de 30 a 58 px entre slides por casualidad, no para
    // impedir que una slide sea a propósito un titular gigante.
    if (bl && !bl.fijo) {
      const otros = enStack.reduce((s, x) => s + (x === bl ? 0 : x.lines.length * x.px * x.lineHeight), 0)
        + gap * Math.max(0, enStack.length - 1)
      // el wordmark vive en la punta libre de la MISMA caja: si el titular
      // crece hasta el borde, la marca le queda encima de la última línea
      const alturaLogo = ref * 0.24 * (p.logoScale || 1) / WORDMARK_RATIO
      const reservaLogo = (p.showLogo && !esc.cajaLogo) ? alturaLogo + ref * 0.03 : 0
      const techo = dispo * 0.98 - otros - reservaLogo
      const { weight, tracking, maxWidth, family, sinPartir } = bl.fitOpts
      const palabras = String(bl.value).split(/\s+/).filter(Boolean)
      for (let i = 0; i < 40; i++) {
        const px = Math.round(bl.px * 1.06) + 1
        // el techo de verdad es la palabra más larga: pasado ese punto el
        // wrap la parte al medio y "Desayuno" sale "Desayu / no". Un titular
        // gigante partido no es un titular gigante, es un error de imprenta.
        if (palabras.some((w) => measure(w, { px, weight, tracking, family }) > maxWidth)) break
        const lines = wrapText(bl.value, { px, weight, tracking, maxWidth, family, sinPartir })
        // una unidad (la cifra, el botón) crece hasta el ancho, no hasta el alto
        if (sinPartir && lines.some((l) => measure(l, { px, weight, tracking, family }) > maxWidth)) break
        if (lines.length * px * bl.lineHeight > techo) break
        bl.px = px; bl.lines = lines
      }
    }
  }

  const medirStack = () => {
    let h = 0
    enStack.forEach((bl, i) => {
      h += bl.lines.length * bl.px * bl.lineHeight
      if (i < enStack.length - 1) h += gap
    })
    return h
  }
  let stackH = medirStack()
  if (stackH > dispo && enStack.length) {
    const sobra = stackH - dispo
    // 1) el aire, hasta un piso del 35% (menos que eso ya no es un stack)
    gap = Math.max(gap * 0.35, gap - sobra / Math.max(1, enStack.length - 1))
    stackH = medirStack()
    // 2) si todavía no entra, se achica todo en proporción. Las líneas ya
    //    están partidas a un tamaño MAYOR, así que al achicar sólo sobra
    //    ancho: nunca aparece una línea nueva.
    if (stackH > dispo) {
      const k = dispo / stackH
      enStack.forEach((bl) => { bl.px = Math.max(8, bl.px * k) })
      gap *= k
      stackH = medirStack()
    }
  }
  let stackW = 0
  enStack.forEach((bl) => {
    const wgt = bl.hand ? 700 : bl.st.weight
    const trk = bl.hand ? 0 : (bl.st.tracking || 0)
    const fam = bl.hand ? FONT_HAND_STACK : undefined
    bl.lines.forEach((ln) => { stackW = Math.max(stackW, measure(ln, { px: bl.px, weight: wgt, tracking: trk, family: fam })) })
  })

  // posición del stack según ancla
  let cursorY
  if (vAnchor === 'bottom') cursorY = safe.y + safe.h - stackH
  else if (vAnchor === 'center') cursorY = safe.y + (safe.h - stackH) / 2
  else cursorY = safe.y + aire
  // el techo es el margen seguro: con el ancla abajo o al centro, un stack
  // alto empujaba el arranque a coordenadas negativas y la volanta quedaba
  // fuera del lienzo
  cursorY = Math.max(safe.y, cursorY)
  const textX = hAnchor === 'center' ? W / 2 : safe.x
  const textAnchor = hAnchor === 'center' ? 'middle' : 'start'

  // ---- PLACA: qué hay detrás del texto (eje `plate` del Bloque B) ----
  const ruleH = Math.max(3, ref * 0.006)
  let plateRect = null // si hay placa opaca, el logo entra ADENTRO (B4)
  // si moviste TODOS los bloques a mano no queda stack: la placa dibujaría
  // una tarjeta vacía de alto cero
  // la regla de acento se ve SOBRE LA PLACA, no sobre la superficie: es una
  // mancha, así que le alcanza con 3:1
  const reglaSobrePlaca = visibleSobre(accentTexto, fondoStack, tintaSobre(fondoStack, p.scheme, 3), 3)
  // la regla "sobre la pieza" se dibuja pegada al stack: con silueta el
  // stack no está sobre la superficie sino sobre el campo de la silueta
  const fondoRegla = esc ? esc.fondo : fondoPieza
  const reglaSobrePieza = visibleSobre(p.accent, fondoRegla, tintaSobre(fondoRegla, p.scheme, 3), 3)
  // Dónde caen los bloques que la persona movió a mano. La regla se dibuja
  // pegada al stack y ellos están en coordenadas fijas: cuando el ancla
  // manda el stack abajo, la barra verde termina cruzada por el epígrafe de
  // otro bloque (le pasa a Quiénes hablan en los formatos apaisados). Antes
  // de pintar una regla se mira si pisa a alguien: el motor puede colisionar
  // con la plantilla, pero no consigo mismo.
  const cajasSueltas = sueltos.map((bl) => {
    const pt = posLibres[bl.eid]
    const wgt = bl.hand ? 700 : bl.st.weight
    const trk = bl.hand ? 0 : (bl.st.tracking || 0)
    const fam = bl.hand ? FONT_HAND_STACK : undefined
    const w = Math.max(...bl.lines.map((ln) => measure(ln, { px: bl.px, weight: wgt, tracking: trk, family: fam })))
    const x = clamp01(pt.x) * W
    return { x: pt.anchor === 'middle' ? x - w / 2 : x, y: clamp01(pt.y) * H, w, h: bl.lines.length * bl.px * bl.lineHeight }
  })
  const pisaUnSuelto = (r) => cajasSueltas.some((c) =>
    !(c.x > r.x + r.w || c.x + c.w < r.x || c.y > r.y + r.h || c.y + c.h < r.y))
  if (!enStack.length) { /* sin stack no hay placa */ } else if (p.plate === 'band') {
    // banda de ancho completo que baja hasta el borde (el clásico zócalo)
    const pad = ref * 0.045
    const by = cursorY - pad
    // La banda baja hasta el borde SÓLO si el texto está abajo. Con el
    // ancla arriba iba desde el tope hasta el pie y se comía la pieza
    // entera — en las plantillas con zócalo, elegir "Arriba" hacía
    // desaparecer la foto. Ahí la banda envuelve el texto y nada más.
    const alPie = vAnchor === 'bottom'
    const alto = alPie ? H - by : stackH + pad * 2
    plateRect = { x: 0, y: by, w: W, h: alto, textW: stackW }
    b.rect({ ...plateRect, fill: colorPlaca, opacity: onPhoto ? 0.94 : 1 })
    const rBanda = { x: safe.x, y: by, w: ref * 0.12, h: ruleH }
    if (p.rule !== 'none' && !pisaUnSuelto(rBanda)) b.rect({ ...rBanda, fill: reglaSobrePlaca })
  } else if (p.plate === 'card') {
    // tarjeta ajustada al texto: la variante más "editorial"
    const padX = ref * 0.05, padY = ref * 0.045
    const cx0 = hAnchor === 'center' ? W / 2 - stackW / 2 : textX
    plateRect = {
      x: Math.max(ref * 0.02, cx0 - padX), y: cursorY - padY,
      w: Math.min(W - ref * 0.04, stackW + padX * 2), h: stackH + padY * 2,
    }
    b.rect({ ...plateRect, rx: ref * 0.028, fill: colorPlaca, opacity: onPhoto ? 0.95 : 1 })
    if (!onPhoto) b.rect({ x: plateRect.x, y: plateRect.y, w: plateRect.w, h: ruleH, rx: ruleH / 2, fill: reglaSobrePlaca })
  } else if (p.plate === 'scrim' && onPhoto) {
    b.scrim({ x: 0, y: H * 0.4, w: W, h: H * 0.6, dir: 'bottom', to: 'rgba(0,0,0,0.68)' })
  }
  // regla de acento arriba del stack (sólo si no la puso ya la placa)
  if (p.rule === 'top' && p.plate === 'none') {
    const rTop = { x: hAnchor === 'center' ? W / 2 - ref * 0.06 : safe.x, y: cursorY - gap, w: ref * 0.12, h: ruleH }
    if (!pisaUnSuelto(rTop)) b.rect({ ...rTop, fill: reglaSobrePieza })
  }

  // ---- objetos DETRÁS del texto (profundidad) ----
  // V2a · cada objeto viaja con su índice REAL en content.objects (`_i`):
  // los textos que dibuja una forma (etiqueta, bocadillo, ventana) llevan
  // data-eid "obj:<i>:<campo>" y el editor resuelve por ese índice. Sin
  // esto el eid apuntaría al índice DENTRO del filtro front/back, que no
  // es el del objeto — editarías el texto de otro elemento.
  const objsIdx = (p.objects || []).map((o, i) => ({ ...o, _i: i }))
  drawObjects(b, { objects: objsIdx.filter((o) => !o.front), W, H, ref, accent: p.accent, scheme: p.scheme, fondo: fondoPieza })

  // dibujar un bloque en (x, y). Devuelve cuánto ocupó en alto.
  // `fondoBase` es lo que hay DEBAJO de este bloque: la placa si está en el
  // stack, la pieza si lo moviste afuera. Todos los colores del bloque se
  // deciden contra eso y no contra el esquema.
  const pintarBloque = (bl, textX, cursorY, textAnchor, fondoBase = fondoStack) => {
    const isKicker = bl.role === 'kicker'
    const isCta = bl.role === 'cta'
    const weight = bl.hand ? 700 : bl.st.weight
    const tracking = bl.hand ? 0 : (bl.st.tracking || 0)
    // Toda la decisión de color vive en `decidirColores`, que es LA MISMA
    // función que consulta el inspector vía `colorEfectivo`: si esto y lo
    // que muestra la UI se calculan en dos lugares, los swatches vuelven a
    // mentir tarde o temprano (ya pasó con las placas y con copyCheck).
    const { pastilla, marcador, fondoLetra, tintaBase, fill } = decidirColores(
      { role: bl.role, colorKey: bl.color, hl: bl.hl, px: bl.px, weight },
      fondoBase, p.scheme, accentTexto, ref,
    )

    // fondo del texto: CTA (pill acento) o resaltado (marcador).
    // Geometría basada en la línea de base real que usa b.text (y + px*0.8).
    const lineH = bl.px * bl.lineHeight
    const CAP = 0.72 // altura de mayúscula aprox (Manrope)
    if (isCta || bl.hl) {
      const bgFill = pastilla || marcador
      const padX = bl.px * (isCta ? 0.7 : 0.24)
      const padY = bl.px * (isCta ? 0.42 : 0.14)
      bl.lines.forEach((ln, li) => {
        const w = measure(ln, { px: bl.px, weight, tracking, family: bl.hand ? FONT_HAND_STACK : undefined })
        const baseline = cursorY + bl.px * 0.8 + li * lineH
        const glyphTop = baseline - bl.px * CAP
        const rh = bl.px * CAP + bl.px * 0.14 + padY * 2 // cap + descendente + aire
        const ry0 = glyphTop - padY
        const rx0 = textAnchor === 'middle' ? textX - w / 2 - padX : textX - padX
        b.rect({ x: rx0, y: ry0, w: w + padX * 2, h: rh, rx: isCta ? rh / 2 : bl.px * 0.12, fill: bgFill })
      })
    }

    b.text({
      x: textX, y: cursorY, lines: bl.lines, px: bl.px,
      weight, fill, anchor: textAnchor,
      tracking, lineHeight: bl.lineHeight,
      fontFamily: bl.hand ? FONT_HAND_STACK : undefined,
      eid: bl.eid,
    })
    // B4 · lockup "volanta con línea": la regla sale AL LADO de la volanta,
    // no arriba del stack. Sube mucho el nivel editorial y no mueve el texto.
    if (isKicker && p.rule === 'side' && textAnchor !== 'middle') {
      const kw = measure(bl.lines[0] || '', { px: bl.px, weight, tracking, family: bl.hand ? FONT_HAND_STACK : undefined })
      const lx = textX + kw + bl.px * 0.7
      const lw = Math.min(ref * 0.16, Math.max(0, safe.x + safe.w - lx))
      if (lw > ref * 0.02) b.rect({ x: lx, y: cursorY + bl.px * 0.5, w: lw, h: Math.max(2, ref * 0.004), fill: visibleSobre(accentTexto, fondoBase, tintaBase, 3) })
    }
    return bl.lines.length * lineH + gap + (isCta ? bl.px * 0.5 : 0)
  }

  // el stack, como siempre
  // 7 · CONTRATO CON EL EDITOR: `textBlock.align: 'left' | 'center'`
  // (opcional). El anchor de la plantilla sigue mandando el stack ENTERO;
  // este campo alinea las líneas de UN bloque adentro de la caja. Nació en
  // la sesión del 3/8: el ancla era de todo el stack y no había forma de
  // centrar sólo el título dejando el resto a la izquierda. Se calcula
  // contra `safe` y no contra W/2 porque con split o silueta la caja del
  // texto no está centrada en la pieza.
  for (const bl of enStack) {
    const tx = bl.align === 'center' ? safe.x + safe.w / 2 : bl.align === 'left' ? safe.x : textX
    const ta = bl.align === 'center' ? 'middle' : bl.align === 'left' ? 'start' : textAnchor
    cursorY += pintarBloque(bl, tx, cursorY, ta)
  }
  // y los que están sueltos, cada uno donde lo dejaron. Se dibujan al
  // final para que queden por encima de la placa y del stack.
  // Un bloque suelto NO está sobre la placa (salvo que lo hayas soltado
  // justo encima): su fondo es la pieza, y con el color de la placa se
  // decidía mal — ése es el mismo error de fondo del punto 1.
  sueltos.forEach((bl, i) => {
    const pt = posLibres[bl.eid]
    const bx = clamp01(pt.x) * W, by = clamp01(pt.y) * H
    const dentro = plateRect && bx >= plateRect.x && bx <= plateRect.x + plateRect.w
      && by >= plateRect.y && by <= plateRect.y + plateRect.h
    // Sobre qué campo se decide el color: el del CENTRO del bloque, no el de
    // su esquina. Con una silueta el lienzo tiene dos colores y la esquina
    // miente: los nombres de "Quiénes hablan" arrancan en x=0,07 y el marco
    // de "Recuadro" llega hasta 0,085, así que el motor elegía la tinta del
    // marco para un texto que en realidad está adentro (y salía a 1,2:1).
    const c = cajasSueltas[i]
    pintarBloque(bl, bx, by, pt.anchor === 'middle' ? 'middle' : 'start',
      dentro ? colorPlaca : campoEn(c.x + c.w / 2, c.y + c.h / 2))
  })

  // ---- logo ----
  // El wordmark lo elige la plantilla, pero la silueta puede haber puesto
  // OTRO color justo abajo (el borde de la tarjeta, el marco de acento, la
  // tinta inundada): un logo negro sobre el campo de tinta no queda sutil,
  // queda invisible. La silueta es una decisión de arte explícita, así que
  // manda el contraste con lo que quedó abajo.
  if (p.showLogo) {
    const cajaLogo = esc?.cajaLogo || safe
    // drawLogo pone la marca en la punta OPUESTA al stack: con el stack
    // abajo (el bloque), 'bottom' la manda arriba de su caja, que es donde va
    const vLogo = esc?.cajaLogo ? 'bottom' : vAnchor
    // el color del campo se mide EN DONDE va a estar el logo: si la persona
    // eligió la vertical (13), la medición la sigue — medir la otra punta es
    // volver a elegir tinta contra un fondo que no es el del logo
    const logoArriba = p.logoVPos === 'top' ? true : p.logoVPos === 'bottom' ? false : vLogo !== 'top'
    drawLogo(b, {
      p, W, H, safe: cajaLogo, ref, textAnchor, hAnchor, vAnchor: vLogo, plateRect,
      campoLogo: esc ? campoEn(cajaLogo.x, logoArriba ? cajaLogo.y : cajaLogo.y + cajaLogo.h) : undefined,
    })
  }

  // ---- objetos DELANTE del texto (profundidad) ----
  drawObjects(b, { objects: objsIdx.filter((o) => o.front), W, H, ref, accent: p.accent, scheme: p.scheme, fondo: fondoPieza })
}

// Qué tamaño le toca a cada estilo en esta pieza, sin dibujar nada.
// Con esto se calcula el tamaño común de un carrusel: el MÍNIMO entre las
// slides, que es el único que entra en todas.
export function medirPieza(template, content, format) {
  if (template.category === 'chat') return {}
  const p = resolvePiece(template, content)
  const { w: W, h: H } = format
  const safe = safeRect(format)
  const ref = Math.min(W, H)
  const onPhoto = p.surface === 'photo'
  const dens = DENSITY[p.density] || DENSITY.normal
  const opaquePlate = (p.plate === 'band' || p.plate === 'card')
  // el tamaño común del carrusel se mide con la MISMA caja y los MISMOS
  // pesos que va a usar el dibujo: si no, una slide con silueta queda
  // clavada al tamaño de una pieza que no es la suya
  const esc = p.silueta ? SILUETAS[p.silueta]({ W, H, ref, safe, onPhoto, p }) : null
  if (esc?.caja) Object.assign(safe, esc.caja)
  const maxTextW = safe.w * (esc ? esc.anchoTexto : (onPhoto && !opaquePlate ? 0.92 : 0.8)) * dens.w
  const out = {}
  const medir = (role, txt, size) => {
    if (txt === undefined || txt === null || String(txt).trim() === '') return
    const st = TEXT_STYLES[role] || TEXT_STYLES.body
    const hand = role === 'kicker' && p.handAccent
    const elegido = size || p.sizes?.[role] || null
    if (elegido) return            // no participa del tamaño común
    const startPx = ref * st.sizeRel * (hand ? 1.9 : 1) * p.scale * (esc?.pesos?.[role] || 1)
    const value = (st.upper && !hand) ? String(txt).toUpperCase() : String(txt)
    const maxLines = esc?.lineas?.[role] ?? (role === 'title' || role === 'quote' ? 4 : role === 'kicker' || role === 'cta' ? 1 : 3)
    const fit = fitText(value, {
      weight: hand ? 700 : st.weight, tracking: hand ? 0 : (st.tracking || 0),
      maxWidth: maxTextW, maxHeight: H * (esc?.techo ?? 0.5), startPx,
      lineHeight: st.lineHeight || 1.15, maxLines,
    })
    out[role] = Math.min(out[role] ?? Infinity, fit.px)
  }
  for (const role of STACK_ORDER) if (p.roles.includes(role)) medir(role, p.text[role])
  ;(p.textBlocks || []).forEach((tb) => medir(tb.style || 'title', tb.text, tb.size))
  return out
}

// El tamaño común de un carrusel: por estilo, el más chico de todas las
// slides. Es el único que entra en la que más texto tiene.
export function tamanoComun(slides, format) {
  const lock = {}
  for (const s of slides || []) {
    const m = medirPieza(s.template, s.content, format)
    for (const [k, v] of Object.entries(m)) lock[k] = Math.min(lock[k] ?? Infinity, v)
  }
  return lock
}

// ---- paleta del chat, derivada del esquema ----
// El chat se dibujaba SIEMPRE igual: papel #E7E0D6, header #0F5132, globo
// propio #DCF8C6, recibido blanco. Elegías el esquema y sólo cambiaba el
// borde de la pieza (menos del 6% de los píxeles). Ahora todo sale de
// `scheme` + acento, pero con la MISMA estructura de WhatsApp (papel,
// barra oscura arriba, globo propio teñido a la derecha, recibido a la
// izquierda) y con los contrastes forzados para que nada se funda.
// `globoElegido` (9b, sesión del 3/8): el color del globo propio, elegido a
// mano. Hasta ahora chatPalette decidía TODO y el editor no tenía dónde
// enchufar una elección: era la única burbuja de la app sin control de
// color. Acepta 'accent' o un hex; null = la regla de siempre.
function chatPalette(scheme, accent, globoElegido = null) {
  // `mejorTinta` nació acá adentro y era la única que acertaba. Ahora vive
  // arriba y la usa toda la app (punto 1 del BLOQUE S).
  const fondo = scheme.surface
  const oscura = lum(fondo) < 0.2
  // Cuánto color tiene un tono (0 = gris, 1 = puro). Hace falta por los dos
  // esquemas donde la superficie ES el verde —"Verde digital" y "Lime"—: ahí
  // el papel salía del mismo verde de la pieza y, como el acento cae al verde
  // profundo para poder verse, el globo propio salía casi negro. El chat se
  // volvía un cartel verde con dos cajas oscuras y perdía lo único que hace
  // que esta plantilla se entienda de un vistazo, que es parecerse a
  // WhatsApp. Esa referencia son tres cosas y ninguna es el color de marca:
  // papel casi neutro, globo propio VERDE a la derecha, recibido casi blanco.
  // El fondo de la pieza sigue siendo el del esquema; el que se calma es el
  // panel, que es donde vive la referencia.
  const croma = (hex) => {
    const s = String(hex || '#000').replace('#', '')
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0)
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255
  }
  const vivo = croma(fondo) > 0.35
  // el "papel" del chat: sobre fondos oscuros es un crema teñido con el
  // esquema (el wallpaper claro de WhatsApp); sobre fondos claros baja un
  // tono para que el panel no se funda con la pieza. 1.25 es a propósito
  // poco: es el mismo salto que hay en WhatsApp entre el globo blanco y su
  // fondo beige. Si se pide más, la crema y la arena se vuelven barro gris.
  const haciaPapel = (oscura || vivo) ? '#F6F1EB' : scheme.onSurface
  const papel = separar(mix(fondo, haciaPapel, oscura ? 0.86 : vivo ? 0.8 : 0.12), fondo, 1.25, haciaPapel)
  const papelClaro = mejorTinta(papel) === '#0D0C0C'
  const tinta = papelClaro ? '#0D0C0C' : '#F6F1EB'
  // barra de arriba: el tono más profundo de la familia, con una pizca de
  // acento para que no sea el mismo color plano que el fondo de la pieza.
  const profundo = lum(fondo) <= lum(scheme.onSurface) ? fondo : scheme.onSurface
  const header = separar(mix(profundo, accent, 0.16), papel, 3, papelClaro ? '#0D0C0C' : '#F6F1EB')
  // globo propio = el verde de la pieza (es LA regla del chat de WhatsApp).
  // Casi siempre ese verde es el acento, pero cuando la superficie ya es el
  // verde el acento cae al tono profundo para poder verse encima, y el globo
  // se iba a negro. Gana el que TIENE más color de los dos, no el que se
  // llama acento.
  // Recibido = el papel empujado al extremo (blanco sobre papel claro,
  // gris oscuro sobre papel oscuro).
  // El elegido a mano gana sobre la regla del "verde con más color"… pero
  // no sobre la legibilidad: pasa por el MISMO `separar` que el automático,
  // así el globo nunca se funde con el papel (y si se empujó, el editor lo
  // puede contar comparando contra `bubbleTint`).
  const verdeGlobo = (globoElegido === 'accent' ? accent : globoElegido)
    || (croma(fondo) > croma(accent) ? fondo : accent)
  const mio = separar(verdeGlobo, papel, 1.35, tinta)
  const otro = separar(mix(papel, papelClaro ? '#FFFFFF' : '#0D0C0C', 0.6), papel, 1.25, papelClaro ? '#FFFFFF' : '#0D0C0C')
  // el avatar tiene que verse SOBRE el header: si el acento se le parece
  // (verde sobre verde), se usa el papel.
  const avatar = ratio(accent, header) >= 1.8 ? accent : papel
  const tintaHeader = mejorTinta(header)
  return {
    papel, header, mio, otro, avatar,
    tintaAvatar: mejorTinta(avatar),
    tintaMia: mejorTinta(mio),
    tintaOtro: mejorTinta(otro),
    tintaHeader,
    tintaHeaderSuave: mix(tintaHeader, header, 0.3),
  }
}

// 9b · CONTRATO CON EL EDITOR: la paleta del chat que DE VERDAD se pinta.
// El inspector necesita dos cosas que hasta ahora vivían encerradas acá:
//   · `mio` — el color real del globo propio, para avisar si el elegido a
//     mano se empujó por legibilidad (mismo patrón que colorEfectivo);
//   · `papel` — el fondo sobre el que caen los objetos de una pieza de chat,
//     para que tinteEfectivo mida contra el fondo que usa drawObjects.
// Resuelve esquema, acento y bubbleTint igual que drawChat: si esto y el
// dibujo se calculan distinto, los swatches vuelven a mentir.
export function paletaChat(content, template) {
  const c = content || {}
  const d = template?.defaults || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = acentoLegible(c.accent || d.accent, scheme)
  return { ...chatPalette(scheme, accent, c.bubbleTint ?? d.bubbleTint ?? null), accent }
}

// ---- renderer de chat (WhatsApp) ----
function drawChat(b, { template, content, format }) {
  const { w: W, h: H } = format
  const ref = Math.min(W, H)
  const c = content || {}
  const d = template.defaults || {}
  const scheme = COLOR_SCHEMES[c.scheme || d.scheme || DEFAULT_SCHEME]
  const accent = acentoLegible(c.accent || d.accent, scheme)
  const objects = c.objects || d.objects || []
  const messages = c.messages || d.messages || []
  const chatName = c.chatName ?? d.chatName ?? 'Magoya'
  const chatStatus = c.chatStatus ?? d.chatStatus ?? 'en línea'

  // fondo de marca
  b.rect({ x: 0, y: 0, w: W, h: H, fill: scheme.surface })

  // degradé y viñeta son de la PIEZA, no de la foto: el chat también los usa
  const grad = c.gradient !== undefined ? c.gradient : d.gradient || null
  if (grad && grad.preset && GRADIENTS[grad.preset]) {
    const g = GRADIENTS[grad.preset]
    b.gradientOverlay({ w: W, h: H, angle: grad.angle ?? g.angle, stops: g.stops, opacity: grad.opacity ?? 1 })
  }

  // toda la paleta del chat sale del esquema elegido; `bubbleTint` (opcional,
  // 'accent' o hex) pisa el color del globo propio — CONTRATO CON EL EDITOR
  const pal = chatPalette(scheme, accent, c.bubbleTint ?? d.bubbleTint ?? null)

  // panel del chat (el "papel" / wallpaper)
  const px = W * 0.06, py = H * 0.055, pw = W * 0.88, ph = H * 0.89
  const R = ref * 0.045
  b.rect({ x: px, y: py, w: pw, h: ph, fill: pal.papel, rx: R })

  // header
  const hh = ref * 0.13
  b.rect({ x: px, y: py, w: pw, h: hh, fill: pal.header, rx: R })
  b.rect({ x: px, y: py + hh - R, w: pw, h: R, fill: pal.header }) // cuadrar la base del header
  // avatar
  const av = hh * 0.58, avx = px + ref * 0.03, avy = py + (hh - av) / 2
  b.rect({ x: avx, y: avy, w: av, h: av, fill: pal.avatar, rx: av / 2 })
  // la "m" del avatar NO lleva eid a propósito: es el monograma de la
  // marca, no un texto que alguien escribió — editarla no tiene sentido
  b.text({ x: avx + av / 2, y: avy + av * 0.24, lines: ['m'], px: av * 0.52, weight: 800, fill: pal.tintaAvatar, anchor: 'middle' })
  // V2a · nombre y estado se editan con doble click sobre la pieza, como
  // cualquier otro texto: el editor resuelve estos eids a chatName/chatStatus
  b.text({ x: avx + av + ref * 0.022, y: py + hh * 0.22, lines: [chatName], px: ref * 0.038, weight: 700, fill: pal.tintaHeader, eid: 'chat:name' })
  b.text({ x: avx + av + ref * 0.022, y: py + hh * 0.56, lines: [chatStatus], px: ref * 0.026, weight: 500, fill: pal.tintaHeaderSuave, eid: 'chat:status' })

  // Objetos "detrás": detrás de los MENSAJES, pero encima del panel. Si van
  // antes del panel quedan 100% tapados (el panel es opaco y cubre casi toda
  // la pieza): era el mismo bug de antes, sólo que más difícil de ver.
  // V2a · mismo índice real que en drawPiece: los eids de los textos de las
  // formas se resuelven contra content.objects, no contra el filtro
  const objsIdx = objects.map((o, i) => ({ ...o, _i: i }))
  drawObjects(b, { objects: objsIdx.filter((o) => !o.front), W, H, ref, accent, scheme, fondo: pal.papel })

  // mensajes (burbujas)
  let cy = py + hh + ref * 0.045
  const maxBubbleW = pw * 0.74
  const padX = ref * 0.03, padY = ref * 0.022
  const fpx = ref * 0.032
  const lh = 1.32
  // el índice es el de content.messages (los vacíos se saltean pero cuentan):
  // el eid tiene que apuntar al mensaje real que vas a editar
  for (let mi = 0; mi < messages.length; mi++) {
    const m = messages[mi]
    if (!m || !String(m.text || '').trim()) continue
    const mine = m.from === 'me'
    const lines = wrapText(m.text, { px: fpx, weight: 500, tracking: 0, maxWidth: maxBubbleW - padX * 2 })
    const contentW = Math.max(...lines.map((l) => measure(l, { px: fpx, weight: 500 })))
    const tw = Math.min(maxBubbleW, contentW + padX * 2)
    const th = lines.length * fpx * lh + padY * 2
    const bx = mine ? px + pw - ref * 0.03 - tw : px + ref * 0.03
    // el globo propio lleva el acento; el recibido va sobre la superficie.
    // La tinta la decide el contraste con el globo, no un negro fijo.
    const globo = mine ? pal.mio : pal.otro
    b.rect({ x: bx, y: cy, w: tw, h: th, fill: globo, rx: ref * 0.024 })
    b.text({ x: bx + padX, y: cy + padY, lines, px: fpx, weight: 500, fill: mine ? pal.tintaMia : pal.tintaOtro, lineHeight: lh, eid: `msg:${mi}` })
    cy += th + ref * 0.022
    if (cy > py + ph - ref * 0.06) break
  }

  // objetos DELANTE del panel + logo, igual que en cualquier otra pieza
  drawObjects(b, { objects: objsIdx.filter((o) => o.front), W, H, ref, accent, scheme, fondo: pal.papel })
  const vig = c.vignette ?? d.vignette ?? 0
  if (vig > 0) b.vignette({ w: W, h: H, strength: vig })
  const mostrarLogo = c.showLogo !== undefined ? c.showLogo : d.showLogo !== false
  if (mostrarLogo) {
    const safe = safeRect(format)
    drawLogo(b, {
      p: { logo: c.logo || d.logo || 'cream', logoPos: c.logoPos || d.logoPos || 'left', logoVPos: c.logoVPos || d.logoVPos || 'auto', logoScale: c.logoScale || d.logoScale || 1, plate: 'none' },
      W, H, safe, ref, hAnchor: 'left', vAnchor: 'top', plateRect: null,
    })
  }
}

// `fondo` = el color sobre el que caen los objetos (null si es una foto).
// 8 · un ícono o una forma con `tint: accent` sobre un bloque del MISMO
// acento no se ve: no está atenuado, no está: son dos manchas del mismo
// color. Antes esto no podía pasar porque el fondo era siempre la
// superficie del esquema; con los estilos nuevos (bloque de color) pasa a
// ser la regla, no la excepción.
function drawObjects(b, { objects, W, H, ref, accent, scheme, fondo = null }) {
  // OJO con el umbral: "desaparece" no es lo mismo que "no cumple WCAG". Una
  // burbuja blanca sobre crema da 1,27:1 y se lee perfecto —es una superficie
  // grande y con sombra—; pedirle 3:1 la volvía gris y rompía la plantilla de
  // la pregunta en las cinco marcas claras. Se toca sólo lo que de verdad no
  // se distingue del fondo, y se lo separa hasta el mismo 1,6 que ya usa
  // `acentoLegible`.
  // el cálculo vive en `tinteEfectivo` (exportado) para que el inspector
  // muestre EL MISMO color que sale pintado — ver el bloque de V10 arriba
  const seVe = (color) => tinteEfectivo(color, fondo)
  for (const o of objects || []) {
    // ---- FORMAS generativas (flecha, sparkle, badge, barras, bocadillo) ----
    if (o.kind === 'shape') { drawShape(b, { o, W, H, ref, accent, scheme, seVe }); continue }
    const size = ref * (o.scale || 0.28)
    const cx = W * (o.x ?? 0.72)
    const cy = H * (o.y ?? 0.5)
    const rotation = o.rotation || 0
    const flipX = !!o.flipX
    const shadow = conSombra(o)
    const opacity = o.opacity ?? 1
    // DISPOSITIVO: marco + foto adentro de la pantalla (automático)
    if (o.kind === 'device') {
      const dev = ICONS_BY_ID[o.deviceId]
      if (!dev) continue
      const sc = dev.screen || { x: 0.1, y: 0.1, w: 0.8, h: 0.8, r: 0.02, ratio: 0.5 }
      const dw = ref * (o.scale || 0.5)
      const dh = dw / (sc.ratio || 1)
      const dx = cx - dw / 2, dy = cy - dh / 2
      // 1) pantalla (foto) por debajo del marco
      // La pantalla gira alrededor del CENTRO DEL DISPOSITIVO (rcx/rcy), no
      // del suyo: en la notebook la pantalla está más arriba que el medio del
      // marco, así que con rotación la foto se salía del encuadre.
      if (o.src) {
        b.framedImage({
          cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh, rcx: cx, rcy: cy,
          w: sc.w * dw, h: sc.h * dh, rotation, flipX, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: sc.r * sc.w * dw, zoom: o.zoom || 1, shadow: false, opacity,
        })
      } else {
        b.framedImage({ cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh, rcx: cx, rcy: cy, w: sc.w * dw, h: sc.h * dh, rotation, href: null, radius: sc.r * sc.w * dw })
      }
      // 2) marco del dispositivo encima, con sombra de objeto físico
      const frameUrl = getAsset(dev.url) || dev.url
      const devShadow = shadow ? b.filter({ kind: 'device', k: (dw / ref) * 1.6 }) : null
      b.object({ cx, cy, size: dw, rotation, flipX, href: frameUrl, tile: false, shadow: false, opacity, aspect: 1 / (sc.ratio || 1), extraFilter: devShadow })
      // 3) reflejo de la pantalla: lo que lo termina de sacar de "ícono"
      if (o.glare !== false) {
        b.screenGlare({
          cx: dx + (sc.x + sc.w / 2) * dw, cy: dy + (sc.y + sc.h / 2) * dh, rcx: cx, rcy: cy,
          w: sc.w * dw, h: sc.h * dh, radius: sc.r * sc.w * dw,
          rotation, strength: o.glare ?? 1,
        })
      }
      continue
    }
    // panel de foto vacío: una plantilla puede declararlo y se ve el
    // esqueleto "acá va una foto" en vez de no dibujar nada
    // MOCKUP: una foto tuya sosteniendo un dispositivo, con la captura
    // adentro de la pantalla. "Eso de tener una mano teniendo un
    // dispositivo o en uso" — las referencias de Canva que trajo el equipo.
    // La foto la pone la persona: una foto de Magoya en el campo vale mas
    // que una mano de stock, y ademas ya es de marca.
    if (o.kind === 'mockup') {
      const w = ref * (o.scale || 0.7)
      const h = w * (o.ratio || 0.75)
      if (!o.foto) {
        b.imageCover({ x: cx - w / 2, y: cy - h / 2, w, h, href: null, rotation, radius: ref * 0.01 })
        continue
      }
      b.pantallaEnFoto({
        x: cx - w / 2, y: cy - h / 2, w, h,
        foto: o.foto, natural: o.fotoNatural, screen: o.screen,
        href: o.src, hrefNatural: o.natural, focal: o.focal || { x: 0.5, y: 0.5 },
        opacity, brillo: o.glare ?? 0.14,
      })
      continue
    }
    if (o.kind === 'image' && !o.src && o.frame) {
      const fw = ref * (o.scale || 0.4)
      const fh = fw * (o.ratio || 0.6)
      b.imageCover({
        x: cx - fw / 2, y: cy - fh / 2, w: fw, h: fh, href: null,
        rotation, radius: (o.radius || 0) * Math.min(fw, fh),
      })
      continue
    }
    if (o.kind === 'image' && o.src) {
      if (o.frame) {
        // imagen enmascarada en un marco (pantalla/mockup)
        const fw = ref * (o.scale || 0.4)
        const fh = fw * (o.ratio || 0.6)
        b.framedImage({
          cx, cy, w: fw, h: fh, rotation, flipX, href: o.src, natural: o.natural,
          focal: o.focal || { x: 0.5, y: 0.5 }, radius: (o.radius || 0) * Math.min(fw, fh),
          zoom: o.zoom || 1, shadow, opacity,
        })
      } else {
        // efectos del recorte: contorno / glow / sombra dura
        let extraFilter = null
        if (o.fx === 'outline') extraFilter = b.filter({ kind: 'outline', r: ref * 0.008, color: o.fxColor || '#FFFFFF' })
        else if (o.fx === 'glow') extraFilter = b.filter({ kind: 'glow', r: ref * 0.05, color: o.fxColor || accent, opacity: 0.85 })
        else if (o.fx === 'hard') extraFilter = b.filter({ kind: 'hard', dx: ref * 0.018, dy: ref * 0.018, color: o.fxColor || '#0D0C0C' })
        b.object({ cx, cy, size, rotation, flipX, href: o.src, tile: false, shadow: shadow && !extraFilter, opacity, extraFilter })
      }
      continue
    }
    const icon = ICONS_BY_ID[o.iconId]
    if (!icon) continue
    const tint = seVe(o.tint === 'accent' ? accent : (o.tint || null))
    if (o.style === 'plain') {
      // trazos y marcas: sin tile, sin sombra y con grosor de trazo ajustable
      // antes: shadow forzada a false en los trazos → el toggle no hacía nada
      b.object({ cx, cy, size, rotation, flipX, href: coloredIcon(icon.url, tint || icon.color, o.sw || 1), tile: false, shadow, opacity })
    } else {
      // Tile app-icon. El default es squircle de color con glifo blanco,
      // pero varias marcas no son así y por eso "no se notaban originales":
      //   · Gemini va al revés (tile claro, glifo de color) y en degradé
      //   · el fondo de Instagram es un degradé, no un rosa plano
      //   · WhatsApp, Telegram, Reddit y Facebook son círculos
      //   · TikTok lleva la nota corrida en cian y magenta debajo
      const claro = LIGHT_TILE[icon.slug]
      const gGlifo = GLYPH_GRADIENT[icon.slug]
      const gTile = o.tileColor ? null : TILE_GRADIENT[icon.slug]
      const capas = (OFFSET_INK[icon.slug] || []).map((k) => ({ ...k, href: coloredIcon(icon.url, k.color) }))
      b.object({
        cx, cy, size, rotation, flipX,
        href: (gGlifo && gradientIcon(icon.url, gGlifo.stops, gGlifo.angle)) || coloredIcon(icon.url, claro || '#FFFFFF'),
        tile: true,
        tileColor: o.tileColor || (claro ? '#FFFFFF' : icon.color),
        tileGradient: gTile,
        tileShape: TILE_SHAPE[icon.slug] || 'squircle',
        offsetInk: capas.length ? capas : null,
        shadow, opacity,
      })
    }
  }
}

// ---- formas paramétricas (Bloque A: alto impacto) ----
function drawShape(b, { o, W, H, ref, accent, scheme, seVe = (c) => c }) {
  // V2a · el texto de una forma también se edita con doble click. El eid
  // dice de QUÉ objeto y de QUÉ campo es ("obj:3:text"): el editor lo
  // resuelve con updateObject, igual que el panel de la derecha. Sin `_i`
  // (piezas dibujadas fuera del motor, tests) no se emite eid y listo.
  const eidDe = (campo) => (o._i != null ? `obj:${o._i}:${campo}` : null)
  const size = ref * (o.scale || 0.3)
  const cx = W * (o.x ?? 0.5), cy = H * (o.y ?? 0.5)
  const rot = o.rotation || 0
  const flipX = !!o.flipX
  const color = seVe(o.tint === 'accent' ? accent : (o.tint || accent))
  const op = o.opacity ?? 1
  const swMul = o.sw || 1 // grosor de trazo ajustable por el usuario
  // La sombra dura se crea SÓLO cuando la rama la va a usar. Antes se creaba
  // acá arriba para cualquier forma, así que el bocadillo y la ventana (que
  // llevan su propia sombra suave) dejaban un <filter> definido y nunca
  // aplicado: ensucia el SVG y, peor, hace pasar los tests que comparan
  // strings — es exactamente la trampa que dice el comentario de las barras.
  const hardShadow = () => (conSombra(o)
    ? b.filter({ kind: 'hard', dx: ref * 0.012, dy: ref * 0.012, color: '#0D0C0C', opacity: 0.9 })
    : null)
  const g = { rotation: rot, cx, cy, flipX, opacity: op }

  if (o.shape === 'arrow' || o.shape === 'handArrow') {
    const w = size, h = size * 0.5
    const tx = cx - w / 2, ty = cy - h / 2
    if (o.shape === 'arrow') {
      b.path({ d: arrowPath(w, h), fill: color, tx, ty, ...g, filterId: hardShadow() })
    } else {
      const { body, head } = handArrowPath(w, h)
      const sw = Math.max(3, ref * 0.012 * swMul)
      b.path({ d: body, stroke: color, sw, tx, ty, ...g, filterId: hardShadow() })
      b.path({ d: head, stroke: color, sw, tx, ty, ...g, filterId: hardShadow() })
    }
    return
  }
  if (o.shape === 'sparkle') {
    b.path({ d: sparklePath(size / 2), fill: color, tx: cx, ty: cy, ...g, filterId: hardShadow() })
    return
  }
  if (o.shape === 'dots') {
    // los puntitos del carrusel: cantidad y cuál está activo, editables
    const w = size
    const ds = dotsCircles(w, o.count ?? 5, o.active ?? 0)
    const x0 = cx - w / 2, y0 = cy - (ds[0]?.r || 0)
    const apagados = ds.filter((d) => !d.on).map((d) => circlePath(x0 + d.cx, y0 + d.cy, d.r)).join(' ')
    const encendido = ds.find((d) => d.on)
    if (apagados) b.path({ d: apagados, fill: color, ...g, opacity: 0.35 * op, filterId: hardShadow() })
    if (encendido) b.path({ d: circlePath(x0 + encendido.cx, y0 + encendido.cy, encendido.r), fill: color, ...g, opacity: op, filterId: hardShadow() })
    return
  }
  if (o.shape === 'panel') {
    // Un rectángulo de color y nada más. Faltaba: para armar un collage había
    // que usar la etiqueta (que obliga a poner texto) o la ventana (que mete
    // los tres puntitos de navegador). Acá sólo hay color, proporción y giro.
    const w = ref * (o.scale || 0.34)
    const h = w * (o.ratio || 0.7)
    const x0 = cx - w / 2, y0 = cy - h / 2
    const r = (o.radius || 0.06) * Math.min(w, h)
    b.path({ d: roundRect(x0, y0, w, h, r), fill: color, ...g, filterId: hardShadow() })
    return
  }
  if (o.shape === 'badge') {
    const txt = String(o.text || 'NUEVO').toUpperCase()
    const px = size * 0.26
    const w = measure(txt, { px, weight: 800, tracking: 0.06 }) + px * 1.5
    const h = px * 2
    const solid = o.style !== 'outline'
    // la etiqueta ignoraba rotación y reflejo: los controles estaban y no
    // hacían nada. Se dibuja como path para poder girarla entera.
    b.path({ d: roundRect(cx - w / 2, cy - h / 2, w, h, h / 2), fill: solid ? color : 'none',
      stroke: solid ? null : color, sw: Math.max(2, ref * 0.006 * swMul), ...g, filterId: hardShadow() })
    b.text({ x: cx, y: cy - px * 0.62, lines: [txt], px, weight: 800, tracking: 0.06,
      fill: solid ? mejorTinta(color) : color, anchor: 'middle', opacity: op, rotation: rot, rcx: cx, rcy: cy, eid: eidDe('text') })
    return
  }
  if (o.shape === 'bars') {
    const vals = o.values || [3, 5, 4, 7, 9]
    const w = size, h = size * 0.62
    const x0 = cx - w / 2, y0 = cy - h / 2
    // Tres cosas estaban mal acá y me las comí en el barrido anterior porque
    // comparaba strings de SVG: el filtro de sombra se CREA aunque no se
    // aplique, así que el string cambiaba y el test daba verde.
    //   1. ninguna de las dos capas llevaba filterId → la sombra no se veía
    //   2. el color pintaba sólo la última barra (el resto usaba el gris del
    //      esquema, así que el swatch parecía no hacer nada)
    //   3. `...g` iba DESPUÉS de opacity y lo pisaba → el atenuado se perdía
    const rects = barsRects(w, h, vals)
    const dResto = rects.slice(0, -1).map((r) => roundRect(x0 + r.x, y0 + r.y, r.w, r.h, r.rx)).join(' ')
    const ultima = rects[rects.length - 1]
    if (dResto) b.path({ d: dResto, fill: color, ...g, opacity: 0.42 * op, filterId: hardShadow() })
    if (ultima) b.path({ d: roundRect(x0 + ultima.x, y0 + ultima.y, ultima.w, ultima.h, ultima.rx), fill: color, ...g, opacity: op, filterId: hardShadow() })
    return
  }
  if (o.shape === 'sparkline') {
    const vals = o.values || [2, 3, 3, 5, 4, 7, 9]
    const w = size, h = size * 0.5
    const x0 = cx - w / 2, y0 = cy - h / 2
    const { line, last } = sparkline(w, h, vals)
    b.path({ d: line, stroke: color, sw: Math.max(3, ref * 0.01 * swMul), tx: x0, ty: y0, ...g, filterId: hardShadow() })
    b.path({ d: roundRect(x0 + last[0] - ref * 0.012, y0 + last[1] - ref * 0.012, ref * 0.024, ref * 0.024, ref * 0.012), fill: color, ...g })
    return
  }
  if (o.shape === 'window') {
    // A6 · la "prueba visual": una captura dentro de un marco de ventana.
    // La foto entra sola abajo de la barra; sin foto queda el esqueleto.
    const w = size, h = w * (o.ratio || 0.62)
    const x0 = cx - w / 2, y0 = cy - h / 2
    const barH = Math.max(ref * 0.018, h * 0.1)
    const r = ref * 0.014
    const soft = conSombra(o) ? b.filter({ kind: 'soft', r: ref * 0.02, dy: ref * 0.012, opacity: 0.32 }) : null
    // el color elegido pinta el marco (antes las swatches no hacían nada)
    const marco = o.fill || color || '#FFFFFF'
    b.path({ d: roundRect(x0, y0, w, h, r), fill: marco, rotation: rot, cx, cy, flipX, opacity: op, filterId: soft })
    // cuerpo de la ventana: una captura, un texto, o el esqueleto de
    // "acá va la captura". Antes, sin foto, quedaba una caja de color
    // vacía con tres puntitos: "este quedó mal, le falta mejora".
    const bx = x0 + ref * 0.003, by = y0 + barH
    const bw = w - ref * 0.006, bh = h - barH - ref * 0.004
    if (o.src) {
      // el cuerpo de la ventana está DEBAJO de la barra de título, así que su
      // centro no es el de la forma: gira alrededor de (cx, cy) como el marco.
      b.framedImage({
        cx, cy: by + bh / 2, w: bw, h: bh, rcx: cx, rcy: cy,
        rotation: rot, flipX, href: o.src, natural: o.natural, focal: o.focal || { x: 0.5, y: 0.5 },
        radius: r * 0.5, zoom: o.zoom || 1, opacity: op,
      })
    } else if (String(o.body || '').trim()) {
      // ventana con texto adentro, como una nota o un aviso del sistema
      const px = Math.max(ref * 0.018, bh * 0.13)
      const tinta = mejorTinta(marco)
      const lineas = wrapText(String(o.body), { px, weight: 500, maxWidth: bw - px * 1.6 }).slice(0, 8)
      b.text({
        x: bx + px * 0.8, y: by + px * 0.7, lines: lineas, px, weight: 500,
        fill: tinta, anchor: 'start', lineHeight: 1.35, opacity: op, rotation: rot, rcx: cx, rcy: cy, eid: eidDe('body'),
      })
    } else {
      b.imageCover({ x: bx, y: by, w: bw, h: bh, href: null, rotation: rot, rcx: cx, rcy: cy })
    }
    // 7 · el chrome también rota: antes el marco giraba y los puntitos no.
    // Cada punto va con su color: es lo que hace que se lea "ventana" de una.
    // Sobre un marco oscuro se aclaran apenas para que no se apaguen.
    const marcoClaro = mejorTinta(marco) === INK
    windowChrome(w, barH).forEach((c) => {
      b.path({
        d: circlePath(x0 + c.cx, y0 + c.cy, c.r),
        fill: marcoClaro ? c.color : mix(c.color, '#FFFFFF', 0.25),
        rotation: rot, cx, cy, flipX, opacity: op,
      })
    })
    if (o.text) {
      const px = barH * 0.5
      b.text({ x: cx, y: y0 + (barH - px) / 2 - px * 0.05, lines: [String(o.text)], px, weight: 600,
        fill: mejorTinta(marco) === INK ? "#8A9096" : 'rgba(255,255,255,.7)', anchor: 'middle',
        opacity: op, rotation: rot, rcx: cx, rcy: cy, eid: eidDe('text') })
    }
    return
  }
  if (o.shape === 'callout') {
    // el bocadillo se ajusta AL TEXTO (como una burbuja de verdad): el ancho
    // lo fija el usuario con el tamaño, el alto sale de las líneas que entran.
    const w = size
    const px = w * 0.115
    const padX = w * 0.09, padY = w * 0.075
    const txt = String(o.text || '').trim()
    const lines = txt ? wrapText(txt, { px, weight: 600, maxWidth: w - padX * 2 }) : []
    const lh = 1.28
    // se descuenta medio interlineado: si no, el aire de abajo se ve mayor
    const h = Math.max(w * 0.42, lines.length * px * lh + padY * 2 - px * (lh - 1) * 0.5)
    const x0 = cx - w / 2, y0 = cy - h / 2
    const soft = conSombra(o) ? b.filter({ kind: 'soft', r: ref * 0.012, dy: ref * 0.008, opacity: 0.28 }) : null
    // el color elegido pinta la burbuja (antes se ignoraba y siempre salía
    // blanca) y el texto se adapta para que se lea
    const burbuja = o.fill || color || '#FFFFFF'
    b.path({ d: calloutPath(w, h, { r: w * 0.09 }), fill: burbuja, tx: x0, ty: y0, ...g, filterId: soft })
    if (lines.length) {
      b.text({ x: x0 + padX, y: y0 + padY, lines, px, weight: 600, fill: mejorTinta(burbuja), lineHeight: lh, opacity: op, eid: eidDe('text') })
    }
    return
  }
}
// círculo como path, para poder juntar varios en un solo <path>
function circlePath(cx, cy, r) {
  return `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0 Z`
}
function roundRect(x, y, w, h, r) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
}

function drawLogo(b, { p, W, H, safe, ref, hAnchor, vAnchor, plateRect, campoLogo }) {
  // `campoLogo === null` = abajo hay foto: manda la regla de arte (crema).
  const auto = campoLogo === undefined ? null : (campoLogo && mejorTinta(campoLogo) === INK ? 'black' : 'cream')
  const wm = WORDMARKS[auto || p.logo] || WORDMARKS.cream
  const logoUrl = getAsset(wm.url)
  if (!logoUrl) return
  // "este logo me parece que queda como muy por debajo": a 0.2 el wordmark
  // no sostenía la pieza, quedaba como un pie de página.
  const lw = ref * 0.24 * (p.logoScale || 1)
  const lh = lw / WORDMARK_RATIO
  const onRight = p.logoPos === 'right'
  // sobre una foto sin placa, el logo se comía el fondo y desaparecía: una
  // sombra suave lo despega sin ensuciar la marca
  const sombra = p.surface === 'photo' && !(plateRect && p.plate === 'band')
    ? b.filter({ kind: 'soft', r: ref * 0.014, dy: ref * 0.004, opacity: 0.45 })
    : null
  // 13 · la vertical la elige el usuario ('top'/'bottom'); 'auto' mantiene
  // las dos reglas de siempre: adentro de la banda si hay banda, y si no,
  // opuesto al stack de texto. Una elección explícita gana sobre las dos:
  // si pediste el logo arriba, meterlo en la banda de abajo es no escucharte.
  const vp = p.logoVPos || 'auto'
  // B4 · con banda, el logo va ADENTRO de la placa, del lado libre (hoy
  // flotaba aparte y la pieza se leía como dos cosas pegadas). Sólo si el
  // texto no llega hasta ahí: nunca se pisan.
  if (vp === 'auto' && plateRect && p.plate === 'band' && hAnchor !== 'center'
      && safe.x + plateRect.textW + lw + ref * 0.06 <= W - safe.x) {
    b.asset({ x: W - safe.x - lw, y: plateRect.y + (plateRect.h - lh) / 2, w: lw, h: lh, href: logoUrl })
    return
  }
  // horizontal: elegido por el usuario
  const lx = onRight ? W - safe.x - lw : safe.x
  const arriba = vp === 'top' ? true : vp === 'bottom' ? false : vAnchor !== 'top'
  const ly = arriba ? safe.y : safe.y + safe.h - lh
  b.asset({ x: lx, y: ly, w: lw, h: lh, href: logoUrl, filterId: sombra })
}
