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
