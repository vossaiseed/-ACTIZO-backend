/**
 * Apply a .sql file to the Supabase Postgres database.
 *   node src/db/runSql.js schema.sql
 *   node src/db/runSql.js policies.sql
 * Requires DATABASE_URL in .env (Supabase → Settings → Database → Connection string).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] || 'schema.sql'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env')
    process.exit(1)
  }
  const sql = readFileSync(join(__dirname, file), 'utf8')
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  console.log(`Applying ${file}...`)
  await client.query(sql)
  await client.end()
  console.log('✓ Done')
}

main().catch((err) => {
  console.error('Failed to apply SQL:', err.message)
  process.exit(1)
})
