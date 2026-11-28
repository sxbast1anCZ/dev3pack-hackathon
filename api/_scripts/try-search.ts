// Calls the real search_prices handler against the Supabase project in .env, to check that the
// agent reads the catalog and the prices. Reads only: no quote, no payment, no Solana call.
//
//   npm run try:search                      asks for "losartán de 50"
//   npm run try:search -- metformina        asks for another medicine
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (copy .env.example to .env).
import { setChain } from '../_lib/solana.js'
import { POST } from '../tools/search-prices.js'

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !process.env[name])
if (missing.length) {
  console.error(`Falta en .env: ${missing.join(', ')}. Copia .env.example a .env y completa esos valores.`)
  process.exit(1)
}

// The policy is not checked here: allowed_by_policy comes back false, and that is expected.
setChain({
  agentAddress: () => '11111111111111111111111111111111',
  readPolicy: async () => null,
  pay: async () => {
    throw new Error('try:search never pays')
  },
})

const query = process.argv.slice(2).join(' ').trim() || 'losartán de 50'
process.env.AGENT_TOOL_SECRET = 'local-try-search'
const res = await POST(
  new Request('http://localhost/api/tools/search-prices', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agent-secret': 'local-try-search' },
    body: JSON.stringify({ policy: '11111111111111111111111111111111', query }),
  }),
)
const body = (await res.json()) as Record<string, unknown>
console.log(`Pregunta: "${query}" -> HTTP ${res.status}`)
console.log(JSON.stringify(body, null, 2))
if (res.status !== 200) {
  console.error('La herramienta falló. Revisa los valores de Supabase en .env (el detalle está arriba).')
  process.exit(1)
}
