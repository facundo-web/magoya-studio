# Schema de template (cómo alimentar Magoya Studio)

Un template es un `.json` en esta carpeta + un import en `index.js`. Es **data**, no código: define una composición on-brand que el motor reflowa a cualquier formato/red.

## Campos

| Campo | Valores | Qué hace |
|---|---|---|
| `id` | string único | identificador |
| `name` | string | nombre visible en la galería |
| `category` | `zocalo` \| `post` \| `quote` \| `metric` | agrupa en la galería |
| `surface` | `photo` \| `solid` | fondo: foto full-bleed o color sólido |
| `anchor` | `{vert}-{horz}` → vert: `top`/`center`/`bottom`, horz: `left`/`center` | dónde ancla el stack de texto |
| `zocalo` | `true`/`false` | si `true` (solo con foto), dibuja la placa/banda de marca detrás del texto |
| `motif` | `true`/`false` | si `true` (solo solid), dibuja el motivo Estratos arriba a la derecha |
| `roles` | array de roles de texto | qué textos muestra y en qué orden |
| `defaults` | objeto | contenido y estilo por defecto (editable por el usuario) |

### Roles de texto disponibles
`kicker` · `title` · `subtitle` · `body` · `metric` · `metricLabel` · `quote` · `author`
(cada uno tiene un estilo tipográfico fijo en `brandKit.js → TEXT_STYLES`).

### `defaults`
```jsonc
{
  "scheme": "deep",        // esquema de color: deep | ink | cream | studio
  "accent": "emerald",     // acento: emerald | lime | deep
  "logo": "cream",         // wordmark: cream | green | black | deep
  "logoVPos": "auto",      // vertical del wordmark: auto (opuesto al texto / en la banda) | top | bottom
  "clientLogo": "none",    // none | basf | bayer | corteva | johndeere | syngenta
  "hasPhoto": true,        // define surface si no se especifica
  "treatment": "bw",       // foto: bw (B&N) | color
  "kicker": "…", "title": "…", "subtitle": "…",  // textos por rol
  "colors": { "cta": "ink" },   // opcional: color por rol (claves de TEXT_COLORS); en un CTA pinta la pastilla
  "bubbleTint": "accent"        // sólo chat: color del globo propio ('accent' o hex); default: la regla de WhatsApp
}
```
Los bloques de texto libres (`textBlocks`) aceptan además `align: "left" | "center"`
(opcional): alinea las líneas de ESE bloque adentro de la caja del stack, sin
mover el ancla de la pieza. Todo color elegido a mano pasa igual por el empuje
de legibilidad del motor (`colorEfectivo` / `tinteEfectivo` en engine/layouts.js
devuelven el color que de verdad sale pintado).

## Reglas de marca que el motor garantiza (anti-"AI delira")
- Colores: solo **roles aprobados** (nunca color libre). Verde `#00DE68`, Verde Magoya `#133825`, Crema `#ECE3DB`, Negro, Lime marcador.
- Tipografía: **Manrope** siempre (embebida en el export).
- Foto: **B&N por defecto** + acento verde (regla de dirección de arte).
- Logo real de Magoya siempre presente; logos de cliente reales.
- Equilibrio negro↔verde: el verde enciende (~acentos), no domina.
