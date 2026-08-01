# Plan — Magoya Studio

Estado a hoy y todo lo que falta, ordenado. Sale de 6 auditorías (diseño de
home, UX end-to-end, UI/design system, marketing de contenido, research de
variantes, research de previews) + el feedback de uso de Facu y Aye.

---

## ✅ Lo que ya está (v1 completa y en producción)

**Motor:** SVG-first, reflow a cualquier formato, export PNG @2x/@3x · JPG ·
SVG · carrusel ZIP/PDF con Manrope embebida. 8 redes.
**Editor:** rail tipo Canva (Texto/Fondo/Fotos/Elementos/Marca/Ajustes),
canvas con selección, arrastre, handles de resize, snapping con guías,
edición de texto in-place, inspector de propiedades, undo/redo, atajos.
**Contenido:** 16 plantillas por objetivo · 26 fotos del Drive · logos de IA
y redes · trazos · dispositivos Apple con foto en pantalla · quitar fondo en
el navegador · biblioteca "Mis elementos" y "Mis fotos" · guardar plantillas
propias.
**Compartir:** mockups (celular/IG/LinkedIn) claro y oscuro · link de preview
· link de revisión con foto + comentarios anclados (Supabase) · aprobar /
pedir cambios por WhatsApp.

---

## ✅ BLOQUE A (HECHO) — "AI en campo": piezas de alto impacto
> **El foco de esta etapa.** Hoy el motor no llega al nivel de las
> referencias (miniaturas tipo YouTube educativas). Esto es lo que falta.

| # | Qué | Costo | Por qué importa |
|---|---|---|---|
| A1 | `path()` genérico + registro de filtros + **stroke en texto** | M | Bloqueante: sin esto no existe nada del resto |
| A2 | **Contorno + sombra dura + glow** en la persona recortada | S | *El* delta con la referencia: sin contorno el recorte se ve pegado, no compuesto |
| A3 | **Viñeta + oscurecer/desenfocar** la foto de fondo | S | 20 líneas; mejora retroactivamente todas las piezas con foto |
| A4 | Highlight **por palabra** + líneas con estilos distintos | M | La referencia mezcla línea blanca + línea resaltada |
| A5 | `shapes.js`: flechas gruesas, badges, sparkles, bocadillos | M | Objetos paramétricos, se tiñen con el acento |
| A6 | Marco de captura con chrome + **gráficos de barras / sparkline** | M | La "prueba visual" de los resultados |
| A7 | **16 íconos agro/IA** (Tabler, MIT): dron, satélite, sensor, lote, chat-IA… | S | Curaduría, no código |
| A8 | 4 **presets de alto impacto** | M | "Recorte + cifra" · "Pantalla que prueba" · "Tres apps" · "Pregunta del productor" |

**Reglas editoriales de la serie:** nada de robots ni cerebros con circuitos
(la IA se muestra por lo que hace: mapa, alerta, chat, escaneo). No más de
1 de cada 3 piezas usa el preset más clickbait.

---

## ✅ BLOQUE B (HECHO) — Variantes de plantilla
> El mayor multiplicador: **20 plantillas × 11 estilos = 220 composiciones**
> sin escribir ninguna plantilla nueva. Panel "Estilo" en el editor.

- **B1** Ejes overridables en el motor: `plate` (none/scrim/banda/tarjeta),
  `anchor`, `density`, `scale`, `rule`. ✅
- **B2** `variants` en el JSON de la plantilla; si no las declara, se derivan
  de los ejes genéricos (`src/templates/variants.js`). ✅
- **B3** Fila de miniaturas en vivo, renderizadas **con tu contenido real**
  (patrón Canva Layouts). Cambiar de estilo nunca pisa los textos. ✅
- **B4** Lockups: volanta con línea al costado, logo **dentro** de la banda
  cuando hay lugar, padding óptico de la tarjeta. ✅

**Bug de fondo que salió acá:** los ids de `<defs>` (filtros, clips,
degradés) viven en el namespace del DOCUMENTO, no del `<svg>`. Con varias
piezas inline en la misma página, `url(#f0)` resolvía al defs de otra pieza
y la foto se recortaba con las coordenadas equivocadas. Cada pieza usa ahora
su propio prefijo de id.

---

## ✅ BLOQUE C (HECHO) — Confianza (que no se pierda trabajo)

- **C1** Autosave honesto: si se llena el navegador hoy dice "✓ Guardado" y
  **miente**. Chip en rojo + aviso + "descargar ahora". **S**
- **C2** Confirmar acciones destructivas con **"Deshacer" en el toast**
  (proyecto, plantilla, elemento, slide). **S**
- **C3** Nombre del proyecto editable (hoy muestra el de la plantilla). **S**
- **C4** "Guardar como plantilla" pidiendo nombre. **S**

---

## ✅ BLOQUE D (HECHO) — Carrusel y revisión

- **D1** **Reordenar slides arrastrando** + numeración 1/5 en la tira. **M**
- **D2** El preview compartido muestra **solo la slide 1**: que muestre el
  carrusel completo con flechas y comentarios por slide. **M**
- **D3** Una sola puerta para compartir (hoy hay 4 salidas): modal con
  intenciones — "para que lo revisen" / "para mostrar" / "para que lo
  editen". **S**
- **D4** "Mis piezas compartidas" con badge de comentarios nuevos — hoy si
  perdés el link, perdiste el feedback. **M**

---

## ✅ BLOQUE E (HECHO) — Sistema visual (que se vea 5 niveles arriba)

- **E1** Unificar componentes: hay **7 implementaciones del mismo pill** y 5
  tipos de card → `.u-btn` / `.u-card` (CSS ya especificado). **M**
- **E2** **Íconos SVG** en vez de glifos (`⧉ ✳ ▣ ⚙ ☆`) — es el "tell" de
  hecho-por-IA que más se nota. 12 paths ya definidos. **S**
- **E3** Densidad y ritmo: alturas de fila, gaps, escala tipográfica. **S**
- **E4** Dark mode — **deferido a propósito**: un chrome oscuro distorsiona
  cómo se juzga el contraste de la pieza. Los tokens ya quedaron listos. **—**

---

## ✅ BLOQUE F (HECHO) — Contenido y plantillas

- **F1** 2 plantillas más: **"Mito vs realidad"** (el formato de mayor
  engagement en LinkedIn B2B) e **"Insight con fuente"** (dato externo
  citado + lectura de Magoya). **S**
- **F2** Consolidar redundancia: 4 de las plantillas son la misma pieza
  (foto + texto con distinto anclaje) → 2, y el resto pasa a ser variante
  del Bloque B. **S**
- **F3** Validación de copy en la app: sin emojis, sin exclamaciones, un
  solo idioma por pieza, métrica siempre con ventana temporal. **S**

---

## ✅ BLOQUE G (HECHO) — Mobile

- **G1** La **vista de revisión** tiene que ser perfecta en celular
  (marketing revisa desde el teléfono). **M**
- **G2** El editor de 3 columnas pasa a **una columna con bottom sheets**
  (no se esconde detrás de un cartel): el rail es una barra inferior, tocar
  un panel abre su hoja, seleccionar un elemento abre la de propiedades. ✅

---

## 🙋 Decisiones que dependen de vos

0. **RESUELTO:** isotipo extraído del PDF del buzo (3 variantes) + trama de
   la capucha, ya usables. Logos de clientes: eliminados por completo.

1. **Los dos pilares de marca.** Un commit de limpieza sacó el highlight
   amarillo, el glow y los sparkles por "estilo YouTube / genérico de IA" —
   y son justo el lenguaje de las referencias de "AI en campo". Propuesta:
   **corporativo B2B sobrio** (lo que quedó) + **AI en campo educativo de
   alto impacto** (donde el amarillo y el glow sí valen), con reglas
   distintas para cada uno.
2. **Logos de clientes reales.** Se sacaron BASF/Bayer/Corteva/JD/Syngenta
   porque son **prospectos, no clientes** (bien sacado). Faltan los SVG de
   **Apeel** y **Biome Makers**, que sí lo son — sin ellos la plantilla
   "Caso de cliente" no puede mostrar prueba social real.
3. **El isotipo de Magoya.** Solo tengo los 4 wordmarks; el isotipo suelto
   no está en los assets.
4. **Fotos propias.** Las de "People in field" del Drive **no tienen
   transparencia** (no son recortes). Con el quitar-fondo de la app se
   resuelve, pero si el diseñador tiene los PNG recortados, mejor.

---

## Estado: el roadmap A–G está completo

Todo lo planificado (A, B, C, D, E, F, G) está implementado, verificado en
el navegador y desplegado en https://facundo-web.github.io/magoya-studio/

**Bugs de fondo que aparecieron y se arreglaron en el camino** (no estaban
en el plan y afectaban a toda la app):

- Los ids de `<defs>` (filtros, clips, degradés) viven en el namespace del
  DOCUMENTO: con varias piezas inline, `url(#f0)` resolvía al defs de otra
  pieza y las fotos se recortaban con coordenadas ajenas.
- `shiftPath` movía los números del `d` con una regex y también corría los
  RADIOS de los arcos → el bocadillo salía deforme.
- `object()` dibujaba la imagen cuadrada aunque el objeto tuviera otro alto
  → el dibujo quedaba corrido respecto a su caja de selección.
- Agregar una forma desde el panel tiraba `ReferenceError`: **ninguna** se
  podía sumar tocándola.
- Deshacer guardaba un estado por píxel de arrastre; ahora cada gesto es un
  paso (y no se usa reloj: el navegador redondea `Date.now()` a 1s).
- El isotipo salía espejado en Y (la `m` se leía como `w`).
- Compartir decía "no se pudo subir" cuando la pieza **sí** se había subido
  y lo único que había fallado era el portapapeles.

## Auditoría de consistencia (después de cerrar A–G)

Revisión flujo por flujo de la app entera. Encontró **13 inconsistencias
reales**, todas arregladas y verificadas:

1. Ninguna operación de slide entraba al historial → **borrar una slide no
   se podía deshacer**. (Pérdida de trabajo.)
2. Sólo el borrado de proyecto ofrecía "Deshacer"; faltaban plantilla propia
   y elemento de la biblioteca.
3. El nombre editable de la pieza se pisaba solo al editar el título.
4. "Guardar como plantilla" guardaba sin preguntar el nombre (C4 no estaba).
5. Quedaban ~20 glifos sin migrar a íconos, y el chevron de menú apuntaba
   hacia el costado.
6. El rail marcaba mal el panel activo al tocar dos veces el mismo botón.
7. "Grosor del trazo" aparecía en el isotipo, donde no hace nada.
8. Toda foto se llamaba "Imagen" en el inspector.
9. El cartel "Subí una foto" tapaba lo que acababas de colocar.
10. **11 de 19 proyectos guardados eran inalcanzables**: la home mostraba
    sólo 8 y no había forma de ver el resto.
11. El badge de comentarios nuevos quedaba con el número viejo al volver.
12. El detector de mezcla de idiomas saltaba con textos normales
    ("el equipo de data", "nuestro insight del mes").
13. Al desplegar una versión con la pestaña abierta, todo lo que carga bajo
    demanda (quitar fondo, ZIP, PDF) fallaba con un error críptico. Ahora
    aparece un aviso claro con botón de recargar.

**Cobertura de la verificación:** 465 combinaciones plantilla × formato ×
variante renderizadas sin un fallo (21 plantillas, 13 formatos, 11
variantes). Flujos probados de punta a punta en el navegador: plantilla, en
blanco, chat, carrusel (agregar / reordenar / borrar / deshacer), variantes,
cambio de formato, fotos, quitar fondo, compartir (las 3 intenciones),
revisión con comentarios anclados, export PNG @3x / ZIP / PDF, y mobile.

## Límites conocidos (honestos)

- **Sólo probado en Chrome** (desktop y viewport de 375px). No se probó en
  Safari, Firefox ni en un teléfono real.
- ~~El guardado local se llena.~~ **RESUELTO.** Eran dos cosas: 5 de las 7
  formas de poner una foto guardaban el archivo **crudo** (una foto de
  celular de 4 MB se volvía 5,4 MB de texto y llenaba sola la cuota), y todo
  eso vivía en localStorage (~5 MB para todo el sitio). Ahora toda foto se
  comprime al entrar y los bytes van a **IndexedDB** (10 GB disponibles acá);
  en localStorage queda una referencia de 24 caracteres. Medido: una pieza
  con foto dentro de un celular pasó de llenar la cuota a **1 KB**.
- La validación de copy es heurística: puede no detectar una mezcla de
  idiomas sutil. Avisa, nunca bloquea.
- Sin control de concurrencia: si dos personas comentan la misma pieza a la
  vez, los comentarios conviven pero no hay aviso en vivo.

---

# Plan en curso — "que nada haya que aprenderlo"

Sale de dos investigaciones: cómo muestran el preview las plataformas y las
herramientas reales, y una auditoría de usabilidad de toda la app.

## ✅ Hecho en esta tanda

- **Dispositivos con volumen**: sombra de 6 capas apiladas (una sola siempre
  se lee como ícono) y reflejo de pantalla con **corte duro al 35%** — el
  borde neto es lo que el ojo lee como vidrio.
- **El preview dejó de ser un teléfono enano.** Hallazgo del research: en el
  feed **ninguna herramienta buena dibuja el teléfono**. Feed IG y LinkedIn
  ahora son la tarjeta de la red con medidas reales, sobre el fondo real de
  la app y con las piezas vecinas cortadas. El marco queda para Story/Reel,
  a 405×720 y siempre 9:16.
- **Historial estilo Figma**: el paso se cierra cuando termina el gesto.
- **7 arreglos de usabilidad** (historial cruzado entre proyectos, selección
  que sobrevivía al cambio de slide, resize desde la esquina opuesta,
  captura de puntero al arrastrar, marco del texto seleccionado, un solo
  control de capas, el formato en la barra del lienzo).

## ✅ BLOQUE H (HECHO) — El lienzo se maneja solo

- **H1 Zoom** (50 / 100 / Ajustar + ⌘scroll). Hoy una story 1080×1920 en una
  notebook entra al ~35% y ajustar el borde de un recorte es imposible: la
  única salida es exportar, mirar y volver. **M**
- **H2 Tirador de rotación** en el lienzo, con snap cada 15° con Shift. Hoy
  sólo se rota desde un slider del panel. **M**
- **H3 Escape cancela** la edición de texto (hoy ya escribió) y Enter hace
  lo mismo en el lienzo y en el panel. **S**

## ✅ BLOQUE I (HECHO) — Una sola forma de hacer cada cosa

- **I1 Fondo + Fotos son un solo panel.** Hoy los dos muestran la MISMA
  biblioteca con dos resultados distintos: en uno la foto es el fondo, en el
  otro es un objeto encima. Hay que aprender la distinción antes de poder
  elegir el panel. Se resuelve preguntando en el momento. **M**
- **I2 Un solo control de encuadre** (el punto arrastrable), no dos sliders
  X/Y en un lado y el punto en el otro. **S**
- **I3 Todo borrado ofrece Deshacer** — hoy hay tres mecanismos según qué
  borres, y el objeto (el caso más frecuente) es el único sin red. **S**
- **I4 Carrusel + formato incompatible**: hoy podés quedar con 5 slides en
  formato "Miniatura de YouTube" y nadie avisa. **S**

## ✅ BLOQUE J (HECHO) — Las palabras del equipo, no las del diseñador

- **J1** volanta→etiqueta (¡el mismo campo tiene dos nombres!), placa,
  scrim/degradé, "clima", tratamiento, app-icon, glow, opacidad, esquema de
  color vs color de fondo, imagen libre / recorte-pantalla. **S**
- **J2 Selector de logo con swatches + "Automático"** — hoy es una lista de
  texto donde hay que deducir cuál contrasta con el fondo. **S**
- **J3 Nombres de color visibles**, no sólo en el tooltip (en celular no hay
  hover: son puntitos anónimos). **S**

## ✅ BLOQUE K (HECHO) — Que el estado sea visible

- **K1 Progreso real al exportar** un carrusel: hoy el aviso se va a los
  2,2 s y un ZIP de 8 slides tarda mucho más; parece colgado. **M**
- **K2 "Aprobar" tiene que aprobar.** Hoy abre WhatsApp y no guarda nada: el
  que revisa cree que terminó y el que espera no se entera. **M**
- **K3 Miniaturas de galería con foto** — hoy todas las plantillas con foto
  se ven como la misma tarjeta gris. **S**


---

## Estado: H, I, J y K completos

Todo el feedback está implementado y verificado en el navegador. Lo medido:

- El resize mantiene la esquina opuesta **exacta** mientras el objeto crece.
- Un gesto = **un** paso de deshacer (245→315 px con un solo ⌘Z de vuelta).
- Aprobar queda guardado en Supabase y se ve como **"Aprobada"** en Inicio.
- El botón de descarga dice **"Slide 3 de 4…"** durante la exportación.
- La galería muestra 19 plantillas, las de foto con foto de verdad.

### Cierre: los 25 hallazgos de la auditoría, uno por uno

Repaso final contra el código. Quedaban cuatro y ya están:

- **#4** El historial guardaba SÓLO las slides. Al meter el cambio de
  formato adentro quedó peor: ⌘Z deshacía el cambio anterior de contenido y
  dejaba el formato cambiado. Ahora el paso es el estado completo (slides +
  formato + si es carrusel), y convertir/volver de carrusel también entra.
- **#13b** Alt+click cicla hacia el objeto de abajo cuando dos se pisan.
- **#14b** Menú de click derecho: Duplicar / Subir / Bajar / Quitar.
- **Carrusel en el preview**: se veía como una pieza suelta. Ahora se pasa
  slide por slide con los puntos de Instagram y el contador "3/3".

### Nueva tabla en Supabase

`verdicts` (share_id, author, verdict ok|changes, created_at) con RLS de
lectura e inserción anónimas, igual que `comments`.

---

## BLOQUE L — La sesión de uso con Aye e Inés (27 jul)

La primera vez que dos personas que **no diseñan** usaron la herramienta
delante mío. El diagnóstico de fondo lo dijeron ellas dos, casi igual:

> Aye: "siento que voy a tardar un montón… me cuesta sentir que tengo que
> tomar todas las decisiones de esto."
> Inés: "si ya está ahí, obvio que lo uso. Pero a mí no se me ocurre ponerlo."

No les falta la herramienta: les falta **la pieza ya encarada**. Todo lo de
abajo sale de ahí.

### ✅ Hecho y verificado

| # | Qué | La frase que lo pidió |
|---|---|---|
| L1 | **"Cambiar diseño" cambia el diseño.** `applyDesign()` separa DISEÑO (lo pone la plantilla) de COPY (se conserva), con cadena de roles parecidos | "¿ahí cambiaste? — falló" |
| L2 | **"Usar en todas"**: el diseño de esta slide pasa al resto sin tocar textos | "quiero combinar diseños y no es muy claro cómo" |
| L3 | **Color del texto** (6 roles de marca), arriba del marcador | "me parecía que era un embole, entonces por eso lo resalté" |
| L4 | La tira del carrusel en dos grupos: sumar slides / esta slide | "desde plantilla y cambiar diseño no se entiende" |
| L5 | **Arrastrar los bloques de texto** (`content.pos`), con "Volver a su lugar" | "lo quería acá arriba, pero no me dejaba" |
| L6 | **Carruseles armados**: portada + internos + cierre, mismo diseño en todos | "una portada, tres internos y un cierre" (Inés, textual) |
| L7 | **Puntitos** paramétricos: cuántos y cuál está lleno | "no les puse para que edites cuánta cantidad querés" |
| L8 | **Gemini** con tile blanco y glifo de color | "no hay violeta así… violeta el cosito, no el fondo" |

(Antes, en el Loop 10: tamaño grande que sí se toma, MAXCHARS al doble,
"Efectos" pasa a llamarse **Fondo**, tonos claros, panel lateral que no se
puede esconder del todo.)

| L9 | **Split en el motor** + 4 plantillas nuevas de las referencias | "más plantillas con más estilos de diseño, que ya estén armados" |
| L10 | Las piezas libres conservan **su propio texto** en la galería | "los textos no son representativos de lo que hay adentro" |
| L11 | **Foto de fondo en cualquier plantilla** (`bg` manda sobre la plantilla) | "debería poder permitirte una vez que lo estás editando" |
| L12 | **Desenfoque y Oscurecer** por foto | "si querés que sea más blureada" |
| L13 | La **ventana**: marco blanco, y adentro captura *o* texto *o* esqueleto | "este quedó mal… le falta mejora" |

| L14 | **8 plantillas nuevas** de las referencias · 30 en total | "más plantillas con más estilos de diseño, que ya estén armados" |
| L15 | El logo pasa a 0.24 del lado corto, con sombra sobre foto | "queda como muy por debajo" |
| L16 | **8 esquemas de color** (Verde digital, Verde medio, Lime, Arena) + acento Crema | "que tenga más variación de colores" |
| L17 | Galería de 178/150 a 146/124: seis por fila | "no te entra todo acá, quedó todo muy grande" |
| L18 | Lo que el motor sabía y no se podía activar: ángulo del degradé, etiqueta en contorno, zoom de la captura, reflejo del dispositivo, color del tile | — |
| L19 | Dos pestañas ya no se pisan (`rev` por proyecto, sin merge automático) | auditoría |
| L20 | Volanta manuscrita medida con su tipografía · `fitText` corta con puntos suspensivos · campo Valores · nombres accesibles | auditoría |

### Bugs que aparecieron haciendo lo de arriba

- El rol `cta` estaba en `STACK_ORDER` pero no en `resolvePiece`: una
  plantilla clásica que lo declarara lo perdía en silencio.
- Los paneles de foto vacíos no rotaban (`imageCover` no aceptaba rotación),
  así que en la galería una plantilla inclinada se veía derecha.
- Un `useEffect` colocado arriba de la declaración de su dependencia:
  ReferenceError en render, pantalla en blanco, y el build compilando igual.
- Un acento verde sobre los fondos verdes nuevos era invisible. `acentoLegible()`
  mide contraste real y cae al del esquema.

| L21 | Forma **panel**, chat teñido por el esquema, pivote de rotación en fotos con marco, criterio único de sombra | roadmap anterior |
| L22 | **Cambiar diseño ya no come texto**: lo que no entra queda guardado y vuelve | QA |
| L23 | Una URL ya no se va de la pieza (`wrapText` parte palabras) · se respetan los saltos de línea | QA |
| L24 | "Quiénes hablan" salía rota de fábrica: rótulo cortado, rótulos pisándose, título sobre los retratos | QA |
| L25 | La notebook nunca mostró la foto en su pantalla | agente del motor |

### Pendiente

1. **En una plantilla que no es "libre" no se puede agregar un texto.** En
   "Cita / testimonial" no existe "+ Agregar texto"; en "Slide en blanco" sí.
2. **El PNG se baja con el título de la slide y el ZIP con el nombre del
   proyecto.** Dos criterios para lo mismo.
3. **"Misceláneas" tiene un solo elemento.** Una categoría con un ítem se lee
   como que algo falló al cargar.
4. **El carrusel armado no arranca parejo**: la portada es el esqueleto gris
   de foto y las otras cuatro ya tienen color.
5. **Un objeto imagen sin marco se dibuja en caja cuadrada** aunque la foto
   sea 3:2 — no se deforma, pero los handles no abrazan lo que se ve.
6. Cosmético: la volanta de "Carrusel · portada" es la única en minúscula;
   el chat sobre "Verde digital" pierde la referencia a WhatsApp.

### Cubierto por el barrido (anda)

Las 26 plantillas abren y dibujan sin solapes ni texto fuera del lienzo.
Cambio de formato en cuadrado, 9:16 y 1280×720. Los 3 carruseles armados.
Agregar, arrastrar, redimensionar, rotar, duplicar y borrar objetos y textos;
deshacer y rehacer revierten el paso justo. Foto de fondo, encuadre, B&N,
desenfoque y oscurecer. Export PNG (3240×3240, PNG válido) y ZIP. Guardar y
volver conserva formato, slides, textos, foto, objetos y nombre. En 375×812
no hay scroll horizontal y los seis paneles abren.

### Fuera de alcance por ahora (decidido con Facu)

Usuarios, roles, permisos y notificaciones de feedback: "sería como otro
level". El link de revisión actual se queda como está hasta la Fase 3.

---

## BLOQUE S — Los estilos (medido, jul 2026)

Facu: "los estilos de las piezas no parecen ajustar la pieza y son casi
imperceptibles". Era cierto y se midió.

**El número.** De 235 combinaciones plantilla × variante, **35 eran píxel a
píxel idénticas** al Original y el **46,8% cambiaba menos del 1%** de la pieza.
El mejor cambio de esquema de color mueve 263 sobre 441; el mejor cambio de
Estilo movía 48. La palanca llamada "Estilo" era la más débil de todas.

### ✅ Arreglado (Loop 28) — eran bugs, no diseño

- **La placa se pintaba del color del fondo** (`fill: scheme.surface`, el mismo
  del rectángulo de atrás). "Texto en tarjeta" y "Texto en barra" dibujaban un
  rectángulo invisible en las 19 plantillas sólidas. Ahora "Texto en barra" en
  Caso de cliente cambia el 51% de la pieza.
- **La banda se comía la pieza**: iba del tope del texto al borde inferior, así
  que con el ancla arriba tapaba todo y la foto desaparecía.
- **Se ofrecían opciones que no hacen nada**: el catálogo se emitía sin
  preguntarle a la plantilla qué es.

Resultado: 235 → 178 opciones, idénticas 14,9% → 2,2%, bajo 1% 46,8% → 13,5%.

### ✅ Los seis estilos con silueta propia (U3) — hecho y medido

El diagnóstico: los cinco ejes son **sub-layout**. Mueven el bloque de texto
dentro de un marco que nunca cambia. Lo que el ojo usa para decir "esto es
otra cosa" —dónde están las masas claras y oscuras, cuánta pieza es tinta y
cuánta imagen— es exactamente lo que ninguna variante tocaba.

**La regla que ordenó la solución:** el esquema decide *qué* colores hay; el
estilo decide *cuánto* de cada uno y *dónde*. Ninguna silueta usa un color
que el esquema no tenga.

**La vara, primero.** `scripts/siluetas.mjs` rasteriza la pieza a 128 px con
el motor real y cuenta píxeles contra el Original. **Si un estilo no cambia
el 25%, no entra al panel.** El script mide el catálogo entero y sale con
código 1 si alguna combinación ofrecida no llega: la próxima persona que
agregue un estilo corre la misma vara.

Lo primero que midió fue el panel viejo, y lo confirmó: **141 de 178
combinaciones por debajo del 25%.** Medianas: Centrado 9,9% · Con aire 6,8%
· Titular grande 8,6% · Etiqueta con línea 0,2%.

| Estilo | mediana | peor | mejor | plantillas |
|---|---|---|---|---|
| A sangre | 99,9% | 71,1% | 100% | 26 |
| Media pieza | 57,9% | 32,3% | 64,8% | 22 |
| Bloque de color | 49,4% | 29,8% | 62,2% | 25 |
| Recuadro | 40,8% | 30,2% | 76,5% | 23 |
| Tarjeta | 38,4% | 30,6% | 86,2% | 23 |
| Titular gigante | 31,7% | 25,2% | 99,8% | 16 |

**135 combinaciones ofrecidas, las 135 arriba del 25%, en los 13 formatos.**
El guard de contraste sigue en cero (18.056 piezas, 66.440 pares) y ninguna
línea se sale del lienzo.

**El panel dejó de ser una lista de ajustes y pasó a ser siete siluetas.**
Salieron Arriba / Abajo / Centrado (el ancla se elige ahora en el panel
Texto, que es donde uno la busca), Con aire, Titular grande y Etiqueta con
línea. Texto en tarjeta y Texto en barra los absorben Tarjeta y Bloque de
color. Ninguno se borró del motor: siguen siendo ejes y las plantillas los
usan como default.

**Dónde no se ofrece cada uno, con el motivo medido** (`NO_VA` / `NO_VA_EN`
en `templates/variants.js`): Media pieza no va en una plantilla que ya es
media pieza (Foto al costado) ni con zócalo (24,2%); Titular gigante no va
donde el héroe es una cifra —`metric` ya sale a sizeRel 0,2 y ocupa el
ancho, así que la pieza YA es un titular gigante (17-20%)—; Tarjeta y
Recuadro no van donde la plantilla clavó un texto al 6% del borde, porque el
marco ocupa el 8,5%. **Y con eso se cerró la deuda que dejó U2:** el estilo
que plantaba el texto sobre el gráfico de `impacto-pantalla` y sobre los
retratos de `speakers` era *Centrado*, que ya no existe; las siluetas que
colisionaban se resolvieron por el otro camino que estaba planteado —no se
ofrecen para esa plantilla—. `CONOCIDAS` quedó vacía.

**Seis cosas del motor que las siluetas destaparon y hubo que arreglar:**

1. El 12% de aire del ancla de arriba **nunca se descontaba** del alto
   disponible: el stack se ajustaba contra la caja entera y después se lo
   empujaba 12% para abajo. No saltaba porque ninguna composición llegaba a
   llenar la caja; con un titular que crece hasta llenarla se salían 40
   líneas de una.
2. El auto-ajuste sólo sabía **achicar**. Un titular gigante hecho con un
   multiplicador fijo dependía del largo del copy: la cita corta cambiaba el
   19% de la pieza y el titular largo el 91%. Ahora el bloque de más
   jerarquía **crece hasta llenar la caja**, y se frena en la palabra más
   larga (si no, "Desayuno" salía "Desayu / no").
3. El color de un bloque suelto se decidía por su **esquina** y no por su
   centro: con dos campos en el lienzo, un nombre que arranca al 7% quedaba
   pintado con la tinta del marco que empieza al 8,5%.
4. El **wordmark** se elegía por el esquema y la silueta le cambia el campo
   de abajo: negro sobre el borde de tinta era invisible. Ahora lo decide el
   contraste con lo que quedó abajo, y Bloque de color y Media pieza le dan
   una caja propia (estaba aterrizando encima del texto).
5. El **aviso de contraste de la UI** (`copyCheck.js`) medía contra la
   superficie del esquema: con un bloque de acento abajo avisaba de una
   pieza que no existe. Le pregunta al motor (`siluetaInfo`).
6. El **tamaño común del carrusel** (`medirPieza`) no sabía de siluetas: una
   slide con Titular gigante quedaba clavada al tamaño de una pieza que no
   era la suya. Ahora mide con la misma caja y los mismos pesos — y el
   titular que crece se pisa el lock a propósito: el lock existe para que
   una cita no salte de 30 a 58 px por casualidad, no para impedir que una
   slide sea a propósito un titular gigante.

Una séptima, chiquita y del mismo tipo: el titular que crece hasta el borde
le quedaba encima al wordmark, así que ahora le reserva su altura.

Se miraron las piezas renderizadas en el navegador, no sólo los números:
las seis siluetas sobre las 26 plantillas, más el editor real (panel Estilo,
carrusel con el tamaño común, y el control de posición del bloque que se
mudó al panel Texto).

**Lo que la vara no puede medir, dicho de frente.** No hay rasterizador de
SVG en el proyecto y no se agregaron dependencias: el script pinta con las
mismas primitivas que emite el motor. Las fotos son un gris plano, el texto
se pinta como una caja por carácter y el motivo y el wordmark no se pintan.
Todas las diferencias van para el mismo lado —quedarse corto—, así que un
estilo que pasa, pasa. Lo que el número no ve lo vio el ojo: cuatro de los
siete arreglos de arriba salieron de mirar las piezas renderizadas, no la
tabla (el wordmark encima de la cita, el motivo cruzado por el titular, el
titular partido al medio, el stack encima de los dos nombres).

Y una limitación de la vara que conviene tener a mano: mide con el copy que
trae la plantilla. Tres plantillas traen un titular de dos palabras a
propósito, y ahí "Titular gigante" no tiene con qué llenar la pieza (23-24%);
el script las vuelve a medir con un titular del largo que recomienda
MAXCHARS —31-35%— y lo dice en la corrida. Medir el ejemplo no es medir la
herramienta.

### ✅ Los nueve arreglos previos (U2) — hechos y medidos

El guard (punto 9) se construyó **primero** y sirvió de red para los otros
ocho: `scripts/contraste.mjs` dibuja cada plantilla × estilo × esquema con el
motor real contra un builder espía que anota qué quedó abajo de qué texto.

**28 plantillas × sus estilos × 8 esquemas = 1776 piezas, 6640 pares de
texto/fondo: 389 por debajo del mínimo → 0.** Barriendo los 13 formatos
(23.088 piezas, 78.648 pares) también da 0.

1. ✅ `mejorTinta` salió de `chatPalette` y decide toda la app; `contrastOn`
   (umbral de luminancia, se equivocaba en los tonos del medio) ya no existe.
2. ✅ `mutedColor` se separa del fondo real hasta el mínimo.
3. ✅ `acentoLegible()` recibe el fondo contra el que se va a ver.
4. ✅ El color elegido a mano se conserva y se empuja hasta que se lee.
5. ✅ `metric` y `cta` son unidades: no se parten, se achican (`−70%` a
   escala 1,4 salía `−70`/`%`; ahora baja de 302 a 206 px y entra entero).
6. ✅ El stack se mide entero: primero se recorta el aire, después el tamaño.
   Reproducido con `metodo` + tamaño a mano: y=−376 con `roomy` (−115 con
   `normal`, o sea que `roomy` triplicaba el desborde) → adentro del margen.
7. ✅ `scrim` sin foto degrada a `none` en vez de dibujar nada en silencio.
8. ✅ Un objeto que no se distingue del fondo se separa. Umbral 1,2 y no 3:1
   a propósito: una burbuja blanca sobre crema (1,27:1) se lee y forzarla la
   volvía gris.
9. ✅ `node scripts/contraste.mjs` (ver README). Sale con código 1 si hay
   fallas; la deuda declarada vive en `CONOCIDAS`, arriba del script.

**Lo que queda, dicho de frente:** 9 pares (82 en los 13 formatos) donde el
estilo *Centrado* deja el texto encima de un objeto de la plantilla —el
gráfico de `impacto-pantalla`, los dos retratos de `speakers`—. No es
contraste, es colisión: el color no lo puede arreglar. La decisión es de
diseño y es de este bloque: o la variante corre el objeto, o esa variante no
se ofrece para esa plantilla.

También, de paso: el aviso de contraste de la UI (`lib/copyCheck.js`) tenía
su propia copia de las reglas y quedaba viejo el mismo día. Ahora importa las
del motor. Como el motor ya no genera pares ilegibles, el aviso **no salta
nunca**: hay que decidir si se convierte en "te corregí el color" (que es lo
que de verdad pasa ahora) o se retira.

Las imágenes de la propuesta están renderizadas con el motor real.

---

# BLOQUE T — El copiloto (jul 2026)

Facu: *"el buscador o espacio para prompt es muy limitado. Quiero que sea casi
una LLM: que recomiende, que si le hablás te responda, que si le pedís ideas te
dé ideas — pero todo desde las posibilidades que tiene la herramienta. Que sea
más smart, que te muestre las funciones como cuando interactúo acá con vos. Y
que recuerde qué hizo, qué no, qué sirvió, qué puede mejorar, qué salió la
última vez, qué está pasando en las redes de Magoya, si algunas piezas tienen
más impacto."*

Es un cambio de categoría, no una mejora del buscador: de **clasificador**
(una frase → un objetivo) a **copiloto** (una conversación → acciones sobre la
herramienta).

## La tensión que hay que resolver primero

El producto nació de "diseñar sin que la AI delire". El buscador de hoy tiene
una aduana que garantiza que el modelo **no puede escribir una sola palabra**
que la persona no haya tipeado. Facu ahora pide justo lo contrario: que dé
ideas.

**La resolución no es sacar la aduana, es cambiar su regla:**

> Antes: el modelo **no puede inventar**.
> Ahora: el modelo **puede proponer, no puede imponer**.

En concreto, tres invariantes que no se negocian:

1. **Nada entra a una pieza sin un sí.** Todo texto que escriba el modelo llega
   como propuesta con Aceptar / Descartar, y se ve el antes/después. Nunca se
   escribe solo en el lienzo.
2. **Sólo puede ofrecer lo que existe.** Las acciones del copiloto son un
   contrato cerrado generado del código real (`capabilities.js`). Si una función
   no está en el contrato, el modelo no la puede nombrar ni prometer.
3. **Los datos duros los siguen leyendo las reglas.** Fecha, hora, cifra, red:
   una expresión regular no se equivoca leyendo "11 de junio", un modelo sí.
   `sugerir.js` no se jubila — pasa a ser una herramienta que el copiloto llama.

## Lo que NO se puede hacer hoy, dicho de frente

**Las métricas de las redes de Magoya no están conectadas.** No hay API de
LinkedIn ni de Instagram en este entorno, y fingir que sí sería exactamente el
delirio que el producto viene a evitar. El bloque T6 se diseña con carga real
pero manual (y pegado de export), con la costura lista para enchufar una API
cuando exista. El copiloto va a decir "no tengo datos de esta pieza" cuando no
los tenga, en vez de inventar un número.

---

## T1 · El contrato de capacidades

Un solo archivo, `src/lib/capabilities.js`, que es **la fuente de verdad de lo
que el copiloto puede hacer**. Cada capacidad declara: nombre, para qué sirve
en castellano, parámetros con su enum real, y el ejecutor del lado del cliente.

Se genera contra el inventario real del motor: 29 plantillas con sus roles, 13
formatos, 8 esquemas, 5 acentos, 9 estilos, 3 carruseles, 26 fotos, ~55 objetos
colocables, 8 degradés.

Por qué un archivo y no prompt suelto: cuando mañana se agregue una plantilla,
el copiloto se entera sola. Un prompt escrito a mano se desactualiza el primer
martes.

## T2 · El agente

`supabase/functions/copiloto` reemplaza a `entender`. Deja de ser un
clasificador de un tiro y pasa a ser un **loop de tool-use partido entre
servidor y cliente**: el modelo pide una acción → el servidor la devuelve → el
cliente la ejecuta contra el estado real (que vive en el navegador, no en la
nube) → se le devuelve el resultado → sigue.

El estado vive en el cliente por diseño (localStorage + IndexedDB, sin login),
así que el loop tiene que cruzar. No es un rodeo: es la única forma de que el
copiloto vea de verdad el proyecto abierto.

Modelo `claude-opus-5`, salida en streaming, y la aduana v2 corriendo sobre
cada tool-call antes de tocar nada.

## T3 · La conversación (y que se vean las funciones)

El input de una línea se convierte en un panel de conversación:
- **Turnos** con lo que dijo cada uno, y persistencia de la sesión.
- **Las acciones se ven mientras pasan** — "Buscando plantillas de webinar…",
  "Armando la pieza…" — igual que las herramientas acá. Facu pidió esto
  textual: *"que te muestre las funciones"*.
- **Sugerencias de arranque** cuando está vacío, tomadas de las capacidades
  reales, no de un texto escrito a mano.
- **Las piezas se previsualizan adentro de la conversación** y se abren de ahí.

## T4 · La aduana v2 — propone, no impone

- Todo texto generado llega como **propuesta**: card con Aceptar / Descartar /
  Pedir otra, y el antes/después visible.
- Aceptar es lo único que escribe en el proyecto.
- Se marca de dónde salió cada texto: lo escribió la persona, lo reubicó una
  regla, o lo propuso el modelo. Esa procedencia se guarda con la pieza.
- El copy propuesto pasa por `copyCheck.js` antes de mostrarse (sin emojis, sin
  signos de exclamación, contraste, etc.): las reglas editoriales de la marca
  valen igual para el modelo que para una persona.

## T5 · La memoria del equipo

Hoy la memoria es un contador de descargas en localStorage — muere con el
navegador y no cruza personas. Lucho pidió lo contrario: *"un historial, y que
puedas volver sobre las piezas que más te sirvieron"* y *"una especie de
entrenamiento de curaduría"*.

Tablas nuevas en Supabase:
- `bitacora` — qué pieza se hizo, con qué plantilla, para qué red, cuándo, quién.
- `publicaciones` — cuál de esas efectivamente salió, dónde y qué día.
- `metricas` — el impacto de las que salieron (T6).
- `conversaciones` — los turnos del copiloto, para que la memoria cruce sesiones.

El copiloto las lee antes de recomendar. "La última vez que hiciste un webinar
usaste Evento sobre foto y tuvo el doble de guardados que el promedio" sólo se
puede decir si eso está guardado.

## T6 · El pulso de las redes

- **Carga manual, treinta segundos**: después de publicar, la pieza pregunta
  dónde salió y más tarde cuántos likes/comentarios/guardados tuvo.
- **Pegar un export**: aceptar el CSV que bajan de LinkedIn/Meta y matchear por
  fecha + red.
- **Lectura honesta**: el copiloto compara contra el promedio del equipo y dice
  el n de la muestra. Con 3 piezas medidas dice "con 3 piezas todavía no puedo
  afirmar nada", no "esto funciona mejor".
- **La costura para la API** queda hecha: un adaptador por red, hoy con una
  sola implementación (manual).

## T7 · Ideas con foco de marketing

Lo que Facu pidió al final: *"que permita construir piezas con ese foco de
marketing y diseño y sobre todo de redes"*. El copiloto puede:
- proponer **ángulos** para un tema (el caso, el dato, el mito, la pregunta) y
  mostrar qué plantilla sirve para cada uno;
- proponer una **secuencia** (esto da para carrusel de 5, o para tres piezas en
  la semana);
- decir **qué le falta** a un pedido para que la pieza salga bien (no hay cifra,
  no hay fecha, el titular tiene 140 caracteres y entran 90);
- **repetir lo que funcionó** — pero sólo cuando hay datos que lo respalden.

## Criterios de aceptación del bloque

1. El copiloto **nunca** nombra una función que no esté en `capabilities.js`.
2. Ningún texto propuesto por el modelo llega a una pieza sin un click de
   Aceptar.
3. Sin red o con la función caída, la home sigue funcionando con las reglas de
   hoy: el peor caso es el producto de ayer, nunca una pantalla muerta.
4. Cuando no hay datos de impacto, lo dice. Nunca estima un número.
5. Las acciones que ejecuta se ven mientras pasan.

---

## R3 — cerrado por absorción (ago 2026)

R3 ("la arquitectura de la decisión") nació de Aye — *"me cuesta sentir que
tengo que tomar todas las decisiones"* — y de Lucho — *"hay que ir
reduciéndole el lugar a la duda"*. Se escribió antes del copiloto, y el
copiloto es la respuesta a la mayor parte: le contás qué querés y te abre la
pieza encarada.

Lo que quedaba vivo y se hizo: **las plantillas con foto abren con su foto
de muestra** (la misma que muestra la miniatura — eran dos caminos distintos
y el que abría te daba el esqueleto gris: una decisión pendiente dibujada en
el lienzo).

**Los "niveles de usuario" (básico/intermedio/pro) se cierran sin hacer.**
El copiloto ya es el nivel: continuo, sin declarar nada antes de empezar. Un
selector de modos sería una decisión más para gente que nos dijo que le
sobran decisiones.

Pendiente heredado, chico y concreto: capacidad `poner_foto({slug})` para
que el copiloto pueda elegir foto del banco (hoy la nombra pero no la puede
poner), y revisar que ningún chip de arranque ofrezca carrusel en formato
que no lo admite.
