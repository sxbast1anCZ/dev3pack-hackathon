import type { ConfirmPurchaseRequest, ConfirmPurchaseResponse } from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'
import { pharmacyWallet } from '../_lib/pharmacies.js'
import { now, quoteStore } from '../_lib/quotes.js'
import { chain, explorerTxUrl, productHash, quoteHash } from '../_lib/solana.js'

// POST /api/tools/confirm-purchase. Agent tool confirm_purchase (docs/contracts.md, section 2).
// 1. The quote is claimed first (card A3): a missing, expired or used quote is refused, and a quote
//    is marked used before anything is sent, so it can never pay twice.
// 2. agent_pay is signed with the agent key and sent to devnet (card A5). The program checks every
//    rule; a refusal comes back with the program's error name.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const validate: Validator<ConfirmPurchaseRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.quote_id)) return { ok: false, error: 'quote_id is required' }
  return { ok: true, value: { quote_id: body.quote_id } }
}

export async function confirmPurchase(body: ConfirmPurchaseRequest): Promise<ConfirmPurchaseResponse> {
  if (!UUID.test(body.quote_id)) return { ok: false, reason: 'QUOTE_NOT_FOUND' }

  const claim = await quoteStore().claim(body.quote_id, now())
  if (!claim.ok) return { ok: false, reason: claim.reason }
  const quote = claim.quote

  const result = await chain().pay({
    policy: quote.policy,
    pharmacy: await pharmacyWallet(quote.pharmacy),
    amount: quote.price,
    product: productHash(quote.product_id),
    quoteHash: quoteHash(quote),
  })
  if (!result.ok) return { ok: false, reason: result.error }

  // The payment is on-chain already. Failing to store its signature must not tell the person that
  // nothing was paid, so it is logged and the result still goes back.
  try {
    await quoteStore().setSignature(quote.id, result.signature)
  } catch (err) {
    console.error('payment sent but its signature was not stored', quote.id, result.signature, err)
  }

  return {
    ok: true,
    signature: result.signature,
    explorer_url: explorerTxUrl(result.signature),
    price: quote.price,
    pharmacy: quote.pharmacy,
  }
}

export const POST = agentTool(validate, confirmPurchase)
