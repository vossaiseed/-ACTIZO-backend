import { supabase } from '../config/supabase.js'

const CAMPAIGN = 'flash_targets'
const BRANCH = 'flash_branch_targets'
const STAFF = 'flash_staff_targets'

const CAMPAIGN_REL = '*, product:products(id,name,unit)'
const BRANCH_REL = '*, branch:branches(id,name), requester:users!requested_by(id,name,avatar_color), flash:flash_targets(id,total_qty,end_date,status,product:products(id,name,unit))'
const STAFF_REL = '*, staff:users!staff_id(id,name,avatar_color), branch:branches(id,name)'

/* ---------------- Flash campaigns ---------------- */
export async function findCampaigns({ status } = {}) {
  let q = supabase.from(CAMPAIGN).select(CAMPAIGN_REL).order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function findCampaignById(id) {
  const { data, error } = await supabase.from(CAMPAIGN).select(CAMPAIGN_REL).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createCampaign(row) {
  const { data, error } = await supabase.from(CAMPAIGN).insert(row).select(CAMPAIGN_REL).single()
  if (error) throw error
  return data
}

export async function updateCampaign(id, row) {
  const { data, error } = await supabase
    .from(CAMPAIGN)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMPAIGN_REL)
    .single()
  if (error) throw error
  return data
}

/* ---------------- Branch requests / approvals ---------------- */
export async function findBranchTargets({ flashTargetId, branchId, status } = {}) {
  let q = supabase.from(BRANCH).select(BRANCH_REL).order('created_at', { ascending: false })
  if (flashTargetId) q = q.eq('flash_target_id', flashTargetId)
  if (branchId) q = q.eq('branch_id', branchId)
  if (status) q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function findBranchTargetById(id) {
  const { data, error } = await supabase.from(BRANCH).select(BRANCH_REL).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function findBranchTarget(flashTargetId, branchId) {
  const { data, error } = await supabase
    .from(BRANCH)
    .select(BRANCH_REL)
    .eq('flash_target_id', flashTargetId)
    .eq('branch_id', branchId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createBranchTarget(row) {
  const { data, error } = await supabase.from(BRANCH).insert(row).select(BRANCH_REL).single()
  if (error) throw error
  return data
}

export async function updateBranchTarget(id, row) {
  const { data, error } = await supabase
    .from(BRANCH)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(BRANCH_REL)
    .single()
  if (error) throw error
  return data
}

/* ---------------- Staff distribution ---------------- */
export async function findStaffTargets({ flashTargetId, branchId, staffId } = {}) {
  let q = supabase.from(STAFF).select(STAFF_REL)
  if (flashTargetId) q = q.eq('flash_target_id', flashTargetId)
  if (branchId) q = q.eq('branch_id', branchId)
  if (staffId) q = q.eq('staff_id', staffId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function upsertStaffTarget(row) {
  // unique (flash_target_id, staff_id) — upsert on that pair
  const { data, error } = await supabase
    .from(STAFF)
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'flash_target_id,staff_id' })
    .select(STAFF_REL)
    .single()
  if (error) throw error
  return data
}

export async function deleteStaffTargets(flashTargetId, branchId, exceptIds = []) {
  let q = supabase.from(STAFF).delete().eq('flash_target_id', flashTargetId).eq('branch_id', branchId)
  if (exceptIds.length) q = q.not('id', 'in', `(${exceptIds.join(',')})`)
  const { error } = await q
  if (error) throw error
}

/* ---------------- Achievement source ----------------
 * ALL completed sales (with product + date) — flash achievement is auto-matched
 * to campaigns by product + window + approved branch, mirroring general targets.
 * An explicit flash_target_id (when present) is used only to disambiguate
 * overlapping same-product campaigns. */
export async function completedSales() {
  const { data, error } = await supabase
    .from('sales')
    .select('id, flash_target_id, product_id, branch_id, staff_id, quantity, status, date')
    .eq('status', 'Completed')
  if (error) throw error
  return data || []
}
