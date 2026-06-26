import { supabase } from '../config/supabase.js'
import { ApiError } from '../utils/ApiError.js'

const TYPES = ['lead', 'sales', 'revenue', 'branch', 'staff', 'target', 'incentive']

function groupCount(rows, key) {
  return rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {})
}
function groupSum(rows, key, valueKey) {
  return rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + Number(r[valueKey] || 0)), acc), {})
}

export async function generate(type, scope = {}) {
  if (!TYPES.includes(type)) throw ApiError.badRequest(`Unknown report type. Use one of: ${TYPES.join(', ')}`)
  const { branchId, staffId } = scope

  switch (type) {
    case 'lead': {
      let q = supabase.from('leads').select('ref_code,name,status,source,priority,value,created_date,branch:branches(name),staff:users(name)').order('created_date', { ascending: false }).limit(200)
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('staff_id', staffId)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { total: rows.length, won: rows.filter((r) => r.status === 'Won').length, lost: rows.filter((r) => r.status === 'Lost').length },
        charts: {
          byStatus: Object.entries(groupCount(rows, 'status')).map(([name, value]) => ({ name, value })),
          bySource: Object.entries(groupCount(rows, 'source')).map(([name, value]) => ({ name, value })),
        },
        rows,
      }
    }
    case 'sales': {
      let q = supabase.from('sales').select('ref_code,customer,amount,date,status,product:products(name),branch:branches(name)').order('date', { ascending: false }).limit(200)
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('staff_id', staffId)
      const { data } = await q
      const rows = data || []
      const completed = rows.filter((r) => r.status === 'Completed')
      return {
        type,
        summary: { totalSales: completed.length, totalRevenue: completed.reduce((s, r) => s + Number(r.amount || 0), 0) },
        charts: {
          byProduct: Object.entries(groupSum(completed.map((r) => ({ name: r.product?.name || '—', amount: r.amount })), 'name', 'amount')).map(([name, value]) => ({ name, value })),
        },
        rows,
      }
    }
    case 'revenue': {
      const { data } = await supabase.from('finance_monthly').select('*').order('id', { ascending: true })
      const rows = data || []
      return {
        type,
        summary: { revenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0), profit: rows.reduce((s, r) => s + Number(r.profit || 0), 0) },
        charts: { trend: rows.map((r) => ({ month: r.month, revenue: r.revenue, profit: r.profit })) },
        rows,
      }
    }
    case 'branch': {
      let q = supabase.from('branches').select('name,city,region,monthly_revenue,total_revenue,target_achievement,conversion_rate')
      if (branchId) q = q.eq('id', branchId)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { branches: rows.length, totalRevenue: rows.reduce((s, r) => s + Number(r.total_revenue || 0), 0) },
        charts: { revenue: rows.map((r) => ({ name: r.name, value: r.monthly_revenue })), achievement: rows.map((r) => ({ name: r.name, value: r.target_achievement })) },
        rows,
      }
    }
    case 'staff': {
      let q = supabase.from('users').select('name,role,revenue,achievement,conversion_rate,performance_score,branch:branches(name)').eq('role', 'staff').order('performance_score', { ascending: false }).limit(100)
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('id', staffId)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { staff: rows.length, totalRevenue: rows.reduce((s, r) => s + Number(r.revenue || 0), 0) },
        charts: { topByRevenue: rows.slice(0, 10).map((r) => ({ name: r.name, value: r.revenue })) },
        rows,
      }
    }
    case 'target': {
      let q = supabase.from('general_targets').select('product:products(name),scope,period,target_qty,achieved_qty,completion,status,branch:branches(name)')
      // Managers/staff see their branch targets + global (all-branch) targets.
      if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { total: rows.length, achieved: rows.filter((r) => ['Completed', 'Overachieved'].includes(r.status)).length },
        charts: { completion: rows.map((r) => ({ name: r.product?.name || '—', target: r.target_qty, achieved: r.achieved_qty })) },
        rows,
      }
    }
    case 'incentive': {
      let q = supabase.from('incentives').select('month,total,type,status,staff:users(name),branch:branches(name)')
      if (branchId) q = q.eq('branch_id', branchId)
      if (staffId) q = q.eq('staff_id', staffId)
      const { data } = await q
      const rows = data || []
      return {
        type,
        summary: { total: rows.reduce((s, r) => s + Number(r.total || 0), 0), paid: rows.filter((r) => r.status === 'Paid').length },
        charts: { byBranch: Object.entries(groupSum(rows.map((r) => ({ name: r.branch?.name || '—', total: r.total })), 'name', 'total')).map(([name, value]) => ({ name, value })) },
        rows,
      }
    }
    default:
      throw ApiError.badRequest('Unknown report type')
  }
}
