import type { ConfirmPurchaseRequest, ConfirmPurchaseResponse } from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'

// POST /api/tools/confirm-purchase. Agent tool confirm_purchase (docs/contracts.md, section 2).
// Card A2: simulated. No transaction is sent: the signature says so, and the explorer link opens
// devnet without a transaction. Card A3 checks the quote; card A5 signs agent_pay on devnet.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const validate: Validator<ConfirmPurchaseRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.quote_id)) return { ok: false, error: 'quote_id is required' }
  return { ok: true, value: { quote_id: body.quote_id } }
}

export const SIMULATED_SIGNATURE = 'simulated-no-transaction'

export async function confirmPurchase(body: ConfirmPurchaseRequest): Promise<ConfirmPurchaseResponse> {
  if (!UUID.test(body.quote_id)) return { ok: false, reason: 'QUOTE_NOT_FOUND' }

  return {
    ok: true,
    signature: SIMULATED_SIGNATURE,
    explorer_url: 'https://explorer.solana.com/?cluster=devnet',
    price: 2599,
    pharmacy: 'salcobrand',
  }
}

export const POST = agentTool(validate, confirmPurchase)
