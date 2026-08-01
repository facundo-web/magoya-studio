# Magoya Studio

Generador de piezas para redes de **Magoya** — *on-brand por diseño*. Elegís una plantilla, cambiás foto, texto y logo, sumás degradés y objetos con profundidad, y descargás en el formato de cada red (Instagram, LinkedIn, WhatsApp, Facebook, X, YouTube…).

La marca queda **bloqueada por diseño**: colores, tipografía (Manrope) y logos salen del design system real de Magoya. Es imposible que una pieza se desvíe — la idea es *diseñar sin que la AI (ni nadie) delire*.

## Qué hace

- **Plantillas curadas** (zócalo sobre foto, foto con titular, bloque de color, cita, dato) reutilizables en cualquier formato.
- **Todas las redes**: un registro de formatos con reflow automático por proporción y zonas seguras.
- **Foto**: subir, B&N (regla de marca) o color, encuadre por punto focal.
- **Degradés** sobre el fondo (scrim, verde Magoya, glow, etc.) con intensidad.
- **Objetos / logos**: biblioteca de logos de IA y redes (estilo *app-icon* con profundidad y sombra), posicionables por presets o **arrastrando en la pieza**. Cualquiera puede **subir sus propios logos/elementos** (PNG/SVG) a **"Mis elementos"** — quedan guardados y reutilizables siempre, sin tocar código.
- **Marca**: esquemas de color aprobados, acento, variante de wordmark, logo de cliente.
- **Dos modos**: *Rápido* (para cualquiera) y *Diseñador* (más control, todo dentro de la marca).
- **Export**: PNG @2x/@3x (alta calidad, Manrope embebida), JPG, **SVG vectorial**, y **carrusel** (ZIP de PNGs o PDF).
- **Proyectos**: guardar/abrir (localStorage), exportar/importar `.magoya.json`, compartir por link.

## Correr localmente

```bash
npm install
npm run dev
```

## Guard de contraste

Dibuja cada plantilla × estilo × esquema con el motor real y falla si algún
par de texto/fondo baja de 4,5:1 (texto chico) o 3:1 (display). Correlo antes
de tocar colores, placas o estilos — es la red que evita que un estilo nuevo
deje texto ilegible en una combinación que nadie iba a abrir a mano.

```bash
node scripts/contraste.mjs              # 1080×1350, el formato que más se usa
node scripts/contraste.mjs --formatos   # los 13 formatos (23.000 piezas)
node scripts/contraste.mjs --todos      # lista todas las fallas, no las primeras 40
node scripts/contraste.mjs --csv        # una línea por par, para medir
```

Sale con código 1 si hay fallas. Las colisiones conocidas que necesitan una
decisión de diseño están declaradas en `CONOCIDAS`, arriba del script (hoy
está vacía: las que había se resolvieron sacando esos estilos del panel).

## La vara de los estilos

Un estilo que no se distingue del Original no es una opción, es ruido. Se
midió y era la mitad del panel: de 178 combinaciones plantilla × estilo, 141
cambiaban menos del 25% de la pieza y "Etiqueta con línea" movía el 0,2%.

El script rasteriza la pieza a **128 px** —el tamaño al que se mira un feed—
con el motor real, y compara píxel a píxel contra el Original.

```bash
node scripts/siluetas.mjs                       # tabla + veredicto
node scripts/siluetas.mjs --formato=li-landscape
node scripts/siluetas.mjs --csv                 # una línea por combinación
node scripts/siluetas.mjs --pgm=cita·bloque     # escribe el PPM para mirarlo
```

**La regla, que no es una guía: si a 128 px un estilo no cambia al menos el
25% de los píxeles, no entra al panel.** Sale con código 1 si alguna
combinación ofrecida no llega. Para agregar un estilo: sumalo a `SILUETAS`
(`src/engine/layouts.js`) y a `SILUETAS_UI` (`src/templates/variants.js`), y
corré los dos scripts —la vara y el guard— hasta que los dos estén en verde.

## Deploy

Push a `main` → GitHub Action (`.github/workflows/deploy.yml`) buildea y publica en GitHub Pages.
La URL pública es accesible para todo el equipo, sin login.

## Alimentar plantillas

Los templates son **data** (`src/templates/*.json`). Para agregar uno: creá el JSON y sumalo a `src/templates/index.js`. Ver `src/templates/schema.md`.

## Arquitectura

- `src/brand/` — design system en JS (tokens, brand kit, biblioteca de logos, assets reales).
- `src/formats/registry.js` — formatos de todas las redes.
- `src/engine/` — motor SVG-first: `render` · `layouts` · `textLayout` · `svg` · `export` · `assets`.
- `src/editor/` — UI (galería + editor + paneles).
- `src/project/store.js` — persistencia local + share.

**Fase 2 (próxima):** backend (Supabase) para librería compartida en la nube, cuentas del equipo, colaboración en tiempo real y roles.

---
Hecho sobre el design system de Magoya · Manrope · verde `#133825` / `#00DE68` · crema `#ECE3DB`.
