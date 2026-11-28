import { createClient } from '@supabase/supabase-js'
import { config } from '../config'

export interface Catalog {
  productNameByHash: Map<string, string>
  productNameById: Map<string, string>
  pharmacyByWallet: Map<string, { id: string; name: string }>
  pharmacyNameById: Map<string, string>
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
  const productNameById = new Map<string, string>()
  const pharmacyByWallet = new Map<string, { id: string; name: string }>()
  const pharmacyNameById = new Map<string, string>(DEFAULT_PHARMACY_NAMES)

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('Supabase is not configured; using fallback catalog labels.')
    return { productNameByHash, productNameById, pharmacyByWallet, pharmacyNameById }
  }

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey)
    const [productsRes, pharmaciesRes] = await Promise.all([
      supabase.from('products').select('id, name'),
      supabase.from('pharmacies').select('id, name, wallet'),
    ])

    if (productsRes.error) {
      console.warn('Failed to load products from Supabase:', productsRes.error.message)
    } else if (productsRes.data) {
      await Promise.all(
        productsRes.data.map(async (row: { id: string; name: string }) => {
          productNameById.set(row.id, row.name)
          const hash = await sha256Hex(row.id)
          productNameByHash.set(hash, row.name)
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
        if (row.wallet) {
          pharmacyByWallet.set(row.wallet, { id: row.id, name: row.name })
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load catalog from Supabase:', err)
  }

  return { productNameByHash, productNameById, pharmacyByWallet, pharmacyNameById }
}
