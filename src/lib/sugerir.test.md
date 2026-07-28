# `sugerir.js` — casos de prueba

Corrida real, no imaginada: se importó el módulo en el navegador contra
`src/templates/index.js` (29 plantillas), `src/formats/registry.js` (13 formatos)
y `src/templates/carousels.js` (3 carruseles armados), con el server de dev en
`http://localhost:5173/magoya-studio/`:

```js
const m   = await import('/magoya-studio/src/lib/sugerir.js')
const tpl = await import('/magoya-studio/src/templates/index.js')
const fmt = await import('/magoya-studio/src/formats/registry.js')
const car = await import('/magoya-studio/src/templates/carousels.js')
m.sugerirTodo(frase, { templates: tpl.TEMPLATES, formatos: fmt.FORMATS, carruseles: car.CAROUSELS })
```

Los textos de abajo son copiados de esa salida. La misma corrida en Node dio
resultado idéntico (la función es pura y no toca red).

**Resumen: 26 frases · 21 bien (18 sugerencias correctas + 3 silencios
correctos) · 2 parciales · 3 falla.**

---

## Aciertos

### 1. `webinar de ia en campo el 11 de junio`

```
91 · Evento / webinar      — porque es para invitar y ya tenés fecha (11 de junio), y esta plantilla tiene volanta, titular, la línea de fecha/lugar y el botón de inscripción
75 · Evento sobre foto     — porque es para invitar y ya tenés fecha (11 de junio), y esta pone la tarjeta con la fecha encima de una foto de ambiente
71 · Fecha marcada         — porque es para invitar y ya tenés fecha (11 de junio), y esta la pone grande con el círculo dibujado a mano
```

**Acierta.** Las tres son las tres que uno elegiría. Ojo que esto antes salía mal:
la regla `save-the-date` disparaba con "hay fecha y no hay hora" y ponía
*Fecha marcada* primera. Un webinar con fecha quiere el botón de inscripción,
no un save-the-date. Ahora `save-the-date` sólo dispara si el texto lo pide
con esas palabras.

### 2. `quiero contar el caso de bayer`

```
95 · Caso de cliente       — porque es un caso de cliente, y esta plantilla es la que lleva el resultado con el logo del cliente
65 · Cita / testimonial    — porque es un caso de cliente, y podés contarlo con la frase textual del cliente
60 · Dato / métrica        — porque es para mostrar un resultado (decís “caso”)
```

**Acierta.** Y no inventa nada sobre Bayer: el nombre propio lo ignora, que es
lo correcto. No hay ninguna lista de clientes hardcodeada.

### 3. `carrusel con 3 tips de suelo`

```
[carrusel armado] Guía paso a paso — porque pediste un carrusel y éste ya viene con portada, internos y cierre
91 · Carrusel · portada    — porque dijiste carrusel, y esta es la slide 1, y decís “3 tips”, o sea una lista
70 · Método / pasos        — porque es para explicar algo (decís “tips”), y decís “3 tips”, o sea una lista
```

**Acierta**, y la respuesta buena acá no es una plantilla sino el carrusel
armado `guia` de `carousels.js`. Que sea lo primero que devuelve es el punto.

### 4. `miniatura para youtube de la charla`

```
[formato] yt-thumb — YouTube · Miniatura
82 · Miniatura de YouTube  — porque pediste una miniatura de YouTube y esta plantilla es exactamente eso (1280×720, titular a la izquierda y la persona a la derecha), y esta plantilla ya habla de “miniatura” y “youtube”
```

**Acierta, y devuelve UNA sola.** Esto también estaba mal antes: salía
*Evento / webinar* segunda con 52 puntos, porque "charla" activaba el objetivo
"invitar" y el copy de esa plantilla dice "YouTube". Se arregló subiendo el
listón para las plantillas que sólo pegan por objetivo y no disparan ninguna
regla propia (`UMBRAL_SOLO_OBJETIVO = 58`).

Notar también que "webinar … por YouTube" NO devuelve la miniatura: para eso
la regla pide *miniatura/thumbnail*, o *youtube* + *portada/tapa*.

### 5. `posteo de que estuvimos en expoagro`

```
100 · Collage con stickers — porque estás contando algo que YA pasó, y esta plantilla es el collage de tres fotos con la etiqueta “recap”
 55 · Persona del equipo   — porque es para mostrar al equipo (decís “estuvimos”)
```

**Acierta.** Es el caso que justifica la señal `pasado`: "expo" está en el
lexicón de *invitar*, así que sin eso esto devolvía la tarjeta de evento para
algo que ya sucedió. El tiempo verbal (`estuvimos`) le saca los puntos a
"invitar" y se los da a "equipo".

### 6. `algo para presentar a las dos personas que dan la charla`

```
111 · Quiénes hablan       — porque nombrás a las personas que dan la charla y esta plantilla pone dos retratos con nombre y rol, y es para invitar a algo (decís “charla”)
```

**Acierta**, y devuelve una sola. Las otras cinco plantillas de "invitar"
quedaron en 40 puntos y no llegan al listón. Es el comportamiento buscado.

### 7. `story para instagram avisando que faltan 2 dias`

```
[formato] ig-story — Instagram · Story / Reel 9:16
106 · Cuenta regresiva     — porque estás avisando cuánto falta, y esta plantilla es el número gigante de días, y es para invitar a algo (decís “faltan”)
```

**Acierta**, y además resuelve el formato: 1080×1920 con los márgenes de story.

### 8. `bajamos 70% los tickets de soporte en 4 meses`

```
103 · Dato / métrica       — porque hay un número que es la noticia (70%), y esta plantilla es el número solo, bien grande
 93 · Caso de cliente      — porque es para mostrar un resultado (decís “bajamos”), y hay un número que es la noticia (70%)
 76 · Impacto · recorte + cifra — porque es para mostrar un resultado (decís “bajamos”), y hay un número que es la noticia (70%), y esta lo pone sobre la foto, con la persona recortada
```

**Acierta.** Discutible el orden: si es un resultado de un cliente, *Caso de
cliente* podría ir primera. Pero la frase no dice cliente, así que el módulo no
lo asume. Prefiero eso a que adivine.

### 9. `una frase de un cliente contento`

```
101 · Cita / testimonial   — porque querés poner algo textual que dijo alguien, y es para mostrar un resultado (decís “cliente”)
```

**Acierta.**

### 10. `post de linkedin explicando como trabajamos paso a paso`

```
[formato] li-square — LinkedIn · Post cuadrado
101 · Método / pasos       — porque lo estás contando en pasos, y esta plantilla los numera, y es para explicar algo (decís “como”)
```

**Acierta la plantilla, parcial el formato.** Un "paso a paso" en LinkedIn
normalmente es carrusel (`li-carousel`, 1080×1350), no post cuadrado. La regla
de formato sólo pasa a carrusel si el texto dice "carrusel" o "N slides".
Corregible, pero implicaría adivinar; por ahora queda anotado.

### 11. `algo con la pregunta que nos hacen siempre los productores`

```
108 · Impacto · pregunta del productor — porque arranca de una pregunta real, y esta plantilla la pone en un bocadillo
 82 · Chat de WhatsApp     — porque es para explicar algo (decís “pregunta”), y arranca de una pregunta real …, o la resolvés como conversación de WhatsApp
```

**Acierta.**

### 12. `sumamos a juan al equipo`

```
101 · Persona del equipo   — porque es sobre una persona del equipo, y esta plantilla es el retrato con su frase
```

**Acierta.**

### 13. `no se, algo lindo`

```
(sin sugerencias)
```

**Acierta callándose.** Es el caso más importante del archivo. No hay señal, no
hay respuesta, la persona ve la galería de siempre.

### 14. `un dato de una fuente externa sobre adopcion digital`

```
113 · Insight con fuente   — porque citás un dato de afuera, y esta plantilla tiene el lugar para la fuente además de tu lectura
```

**Acierta.** Distingue *Insight con fuente* de *Dato / métrica*, que es
exactamente la distinción editorial que le importa a marketing (curaduría con
opinión vs. autobombo).

### 15. `capturas del dashboard mostrando resultados`

```
113 · Impacto · pantalla que prueba — porque querés mostrar la pantalla o el gráfico, y esta plantilla tiene el lugar para la captura y las barras que suben
```

**Acierta.**

### 16. `mito vs realidad de la ia en el agro`

```
106 · Mito vs realidad     — porque estás contraponiendo dos cosas, que es literalmente lo que hace esta plantilla
```

**Acierta.**

### 17. `guarda la fecha 18 de septiembre`

```
132 · Fecha marcada        — porque estás pidiendo que agenden la fecha (18 de septiembre), y esta plantilla la pone grande con el círculo dibujado a mano, y esta plantilla ya habla de “guarda” y “fecha”
 91 · Evento / webinar     — porque es para invitar y ya tenés fecha (18 de septiembre), y esta plantilla tiene volanta, titular, la línea de fecha/lugar y el botón de inscripción
 81 · Evento sobre foto    — porque es para invitar y ya tenés fecha (18 de septiembre), y esta pone la tarjeta con la fecha encima de una foto de ambiente
```

**Acierta**, y el orden se invierte respecto del caso 1 — que es lo que
corresponde. El motivo "esta plantilla ya habla de «guardá» y «fecha»" es
verificable: el copy de fábrica de `fecha-marcada.json` dice literalmente
`GUARDÁ LA FECHA`.

### 18. `lanzamos la nueva version del producto`

```
85 · Bloque de color (anuncio) — porque es un anuncio (decís “lanzamos”), y esta plantilla es el bloque de color con volanta, titular y bajada
75 · Tech · titular            — porque es un anuncio (decís “lanzamos”)
```

**Acierta.**

### 19. `que herramienta de ia uso para armar un informe tecnico`

```
73 · Impacto · herramientas — porque preguntás con qué herramienta, y esta plantilla tiene los logos de IA puestos, y esta plantilla ya habla de “herramienta” y “armar”
```

**Acierta.**

### 20. `un chat donde el productor pregunta por el clima`

```
137 · Chat de WhatsApp     — porque lo pensás como conversación, y esta plantilla dibuja el chat
102 · Impacto · pregunta del productor — porque arranca de una pregunta real, y esta plantilla la pone en un bocadillo
```

**Acierta**, y en el orden correcto: "chat" pesa más que "pregunta".

---

## Silencios correctos

### 21. `algo para el dia del trabajador rural`

```
(sin sugerencias)
```

**Bien.** No hay plantilla de efeméride en el set. Lo honesto es no ofrecer
nada antes que empujarla a *Bloque de color* porque sí.

### 22. `placa para el cumple de vale`

```
(sin sugerencias)
```

**Bien.** Mismo caso. Además "placa" no está en ningún lexicón a propósito: es
una palabra de formato, no de intención.

---

## Falla

### 23. `un post contando que la ia no reemplaza al agronomo`

```
(sin sugerencias)
```

**Falla.** *Tech · titular* tiene como copy de fábrica, textual, "La IA no
reemplaza al agrónomo. Lo potencia." Es la plantilla exacta y no la encuentra.

*Por qué:* la frase no tiene ningún verbo de intención ("contando" no está en
ningún lexicón), así que no hay objetivo. El eco de palabras sí pega
(`reemplaza`, `agronomo` = 12 puntos), pero el eco está topeado a 18 y nunca
puede sugerir solo. Es el precio de la capa 3 topeada: prefiero perder este
antes que abrir la puerta a que cualquier coincidencia léxica arme una
sugerencia. Si se quiere arreglar, el camino es sumar verbos de enunciación
(`contando`, `contar`, `decir`, `hablar de`, `opinar`) al lexicón de `anuncio`
o `ensenar` — no subir el tope del eco.

### 24. `una pieza para reclutamiento, buscamos un dev backend`

```
(sin sugerencias)
```

**Falla.** Debería dar *Persona del equipo* (retrato). Detecta bien el objetivo
`equipo` (por "buscamos"), pero ninguna regla a mano cubre reclutamiento, así
que se queda en 40 puntos y no pasa el listón de 58 que rige para las
plantillas que sólo pegan por objetivo.

Es el mismo mecanismo que arregla el caso 4, funcionando en contra acá. Arreglo:
una regla `reclutamiento` de cinco líneas (`buscamos|reclutamiento|sumate al
equipo|hiring|vacante|posicion abierta` → `retrato`).

### 25. `queremos mostrar que ganamos el premio a la innovacion agtech`

```
(sin sugerencias)
```

**Falla.** Debería dar *Bloque de color* o *Tech · titular*: es un anuncio.
Ni "ganamos" ni "premio" están en el lexicón de `anuncio`. Arreglo de dos
palabras, pero lo dejo sin tocar para no calibrar el módulo contra su propio
test — que es la forma más fácil de que un informe mienta.

### 26. `necesito 4 slides de linkedin sobre mapas de rinde`

```
[formato] li-carousel — LinkedIn · Carrusel (retrato)
45 · Carrusel · portada    — porque pediste varias slides, y esta es la slide 1
```

**Parcial.** Acierta el formato (`li-carousel`, que es el correcto) y acierta
la portada. Pero no ofrece el carrusel armado ni el interno ni el cierre,
porque "mapas de rinde" no cae en ningún objetivo y `sugerirCarrusel` no
adivina cuál de los tres presets sin objetivo.

Nota de honestidad: este caso destapó un **motivo falso**. Antes decía "porque
dijiste carrusel" cuando la persona había escrito "4 slides". Está corregido
(`s.diceCarrusel`), pero vale dejarlo anotado: cada vez que el motivo se escribe
en el código en vez de derivarse de lo que la persona tipeó, hay riesgo de
que mienta. Es exactamente el modo de falla que este producto existe para
evitar.

---

## Bordes

| entrada | salida |
|---|---|
| `null`, `undefined`, `''`, `'   '` | `[]` |
| `'?'` | `[]` (activa la regla `pregunta` pero no llega al mínimo de 8 caracteres) |
| `'😀😀😀'` | `[]` |
| 3000 caracteres de `'a'` | `[]`, sin colgarse |
| `'WEBINAR EL 11 DE JUNIO'` (mayúsculas) | idéntico a minúsculas |
| `'  webinar   de   ia  el 11 de JUNIO '` (espacios de más) | idéntico |
| `sugerir(texto)` sin opciones | `[]`, no explota |

Verificado además:

- **Determinista**: dos llamadas con la misma entrada dan salida byte a byte idéntica.
- **No muta**: `JSON.stringify(TEMPLATES)` es igual antes y después de llamar.
- **Sin red**: no hay `fetch`, `import()` dinámico ni dependencias nuevas.

---

## Cómo se corrige cuando falla

Todo lo que decide está en tres lugares del archivo, en este orden de
frecuencia esperada:

1. `LEX` — agregar la palabra que este equipo usa y nosotros no previmos.
2. `REGLAS` — agregar o ajustar una intención. Cada regla son ~6 líneas y se
   lee sola.
3. `SOLO_SI` — si una plantilla muy específica aparece donde no va.

Los umbrales (`UMBRAL`, `UMBRAL_SOLO_OBJETIVO`, `PISO_RELATIVO`) están arriba
de todo y son la última perilla que hay que tocar: mover 5 puntos ahí cambia
las 26 respuestas de este archivo a la vez.
