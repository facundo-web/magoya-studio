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
