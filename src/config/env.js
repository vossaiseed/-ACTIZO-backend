import dotenv from 'dotenv'

dotenv.config()

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET']

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,

  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 1000,

  get isProd() {
    return this.nodeEnv === 'production'
  },
}

/** Warn (don't crash in dev) if any required env vars are missing. */
export function validateEnv() {
  const missing = required.filter((k) => !process.env[k])
  if (missing.length) {
    const msg = `[env] Missing required environment variables: ${missing.join(', ')}`
    if (env.isProd) throw new Error(msg)
    console.warn(`\x1b[33m${msg}\x1b[0m`)
  }
}

export default env
