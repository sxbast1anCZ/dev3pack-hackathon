import type { PharmacyId } from './contract.js'
import { serverDb } from './db.js'

// The devnet address each pharmacy chain is paid at: column wallet of the pharmacies table.
export type PharmacyWallets = (id: PharmacyId) => Promise<string>

async function fromTable(id: PharmacyId): Promise<string> {
  const { data, error } = await serverDb().from('pharmacies').select('wallet').eq('id', id).maybeSingle()
  if (error) throw new Error(`pharmacies read failed: ${error.message}`)
  if (!data?.wallet) throw new Error(`pharmacy ${id} has no wallet in the pharmacies table`)
  return data.wallet as string
}

export let pharmacyWallet: PharmacyWallets = fromTable

// Tests replace the lookup through this.
export function setPharmacyWallets(next: PharmacyWallets | undefined): void {
  pharmacyWallet = next ?? fromTable
}
