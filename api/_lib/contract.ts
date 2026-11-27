// Types of docs/contracts.md, section 2 (agent tools). If this file and the contract disagree,
// the contract is right: change the contract first, then this file.

export const PHARMACY_IDS = ['cruzverde', 'ahumada', 'salcobrand'] as const
export type PharmacyId = (typeof PHARMACY_IDS)[number]

export function isPharmacyId(value: unknown): value is PharmacyId {
  return typeof value === 'string' && (PHARMACY_IDS as readonly string[]).includes(value)
}

export interface Product {
  id: string
  name: string
  requires_prescription: boolean
  is_bioequivalent: boolean
}

export interface Offer {
  pharmacy: PharmacyId
  price: number
  in_stock: boolean
  read_minutes_ago: number
  url: string
}

export interface SearchPricesRequest {
  policy: string
  query: string
}

export type SearchPricesResponse =
  | {
      ok: true
      product: Product
      allowed_by_policy: boolean
      bioequivalent_available: boolean
      offers: Offer[]
    }
  | { ok: false; reason: 'PRODUCT_NOT_IN_CATALOG' }
