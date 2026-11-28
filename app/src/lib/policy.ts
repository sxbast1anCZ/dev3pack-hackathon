import { AnchorProvider, Program, web3, type Idl } from '@anchor-lang/core'
import idl from '../../../idl/remedio_seguro.json'
import { config } from '../config'
import type { PurchaseRow } from './policyMath'

const LAMPORTS_PER_PESO = 1000
const DEFAULT_PUBKEY = web3.PublicKey.default.toBase58()
const EMPTY_HASH = '0'.repeat(64)

if (import.meta.env.VITE_PROGRAM_ID && import.meta.env.VITE_PROGRAM_ID !== idl.address) {
  console.warn(
    `VITE_PROGRAM_ID (${import.meta.env.VITE_PROGRAM_ID}) differs from IDL address (${idl.address}); using IDL address.`,
  )
}

export const connection = new web3.Connection(config.rpcUrl, 'confirmed')

// Read-only: a wallet that cannot sign. W4 builds its own provider with Phantom.
const readOnlyWallet = {
  publicKey: web3.PublicKey.default,
  signTransaction: async () => {
    throw new Error('read-only')
  },
  signAllTransactions: async () => {
    throw new Error('read-only')
  },
}

export const readProgram = new Program(
  idl as Idl,
  new AnchorProvider(connection, readOnlyWallet as never, { commitment: 'confirmed' }),
)

export interface PolicySummary {
  address: string
  family: string
  agent: string
  paused: boolean
  perPurchaseCap: number
  periodBudget: number
  periodSeconds: number
  periodStart: number
  spentInPeriod: number
  pharmacies: string[]
  productHashes: string[]
  allPharmacySlots: string[]
  allProductSlots: string[]
  history: PurchaseRow[]
  purchaseCount: number
  vaultLamports: number
  availablePesos: number
}

interface RawPurchase {
  amount: { toNumber(): number }
  pharmacyIndex: number
  productIndex: number
  timestamp: { toNumber(): number }
}

interface RawPolicyAccount {
  family: web3.PublicKey
  agent: web3.PublicKey
  paused: boolean
  perPurchaseCap: { toNumber(): number }
  periodBudget: { toNumber(): number }
  periodSeconds: { toNumber(): number }
  periodStart: { toNumber(): number }
  spentInPeriod: { toNumber(): number }
  pharmacies: web3.PublicKey[]
  products: number[][]
  history: RawPurchase[]
  purchaseCount: number
}

function bytesToHex(bytes: number[]): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function readPolicy(address: string): Promise<PolicySummary | null> {
  const pubkey = new web3.PublicKey(address)
  const info = await connection.getAccountInfo(pubkey)
  if (!info || !info.owner.equals(readProgram.programId)) return null

  // The IDL has no generated account types, so this single cast is required.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const account = (await (readProgram.account as any).policy.fetchNullable(
    pubkey,
  )) as RawPolicyAccount | null
  if (!account) return null

  const vaultLamports = info.lamports
  const rentMinimum = await connection.getMinimumBalanceForRentExemption(info.data.length)
  const availablePesos = Math.floor(Math.max(0, vaultLamports - rentMinimum) / LAMPORTS_PER_PESO)

  const allPharmacySlots = account.pharmacies.map((p) => p.toBase58())
  const allProductSlots = account.products.map((bytes) => bytesToHex(bytes))

  return {
    address: pubkey.toBase58(),
    family: account.family.toBase58(),
    agent: account.agent.toBase58(),
    paused: account.paused,
    perPurchaseCap: account.perPurchaseCap.toNumber(),
    periodBudget: account.periodBudget.toNumber(),
    periodSeconds: account.periodSeconds.toNumber(),
    periodStart: account.periodStart.toNumber(),
    spentInPeriod: account.spentInPeriod.toNumber(),
    pharmacies: allPharmacySlots.filter((addr) => addr !== DEFAULT_PUBKEY),
    productHashes: allProductSlots.filter((hash) => hash !== EMPTY_HASH),
    allPharmacySlots,
    allProductSlots,
    history: account.history.map((row) => ({
      amount: row.amount.toNumber(),
      pharmacyIndex: row.pharmacyIndex,
      productIndex: row.productIndex,
      timestamp: row.timestamp.toNumber(),
    })),
    purchaseCount: account.purchaseCount,
    vaultLamports,
    availablePesos,
  }
}
