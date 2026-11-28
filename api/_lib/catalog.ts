import type { Offer, PharmacyId, Product } from './contract.js'
import { serverDb } from './db.js'

// The catalog and the latest price readings (card A6): tables products, product_sources and prices
// (docs/contracts.md, section 3). The data lane fills them with Firecrawl (data/refresh-prices.mjs).

export interface ProductRow {
  id: string
  name: string
  active_ingredient: string
  dose: string
  quantity: number
  requires_prescription: boolean
  is_bioequivalent: boolean
  aliases: string[]
}

export interface SourceRow {
  product_id: string
  pharmacy: PharmacyId
  url: string
}

export interface PriceRow {
  product_id: string
  pharmacy: PharmacyId
  price: number
  in_stock: boolean
  read_at: string
}

export interface CatalogData {
  products: ProductRow[]
  sources: SourceRow[]
  prices: PriceRow[]
}

export type CatalogSource = () => Promise<CatalogData>

async function fromTables(): Promise<CatalogData> {
  const db = serverDb()
  const [products, sources, prices] = await Promise.all([
    db.from('products').select('id, name, active_ingredient, dose, quantity, requires_prescription, is_bioequivalent, aliases'),
    db.from('product_sources').select('product_id, pharmacy, url'),
    db.from('prices').select('product_id, pharmacy, price, in_stock, read_at'),
  ])
  for (const [table, res] of [['products', products], ['product_sources', sources], ['prices', prices]] as const) {
    if (res.error) throw new Error(`${table} read failed: ${res.error.message}`)
  }
  return {
    products: (products.data ?? []) as ProductRow[],
    sources: (sources.data ?? []) as SourceRow[],
    prices: (prices.data ?? []) as PriceRow[],
  }
}

export let loadCatalog: CatalogSource = fromTables

// Tests replace the tables through this.
export function setCatalogSource(next: CatalogSource | undefined): void {
  loadCatalog = next ?? fromTables
}

// Lower case, without accents, so "Losartán" and "losartan" match.
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// How a request is compared with an alias: normalized, "z" read as "s" (they sound the same in
// Chile), and without spaces. Speech recognition joins and splits words: "mi losartán" arrives as
// "milosartán", "losartán" as "lozartán".
function spoken(text: string): string {
  return normalize(text).replace(/z/g, 's').replace(/ /g, '')
}

// The product whose alias appears in what the person said, even inside a longer word. When several
// match, the longest alias wins: "corodin de 50" names Corodin even if it also contains a shorter
// alias of another product.
export function matchProduct(query: string, products: ProductRow[]): ProductRow | undefined {
  const q = spoken(query)
  let best: { product: ProductRow; length: number } | undefined
  for (const product of products) {
    for (const alias of product.aliases) {
      const a = spoken(alias)
      if (a.length >= 4 && q.includes(a) && (!best || a.length > best.length)) best = { product, length: a.length }
    }
  }
  return best?.product
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    requires_prescription: row.requires_prescription,
    is_bioequivalent: row.is_bioequivalent,
  }
}

// The offers of one product, sorted by price as the contract says, with the age of each reading.
export function offersFor(productId: string, data: CatalogData, now: Date): Offer[] {
  return data.prices
    .filter((p) => p.product_id === productId)
    .map((p) => ({
      pharmacy: p.pharmacy,
      price: p.price,
      in_stock: p.in_stock,
      read_minutes_ago: Math.max(0, Math.floor((now.getTime() - new Date(p.read_at).getTime()) / 60_000)),
      url: data.sources.find((s) => s.product_id === productId && s.pharmacy === p.pharmacy)?.url ?? '',
    }))
    .sort((a, b) => a.price - b.price)
}

function cheapestInStock(productId: string, data: CatalogData): number | undefined {
  const prices = data.prices.filter((p) => p.product_id === productId && p.in_stock).map((p) => p.price)
  return prices.length ? Math.min(...prices) : undefined
}

// True when another product of the catalog has the same active ingredient, dose and quantity, is
// bioequivalent, and costs less in stock. The products table has no brand column, so "the product is
// a brand" (docs/contracts.md) is read as "a cheaper bioequivalent of the same medicine exists".
export function cheaperBioequivalentExists(product: ProductRow, data: CatalogData): boolean {
  const own = cheapestInStock(product.id, data)
  return data.products.some((other) => {
    if (other.id === product.id || !other.is_bioequivalent) return false
    if (normalize(other.active_ingredient) !== normalize(product.active_ingredient)) return false
    if (normalize(other.dose) !== normalize(product.dose) || other.quantity !== product.quantity) return false
    const theirs = cheapestInStock(other.id, data)
    return theirs !== undefined && (own === undefined || theirs < own)
  })
}
