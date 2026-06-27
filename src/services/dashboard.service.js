import { supabase } from '../config/supabase.js'
import * as leadModel from '../models/lead.model.js'
import * as branchModel from '../models/branch.model.js'
import * as followupModel from '../models/followup.model.js'
import * as targetModel from '../models/target.model.js'

const PIPELINE_COLORS = {
  'New Lead': '#7dd8d1', Assigned: '#4ec4bc', Contacted: '#36bab3',
  'Follow-Up': '#2a9d97', Negotiation: '#267f7b', Won: '#10b981', Lost: '#f43f5e',
}

export async function overview(scope = {}) {
  const branchId = scope.branchId || null
  const staffId = scope.staffId || null // staff see only their own records

  // Lead status counts — scoped to branch (manager) or self (staff).
  let leadQ = supabase.from('leads').select('status')
  if (branchId) leadQ = leadQ.eq('branch_id', branchId)
  if (staffId) leadQ = leadQ.eq('staff_id', staffId)
  const leadRowsRes = await leadQ
  if (leadRowsRes.error) throw leadRowsRes.error
  const leadRows = leadRowsRes.data || []
  const leadCounts = leadRows.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {})
  const totalLeads = leadRows.length

  const [branchRes, upcomingAll] = await Promise.all([
    branchModel.findAll({ from: 0, to: 99 }),
    followupModel.upcoming(branchId || staffId ? 100 : 6),
  ])
  const allBranches = branchRes.data || []
  // Branch Performance is a company-wide comparison for Admin & Managers.
  // Only individual Staff are scoped to their own branch (operational isolation).
  const perfBranchId = staffId ? branchId : null
  const branches = perfBranchId ? allBranches.filter((b) => b.id === perfBranchId) : allBranches
  // Upcoming follow-ups scoped by the lead's branch (manager) and/or staff (staff).
  const upcoming = (branchId || staffId
    ? (upcomingAll || []).filter(
        (f) => (!branchId || f.lead?.branch_id === branchId) && (!staffId || f.lead?.staff_id === staffId),
      )
    : upcomingAll || []
  ).slice(0, 6)

  // Scoped data queries.
  let salesQ = supabase.from('sales').select('amount, date, status')
  if (branchId) salesQ = salesQ.eq('branch_id', branchId)
  if (staffId) salesQ = salesQ.eq('staff_id', staffId)
  let recentLeadsQ = supabase.from('leads').select('*, branch:branches(name)').order('created_at', { ascending: false }).limit(6)
  if (branchId) recentLeadsQ = recentLeadsQ.eq('branch_id', branchId)
  if (staffId) recentLeadsQ = recentLeadsQ.eq('staff_id', staffId)
  let staffCountQ = supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'staff')
  if (branchId) staffCountQ = staffCountQ.eq('branch_id', branchId)
  let performersQ = supabase.from('users').select('id,name,role,branch_id,avatar_color,performance_score,revenue').eq('role', 'staff').order('performance_score', { ascending: false }).limit(5)
  if (branchId) performersQ = performersQ.eq('branch_id', branchId)
  // Activity feed scoped to the branch's users (via the user relation) for managers.
  let activitiesQ = supabase
    .from('activities')
    .select(branchId ? '*, user:users!inner(name,avatar_color,branch_id)' : '*, user:users(name,avatar_color)')
    .order('time', { ascending: false })
    .limit(8)
  if (branchId) activitiesQ = activitiesQ.eq('user.branch_id', branchId)

  const [salesAgg, recentLeadsRes, staffCount, performersRes, activitiesRes] = await Promise.all([
    salesQ,
    recentLeadsQ,
    staffCountQ,
    performersQ,
    activitiesQ,
  ])

  const completed = (salesAgg.data || []).filter((s) => s.status === 'Completed')
  const totalRevenue = completed.reduce((s, r) => s + Number(r.amount || 0), 0)
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const monthlyRevenue = completed.filter((r) => String(r.date || '').startsWith(monthPrefix)).reduce((s, r) => s + Number(r.amount || 0), 0)

  // Real last-8-months revenue trend from actual completed sales (no seeded data).
  const revByMonth = {}
  for (const r of completed) {
    const k = String(r.date || '').slice(0, 7)
    if (k) revByMonth[k] = (revByMonth[k] || 0) + Number(r.amount || 0)
  }
  const trendNow = new Date()
  const revenueTrendData = []
  for (let i = 7; i >= 0; i -= 1) {
    const d = new Date(trendNow.getFullYear(), trendNow.getMonth() - i, 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    revenueTrendData.push({ month: d.toLocaleString('en-US', { month: 'short' }), revenue: revByMonth[k] || 0, target: 0 })
  }

  // Live per-branch metrics (replaces the seeded monthly_* / target_achievement columns).
  const branchStats = await branchModel.bulkStats(branches.map((b) => b.id))

  // Unit-based branch targets (from the Product → Branch target workflow) + units actually sold.
  // Branch Performance compares allocated target UNITS vs units sold; revenue stays a separate ₹ figure.
  let unitTargetQ = supabase.from('general_targets').select('branch_id, target_qty').eq('scope', 'Branch')
  if (perfBranchId) unitTargetQ = unitTargetQ.eq('branch_id', perfBranchId)
  const unitTargetRes = await unitTargetQ
  const targetUnitsByBranch = {}
  for (const r of unitTargetRes.data || []) {
    if (r.branch_id) targetUnitsByBranch[r.branch_id] = (targetUnitsByBranch[r.branch_id] || 0) + Number(r.target_qty || 0)
  }
  const unitSales = await targetModel.completedSalesForAchievement()
  const soldUnitsByBranch = {}
  for (const s of unitSales) {
    if (perfBranchId && s.branch_id !== perfBranchId) continue
    if (s.branch_id) soldUnitsByBranch[s.branch_id] = (soldUnitsByBranch[s.branch_id] || 0) + Number(s.quantity || 0)
  }
  const branchUnitPct = (b) => {
    const t = targetUnitsByBranch[b.id] || 0
    const a = soldUnitsByBranch[b.id] || 0
    return t > 0 ? Math.round((a / t) * 100) : 0
  }
  const targetAchievement = branches.length
    ? Math.round((branches.reduce((s, b) => s + branchUnitPct(b), 0) / branches.length) * 10) / 10
    : 0

  return {
    kpis: {
      totalLeads,
      newLeads: (leadCounts['New Lead'] || 0) + (leadCounts['Assigned'] || 0),
      contactedLeads: leadCounts['Contacted'] || 0,
      followUpLeads: leadCounts['Follow-Up'] || 0,
      wonLeads: leadCounts['Won'] || 0,
      lostLeads: leadCounts['Lost'] || 0,
      totalSales: completed.length,
      totalRevenue,
      monthlyRevenue,
      totalBranches: branches.length,
      totalStaff: staffCount.count || 0,
      targetAchievement,
      pendingFollowUps: upcoming.length,
    },
    charts: {
      leadPipeline: Object.entries(leadCounts).map(([stage, count]) => ({ stage, count, fill: PIPELINE_COLORS[stage] })),
      branchPerformance: branches.map((b) => {
        const st = branchStats[b.id] || { totalLeads: 0, wonLeads: 0, totalSales: 0, revenue: 0 }
        const target = targetUnitsByBranch[b.id] || 0
        const achieved = soldUnitsByBranch[b.id] || 0
        return {
          id: b.id,
          name: b.name,
          target,
          achieved,
          remaining: Math.max(0, target - achieved),
          revenue: st.revenue,
          convRate: st.totalLeads ? Math.round((st.wonLeads / st.totalLeads) * 100) : 0,
          achievementPct: branchUnitPct(b),
          accent: b.accent,
        }
      }),
      revenueTrend: revenueTrendData,
    },
    recentLeads: recentLeadsRes.data || [],
    recentActivities: activitiesRes.data || [],
    upcomingFollowUps: upcoming,
    topPerformers: performersRes.data || [],
  }
}
