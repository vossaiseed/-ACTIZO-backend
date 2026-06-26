import * as financeModel from '../models/finance.model.js'

export async function overview() {
  const [months, recv, incPaid] = await Promise.all([
    financeModel.monthly(),
    financeModel.receivables(),
    financeModel.incentivesPaid(),
  ])
  const revenue = months.reduce((s, m) => s + Number(m.revenue || 0), 0)
  const expenses = months.reduce((s, m) => s + Number(m.expense || 0), 0)
  const profit = revenue - expenses
  const receivables = recv.reduce((s, r) => s + Number(r.amount || 0), 0)
  const profitMargin = revenue ? Math.round((profit / revenue) * 1000) / 10 : 0
  // Simple weighted health score from margin & receivables pressure.
  const healthScore = Math.max(
    0,
    Math.min(100, Math.round(profitMargin * 1.5 + 40 - (receivables / (revenue || 1)) * 20)),
  )
  return { revenue, expenses, profit, profitMargin, receivables, incentivesPaid: incPaid, healthScore }
}

export async function charts() {
  const [months, exp, recv] = await Promise.all([
    financeModel.monthly(),
    financeModel.expenses(),
    financeModel.receivables(),
  ])
  return {
    revenueVsExpense: months.map((m) => ({ month: m.month, revenue: m.revenue, expense: m.expense, profit: m.profit })),
    profitTrend: months.map((m) => ({ month: m.month, profit: m.profit })),
    monthlyOverview: months.map((m) => ({ month: m.month, revenue: m.revenue, expense: m.expense, profit: m.profit })),
    cashFlow: months.map((m) => ({ month: m.month, inflow: m.inflow, outflow: m.outflow, net: Number(m.inflow || 0) - Number(m.outflow || 0) })),
    expenseBreakdown: exp.map((e) => ({ name: e.category, value: e.share, amount: e.amount })),
    receivablesAging: recv.map((r) => ({ bucket: r.bucket, amount: r.amount })),
  }
}
