# Magoya Studio

Generador de piezas para redes de **Magoya** — *on-brand por diseño*. Elegís una plantilla, cambiás foto, texto y logo, sumás degradés y objetos con profundidad, y descargás en el formato de cada red (Instagram, LinkedIn, WhatsApp, Facebook, X, YouTube…).

La marca queda **bloqueada por diseño**: colores, tipografía (Manrope) y logos salen del design system real de Magoya. Es imposible que una pieza se desvíe — la idea es *diseñar sin que la AI (ni nadie) delire*.

## Qué hace

- **Plantillas curadas** (zócalo sobre foto, foto con titular, bloque de color, cita, dato) reutilizables en cualquier formato.
- **Todas las redes**: un registro de formatos con reflow automático por proporción y zonas seguras.
- **Foto**: subir, B&N (regla de marca) o color, encuadre por punto focal.
- **Degradés** sobre el fondo (scrim, verde Magoya, glow, etc.) con intensidad.
- **Objetos / logos**: biblioteca de logos de IA y redes (estilo *app-icon* con profundidad y sombra) + subir PNG propio.
- **Marca**: esquemas de color aprobados, acento, variante de wordmark, logo de cliente.
- **Dos modos**: *Rápido* (para cualquiera) y *Diseñador* (más control, todo dentro de la marca).
- **Export**: PNG @2x/@3x (alta calidad, Manrope embebida), JPG, **SVG vectorial**, y **carrusel** (ZIP de PNGs o PDF).
- **Proyectos**: guardar/abrir (localStorage), exportar/importar `.magoya.json`, compartir por link.

## Correr localmente

```bash
npm install
npm run dev
```

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
