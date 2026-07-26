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
