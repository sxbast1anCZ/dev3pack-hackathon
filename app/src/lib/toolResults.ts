export type Proposal =
  | {
      ok: true
      productId: string
      pharmacy: string
      price: number
      withinPolicy: boolean
      policyReason: string | null
    }
  | { ok: false; reason: string }

export type Purchase =
  | { ok: true; signature: string; explorerUrl: string; price: number; pharmacy: string }
  | { ok: false; reason: string }

const EXPLORER_PREFIX = 'https://explorer.solana.com/'

function parseObject(json: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

export function parseProposal(json: string): Proposal | null {
  const raw = parseObject(json)
  if (!raw || typeof raw.ok !== 'boolean') return null

  if (raw.ok) {
    if (
      typeof raw.product_id !== 'string' ||
      raw.product_id.length === 0 ||
      typeof raw.pharmacy !== 'string' ||
      raw.pharmacy.length === 0 ||
      typeof raw.price !== 'number' ||
      !Number.isFinite(raw.price) ||
      typeof raw.within_policy !== 'boolean'
    ) {
      return null
    }
    const reason = raw.policy_reason
    if (reason !== null && reason !== undefined && typeof reason !== 'string') {
      return null
    }
    return {
      ok: true,
      productId: raw.product_id,
      pharmacy: raw.pharmacy,
      price: raw.price,
      withinPolicy: raw.within_policy,
      policyReason: reason ?? null,
    }
  }

  if (typeof raw.reason !== 'string' || raw.reason.length === 0) return null
  return { ok: false, reason: raw.reason }
}

export function parsePurchase(json: string): Purchase | null {
  const raw = parseObject(json)
  if (!raw || typeof raw.ok !== 'boolean') return null

  if (raw.ok) {
    if (
      typeof raw.signature !== 'string' ||
      raw.signature.length === 0 ||
      typeof raw.explorer_url !== 'string' ||
      !raw.explorer_url.startsWith(EXPLORER_PREFIX) ||
      typeof raw.price !== 'number' ||
      !Number.isFinite(raw.price) ||
      typeof raw.pharmacy !== 'string' ||
      raw.pharmacy.length === 0
    ) {
      return null
    }
    return {
      ok: true,
      signature: raw.signature,
      explorerUrl: raw.explorer_url,
      price: raw.price,
      pharmacy: raw.pharmacy,
    }
  }

  if (typeof raw.reason !== 'string' || raw.reason.length === 0) return null
  return { ok: false, reason: raw.reason }
}

export interface Search {
  productId: string
  productName: string
  offers: { pharmacy: string; price: number; inStock: boolean }[]
}

export function parseSearch(json: string): Search | null {
  const raw = parseObject(json)
  if (!raw || raw.ok !== true) return null

  const product = raw.product
  if (typeof product !== 'object' || product === null || Array.isArray(product)) return null
  const prod = product as Record<string, unknown>
  if (
    typeof prod.id !== 'string' ||
    prod.id.length === 0 ||
    typeof prod.name !== 'string' ||
    prod.name.length === 0
  ) {
    return null
  }

  if (!Array.isArray(raw.offers)) return null
  const offers: Search['offers'] = []
  for (const entry of raw.offers) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null
    const o = entry as Record<string, unknown>
    if (
      typeof o.pharmacy !== 'string' ||
      o.pharmacy.length === 0 ||
      typeof o.price !== 'number' ||
      !Number.isFinite(o.price) ||
      typeof o.in_stock !== 'boolean'
    ) {
      return null
    }
    offers.push({ pharmacy: o.pharmacy, price: o.price, inStock: o.in_stock })
  }

  return { productId: prod.id, productName: prod.name, offers }
}

export function savingsFor(
  search: Search | null,
  proposal: Proposal | null,
): { amount: number; vs: string } | null {
  if (!search || !proposal || !proposal.ok) return null
  if (search.productId !== proposal.productId) return null

  const others = search.offers.filter((o) => o.inStock && o.pharmacy !== proposal.pharmacy)
  if (others.length === 0) return null

  let next = others[0]
  for (const candidate of others) {
    if (candidate.price < next.price) next = candidate
  }

  const amount = next.price - proposal.price
  if (amount <= 0) return null
  return { amount, vs: next.pharmacy }
}
