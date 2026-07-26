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

## 🔴 BLOQUE A — "AI en campo": piezas de alto impacto
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

## 🟠 BLOQUE B — Variantes de plantilla
> El mayor multiplicador: con esto las 16 plantillas pasan a ~45 piezas
> distintas sin escribir ninguna nueva.

- **B1** Ejes overridables en el motor: `plate` (none/scrim/banda/tarjeta),
  `anchor`, `surface`, `density` (cuánto texto), `scale`. **M**
- **B2** Bloque `variants` curadas en el JSON de cada plantilla. **S**
- **B3** Fila de miniaturas en vivo en el editor, renderizadas **con tu
  contenido real** (patrón Canva Layouts). Cambiar de estilo nunca pisa los
  textos. **M**
- **B4** Lockups que suben el nivel: kicker con línea al costado, logo
  **dentro** de la placa (hoy flota aparte), padding óptico de la banda. **S**

---

## 🟡 BLOQUE C — Confianza (que no se pierda trabajo)

- **C1** Autosave honesto: si se llena el navegador hoy dice "✓ Guardado" y
  **miente**. Chip en rojo + aviso + "descargar ahora". **S**
- **C2** Confirmar acciones destructivas con **"Deshacer" en el toast**
  (proyecto, plantilla, elemento, slide). **S**
- **C3** Nombre del proyecto editable (hoy muestra el de la plantilla). **S**
- **C4** "Guardar como plantilla" pidiendo nombre. **S**

---

## 🟡 BLOQUE D — Carrusel y revisión

- **D1** **Reordenar slides arrastrando** + numeración 1/5 en la tira. **M**
- **D2** El preview compartido muestra **solo la slide 1**: que muestre el
  carrusel completo con flechas y comentarios por slide. **M**
- **D3** Una sola puerta para compartir (hoy hay 4 salidas): modal con
  intenciones — "para que lo revisen" / "para mostrar" / "para que lo
  editen". **S**
- **D4** "Mis piezas compartidas" con badge de comentarios nuevos — hoy si
  perdés el link, perdiste el feedback. **M**

---

## 🟢 BLOQUE E — Sistema visual (que se vea 5 niveles arriba)

- **E1** Unificar componentes: hay **7 implementaciones del mismo pill** y 5
  tipos de card → `.u-btn` / `.u-card` (CSS ya especificado). **M**
- **E2** **Íconos SVG** en vez de glifos (`⧉ ✳ ▣ ⚙ ☆`) — es el "tell" de
  hecho-por-IA que más se nota. 12 paths ya definidos. **S**
- **E3** Densidad y ritmo: alturas de fila, gaps, escala tipográfica. **S**
- **E4** Dark mode — **deferido a propósito**: un chrome oscuro distorsiona
  cómo se juzga el contraste de la pieza. Los tokens ya quedaron listos. **—**

---

## 🟢 BLOQUE F — Contenido y plantillas

- **F1** 2 plantillas más: **"Mito vs realidad"** (el formato de mayor
  engagement en LinkedIn B2B) e **"Insight con fuente"** (dato externo
  citado + lectura de Magoya). **S**
- **F2** Consolidar redundancia: 4 de las plantillas son la misma pieza
  (foto + texto con distinto anclaje) → 2, y el resto pasa a ser variante
  del Bloque B. **S**
- **F3** Validación de copy en la app: sin emojis, sin exclamaciones, un
  solo idioma por pieza, métrica siempre con ventana temporal. **S**

---

## 🔵 BLOQUE G — Mobile

- **G1** La **vista de revisión** tiene que ser perfecta en celular
  (marketing revisa desde el teléfono). **M**
- **G2** El editor de 3 columnas queda desktop-only con un cartel honesto, o
  se hace la versión mobile con bottom sheet. **L**

---

## 🙋 Decisiones que dependen de vos

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

## Orden recomendado

1. **Bloque A completo** (A1→A3 primero: es el salto visual grande y son
   pocos días). Es el foco declarado de la etapa.
2. **Bloque B** (variantes) — el mayor multiplicador de catálogo.
3. **C + D3** (que no se pierda trabajo, y una sola puerta para compartir).
4. **E1/E2** (unificar componentes + íconos) — sube el nivel percibido.
5. **F + D1/D2/D4**.
6. **G** al final.
