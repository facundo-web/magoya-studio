import React, { useState, useRef } from 'react'
import PiecePreview from './PiecePreview.jsx'
import { FORMATS_BY_ID, formatsByNetwork, CAROUSEL_FORMATS } from '../formats/registry.js'
import { COLOR_SCHEMES, ACCENTS, WORDMARKS, CLIENT_LOGOS, TEXT_STYLES, GRADIENTS } from '../brand/brandKit.js'
import { ICONS, ICON_CATEGORIES } from '../brand/iconLibrary.js'
import { imageSize } from '../engine/assets.js'
import { exportPiece, exportCarousel } from '../engine/export.js'

const ROLE_LABELS = {
  kicker: 'Kicker (etiqueta)',
  title: 'Título',
  subtitle: 'Subtítulo',
  body: 'Cuerpo',
  metric: 'Dato / número',
  metricLabel: 'Descripción del dato',
  quote: 'Cita',
  author: 'Autor / fuente',
}

export default function Editor({
  template, format, content, mode, slides, activeSlide,
  onChangeContent, onChangeFormat, onSelectSlide, onAddSlide, onDeleteSlide, onToast,
}) {
  const [busy, setBusy] = useState(false)
  const isCarousel = slides && slides.length > 0
  const canCarousel = CAROUSEL_FORMATS.includes(format.id)

  const set = (patch) => onChangeContent({ ...content, ...patch })

  return (
    <div className="editor">
      <div className="sidebar">
        <FormatPanel format={format} onChangeFormat={onChangeFormat} />
        <ContentPanel template={template} content={content} set={set} />
        {template.surface === 'photo' && (
          <PhotoPanel content={content} set={set} mode={mode} onToast={onToast} />
        )}
        <GradientPanel content={content} set={set} />
        <ObjectsPanel content={content} set={set} mode={mode} onToast={onToast} />
        <BrandPanel content={content} template={template} set={set} mode={mode} />
      </div>

      <div className="stage">
        <div className="stage-tools">
          <span style={{ fontSize: 13, color: '#5C6B61' }}>
            {format.network} · {format.label} · {format.w}×{format.h}
          </span>
          <div style={{ flex: 1 }} />
          {canCarousel && !isCarousel && (
            <button className="btn" onClick={onAddSlide}>+ Convertir en carrusel</button>
          )}
          <DownloadMenu
            template={template} content={content} format={format}
            slides={slides} busy={busy} setBusy={setBusy} onToast={onToast}
          />
        </div>

        <div className="stage-canvas">
          <div className="piece-frame">
            <PiecePreview template={template} content={content} format={format} />
          </div>
        </div>

        {isCarousel && (
          <div className="strip">
            {slides.map((s, i) => (
              <button
                key={i}
                className={'slide-thumb' + (i === activeSlide ? ' on' : '')}
                onClick={() => onSelectSlide(i)}
                title={`Slide ${i + 1}`}
              >
                <PiecePreview template={s.template} content={s.content} format={format} />
              </button>
            ))}
            <button className="add" onClick={onAddSlide} title="Agregar slide">+</button>
            {slides.length > 1 && (
              <button className="btn" style={{ marginLeft: 8 }} onClick={() => onDeleteSlide(activeSlide)}>
                Borrar slide
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Format ---------------- */
function FormatPanel({ format, onChangeFormat }) {
  const groups = formatsByNetwork()
  return (
    <div className="panel">
      <h3>Formato / red</h3>
      <div className="field">
        <select value={format.id} onChange={(e) => onChangeFormat(FORMATS_BY_ID[e.target.value])}>
          {Object.entries(groups).map(([net, list]) => (
            <optgroup key={net} label={net}>
              {list.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} — {f.w}×{f.h}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ---------------- Content (texto) ---------------- */
function ContentPanel({ template, content, set }) {
  const roles = template.roles || []
  return (
    <div className="panel">
      <h3>Contenido</h3>
      {roles.map((role) => {
        const st = TEXT_STYLES[role]
        const long = role === 'title' || role === 'quote' || role === 'subtitle' || role === 'body' || role === 'metricLabel'
        const val = content[role] ?? template.defaults?.[role] ?? ''
        return (
          <div className="field" key={role}>
            <label>{ROLE_LABELS[role] || role}</label>
            {long ? (
              <textarea value={val} onChange={(e) => set({ [role]: e.target.value })} rows={role === 'title' || role === 'quote' ? 2 : 1} />
            ) : (
              <input type="text" value={val} onChange={(e) => set({ [role]: e.target.value })} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Photo ---------------- */
function PhotoPanel({ content, set, mode, onToast }) {
  const fileRef = useRef(null)
  const photo = content.photo
  const treatment = content.treatment || 'bw'

  const onFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      onToast('Ese archivo no es una imagen')
      return
    }
    const src = await new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
    const natural = await imageSize(src)
    set({ photo: { src, natural, focal: photo?.focal || { x: 0.5, y: 0.5 } } })
  }

  return (
    <div className="panel">
      <h3>Foto</h3>
      <div
        className={'dropzone' + (photo?.src ? ' has' : '')}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0])
        }}
      >
        {photo?.src ? '✓ Foto cargada — click para cambiar' : 'Arrastrá una foto o hacé click'}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />

      <div className="field" style={{ marginTop: 12 }}>
        <label>Tratamiento</label>
        <div className="chips">
          <button className={'chip' + (treatment === 'bw' ? ' on' : '')} onClick={() => set({ treatment: 'bw' })}>B&N (marca)</button>
          <button className={'chip' + (treatment === 'color' ? ' on' : '')} onClick={() => set({ treatment: 'color' })}>Color</button>
        </div>
      </div>

      {mode === 'designer' && photo?.src && (
        <>
          <div className="field">
            <label>Encuadre horizontal</label>
            <input className="range" type="range" min="0" max="1" step="0.01"
              value={photo.focal?.x ?? 0.5}
              onChange={(e) => set({ photo: { ...photo, focal: { ...photo.focal, x: +e.target.value } } })} />
          </div>
          <div className="field">
            <label>Encuadre vertical</label>
            <input className="range" type="range" min="0" max="1" step="0.01"
              value={photo.focal?.y ?? 0.5}
              onChange={(e) => set({ photo: { ...photo, focal: { ...photo.focal, y: +e.target.value } } })} />
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------- Gradient overlay ---------------- */
function GradientPanel({ content, set }) {
  const g = content.gradient || null
  const on = !!g?.preset
  const setPreset = (preset) => set({ gradient: preset ? { preset, opacity: g?.opacity ?? 1 } : null })
  return (
    <div className="panel">
      <h3>Degradé (sobre el fondo)</h3>
      <div className="chips">
        <button className={'chip' + (!on ? ' on' : '')} onClick={() => setPreset(null)}>Sin degradé</button>
        {Object.entries(GRADIENTS).map(([k, gr]) => (
          <button key={k} className={'chip' + (g?.preset === k ? ' on' : '')} onClick={() => setPreset(k)}>
            {gr.label}
          </button>
        ))}
      </div>
      {on && (
        <div className="field" style={{ marginTop: 10 }}>
          <label>Intensidad</label>
          <input className="range" type="range" min="0.2" max="1" step="0.05"
            value={g.opacity ?? 1}
            onChange={(e) => set({ gradient: { ...g, opacity: +e.target.value } })} />
        </div>
      )}
    </div>
  )
}

/* ---------------- Objetos (logos / profundidad) ---------------- */
function ObjectsPanel({ content, set, mode, onToast }) {
  const [picking, setPicking] = useState(false)
  const [cat, setCat] = useState('ai')
  const fileRef = useRef(null)
  const objects = content.objects || []

  const addIcon = (icon) => {
    const next = [...objects, { kind: 'icon', iconId: icon.id, style: 'tile', x: 0.72, y: 0.42, scale: 0.3, rotation: -8, shadow: true }]
    set({ objects: next })
    setPicking(false)
  }
  const addImage = async (file) => {
    if (!file.type.startsWith('image/')) return onToast('No es una imagen')
    const src = await new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
    set({ objects: [...objects, { kind: 'image', src, x: 0.72, y: 0.42, scale: 0.32, rotation: 0, shadow: true }] })
  }
  const update = (i, patch) => set({ objects: objects.map((o, idx) => (idx === i ? { ...o, ...patch } : o)) })
  const remove = (i) => set({ objects: objects.filter((_, idx) => idx !== i) })

  const iconsInCat = ICONS.filter((i) => i.category === cat)

  return (
    <div className="panel">
      <h3>Objetos · logos & profundidad</h3>

      {objects.map((o, i) => (
        <div key={i} style={{ border: '1px solid var(--paper-200,#E6E1D8)', borderRadius: 10, padding: 10, marginBottom: 8, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <strong style={{ fontSize: 13 }}>{o.kind === 'image' ? 'PNG subido' : (ICONS.find((x) => x.id === o.iconId)?.label || 'Logo')}</strong>
            <button className="btn" style={{ padding: '2px 8px' }} onClick={() => remove(i)}>✕</button>
          </div>
          {o.kind === 'icon' && (
            <div className="chips" style={{ marginBottom: 6 }}>
              <button className={'chip' + (o.style !== 'plain' ? ' on' : '')} onClick={() => update(i, { style: 'tile' })}>Tile (app-icon)</button>
              <button className={'chip' + (o.style === 'plain' ? ' on' : '')} onClick={() => update(i, { style: 'plain' })}>Plano</button>
            </div>
          )}
          <label style={{ fontSize: 11, color: '#4A554D' }}>Tamaño</label>
          <input className="range" type="range" min="0.08" max="0.7" step="0.01" value={o.scale} onChange={(e) => update(i, { scale: +e.target.value })} />
          <label style={{ fontSize: 11, color: '#4A554D' }}>Rotación</label>
          <input className="range" type="range" min="-45" max="45" step="1" value={o.rotation} onChange={(e) => update(i, { rotation: +e.target.value })} />
          {mode === 'designer' && (
            <>
              <label style={{ fontSize: 11, color: '#4A554D' }}>Posición X</label>
              <input className="range" type="range" min="0" max="1" step="0.01" value={o.x} onChange={(e) => update(i, { x: +e.target.value })} />
              <label style={{ fontSize: 11, color: '#4A554D' }}>Posición Y</label>
              <input className="range" type="range" min="0" max="1" step="0.01" value={o.y} onChange={(e) => update(i, { y: +e.target.value })} />
            </>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn" onClick={() => setPicking((v) => !v)}>+ Logo</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>+ Subir PNG</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && addImage(e.target.files[0])} />
      </div>

      {picking && (
        <div style={{ marginTop: 10 }}>
          <div className="chips" style={{ marginBottom: 8 }}>
            {Object.entries(ICON_CATEGORIES).map(([k, label]) => (
              <button key={k} className={'chip' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
            {iconsInCat.map((icon) => (
              <button key={icon.id} title={icon.label} onClick={() => addIcon(icon)}
                style={{ aspectRatio: '1/1', borderRadius: 10, border: 0, background: icon.color, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                <img src={icon.url} alt={icon.label} style={{ width: '70%', height: '70%', filter: 'brightness(0) invert(1)' }} />
              </button>
            ))}
          </div>
          <div className="hint">También podés subir el PNG oficial (versión a color) de cualquier logo.</div>
        </div>
      )}
    </div>
  )
}

/* ---------------- Brand ---------------- */
function BrandPanel({ content, template, set, mode }) {
  const scheme = content.scheme || template.defaults?.scheme || 'deep'
  const accent = content.accent || template.defaults?.accent || 'emerald'
  const logo = content.logo || template.defaults?.logo || 'cream'
  const clientLogo = content.clientLogo || template.defaults?.clientLogo || 'none'
  return (
    <div className="panel">
      <h3>Marca</h3>

      {(mode === 'designer' || template.surface !== 'photo') && (
        <div className="field">
          <label>Esquema de color</label>
          <div className="swatches">
            {Object.entries(COLOR_SCHEMES).map(([k, s]) => (
              <button key={k} className={'sw' + (scheme === k ? ' on' : '')} title={s.label}
                style={{ background: s.surface }} onClick={() => set({ scheme: k })} />
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label>Acento</label>
        <div className="swatches">
          {Object.entries(ACCENTS).map(([k, a]) => (
            <button key={k} className={'sw' + (accent === k ? ' on' : '')} title={a.label}
              style={{ background: a.value }} onClick={() => set({ accent: k })} />
          ))}
        </div>
      </div>

      <div className="field">
        <label>Logo Magoya</label>
        <select value={logo} onChange={(e) => set({ logo: e.target.value })}>
          {Object.entries(WORDMARKS).map(([k, w]) => (
            <option key={k} value={k}>{w.label}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Logo de cliente</label>
        <select value={clientLogo} onChange={(e) => set({ clientLogo: e.target.value })}>
          {Object.entries(CLIENT_LOGOS).map(([k, l]) => (
            <option key={k} value={k}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ---------------- Download menu ---------------- */
function DownloadMenu({ template, content, format, slides, busy, setBusy, onToast }) {
  const [open, setOpen] = useState(false)
  const isCarousel = slides && slides.length > 0

  const run = async (fn, label) => {
    setOpen(false)
    setBusy(true)
    onToast('Generando ' + label + '…')
    try {
      await fn()
      onToast('✓ ' + label + ' descargado')
    } catch (e) {
      console.error(e)
      onToast('⚠ Error al exportar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="menu">
      <button className="btn primary" disabled={busy} onClick={() => setOpen((o) => !o)}>
        ↓ Descargar
      </button>
      {open && (
        <div className="menu-pop" onMouseLeave={() => setOpen(false)}>
          <div className="grp">Esta pieza</div>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 3 }), 'PNG @3x')}>
            <span>PNG — alta calidad</span><span>@3x</span>
          </button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'png', scale: 2 }), 'PNG @2x')}>
            <span>PNG</span><span>@2x</span>
          </button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'jpg', scale: 2 }), 'JPG')}>
            <span>JPG</span><span>@2x</span>
          </button>
          <button onClick={() => run(() => exportPiece({ template, content, format, kind: 'svg' }), 'SVG')}>
            <span>SVG — vectorial</span><span>∞</span>
          </button>
          {isCarousel && (
            <>
              <div className="grp">Carrusel ({slides.length} slides)</div>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'zip', scale: 3 }), 'ZIP de PNGs')}>
                <span>ZIP de PNGs</span><span>@3x</span>
              </button>
              <button onClick={() => run(() => exportCarousel({ slides, format, kind: 'pdf', scale: 2 }), 'PDF')}>
                <span>PDF</span><span>multipágina</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
