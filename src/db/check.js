/**
 * Supabase connectivity check — prints a clear PASS/FAIL to the terminal.
 *   npm run db:check
 *
 * Note: run via `node --use-system-ca` (the npm script does this) so Node trusts
 * the OS certificate store. On machines with antivirus/proxy HTTPS scanning
 * (e.g. Avast), the AV re-signs TLS with its own root; without --use-system-ca
 * Node rejects it as UNABLE_TO_VERIFY_LEAF_SIGNATURE.
 */
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'

const ok = (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`)

async function main() {
  console.log('— Supabase connection check —')
  console.log('URL        :', env.supabaseUrl || '(missing)')
  console.log('Service key:', env.supabaseServiceKey ? 'present' : '(missing)')
  console.log('')

  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    bad('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
    process.exit(1)
  }

  // A HEAD count on any table proves TLS + auth + reachable Postgres.
  const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })

  if (!error) {
    ok('Connected to Supabase (REST + auth + DB all OK)')
    return
  }

  // Connection succeeded but the table is absent → schema not pushed yet.
  if (/schema cache|does not exist|find the table/i.test(error.message)) {
    ok('Connected to Supabase (REST + auth OK)')
    console.log(`  Note: ${error.message}`)
    console.log('  → Connection is fine; run `npm run db:push` to create the schema.')
    return
  }

  bad(`Connection failed: ${error.message}`)
  if (/leaf signature|self.signed|unable to verify|certificate/i.test(error.message)) {
    console.log('  → TLS interception (antivirus/proxy). Ensure scripts run with `node --use-system-ca`.')
  }
  process.exit(1)
}

main().catch((e) => {
  bad(`Connection failed: ${e.cause?.code || e.message}`)
  if (/LEAF_SIGNATURE|certificate|unable to verify/i.test(e.cause?.code || e.message)) {
    console.log('  → TLS interception (antivirus/proxy). Run with `node --use-system-ca`.')
  }
  process.exit(1)
})
