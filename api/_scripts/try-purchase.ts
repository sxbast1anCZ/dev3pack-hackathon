// Runs the agent's purchase flow from this computer, without Vercel or ElevenLabs: the real
// search_prices, propose_purchase and confirm_purchase handlers, against the Supabase project and
// the Solana policy named in .env. It checks every piece the live demo needs.
//
//   npm run try:purchase                        search and propose only: nothing is paid
//   npm run try:purchase -- --pay               also confirms: one real payment on devnet
//   npm run try:purchase -- metformina --pay    another medicine
//
// Needs in .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_KEYPAIR, GUEST_POLICY.
// SOLANA_RPC_URL defaults to devnet.
import type { ConfirmPurchaseResponse, ProposePurchaseResponse, SearchPricesResponse } from '../_lib/contract.js'
import { POST as confirm } from '../tools/confirm-purchase.js'
import { POST as propose } from '../tools/propose-purchase.js'
import { POST as search } from '../tools/search-prices.js'

const args = process.argv.slice(2)
const pay = args.includes('--pay')
const query = args.filter((a) => a !== '--pay').join(' ').trim() || 'losartán de 50'

if (!process.env.SOLANA_RPC_URL) process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com'
const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AGENT_KEYPAIR', 'GUEST_POLICY'].filter((n) => !process.env[n])
if (missing.length) {
  console.error(`Falta en .env: ${missing.join(', ')}.`)
  process.exit(1)
}
const policy = process.env.GUEST_POLICY as string
process.env.AGENT_TOOL_SECRET = 'local-try-purchase'

async function call<T>(handler: (r: Request) => Promise<Response>, body: unknown): Promise<T> {
  const res = await handler(
    new Request('http://localhost/api/tools/local', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-secret': 'local-try-purchase' },
      body: JSON.stringify(body),
    }),
  )
  const out = (await res.json()) as T
  if (res.status !== 200) {
    console.error(`HTTP ${res.status}:`, JSON.stringify(out), '(el detalle del error está arriba)')
    process.exit(1)
  }
  return out
}

console.log(`1. search_prices "${query}" con la política ${policy}`)
const found = await call<SearchPricesResponse>(search, { policy, query })
console.log(JSON.stringify(found, null, 2))
if (!found.ok) process.exit(1)
if (!found.allowed_by_policy) console.log('   Ojo: la política no incluye este remedio.')
const offer = found.offers.find((o) => o.in_stock)
if (!offer) {
  console.log('   Ninguna farmacia tiene stock: no hay nada que proponer.')
  process.exit(0)
}

console.log(`\n2. propose_purchase ${found.product.id} en ${offer.pharmacy} a $${offer.price}`)
const quote = await call<ProposePurchaseResponse>(propose, { policy, product_id: found.product.id, pharmacy: offer.pharmacy })
console.log(JSON.stringify(quote, null, 2))
if (!quote.ok) process.exit(1)
if (!quote.within_policy) {
  console.log(`   La política lo rechazaría: ${quote.policy_reason}. No se paga.`)
  process.exit(0)
}

if (!pay) {
  console.log('\nTodo bien hasta la cotización. No se pagó nada. Para pagar de verdad en devnet: npm run try:purchase -- --pay')
  process.exit(0)
}

console.log(`\n3. confirm_purchase ${quote.quote_id}`)
const paid = await call<ConfirmPurchaseResponse>(confirm, { quote_id: quote.quote_id })
console.log(JSON.stringify(paid, null, 2))
if (paid.ok) console.log(`\nPagado en devnet. Transacción: ${paid.explorer_url}`)
