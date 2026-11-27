import type { SearchPricesRequest, SearchPricesResponse } from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'
import { findMockProduct } from '../_lib/mock-catalog.js'

// POST /api/tools/search-prices. Agent tool search_prices (docs/contracts.md, section 2).
// Cards A1 and A2: answers from simulated data. Card A6 reads the products and prices tables.

const validate: Validator<SearchPricesRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.policy)) return { ok: false, error: 'policy is required' }
  if (!nonEmptyString(body.query)) return { ok: false, error: 'query is required' }
  return { ok: true, value: { policy: body.policy, query: body.query } }
}

export async function searchPrices(body: SearchPricesRequest): Promise<SearchPricesResponse> {
  const entry = findMockProduct(body.query)
  if (!entry) return { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' }

  return {
    ok: true,
    product: entry.product,
    allowed_by_policy: true,
    bioequivalent_available: false,
    // The contract says offers are sorted by price.
    offers: [...entry.offers].sort((a, b) => a.price - b.price),
  }
}

export const POST = agentTool(validate, searchPrices)
