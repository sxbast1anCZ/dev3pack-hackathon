import { cheaperBioequivalentExists, loadCatalog, matchProduct, offersFor, toProduct } from '../_lib/catalog.js'
import type { SearchPricesRequest, SearchPricesResponse } from '../_lib/contract.js'
import { agentTool, isObject, nonEmptyString, type Validator } from '../_lib/http.js'
import { now } from '../_lib/quotes.js'
import { chain, isPublicKey, productHash } from '../_lib/solana.js'

// POST /api/tools/search-prices. Agent tool search_prices (docs/contracts.md, section 2).
// Reads the catalog and the latest prices (card A6), and the policy from the chain to say whether
// the family allowed this product.

const validate: Validator<SearchPricesRequest> = (body) => {
  if (!isObject(body)) return { ok: false, error: 'body must be an object' }
  if (!nonEmptyString(body.policy) || !isPublicKey(body.policy)) return { ok: false, error: 'policy must be a base58 address' }
  if (!nonEmptyString(body.query)) return { ok: false, error: 'query is required' }
  return { ok: true, value: { policy: body.policy, query: body.query } }
}

export async function searchPrices(body: SearchPricesRequest): Promise<SearchPricesResponse> {
  const [data, policy] = await Promise.all([loadCatalog(), chain().readPolicy(body.policy)])
  const product = matchProduct(body.query, data.products)
  if (!product) return { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' }

  const hash = Buffer.from(productHash(product.id)).toString('hex')
  return {
    ok: true,
    product: toProduct(product),
    allowed_by_policy: policy !== null && policy.products.includes(hash),
    bioequivalent_available: cheaperBioequivalentExists(product, data),
    offers: offersFor(product.id, data, now()),
  }
}

export const POST = agentTool(validate, searchPrices)
