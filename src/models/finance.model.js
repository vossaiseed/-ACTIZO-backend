import { supabase } from '../config/supabase.js'

export async function monthly() {
  const { data, error } = await supabase.from('finance_monthly').select('*').order('id', { ascending: true })
  if (error) throw error
  return data || []
}

export async function expenses() {
  const { data, error } = await supabase.from('expenses').select('*')
  if (error) throw error
  return data || []
}

export async function receivables() {
  const { data, error } = await supabase.from('receivables').select('*')
  if (error) throw error
  return data || []
}

export async function incentivesPaid() {
  const { data, error } = await supabase.from('incentives').select('total').eq('status', 'Paid')
  if (error) throw error
  return (data || []).reduce((s, r) => s + Number(r.total || 0), 0)
}
