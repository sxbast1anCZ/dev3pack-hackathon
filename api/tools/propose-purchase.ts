import {
  isPharmacyId,
  QUOTE_TTL_SECONDS,
  type ProposePurchaseRequest,
  type ProposePurchaseResponse,
} from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'
import { findMockProductById } from '../_lib/mock-catalog.js'
import { now, quoteStore } from '../_lib/quotes.js'

// POST /api/tools/propose-purchase. Agent tool propose_purchase (docs/contracts.md, section 2).
// Prices are simulated until card A6. The quote is stored (card A3). Card A5 reads the policy
// from the chain to set within_policy.

const validate: Validator<ProposePurchaseRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.policy)) return { ok: false, error: 'policy is required' }
  if (!nonEmptyString(body.product_id)) return { ok: false, error: 'product_id is required' }
  if (!isPharmacyId(body.pharmacy)) return { ok: false, error: 'pharmacy must be cruzverde, ahumada or salcobrand' }
  return { ok: true, value: { policy: body.policy, product_id: body.product_id, pharmacy: body.pharmacy } }
}

export async function proposePurchase(body: ProposePurchaseRequest): Promise<ProposePurchaseResponse> {
  const entry = findMockProductById(body.product_id)
  if (!entry) return { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' }

  const offer = entry.offers.find((o) => o.pharmacy === body.pharmacy)
  if (!offer) return { ok: false, reason: 'PRICE_UNAVAILABLE' }
  if (!offer.in_stock) return { ok: false, reason: 'OUT_OF_STOCK' }

  const at = now()
  const readAt = new Date(at.getTime() - offer.read_minutes_ago * 60_000).toISOString()
  const quote = await quoteStore().create(
    { policy: body.policy, product_id: entry.product.id, pharmacy: offer.pharmacy, price: offer.price, read_at: readAt },
    at,
  )

  return {
    ok: true,
    quote_id: quote.id,
    product_id: entry.product.id,
    pharmacy: offer.pharmacy,
    price: offer.price,
    expires_in_seconds: QUOTE_TTL_SECONDS,
    within_policy: true,
    policy_reason: null,
  }
}

export const POST = agentTool(validate, proposePurchase)
