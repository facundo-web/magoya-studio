// ============================================================
// SUPABASE — Fase 2: compartir con foto + comentarios tipo Figma.
// La publishable key es pública por diseño (cliente); la seguridad
// real la dan las políticas RLS en la base.
// ============================================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://otdbwfoydofzwtkcgfqf.supabase.co'
const SUPABASE_KEY = 'sb_publishable_N1z4W3orpSLEH24c3S1UmA_d8NyZ8Lw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// sube el proyecto completo (CON fotos, van en el payload) → id del share
export async function createShare(payload) {
  const { data, error } = await supabase.from('shares').insert({ payload }).select('id').single()
  if (error) throw error
  return data.id
}

export async function loadShare(id) {
  const { data, error } = await supabase.from('shares').select('payload').eq('id', id).single()
  if (error) throw error
  return data.payload
}

export async function listComments(shareId) {
  const { data, error } = await supabase.from('comments').select('*').eq('share_id', shareId).order('created_at')
  if (error) throw error
  return data
}

export async function addComment({ share_id, author, text, x, y, slide = 0 }) {
  const { error } = await supabase.from('comments').insert({ share_id, author, text, x, y, slide })
  if (error) throw error
}

// cuántos comentarios tiene cada share (para el badge de "hay novedades")
export async function countComments(shareIds) {
  if (!shareIds?.length) return {}
  const { data, error } = await supabase.from('comments').select('share_id').in('share_id', shareIds)
  if (error) throw error
  // arranca en 0 para TODOS los pedidos: si no, "sin comentarios" y
  // "todavía no cargó" se ven igual y la fila queda buscando para siempre.
  const out = {}
  for (const id of shareIds) out[id] = 0
  for (const r of data) out[r.share_id] = (out[r.share_id] || 0) + 1
  return out
}

// ---- veredicto de la revisión (K2) ----
// "Aprobar" abría WhatsApp y no guardaba nada: el que revisa creía que
// había terminado y el que espera no se enteraba nunca.
export async function setVerdict({ share_id, author, verdict }) {
  const { error } = await supabase.from('verdicts').insert({ share_id, author, verdict })
  if (error) throw error
}

export async function getVerdicts(shareIds) {
  if (!shareIds?.length) return {}
  const { data, error } = await supabase
    .from('verdicts').select('share_id, verdict, author, created_at')
    .in('share_id', shareIds).order('created_at')
  if (error) throw error
  const out = {}
  for (const r of data) out[r.share_id] = r   // el último gana
  return out
}
