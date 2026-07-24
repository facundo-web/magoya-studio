import React from 'react'
import { WORDMARKS, PALETTE, FONT_STACK } from '../brand/brandKit.js'
import { downloadBlob } from '../engine/export.js'

// colores de marca con nombre (para descargar / copiar)
const BRAND_COLORS = [
  { name: 'Verde Magoya', hex: PALETTE.green900, note: 'Institucional' },
  { name: 'Verde profundo', hex: PALETTE.green950, note: 'Fondo oscuro' },
  { name: 'Verde digital', hex: PALETTE.emerald500, note: 'Acento' },
  { name: 'Lime marcador', hex: PALETTE.lime300, note: 'Highlight' },
  { name: 'Crema Magoya', hex: PALETTE.cream100, note: 'Neutro cálido' },
  { name: 'Crema clara', hex: PALETTE.cream50, note: 'Casi blanco' },
  { name: 'Negro', hex: PALETTE.ink900, note: 'Texto' },
  { name: 'Blanco', hex: PALETTE.white, note: '' },
]

// fondo de preview por variante de wordmark
const WM_BG = { cream: PALETTE.green900, green: PALETTE.green950, deep: PALETTE.cream100, black: PALETTE.cream100 }

async function fetchText(url) {
  const r = await fetch(url)
  return r.text()
}

function paletteSVG() {
  const w = 900, rowH = 90, h = rowH * BRAND_COLORS.length
  const rows = BRAND_COLORS.map((c, i) => {
    const y = i * rowH
    const textColor = ['#FFFFFF', '#F6F1EB', '#ECE3DB', '#CBF06E'].includes(c.hex) ? '#0D0C0C' : '#FFFFFF'
    return (
      `<rect x="0" y="${y}" width="${w}" height="${rowH}" fill="${c.hex}"/>` +
      `<text x="32" y="${y + 42}" font-family="Manrope, sans-serif" font-size="26" font-weight="800" fill="${textColor}">${c.name}</text>` +
      `<text x="32" y="${y + 72}" font-family="monospace" font-size="20" fill="${textColor}" opacity="0.85">${c.hex}</text>`
    )
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rows}</svg>`
}

function tokensCSS() {
  const lines = BRAND_COLORS.map((c) => `  --magoya-${c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}: ${c.hex};`)
  return `/* Magoya — colores de marca */\n:root {\n${lines.join('\n')}\n}\n\n/* Tipografía: Manrope (Google Fonts) */\n/* font-family: ${FONT_STACK}; */\n`
}

export default function BrandKit({ onToast }) {
  const dlWordmark = async (key) => {
    const wm = WORDMARKS[key]
    const text = await fetchText(wm.url)
    downloadBlob(new Blob([text], { type: 'image/svg+xml' }), `magoya-wordmark-${key}.svg`)
  }
  const copyHex = (hex) => { navigator.clipboard?.writeText(hex); onToast(`Copiado ${hex}`) }
  const dlPalette = () => downloadBlob(new Blob([paletteSVG()], { type: 'image/svg+xml' }), 'magoya-colores.svg')
  const dlTokens = () => downloadBlob(new Blob([tokensCSS()], { type: 'text/css' }), 'magoya-colores.css')

  const dlAll = async () => {
    onToast('Armando el kit…')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const logos = zip.folder('logos')
      for (const key of Object.keys(WORDMARKS)) {
        logos.file(`magoya-wordmark-${key}.svg`, await fetchText(WORDMARKS[key].url))
      }
      const colors = zip.folder('colores')
      colors.file('magoya-colores.svg', paletteSVG())
      colors.file('magoya-colores.css', tokensCSS())
      zip.file('LEÉME.txt', 'Kit de marca de Magoya\n\n- logos/ : wordmarks en SVG (crema, verde, negro, verde profundo)\n- colores/ : paleta en SVG + tokens CSS\n- Tipografía: Manrope (Google Fonts)\n\nUso interno / handoff. Los colores y el logo son la marca de Magoya.\n')
      const out = await zip.generateAsync({ type: 'blob' })
      downloadBlob(out, 'magoya-brand-kit.zip')
      onToast('✓ Kit descargado')
    } catch (e) {
      console.error(e); onToast('⚠ Error al armar el kit')
    }
  }

  return (
    <div className="gallery">
      <h1>Kit de marca</h1>
      <p className="lead">Descargá el logo y los colores de Magoya para usarlos o <b>pasárselos a alguien más</b> (un diseñador, una imprenta, un partner).</p>
      <div style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={dlAll}>↓ Descargar kit completo (ZIP)</button>
      </div>

      <div className="section-title">Logos</div>
      <div className="grid">
        {Object.entries(WORDMARKS).map(([key, wm]) => (
          <div key={key} className="tcard">
            <div className="thumb" style={{ aspectRatio: '16/9', background: WM_BG[key], display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <img src={wm.url} alt={wm.label} style={{ maxWidth: '70%', maxHeight: '60%' }} />
            </div>
            <div className="meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div className="n">{wm.label}</div><div className="c">SVG vectorial</div></div>
              <button className="btn" onClick={() => dlWordmark(key)}>↓ SVG</button>
            </div>
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Manrope es la tipografía de marca — está en <b>Google Fonts</b> (gratis).</p>

      <div className="section-title">Colores</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn" onClick={dlPalette}>↓ Paleta (SVG)</button>
        <button className="btn" onClick={dlTokens}>↓ Tokens (CSS)</button>
      </div>
      <div className="palette-grid">
        {BRAND_COLORS.map((c) => (
          <button key={c.hex} className="pal-card" onClick={() => copyHex(c.hex)} title="Copiar hex">
            <span className="pal-chip" style={{ background: c.hex, border: c.hex === '#FFFFFF' ? '1px solid #E6E1D8' : '0' }} />
            <span className="pal-info">
              <span className="pal-name">{c.name}</span>
              <span className="pal-hex">{c.hex}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Tocá un color para copiar el código. Regla: el negro construye, el verde hace crecer (verde ~20-30%).</p>
    </div>
  )
}
