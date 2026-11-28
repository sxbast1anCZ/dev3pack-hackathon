import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

export interface CatalogProduct {
  id: string
  name: string
  activeIngredient: string
  isBioequivalent: boolean
}

export interface CatalogPharmacy {
  id: string
  name: string
  wallet: string | null
}

export interface CatalogPrice {
  productId: string
  pharmacy: string
  price: number
  inStock: boolean
}

export interface Catalog {
  productNameByHash: Map<string, string>
  productIdByHash: Map<string, string>
  productNameById: Map<string, string>
  pharmacyByWallet: Map<string, { id: string; name: string }>
  pharmacyNameById: Map<string, string>
  products: CatalogProduct[]
  pharmacies: CatalogPharmacy[]
  prices: CatalogPrice[]
}

const DEFAULT_PHARMACY_NAMES: Array<[string, string]> = [
  ['cruzverde', 'Cruz Verde'],
  ['ahumada', 'Ahumada'],
  ['salcobrand', 'Salcobrand'],
]

export async function sha256Bytes(text: string): Promise<number[]> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = await sha256Bytes(text)
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function loadCatalog(): Promise<Catalog> {
  const productNameByHash = new Map<string, string>()
  const productIdByHash = new Map<string, string>()
  const productNameById = new Map<string, string>()
  const pharmacyByWallet = new Map<string, { id: string; name: string }>()
  const pharmacyNameById = new Map<string, string>(DEFAULT_PHARMACY_NAMES)
  const products: CatalogProduct[] = []
  const pharmacies: CatalogPharmacy[] = []
  const prices: CatalogPrice[] = []

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('Supabase is not configured; using fallback catalog labels.')
    return {
      productNameByHash,
      productIdByHash,
      productNameById,
      pharmacyByWallet,
      pharmacyNameById,
      products,
      pharmacies,
      prices,
    }
  }

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
    const [productsRes, pharmaciesRes, pricesRes] = await Promise.all([
      supabase.from('products').select('id, name, active_ingredient, is_bioequivalent'),
      supabase.from('pharmacies').select('id, name, wallet'),
      supabase.from('prices').select('product_id, pharmacy, price, in_stock'),
    ])

    if (productsRes.error) {
      console.warn('Failed to load products from Supabase:', productsRes.error.message)
    } else if (productsRes.data) {
      await Promise.all(
        (
          productsRes.data as Array<{
            id: string
            name: string
            active_ingredient: string | null
            is_bioequivalent: boolean | null
          }>
        ).map(async (row) => {
          productNameById.set(row.id, row.name)
          const hash = await sha256Hex(row.id)
          productNameByHash.set(hash, row.name)
          productIdByHash.set(hash, row.id)
          products.push({
            id: row.id,
            name: row.name,
            activeIngredient: row.active_ingredient ?? '',
            isBioequivalent: Boolean(row.is_bioequivalent),
          })
        }),
      )
    }

    if (pharmaciesRes.error) {
      console.warn('Failed to load pharmacies from Supabase:', pharmaciesRes.error.message)
    } else if (pharmaciesRes.data) {
      for (const row of pharmaciesRes.data as Array<{
        id: string
        name: string
        wallet: string | null
      }>) {
        pharmacyNameById.set(row.id, row.name)
        pharmacies.push({ id: row.id, name: row.name, wallet: row.wallet })
        if (row.wallet) {
          pharmacyByWallet.set(row.wallet, { id: row.id, name: row.name })
        }
      }
    }

    if (pricesRes.error) {
      console.warn('Failed to load prices from Supabase:', pricesRes.error.message)
    } else if (pricesRes.data) {
      for (const row of pricesRes.data as Array<{
        product_id: string
        pharmacy: string
        price: number
        in_stock: boolean
      }>) {
        prices.push({
          productId: row.product_id,
          pharmacy: row.pharmacy,
          price: row.price,
          inStock: Boolean(row.in_stock),
        })
      }
    }
  } catch (err) {
    console.warn('Failed to load catalog from Supabase:', err)
  }

  return {
    productNameByHash,
    productIdByHash,
    productNameById,
    pharmacyByWallet,
    pharmacyNameById,
    products,
    pharmacies,
    prices,
  }
}
