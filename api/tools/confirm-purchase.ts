import type { ConfirmPurchaseRequest, ConfirmPurchaseResponse } from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'
import { now, quoteStore } from '../_lib/quotes.js'

// POST /api/tools/confirm-purchase. Agent tool confirm_purchase (docs/contracts.md, section 2).
// The quote is claimed first (card A3): a missing, expired or used quote is refused, and a quote
// is marked used before anything is sent, so it can never pay twice. No transaction is sent yet:
// the signature says so, and the explorer link opens devnet. Card A5 signs agent_pay on devnet.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const validate: Validator<ConfirmPurchaseRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.quote_id)) return { ok: false, error: 'quote_id is required' }
  return { ok: true, value: { quote_id: body.quote_id } }
}

export const SIMULATED_SIGNATURE = 'simulated-no-transaction'

export async function confirmPurchase(body: ConfirmPurchaseRequest): Promise<ConfirmPurchaseResponse> {
  if (!UUID.test(body.quote_id)) return { ok: false, reason: 'QUOTE_NOT_FOUND' }

  const claim = await quoteStore().claim(body.quote_id, now())
  if (!claim.ok) return { ok: false, reason: claim.reason }

  return {
    ok: true,
    signature: SIMULATED_SIGNATURE,
    explorer_url: 'https://explorer.solana.com/?cluster=devnet',
    price: claim.quote.price,
    pharmacy: claim.quote.pharmacy,
  }
}

export const POST = agentTool(validate, confirmPurchase)
