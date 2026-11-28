// GET /api/diagnose. TEMPORARY: the agent tools answer FUNCTION_INVOCATION_FAILED on Vercel and the
// runtime logs are not at hand. This loads, one by one, every module the tools load, and says which
// one fails and why. It reports whether each variable is set, never its value. Delete it once the
// tools answer.
//
// Each import is a literal, so Vercel bundles the same files the tools use.

type Result = 'ok' | string

async function attempt(load: () => Promise<unknown>): Promise<Result> {
  try {
    await load()
    return 'ok'
  } catch (err) {
    const text = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err)
    return text.split('\n').slice(0, 8).join('\n')
  }
}

export async function GET(): Promise<Response> {
  const modules: Record<string, Result> = {
    '@supabase/supabase-js': await attempt(() => import('@supabase/supabase-js')),
    '@anchor-lang/core': await attempt(() => import('@anchor-lang/core')),
    './_lib/http.js': await attempt(() => import('./_lib/http.js')),
    './_lib/db.js': await attempt(() => import('./_lib/db.js')),
    './_lib/quotes.js': await attempt(() => import('./_lib/quotes.js')),
    './_lib/pharmacies.js': await attempt(() => import('./_lib/pharmacies.js')),
    './_lib/catalog.js': await attempt(() => import('./_lib/catalog.js')),
    './_lib/solana.js': await attempt(() => import('./_lib/solana.js')),
    './tools/search-prices.js': await attempt(() => import('./tools/search-prices.js')),
  }
  const names = ['AGENT_TOOL_SECRET', 'AGENT_KEYPAIR', 'SOLANA_RPC_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const env = Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]))
  return Response.json({ node: process.version, modules, env_is_set: env })
}
