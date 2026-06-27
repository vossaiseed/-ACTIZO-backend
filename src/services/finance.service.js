import { supabase } from '../config/supabase.js'
import * as incentiveService from './incentive.service.js'

/**
 * Finance is derived entirely from REAL data — no seeded finance tables:
 *   revenue  = completed sales
 *   expenses = computed staff incentives (the only real cost the system tracks)
 *   receivables = value of sales not yet fully paid
 * (The app has no general expense ledger, so incentives are the expense basis.)
 */
async function allSales() {
  const { data } = await supabase.from('sales').select('final_amount, amount, status, payment_status, date')
  return data || []
}

function monthlySeries(completed, n = 8) {
  const byMonth = {}
  for (const s of completed) {
    const k = String(s.date || '').slice(0, 7) // YYYY-MM
    if (k) byMonth[k] = (byMonth[k] || 0) + Number(s.final_amount ?? s.amount ?? 0)
  }
  const now = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ month: d.toLocaleString('en-US', { month: 'short' }), revenue: byMonth[k] || 0 })
  }
  return out
}

export async function overview() {
  const [sales, inc] = await Promise.all([allSales(), incentiveService.earned({})])
  const completed = sales.filter((s) => s.status === 'Completed')
  const revenue = completed.reduce((s, r) => s + Number(r.final_amount ?? r.amount ?? 0), 0)
  const expenses = Number(inc.summary.totalIncentives || 0)
  const profit = revenue - expenses
  const profitMargin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0
  const receivables = sales
    .filter((s) => s.payment_status && s.payment_status !== 'Paid')
    .reduce((s, r) => s + Number(r.final_amount ?? r.amount ?? 0), 0)
  const healthScore = revenue
    ? Math.max(0, Math.min(100, Math.round(profitMargin * 1.5 + 40 - (receivables / revenue) * 20)))
    : 0
  return { revenue, expenses, profit, profitMargin, receivables, incentivesPaid: expenses, healthScore }
}

export async function charts() {
  const [sales, inc] = await Promise.all([allSales(), incentiveService.earned({})])
  const completed = sales.filter((s) => s.status === 'Completed')
  const months = monthlySeries(completed)
  const totalInc = Number(inc.summary.totalIncentives || 0)
  // Incentives aren't time-bucketed; attribute the running total to the latest month
  // so the chart's expense total reconciles with the KPI.
  const lastIdx = months.length - 1
  const withExpense = months.map((m, i) => {
    const expense = i === lastIdx ? totalInc : 0
    return { month: m.month, revenue: m.revenue, expense, profit: m.revenue - expense }
  })
  return {
    revenueVsExpense: withExpense,
    profitTrend: withExpense.map((m) => ({ month: m.month, profit: m.profit })),
    monthlyOverview: withExpense,
    cashFlow: months.map((m) => ({ month: m.month, inflow: m.revenue, outflow: 0, net: m.revenue })),
    expenseBreakdown: totalInc > 0 ? [{ name: 'Staff Incentives', value: 100, amount: totalInc }] : [],
    receivablesAging: [],
  }
}
