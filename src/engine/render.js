// ============================================================
// RENDER — orquesta: builder → drawPiece → documento SVG.
// ============================================================

import { createBuilder, svgDoc } from './svg.js'
import { drawPiece } from './layouts.js'

export function renderPieceSVG({ template, content, format, fontFaceCss = '', sizeLock = null }) {
  const b = createBuilder()
  drawPiece(b, { template, content, format, sizeLock })
  return svgDoc({ w: format.w, h: format.h, builder: b, fontFaceCss })
}
