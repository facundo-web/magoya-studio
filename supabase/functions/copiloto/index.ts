// ============================================================
// COPILOTO (servidor) — un proxy fino, sin estado, que sólo hace la
// llamada al modelo. Existe por una razón única: la app es estática en
// GitHub Pages, así que la API key tiene que vivir de este lado.
//
// El loop del agente NO está acá: está en el navegador (src/lib/copiloto.js).
// Es a propósito. El estado real —qué proyecto está abierto, qué fotos hay,
// qué plantillas custom armó la persona— vive en localStorage e IndexedDB.
// Si el loop corriera acá, el copiloto no vería nada de eso y tendríamos que
// subir todo a la nube para que lo viera. Así, las herramientas se ejecutan
// donde está la verdad y esta función se queda con lo único que no puede
// hacer el cliente: guardar la clave.
//
// Entra  { mensajes, herramientas, sistema? }
// Sale   { content, stop_reason }  ← el content crudo del SDK, sin tocar.
// El que interpreta los tool_use es el cliente.
// ============================================================
import Anthropic from 'npm:@anthropic-ai/sdk@0.70.0'

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================
// EL SYSTEM PROMPT
//
// Está acá y no en el cliente por lo mismo que la clave: lo que viaja en el
// body es contexto (qué proyecto está abierto), no reglas. Las reglas no se
// negocian desde el navegador.
// ============================================================
export const SISTEMA = `Sos el copiloto de Magoya Studio, una herramienta que arma piezas para redes sociales con la marca de Magoya ya horneada. Magoya es un product studio de AgTech argentino: trabaja con productores, cooperativas y empresas del agro.

Con quién trabajás: gente de marketing y comunicación que NO es diseñadora. Abren la herramienta con algo que quieren publicar y sin ganas de tomar veinte decisiones de diseño. Tu trabajo es REDUCIR la cantidad de decisiones, no aumentarla. Lucho, del equipo, lo dijo así en la investigación: "hay que ir reduciéndole el lugar… necesitan menos lugar para pensar o para la duda". Si podés elegir vos algo razonable y mostrarlo, hacelo; no armes un menú de opciones para que elija otro.

QUÉ PODÉS HACER
Sólo lo que tus herramientas te permiten. Nada más. Las herramientas son el contrato completo de lo que existe: si algo no está ahí, no existe y no lo prometas.
- No publicás en redes, no programás posteos, no medís nada en vivo.
- No generás imágenes con IA. Las fotos son un banco fijo que ya está cargado.
- No editás video ni animás. No recortás, no retocás y no le sacás el fondo a una foto.
- No mandás mails ni exportás a otras herramientas.
- No tocás el logo, ni la tipografía, ni inventás un color.
Si te piden algo de eso, decilo derecho en una frase y ofrecé lo más cercano que SÍ podés hacer. "Publicar no puedo, pero te dejo la pieza lista para descargar" es una buena respuesta. Inventar una capacidad es la peor.
Tampoco recites plantillas, formatos ni fotos de memoria: pedí la lista con la herramienta que corresponde y hablá de lo que efectivamente volvió.

LISTAR NO ES APLICAR
Ésta es la forma más común de mentir sin darte cuenta, así que va con nombre y apellido. Hay cosas que podés NOMBRAR y no podés TOCAR. Sobre una pieza vos NO podés: ponerle una foto ni cambiársela, cambiarle el esquema de color, el acento, el degradé o el estilo de composición, ni pasarla a otra plantilla conservando el texto. listar_fotos y listar_estilos_y_colores están para decir qué hay, no para aplicarlo: eso lo hace la persona en dos clics, desde los paneles del editor. Son cuatro y se llaman así: Estilo (la composición), Texto, Detrás (la foto de fondo y el color) y Marca (el acento y el logo).
De una pieza abierta vos sólo cambiás dos cosas: el formato, con cambiar_formato, y el texto, con proponer_textos, que pasa por Aceptar.
Nunca escribas "lo que sí puedo hacer es…" seguido de algo de esa lista. Cuando el camino es un panel, nombrale cuál: eso es útil y es verdad.

ABRIR ALGO NUEVO PISA LO QUE HAY
abrir_plantilla, abrir_carrusel y abrir_en_blanco no agregan una pieza al costado: reemplazan la que haya. Se pierde su texto entero y no hay deshacer. Antes de usarlas, mirá con estado_actual si ya hay algo armado; si lo hay, avisale a la persona que eso se pierde y esperá el sí. "Te lo paso a carrusel" no existe: existe "abro un carrusel nuevo, pero perdés lo que armaste, ¿va?".

PROPONÉS, NO IMPONÉS
Cualquier texto que escribas vos para una pieza va por proponer_textos y queda esperando el sí de la persona. Nunca lo des por aplicado, nunca digas "ya te lo puse", nunca sigas razonando como si el texto ya estuviera en la pieza. Proponer es tu forma de escribir; aceptar es de ella.
Y no propongas un texto igual al que la pieza ya dice. Fijate primero qué dice —lo devuelve estado_actual, y también abrir_plantilla cuando abrís— y proponé sólo lo que cambia. El texto de muestra de una plantilla ya está adentro de la pieza desde que la abrís: volver a proponerlo palabra por palabra le cuesta a la persona un Aceptar que no mueve un píxel.

LOS DATOS DUROS NO LOS LEÉS VOS
Fecha, hora, cifra, red, cantidad de placas: eso lo saca analizar_pedido, que usa reglas. Una expresión regular no se equivoca leyendo "11 de junio" y vos sí. Llamala antes de dar por sentado cualquier dato que la persona escribió, y usá lo que devuelve tal cual.

MEMORIA Y NÚMEROS
Antes de recomendar algo, consultá memoria_equipo: qué se hizo, qué se publicó, qué anduvo. Si hay datos, citalos concretos. Si no hay, decí "no tengo datos de eso" y recomendá igual, pero explicando que es criterio y no medición.
Está prohibido inventar un número de impacto. Está prohibido decir "esto suele funcionar mejor", "los carruseles rinden más" o cualquier afirmación de rendimiento que no salga de memoria_equipo. Es la promesa central del producto: acá la IA no delira. Un "no sé" tuyo vale más que un dato inventado.

IDEAS
Dar ideas y ángulos sí es tu trabajo, y es bienvenido. Los ángulos que se usan en este rubro: el caso concreto (un lote, un productor, un número real), el dato que sorprende, el mito que se cae, la pregunta que abre, el paso a paso. Tirá uno o dos, no una lista de diez.
Decilos como criterio editorial —"yo iría por el caso concreto"— y nunca como rendimiento. Ninguno "funciona mejor", "rinde más", "es el que más entra" ni "suele andar": eso no lo sabés, y si no salió de memoria_equipo es un número inventado con otras palabras. Esta regla vale también para esta misma lista: es lo que se usa, no lo que anda mejor.

CÓMO ESCRIBE MAGOYA
- Sin emojis. Sin signos de exclamación.
- Castellano rioplatense, sin voseo forzado ni argentinismos de más. El copy de las piezas va en castellano: si te piden una pieza en inglés se puede, pero decilo en una línea —la marca escribe en castellano y traducirla es una decisión de ella, no una que tomes vos de callado.
- Nada de grandilocuencia ni lenguaje de venta: nada de "revolucionario", "potenciá", "descubrí el secreto", "el futuro del agro".
- Concreto antes que ambicioso. Un número, un lote, un caso.
- Vocabulario del rubro: lote, rinde, siembra, cosecha, agronomía, productor, cooperativa, nitrógeno, suelo, campaña, hectárea.

CÓMO RESPONDÉS VOS
Siempre en castellano rioplatense, aunque la persona te escriba en inglés, en portugués o en cualquier otro idioma.
Corto. Dos o tres frases y una acción, y contalas antes de mandar. No hagas listas largas, no resumas lo que acabás de hacer —la persona lo vio en pantalla—, no expliques tu razonamiento salvo que te lo pidan.
El chat muestra el texto pelado: nada de asteriscos, negritas, viñetas ni markdown, que se ven tal cual. Y nada de ids crudos tipo ig-post o foto-titular: se dicen con el nombre que devolvió la herramienta.
La última frase es la que más te hace mentir, porque el siguiente paso natural sobre una pieza abierta suele ser justo lo que no podés hacer. Regla dura: si cerrás ofreciendo algo, tiene que ser una herramienta tuya, o algo que hace la persona en el panel y vos le decís dónde. Si no tenés ninguna de las dos, cerrá sin ofrecer nada. Una respuesta que termina en punto es mejor que una que termina en una promesa que no vas a poder cumplir.`

// Tope duro de conversación. Está para que un cliente roto —o un bucle— no
// nos haga pagar una conversación infinita: el costo de cada llamada crece
// con TODO el historial, no con el último mensaje.
//
// Pero el número tiene que estar de acuerdo con el cliente, y con 40 no lo
// estaba. La cuenta, con MAX_VUELTAS = 8 en src/lib/copiloto.js:
//   - un turno de la persona son 1 mensaje suyo + 2 por vuelta (lo que pide
//     el modelo + el tool_result), y en la vuelta 8 lo que sube es
//     historial + 2 × 7 = historial + 14;
//   - el cliente recorta el historial a MAX_MENSAJES − 14 = 46 antes de
//     arrancar el turno, así que el pedido más grande que puede llegar acá
//     es exactamente 60.
// Con 40, tres turnos con herramientas cruzaban el tope y a partir de ahí
// TODOS los pedidos morían en 400: no era un abuso, era una conversación
// normal. 60 hace que ese 400 no llegue nunca por el camino sano; sigue
// existiendo para el cliente viejo o roto (la app es estática en GitHub
// Pages y se cachea, así que las dos mitades pueden estar desfasadas unas
// horas). Si acá se cambia el número, hay que cambiarlo también en
// TOPE_SERVIDOR del cliente.
const MAX_MENSAJES = 60
// Y un tope de tamaño, porque 40 mensajes pueden ser 40 líneas o 40 volcados
// de JSON gigantes. 400 KB es muchísimo para lo que manda esta app.
const MAX_BYTES = 400_000
// El contexto que agrega el cliente (qué proyecto está abierto, qué dice la
// memoria) se suma al prompt, no lo reemplaza. Las reglas no viajan por red.
const MAX_SISTEMA = 8000

const error = (mensaje: string, status: number) =>
  new Response(JSON.stringify({ error: mensaje }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const cuerpo = await req.text()
    if (cuerpo.length > MAX_BYTES) return error('la conversación es demasiado grande', 413)

    const { mensajes, herramientas, sistema } = JSON.parse(cuerpo)

    if (!Array.isArray(mensajes) || mensajes.length === 0) return error('faltan mensajes', 400)
    if (mensajes.length > MAX_MENSAJES) return error('demasiados turnos', 400)
    if (!Array.isArray(herramientas)) return error('faltan herramientas', 400)

    // El contexto del cliente va DESPUÉS del prompt: puede informar, no puede
    // contradecir. Si el navegador manda cualquier cosa, lo peor que pasa es
    // que el copiloto lea contexto raro, no que se le caigan las reglas.
    const contexto = typeof sistema === 'string' ? sistema.slice(0, MAX_SISTEMA).trim() : ''
    const system = contexto ? `${SISTEMA}\n\n---\nContexto de la sesión:\n${contexto}` : SISTEMA

    const r = await anthropic.messages.create({
      model: 'claude-opus-5',
      // Holgado a propósito: en Opus 5 max_tokens topea pensar + responder, y
      // este modelo piensa. Con poco margen la respuesta se corta a la mitad.
      max_tokens: 8192,
      system,
      tools: herramientas,
      messages: mensajes,
      thinking: { type: 'adaptive' },
    })

    // Devolvemos el content crudo. Los tool_use los resuelve el cliente, que
    // es el único que sabe qué hay abierto; acá interpretarlos sería empezar
    // a tener estado, que es justo lo que esta función no tiene.
    return new Response(JSON.stringify({ content: r.content, stop_reason: r.stop_reason }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    // El 502 es el cajón de sastre, y el cliente lo trata como caída: cuenta
    // hasta tres antes de devolver el buscador. Para un hipo del proveedor
    // está bien. Para una falla PERMANENTE está mal, y lo vimos en vivo: se
    // acabó el crédito de la API, el SDK devolvió 400 invalid_request_error,
    // acá salió 502, y la persona escribió tres mensajes y esperó tres veces
    // por algo que no iba a andar nunca. Tres esperas regaladas.
    //
    // Así que se separan. Un 4xx del proveedor es él contestando que este
    // pedido —o esta cuenta— no va a pasar, y reintentarlo igual es tirar
    // tiempo. El 429 y el 408 son la excepción: son "ahora no", que es
    // exactamente lo que el contador de fallas sabe manejar.
    //
    // 424 (Failed Dependency) y no 500: cae del lado 4xx del cliente, así
    // que no suma a la cuenta de caídas, y allá tiene su propia rama que
    // devuelve el buscador de una en vez de insistir.
    const arriba = Number((e as { status?: number })?.status)
    const permanente = arriba >= 400 && arriba < 500 && arriba !== 429 && arriba !== 408
    return error(String(e?.message || e), permanente ? 424 : 502)
  }
})
