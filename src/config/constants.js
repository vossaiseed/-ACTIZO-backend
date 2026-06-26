/**
 * Domain constants — mirror the frontend so the API and UI stay in sync.
 */

export const ROLES = {
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  STAFF: 'staff',
}
export const ROLE_VALUES = Object.values(ROLES)

export const USER_STATUS = ['active', 'inactive']

export const LEAD_STATUSES = [
  'New Lead',
  'Assigned',
  'Contacted',
  'Follow-Up',
  'Negotiation',
  'Won',
  'Lost',
]
export const LEAD_PRIORITIES = ['High', 'Medium', 'Low']
export const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Walk-in',
  'Social Media',
  'Cold Call',
  'Exhibition',
  'Google Ads',
  'WhatsApp',
]

export const FOLLOWUP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Site Visit']
export const FOLLOWUP_STATUSES = ['Scheduled', 'Completed', 'Missed']

export const PRODUCT_CATEGORIES = [
  'ACP Sheets',
  'Construction Materials',
  'Industrial Products',
  'Manufacturing Products',
  'Project Supply Materials',
  'Distribution Products',
]
export const PRODUCT_STATUS = ['Active', 'Inactive']

export const SALE_STATUS = ['Completed', 'Pending', 'Refunded']
export const PAYMENT_STATUS = ['Pending', 'Partial', 'Paid']
export const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other']

export const TARGET_TYPES = ['general', 'special', 'project']
export const TARGET_STATUSES = ['Active', 'Completed', 'Pending', 'Overachieved', 'Expired']
export const TARGET_PERIODS = ['Monthly', 'Quarterly', 'Yearly', 'Custom']
export const SPECIAL_CAMPAIGN_TYPES = ['Festival', 'Seasonal', 'Product Launch', 'Flash Sale']
export const PROJECT_TYPES = ['Villa', 'Apartment', 'Commercial', 'Interior']

export const INCENTIVE_TYPES = ['Monthly', 'Special', 'Project']
export const INCENTIVE_STATUS = ['Paid', 'Pending']

export const REGIONS = ['Kerala', 'Tamil Nadu']
export const CURRENCY = 'INR'

/**
 * Route base-paths each role may access (used by RBAC middleware to mirror the
 * frontend sidebar/route gating).
 */
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['*'],
  [ROLES.BRANCH_MANAGER]: [
    'dashboard', 'leads', 'sales', 'targets', 'incentives',
    'branches', 'staff', 'users', 'reports', 'settings',
  ],
  [ROLES.STAFF]: ['dashboard', 'leads', 'follow-ups', 'sales', 'targets', 'incentives', 'settings'],
}

export default {
  ROLES,
  LEAD_STATUSES,
  PRODUCT_CATEGORIES,
  TARGET_TYPES,
}
