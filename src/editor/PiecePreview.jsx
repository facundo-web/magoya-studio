import React, { useMemo } from 'react'
import { renderPieceSVG } from '../engine/render.js'

// Preview en vivo: render SVG (sin embeber fuente; la pantalla ya tiene Manrope)
export default function PiecePreview({ template, content, format, className, sizeLock = null }) {
  const svg = useMemo(() => {
    try {
      return renderPieceSVG({ template, content, format, sizeLock })
    } catch (e) {
      console.error('[preview] render falló', e)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${format.w}" height="${format.h}"><rect width="100%" height="100%" fill="#20302A"/></svg>`
    }
  }, [template, content, format, sizeLock])
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />
}
