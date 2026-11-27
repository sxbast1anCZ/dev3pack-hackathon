import { createHash } from 'node:crypto'
import anchor, { type Idl } from '@anchor-lang/core'
import idl from '../../idl/remedio_seguro.json' with { type: 'json' }
import type { ProgramError } from './contract.js'
import { requireEnv } from './env.js'

const { AnchorError, AnchorProvider, BN, Program, Wallet, web3 } = anchor

// Program remedio_seguro (docs/contracts.md, section 1), read and called with its committed IDL.

export const LAMPORTS_PER_PESO = 1_000n

export const PROGRAM_ERRORS: readonly ProgramError[] = [
  'Paused',
  'UnauthorizedAgent',
  'PharmacyNotAllowed',
  'ProductNotAllowed',
  'ZeroAmount',
  'OverPurchaseCap',
  'OverPeriodBudget',
  'InsufficientVault',
]

function sha256(text: string): number[] {
  return [...createHash('sha256').update(text, 'utf8').digest()]
}

// Contract, "Product hash": sha256 of the product id as UTF-8.
export function productHash(productId: string): number[] {
  return sha256(productId)
}

// Contract, "Quote hash": sha256 of "<quote_id>|<product_id>|<pharmacy>|<price>|<read_at ISO 8601 UTC>".
// read_at is normalized, so "2026-11-28 11:50:00+00" and "2026-11-28T11:50:00.000Z" hash the same.
export function quoteHash(q: { id: string; product_id: string; pharmacy: string; price: number; read_at: string }): number[] {
  return sha256(`${q.id}|${q.product_id}|${q.pharmacy}|${q.price}|${new Date(q.read_at).toISOString()}`)
}

export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`
}

export function isPublicKey(value: string): boolean {
  try {
    new web3.PublicKey(value)
    return true
  } catch {
    return false
  }
}

// AGENT_KEYPAIR holds the agent's secret key: the JSON array of solana-keygen, or base58.
export function parseKeypair(secret: string): InstanceType<typeof web3.Keypair> {
  const text = secret.trim()
  const bytes = text.startsWith('[')
    ? Uint8Array.from(JSON.parse(text) as number[])
    : anchor.utils.bytes.bs58.decode(text)
  if (bytes.length !== 64) throw new Error('AGENT_KEYPAIR must be a 64-byte secret key')
  return web3.Keypair.fromSecretKey(bytes)
}

// The fields of the Policy account that decide a payment, plus the vault balance and its rent minimum.
export interface PolicyView {
  agent: string
  paused: boolean
  pharmacies: string[]
  products: string[]
  perPurchaseCap: bigint
  periodBudget: bigint
  periodSeconds: bigint
  periodStart: bigint
  spentInPeriod: bigint
  vaultLamports: bigint
  rentMinimum: bigint
}

export interface PayCheck {
  agent: string
  pharmacy: string
  product: number[]
  amount: bigint
  now: bigint
}

const hex = (bytes: number[]) => Buffer.from(bytes).toString('hex')

// The rules of agent_pay, in the program's order (docs/contracts.md, "Rules of agent_pay").
// Used to answer within_policy before anything is sent. The program stays the judge.
export function checkPolicy(p: PolicyView, c: PayCheck): ProgramError | null {
  if (p.paused) return 'Paused'
  if (c.agent !== p.agent) return 'UnauthorizedAgent'
  if (!p.pharmacies.includes(c.pharmacy)) return 'PharmacyNotAllowed'
  if (!p.products.includes(hex(c.product))) return 'ProductNotAllowed'
  if (c.amount <= 0n) return 'ZeroAmount'
  if (c.amount > p.perPurchaseCap) return 'OverPurchaseCap'
  const spent = c.now >= p.periodStart + p.periodSeconds ? 0n : p.spentInPeriod
  if (spent + c.amount > p.periodBudget) return 'OverPeriodBudget'
  if (p.vaultLamports < c.amount * LAMPORTS_PER_PESO + p.rentMinimum) return 'InsufficientVault'
  return null
}

export interface PayArgs {
  policy: string
  pharmacy: string
  amount: number
  product: number[]
  quoteHash: number[]
}

export type PayResult = { ok: true; signature: string } | { ok: false; error: ProgramError }

export interface Chain {
  agentAddress(): string
  readPolicy(address: string): Promise<PolicyView | null>
  pay(args: PayArgs): Promise<PayResult>
}

const DEFAULT_KEY = web3.PublicKey.default.toBase58()
const ZERO_HASH = '00'.repeat(32)

interface DecodedPolicy {
  agent: { toBase58(): string }
  paused: boolean
  pharmacies: { toBase58(): string }[]
  products: number[][]
  perPurchaseCap: { toString(): string }
  periodBudget: { toString(): string }
  periodSeconds: { toString(): string }
  periodStart: { toString(): string }
  spentInPeriod: { toString(): string }
}

export function toPolicyView(d: DecodedPolicy, vaultLamports: number, rentMinimum: number): PolicyView {
  return {
    agent: d.agent.toBase58(),
    paused: d.paused,
    pharmacies: d.pharmacies.map((k) => k.toBase58()).filter((k) => k !== DEFAULT_KEY),
    products: d.products.map(hex).filter((h) => h !== ZERO_HASH),
    perPurchaseCap: BigInt(d.perPurchaseCap.toString()),
    periodBudget: BigInt(d.periodBudget.toString()),
    periodSeconds: BigInt(d.periodSeconds.toString()),
    periodStart: BigInt(d.periodStart.toString()),
    spentInPeriod: BigInt(d.spentInPeriod.toString()),
    vaultLamports: BigInt(vaultLamports),
    rentMinimum: BigInt(rentMinimum),
  }
}

// The program, on devnet, signed by the agent key.
export class AnchorChain implements Chain {
  private readonly program: InstanceType<typeof Program>
  private readonly agent: InstanceType<typeof web3.Keypair>

  constructor(rpcUrl: string, agent: InstanceType<typeof web3.Keypair>) {
    this.agent = agent
    const connection = new web3.Connection(rpcUrl, 'confirmed')
    const provider = new AnchorProvider(connection, new Wallet(agent), { commitment: 'confirmed' })
    this.program = new Program(idl as unknown as Idl, provider)
  }

  agentAddress(): string {
    return this.agent.publicKey.toBase58()
  }

  async readPolicy(address: string): Promise<PolicyView | null> {
    const connection = this.program.provider.connection
    const info = await connection.getAccountInfo(new web3.PublicKey(address), 'confirmed')
    if (!info || !info.owner.equals(this.program.programId)) return null
    const decoded = this.program.coder.accounts.decode<DecodedPolicy>('policy', info.data)
    const rent = await connection.getMinimumBalanceForRentExemption(info.data.length)
    return toPolicyView(decoded, info.lamports, rent)
  }

  payInstruction(args: PayArgs) {
    return this.program.methods
      .agentPay(new BN(args.amount), args.product, args.quoteHash)
      .accountsPartial({
        agent: this.agent.publicKey,
        policy: new web3.PublicKey(args.policy),
        pharmacy: new web3.PublicKey(args.pharmacy),
      })
  }

  async pay(args: PayArgs): Promise<PayResult> {
    try {
      const signature = await this.payInstruction(args).rpc({ commitment: 'confirmed' })
      return { ok: true, signature }
    } catch (err) {
      const logs = (err as { logs?: string[] }).logs
      const parsed = err instanceof AnchorError ? err : logs ? AnchorError.parse(logs) : null
      const code = parsed?.error.errorCode.code
      if (code && (PROGRAM_ERRORS as readonly string[]).includes(code)) return { ok: false, error: code as ProgramError }
      throw err
    }
  }
}

let current: Chain | undefined

// The chain the tools use. Created on first use: a deployment without SOLANA_RPC_URL or
// AGENT_KEYPAIR fails on the first call (500).
export function chain(): Chain {
  if (!current) current = new AnchorChain(requireEnv('SOLANA_RPC_URL'), parseKeypair(requireEnv('AGENT_KEYPAIR')))
  return current
}

export function setChain(next: Chain | undefined): void {
  current = next
}
