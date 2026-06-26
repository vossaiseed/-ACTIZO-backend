/**
 * Seed the database with the ACTIZO demo dataset (mirrors the frontend).
 *   node src/db/seed.js
 * Uses the Supabase service-role client (bypasses RLS).
 */
import { supabase } from '../config/supabase.js'
import { hashPin } from '../utils/pin.js'
import { logger } from '../utils/logger.js'

const BRANCHES = [
  { code: 'KKD', name: 'Kozhikode', city: 'Kozhikode', region: 'Kerala', manager: 'Arjun Menon', email: 'kozhikode@actizo.com', phone: '+91 495 244 1001', accent: 'blue', monthly_target: 55, monthly_achieved: 61, conversion_rate: 43, monthly_revenue: 1340000, total_revenue: 14200000, target_revenue: 16000000, target_achievement: 89 },
  { code: 'MLP', name: 'Malappuram', city: 'Malappuram', region: 'Kerala', manager: 'Fathima Rahman', email: 'malappuram@actizo.com', phone: '+91 483 273 1002', accent: 'emerald', monthly_target: 50, monthly_achieved: 44, conversion_rate: 38, monthly_revenue: 1080000, total_revenue: 11200000, target_revenue: 13000000, target_achievement: 86 },
  { code: 'COK', name: 'Kochi', city: 'Kochi', region: 'Kerala', manager: 'Rahul Pillai', email: 'kochi@actizo.com', phone: '+91 484 401 1003', accent: 'violet', monthly_target: 65, monthly_achieved: 71, conversion_rate: 46, monthly_revenue: 1620000, total_revenue: 17400000, target_revenue: 18500000, target_achievement: 94 },
  { code: 'TSR', name: 'Thrissur', city: 'Thrissur', region: 'Kerala', manager: 'Vishnu Nair', email: 'thrissur@actizo.com', phone: '+91 487 233 1004', accent: 'amber', monthly_target: 35, monthly_achieved: 28, conversion_rate: 39, monthly_revenue: 720000, total_revenue: 7600000, target_revenue: 9500000, target_achievement: 80 },
  { code: 'CBE', name: 'Coimbatore', city: 'Coimbatore', region: 'Tamil Nadu', manager: 'Karthik Subramaniam', email: 'coimbatore@actizo.com', phone: '+91 422 245 1005', accent: 'rose', monthly_target: 45, monthly_achieved: 33, conversion_rate: 35, monthly_revenue: 1100000, total_revenue: 9800000, target_revenue: 12500000, target_achievement: 78 },
]

const PRODUCTS = [
  { code: 'ACP-001', name: 'ACP Sheet — Silver Metallic', brand: 'Alstrong', category: 'ACP Sheets', unit: 'SQM', price: 320, sold: 4820, growth: 18.6, status: 'Active' },
  { code: 'ACP-002', name: 'ACP Sheet — Wooden Finish', brand: 'Aludecor', category: 'ACP Sheets', unit: 'SQM', price: 360, sold: 3120, growth: 14.2, status: 'Active' },
  { code: 'ACP-003', name: 'Fire-Rated ACP Sheet', brand: 'Eurobond', category: 'ACP Sheets', unit: 'SQM', price: 540, sold: 1860, growth: 22.9, status: 'Active' },
  { code: 'CON-001', name: 'TMT Steel Bar', brand: 'Tata Tiscon', category: 'Construction Materials', unit: 'TON', price: 62000, sold: 280, growth: 6.4, status: 'Active' },
  { code: 'CON-002', name: 'Ready-Mix Concrete', brand: 'UltraTech', category: 'Construction Materials', unit: 'CUM', price: 5200, sold: 940, growth: 9.1, status: 'Active' },
  { code: 'CON-003', name: 'Cement Bag (50kg)', brand: 'ACC', category: 'Construction Materials', unit: 'BAG', price: 410, sold: 8940, growth: 5.7, status: 'Active' },
  { code: 'IND-001', name: 'Aluminium Profile', brand: 'Jindal', category: 'Industrial Products', unit: 'PCS', price: 880, sold: 2120, growth: 11.3, status: 'Active' },
  { code: 'IND-002', name: 'Industrial Adhesive', brand: 'Pidilite', category: 'Industrial Products', unit: 'LTR', price: 540, sold: 1640, growth: 8.1, status: 'Inactive' },
  { code: 'MFG-001', name: 'PVC Sheet', brand: 'Sintex', category: 'Manufacturing Products', unit: 'PCS', price: 145, sold: 6210, growth: 12.4, status: 'Active' },
  { code: 'MFG-002', name: 'Composite Panel Core', brand: 'Alstrong', category: 'Manufacturing Products', unit: 'SQM', price: 240, sold: 3580, growth: 16.8, status: 'Active' },
  { code: 'PSM-001', name: 'Cladding Fastener Set', brand: 'Hilti', category: 'Project Supply Materials', unit: 'SET', price: 1250, sold: 760, growth: 7.5, status: 'Active' },
  { code: 'PSM-002', name: 'Structural Sealant', brand: 'Dow', category: 'Project Supply Materials', unit: 'LTR', price: 690, sold: 1980, growth: 10.2, status: 'Active' },
  { code: 'PSM-003', name: 'Sub-frame Channel', brand: 'Jindal', category: 'Project Supply Materials', unit: 'PCS', price: 320, sold: 2840, growth: -3.2, status: 'Inactive' },
  { code: 'DST-001', name: 'Coil Coated Aluminium', brand: 'Hindalco', category: 'Distribution Products', unit: 'SQM', price: 410, sold: 4360, growth: 19.4, status: 'Active' },
  { code: 'DST-002', name: 'Polyethylene Core Roll', brand: 'Supreme', category: 'Distribution Products', unit: 'ROLL', price: 2100, sold: 540, growth: 13.6, status: 'Active' },
]

const FINANCE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => {
  const revenue = (980 + i * 70) * 1000
  const expense = Math.round(revenue * 0.6)
  return { month: m, year: 2026, revenue, expense, profit: revenue - expense, inflow: revenue + 120000, outflow: expense + 60000 }
})

const EXPENSES = [
  { category: 'Salaries & Payroll', share: 38, amount: 642000 },
  { category: 'Marketing', share: 18, amount: 304000 },
  { category: 'Operations', share: 16, amount: 270000 },
  { category: 'Logistics', share: 12, amount: 203000 },
  { category: 'Incentives', share: 9, amount: 152000 },
  { category: 'Misc', share: 7, amount: 118000 },
]

const RECEIVABLES = [
  { bucket: '0–30 days', amount: 486000 },
  { bucket: '31–60 days', amount: 312000 },
  { bucket: '61–90 days', amount: 168000 },
  { bucket: '90+ days', amount: 94000 },
]

async function seed() {
  logger.info('Seeding ACTIZO CRM database...')

  // Branches
  const { data: branches, error: bErr } = await supabase.from('branches').upsert(BRANCHES, { onConflict: 'code' }).select()
  if (bErr) throw bErr
  logger.success(`Branches: ${branches.length}`)
  const branchByCode = Object.fromEntries(branches.map((b) => [b.code, b.id]))

  // Products
  const { data: products, error: pErr } = await supabase.from('products').upsert(PRODUCTS, { onConflict: 'code' }).select()
  if (pErr) throw pErr
  logger.success(`Products: ${products.length}`)

  // Users — admin + one manager per branch + two staff per branch
  const adminPin = await hashPin('123456')
  const staffPin = await hashPin('445566')
  // Unique PIN per branch manager so logging in as a manager lands on a specific
  // branch (demo PIN 112233 = Kozhikode). Shared PINs made login non-deterministic.
  const MGR_PINS = { KKD: '112233', MLP: '112244', COK: '112255', TSR: '112266', CBE: '112277' }
  const mgrPinHash = {}
  for (const [code, p] of Object.entries(MGR_PINS)) mgrPinHash[code] = await hashPin(p)

  const users = [
    { employee_id: 'EMP-ADMIN', name: 'Alex Morgan', email: 'admin@actizo.com', role: 'admin', pin_hash: adminPin, pin: '123456', avatar_color: 'from-brand-400 to-brand-600', status: 'active' },
  ]
  branches.forEach((b, i) => {
    users.push({
      employee_id: `EMP-MGR-${b.code}`, name: b.manager, email: b.email, role: 'branch_manager',
      pin_hash: mgrPinHash[b.code] || mgrPinHash.KKD, pin: MGR_PINS[b.code] || '112233', branch_id: b.id, avatar_color: 'from-indigo-400 to-indigo-600', status: 'active',
    })
    for (let s = 1; s <= 2; s++) {
      users.push({
        employee_id: `EMP-${b.code}-${s}`, name: `${b.city} Staff ${s}`,
        email: `staff${s}.${b.code.toLowerCase()}@actizo.com`, role: 'staff', pin_hash: staffPin, pin: '445566',
        branch_id: b.id, avatar_color: 'from-emerald-400 to-emerald-600', status: 'active',
        performance_score: 60 + i, rating: 4.2,
      })
    }
  })
  const { data: insertedUsers, error: uErr } = await supabase.from('users').upsert(users, { onConflict: 'email' }).select()
  if (uErr) throw uErr
  logger.success(`Users: ${insertedUsers.length}`)

  // Give sales staff a revenue target so achievement % computes.
  await supabase.from('users').update({ target: 1000000 }).eq('role', 'staff')

  // ---- Transactional demo data (leads, sales, targets, incentives, feed) ----
  // Clear prior runs first (leads cascade to timeline/follow-ups/activities).
  const NONE = '00000000-0000-0000-0000-000000000000'
  await supabase.from('sales').delete().neq('id', NONE)
  await supabase.from('incentives').delete().neq('id', NONE)
  await supabase.from('general_targets').delete().neq('id', NONE)
  await supabase.from('special_targets').delete().neq('id', NONE)
  await supabase.from('project_targets').delete().neq('id', NONE)
  await supabase.from('activities').delete().neq('id', NONE)
  await supabase.from('leads').delete().neq('id', NONE)

  const daysAgo = (n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const SURNAMES = ['Menon', 'Nair', 'Khan', 'Pillai', 'Raj', 'Kumar', 'Das', 'Varma']
  const FIRST = ['Rahul', 'Anjali', 'Mohammed', 'Priya', 'Vishnu', 'Fathima', 'Arun', 'Deepa', 'Suresh', 'Lakshmi', 'Nikhil', 'Sneha', 'Rajesh', 'Divya', 'Hari', 'Meera', 'Sanjay', 'Kavya', 'Imran', 'Reshma', 'Gopika', 'Aishwarya', 'Tariq', 'Nimisha']
  const COMPANIES = ['Skyline Interiors', 'Crescent Builders', 'Galaxy Constructions', 'Pioneer Projects', 'Urban Edge', 'Heritage Homes', 'Summit Infra', 'Coastal Developers', 'Metro Facades', 'Greenfield Estates']
  const SOURCES = ['Website', 'Referral', 'Walk-in', 'Social Media', 'Cold Call', 'Exhibition', 'Google Ads', 'WhatsApp']
  const STATUS_CYCLE = ['New Lead', 'Assigned', 'Contacted', 'Follow-Up', 'Negotiation', 'Won', 'Won', 'Contacted', 'Lost', 'Follow-Up', 'Negotiation', 'Won']
  const PRIO = ['High', 'Medium', 'Low']
  const FU_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Site Visit']

  const staffByBranch = {}
  insertedUsers.filter((u) => u.role === 'staff').forEach((s) => {
    ;(staffByBranch[s.branch_id] ||= []).push(s)
  })

  // Leads
  const leadRows = []
  for (let i = 0; i < 24; i++) {
    const branch = branches[i % branches.length]
    const status = STATUS_CYCLE[i % STATUS_CYCLE.length]
    const bStaff = staffByBranch[branch.id] || []
    const staffMember = status !== 'New Lead' && bStaff.length ? bStaff[i % bStaff.length] : null
    const product = products[i % products.length]
    const name = `${FIRST[i % FIRST.length]} ${SURNAMES[i % SURNAMES.length]}`
    const upcoming = ['Contacted', 'Follow-Up', 'Negotiation'].includes(status)
    leadRows.push({
      ref_code: `LD-${1001 + i}`,
      name,
      company: COMPANIES[i % COMPANIES.length],
      mobile: `+91 9${String(400000000 + i * 1234567).slice(0, 9)}`,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${i}@example.com`,
      location: branch.city,
      product_id: product.id,
      source: SOURCES[i % SOURCES.length],
      branch_id: branch.id,
      staff_id: staffMember?.id || null,
      status,
      priority: PRIO[i % PRIO.length],
      value: 40000 + ((i * 17000) % 260000),
      score: 55 + ((i * 7) % 45),
      created_date: daysAgo(90 - i * 3),
      next_follow_up: upcoming ? daysAgo(-(3 + (i % 7))) : null,
      notes: 'Auto-seeded demo lead.',
      tags: [product.category, branch.region, PRIO[i % PRIO.length]],
    })
  }
  const { data: insertedLeads, error: lErr } = await supabase.from('leads').insert(leadRows).select()
  if (lErr) throw lErr
  logger.success(`Leads: ${insertedLeads.length}`)

  // Timeline + activities + follow-ups for those leads
  const timeline = []
  const leadActs = []
  const followUps = []
  insertedLeads.forEach((lead, i) => {
    timeline.push({ lead_id: lead.id, type: 'created', title: 'Lead created', description: `Captured via ${lead.source}`, date: lead.created_date, by: 'System' })
    leadActs.push({ lead_id: lead.id, action: 'Lead created', detail: `New lead from ${lead.source}`, date: lead.created_date, by: 'System' })
    if (lead.staff_id) timeline.push({ lead_id: lead.id, type: 'assigned', title: 'Staff assigned', description: 'Allocated to sales staff', date: lead.created_date, by: 'Branch Manager' })
    if (['Contacted', 'Follow-Up', 'Negotiation', 'Won'].includes(lead.status)) {
      const ftype = FU_TYPES[i % FU_TYPES.length]
      followUps.push({ lead_id: lead.id, type: ftype, status: lead.status === 'Won' ? 'Completed' : 'Scheduled', date: lead.created_date, next_date: lead.next_follow_up, remark: `${ftype} with the customer to discuss requirements.`, by: 'Sales' })
      leadActs.push({ lead_id: lead.id, action: `Follow-up (${ftype})`, detail: 'Customer contacted', date: lead.created_date, by: 'Sales' })
    }
    if (['Won', 'Lost'].includes(lead.status)) timeline.push({ lead_id: lead.id, type: 'status', title: lead.status, description: `Stage moved to ${lead.status}`, date: daysAgo(5), by: 'Sales' })
  })
  await supabase.from('lead_timeline').insert(timeline)
  await supabase.from('lead_activities').insert(leadActs)
  await supabase.from('follow_ups').insert(followUps)
  logger.success(`Timeline/Activities/Follow-ups: ${timeline.length}/${leadActs.length}/${followUps.length}`)

  // Sales (from Won leads)
  const productById = Object.fromEntries(products.map((p) => [p.id, p]))
  const saleRows = insertedLeads
    .filter((l) => l.status === 'Won')
    .map((lead, i) => {
      const product = productById[lead.product_id] || products[0]
      const qty = 5 + (i % 10) * 3
      const unitPrice = Number(product.price) || 1000
      const total = qty * unitPrice
      const discount = Math.round(total * 0.03)
      const final = total - discount
      return {
        ref_code: `SL-${2001 + i}`,
        lead_id: lead.id,
        customer: lead.name,
        product_id: product.id,
        category: product.category,
        branch_id: lead.branch_id,
        staff_id: lead.staff_id,
        quantity: qty,
        unit: product.unit,
        unit_price: unitPrice,
        total_amount: total,
        discount,
        final_amount: final,
        amount: final,
        date: daysAgo(2 + i * 4),
        status: 'Completed',
        payment_status: i % 3 === 0 ? 'Partial' : 'Paid',
        payment_method: ['Cash', 'Bank Transfer', 'UPI', 'Cheque'][i % 4],
      }
    })
  const { data: insertedSales } = await supabase.from('sales').insert(saleRows).select()
  logger.success(`Sales: ${insertedSales?.length || 0}`)

  // Targets — general / special / project
  const generalTargets = products.slice(0, 6).map((p, i) => {
    const branch = branches[i % branches.length]
    const targetQty = 200 + i * 120
    const achieved = Math.round(targetQty * (0.4 + (i % 5) * 0.14))
    return { product_id: p.id, scope: i % 3 === 0 ? 'Branch' : 'Admin', branch_id: i % 3 === 0 ? branch.id : null, period: 'Monthly', target_qty: targetQty, achieved_qty: achieved, completion: Math.round((achieved / targetQty) * 100), start_date: daysAgo(20), end_date: daysAgo(-10), month: 'Jun 2026', status: achieved >= targetQty ? 'Overachieved' : 'Active' }
  })
  await supabase.from('general_targets').insert(generalTargets)

  const specialTargets = [
    { name: 'Eid Festival Mega Sale', type: 'Festival' },
    { name: 'Monsoon Construction Drive', type: 'Seasonal' },
    { name: 'New ACP Range Launch', type: 'Product Launch' },
  ].map((t, i) => {
    const branch = branches[i % branches.length]
    const targetValue = 600000 + i * 250000
    const achievedValue = Math.round(targetValue * (0.45 + i * 0.18))
    return { ...t, branch_id: branch.id, start_date: daysAgo(25), end_date: daysAgo(-15), target_value: targetValue, achieved_value: achievedValue, incentive: 8000 + i * 2500, completion: Math.round((achievedValue / targetValue) * 100), status: 'Active' }
  })
  await supabase.from('special_targets').insert(specialTargets)

  const projectTargets = [
    { name: 'Palm Villa Estates', type: 'Villa', location: 'Kochi' },
    { name: 'Metro Commercial Tower', type: 'Commercial', location: 'Coimbatore' },
    { name: 'Lakeside Apartments', type: 'Apartment', location: 'Thrissur' },
  ].map((t, i) => {
    const branch = branches[i % branches.length]
    const revenueTarget = 1200000 + i * 400000
    const revenueAchieved = Math.round(revenueTarget * (0.35 + i * 0.2))
    return { ...t, branch_id: branch.id, project_value: revenueTarget * 3, revenue_target: revenueTarget, revenue_achieved: revenueAchieved, qty_target: 800 + i * 200, qty_achieved: Math.round((800 + i * 200) * 0.4), start_date: daysAgo(60), end_date: daysAgo(-180), completion: Math.round((revenueAchieved / revenueTarget) * 100), status: 'Active' }
  })
  await supabase.from('project_targets').insert(projectTargets)
  logger.success(`Targets: ${generalTargets.length} general · ${specialTargets.length} special · ${projectTargets.length} project`)

  // Incentives (3 months per staff; revenue-based)
  const revByStaff = {}
  ;(insertedSales || []).forEach((s) => {
    revByStaff[s.staff_id] = (revByStaff[s.staff_id] || 0) + Number(s.final_amount)
  })
  const incMonths = ['Apr 2026', 'May 2026', 'Jun 2026']
  const incentiveRows = []
  insertedUsers.filter((u) => u.role === 'staff').forEach((s, i) => {
    incMonths.forEach((m, mi) => {
      const base = (revByStaff[s.id] || 250000) * (0.7 + mi * 0.15)
      const rate = 3 + (i % 3)
      const amount = Math.round((base * rate) / 100)
      const bonus = mi === 2 ? 2000 : 0
      incentiveRows.push({ staff_id: s.id, branch_id: s.branch_id, month: m, base_sales: Math.round(base), incentive_rate: rate, amount, bonus, total: amount + bonus, type: 'Monthly', status: m === 'Jun 2026' ? 'Pending' : 'Paid' })
    })
  })
  await supabase.from('incentives').insert(incentiveRows)
  logger.success(`Incentives: ${incentiveRows.length}`)

  // Global activity feed
  const feed = insertedLeads.slice(0, 10).map((lead, i) => ({
    type: lead.status === 'Won' ? 'won' : 'lead',
    icon: lead.status === 'Won' ? 'FiCheckCircle' : 'FiUserPlus',
    color: ['brand', 'emerald', 'sky', 'violet', 'amber', 'rose'][i % 6],
    title: lead.status === 'Won' ? `Deal won — ${lead.name}` : `New lead ${lead.name}`,
    description: `${lead.source} • ${lead.location}`,
    user_id: lead.staff_id,
    time: new Date(Date.now() - i * 3600 * 1000).toISOString(),
  }))
  await supabase.from('activities').insert(feed)
  logger.success(`Activity feed: ${feed.length}`)

  // Finance
  await supabase.from('finance_monthly').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('finance_monthly').insert(FINANCE)
  await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('expenses').insert(EXPENSES)
  await supabase.from('receivables').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('receivables').insert(RECEIVABLES)
  logger.success('Finance reference data seeded')

  logger.success('Seed complete. Demo PINs — Admin: 123456 · Branch Manager: 112233 · Staff: 445566')
}

seed().catch((err) => {
  logger.error('Seed failed:', err.message || err)
  process.exit(1)
})
