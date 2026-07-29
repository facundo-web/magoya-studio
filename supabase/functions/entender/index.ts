// ============================================================
// ENTENDER — traduce lo que la persona escribió a las señales que las
// reglas ya saben leer. Vive acá y no en el navegador por una razón
// concreta: la app es estática en GitHub Pages, así que una clave en el
// front sería una clave publicada.
//
// La división del trabajo es a propósito:
//   el modelo ENTIENDE la frase   (es bueno con lenguaje desprolijo)
//   las reglas ELIGEN la plantilla (se pueden explicar cuando fallan)
//
// El modelo NO escribe copy, no inventa títulos y no elige plantillas.
// Devuelve un objetivo del vocabulario cerrado y, para el tema, un
// PEDAZO TEXTUAL de la frase — si devuelve algo que no está en lo que la
// persona escribió, el cliente lo descarta.
// ============================================================
import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Vocabulario CERRADO. Es el mismo que hablan las reglas y las plantillas:
// si el modelo pudiera devolver un objetivo nuevo, no habría plantilla que
// lo sirviera y la sugerencia saldría vacía sin explicación.
const ESQUEMA = {
  type: 'object',
  properties: {
    objetivo: {
      type: 'string',
      enum: ['webinar', 'prueba', 'ensenar', 'anuncio', 'equipo', 'cierre', 'ninguno'],
      description: 'webinar=invitar a algo con fecha · prueba=mostrar un resultado o caso · ensenar=explicar o dar tips · anuncio=novedad o lanzamiento · equipo=cultura y personas · cierre=aviso operativo · ninguno=no se entiende qué quiere',
    },
    tema: {
      type: 'string',
      description: 'El asunto, COPIADO TAL CUAL de la frase, sin el andamiaje ("quiero un posteo para", "necesito algo que"). Máximo 8 palabras. Vacío si no hay tema claro.',
    },
    carrusel: { type: 'boolean', description: 'true sólo si pide varias placas o varios pasos' },
    red: {
      type: 'string',
      enum: ['instagram', 'linkedin', 'whatsapp', 'youtube', 'facebook', 'x', 'ninguna'],
      description: 'La red, sólo si la nombró',
    },
    confianza: { type: 'number', description: '0 a 1. Bajo si estás adivinando.' },
  },
  required: ['objetivo', 'tema', 'carrusel', 'red', 'confianza'],
  additionalProperties: false,
}

const SISTEMA = `Trabajás para Magoya, un product studio de AgTech argentino. Alguien del equipo escribió lo que quiere publicar en redes y tu único trabajo es clasificar el pedido para que otro sistema elija la plantilla.

Reglas, en orden de importancia:
1. NO escribas copy. No inventes títulos, no mejores la frase, no completes lo que falta.
2. El "tema" son palabras COPIADAS de la frase. Si la persona no dijo el tema, devolvé vacío.
3. Si no entendés qué quiere, objetivo "ninguno" y confianza baja. Preferí no saber antes que adivinar mal: una sugerencia equivocada es peor que ninguna.
4. Escribí en español rioplatense, sin voseo forzado.

El vocabulario del rubro: lote, rinde, siembra, cosecha, agronomía, productor, cooperativa, nitrógeno, suelo, campaña, hectárea.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { texto } = await req.json()
    if (typeof texto !== 'string' || texto.trim().length < 4) {
      return new Response(JSON.stringify({ objetivo: 'ninguno', tema: '', carrusel: false, red: 'ninguna', confianza: 0 }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const r = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2048, // holgado: en Opus 5 max_tokens topea pensar + responder
      system: SISTEMA,
      // Salida estructurada: el modelo no puede devolver prosa aunque quiera.
      // Es la garantía técnica de que "no escribe copy", no una promesa.
      output_config: { format: { type: 'json_schema', schema: ESQUEMA }, effort: 'low' },
      messages: [{ role: 'user', content: String(texto).slice(0, 500) }],
    })

    // Un rechazo del clasificador no es un error: es "no sé".
    if (r.stop_reason === 'refusal') {
      return new Response(JSON.stringify({ objetivo: 'ninguno', tema: '', carrusel: false, red: 'ninguna', confianza: 0 }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
    const bloque = r.content.find((b) => b.type === 'text')
    return new Response(bloque?.text ?? '{}', { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (e) {
    // 502 y no 500: el cliente distingue "la IA no está" de "el pedido está mal",
    // y en los dos casos cae a las reglas.
    return new Response(JSON.stringify({ error: String(e?.message || e) }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
