// ============================================================
// RENDER — orquesta: builder → drawPiece → documento SVG.
// ============================================================

import { createBuilder, svgDoc } from './svg.js'
import { drawPiece } from './layouts.js'

export function renderPieceSVG({ template, content, format, fontFaceCss = '' }) {
  const b = createBuilder()
  drawPiece(b, { template, content, format })
  return svgDoc({ w: format.w, h: format.h, builder: b, fontFaceCss })
}
