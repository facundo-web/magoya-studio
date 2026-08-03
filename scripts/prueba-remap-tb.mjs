// Prueba del remapeo de claves tb:N al borrar/reordenar/duplicar bloques.
// Corre con vite-node (o node a secas: remapEids.js es JS puro).
// Simula EXACTAMENTE los parches que arman textRemoveMany / removeMixto /
// TextBlocksBody.move / textDuplicateMany en Editor.jsx, usando las mismas
// funciones compartidas de remapEids.js.
import { remapEidKeys, idxTrasBorrar, idxTrasSwap, posConCopias } from '../src/editor/remapEids.js'

let fallas = 0
const check = (nombre, cond, detalle) => {
  console.log(`${cond ? 'OK ' : 'FALLA'} · ${nombre}${cond ? '' : ' → ' + detalle}`)
  if (!cond) fallas++
}
const j = (x) => JSON.stringify(x)

// ------------------------------------------------------------
// El escenario del reporte: 3 bloques, muevo el del medio, borro el primero.
let content = {
  textBlocks: [{ text: 'uno' }, { text: 'dos' }, { text: 'tres' }],
  pos: { 'tb:1': { x: 0.8, y: 0.2 } },          // "dos" movido a mano
}
// borrar tb:0 — el parche de textRemoveMany:
const borrados = new Set([0])
content = {
  ...content,
  textBlocks: content.textBlocks.filter((_, i) => !borrados.has(i)),
  pos: remapEidKeys(content.pos, 'tb:', idxTrasBorrar(borrados)),
}
check('el movido sigue donde estaba (ahora como tb:0)',
  content.pos?.['tb:0']?.x === 0.8 && content.pos?.['tb:0']?.y === 0.2, j(content.pos))
check('no queda pos huérfana tb:1', !('tb:1' in (content.pos || {})), j(content.pos))
check('quedan 2 bloques y el primero es "dos"',
  content.textBlocks.length === 2 && content.textBlocks[0].text === 'dos', j(content.textBlocks))

// ------------------------------------------------------------
// Borrar el bloque movido: su pos se va con él (nada de huérfanas).
let c2 = { textBlocks: [{ text: 'a' }, { text: 'b' }], pos: { 'tb:1': { x: 0.3, y: 0.7 } } }
c2 = { ...c2, textBlocks: c2.textBlocks.filter((_, i) => i !== 1), pos: remapEidKeys(c2.pos, 'tb:', idxTrasBorrar(new Set([1]))) }
check('borrar el movido deja pos vacía (undefined, no {})', c2.pos === undefined, j(c2.pos))

// ------------------------------------------------------------
// Borrado múltiple salteado (0 y 2 de 4): el 1 pasa a 0, el 3 pasa a 1.
let c3 = { pos: { 'tb:1': { x: 0.1, y: 0.1 }, 'tb:3': { x: 0.9, y: 0.9 }, 'role:title': { x: 0.5, y: 0.5 } } }
const m3 = remapEidKeys(c3.pos, 'tb:', idxTrasBorrar(new Set([0, 2])))
check('borrado múltiple: tb:1→tb:0 y tb:3→tb:1',
  m3['tb:0']?.x === 0.1 && m3['tb:1']?.x === 0.9 && !('tb:3' in m3), j(m3))
check('las claves de otros prefijos (role:) no se tocan', m3['role:title']?.x === 0.5, j(m3))

// ------------------------------------------------------------
// Reordenar (Subir/Bajar del panel): swap de índices, swap de posiciones.
const m4 = remapEidKeys({ 'tb:0': { x: 0.2, y: 0.2 } }, 'tb:', idxTrasSwap(0, 1))
check('subir/bajar: la pos sigue al bloque (tb:0→tb:1)', m4['tb:1']?.x === 0.2 && !('tb:0' in m4), j(m4))

// ------------------------------------------------------------
// Duplicar: la copia hereda la pos del original, corrida un poquito.
const pos5 = { 'tb:0': { x: 0.5, y: 0.5 } }
const m5 = posConCopias(pos5, 2, [{ x: 0.5, y: 0.5 }])   // base=2 (había 2 bloques)
check('duplicar: la copia (tb:2) hereda la pos corrida',
  m5['tb:2']?.x === 0.54 && m5['tb:2']?.y === 0.54 && m5['tb:0']?.x === 0.5, j(m5))
const m6 = posConCopias(pos5, 2, [null])                  // original en el stack
check('duplicar uno del stack no inventa pos (mismo objeto)', m6 === pos5, j(m6))

// ------------------------------------------------------------
// Sin cambios → mismo objeto (no ensucia el undo con parches idénticos).
const pos7 = { 'role:cta': { x: 0.4, y: 0.4 } }
check('remapear sin tb:N devuelve el mismo objeto', remapEidKeys(pos7, 'tb:', idxTrasBorrar(new Set([0]))) === pos7, 'copió al pedo')
check('mapa vacío/undefined pasa de largo', remapEidKeys(undefined, 'tb:', idxTrasBorrar(new Set([0]))) === undefined, 'inventó un mapa')

console.log(fallas ? `\n${fallas} pruebas fallaron` : '\nTodo verde')
process.exit(fallas ? 1 : 0)
