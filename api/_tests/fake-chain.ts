import anchor from '@anchor-lang/core'
import type { PharmacyId } from '../_lib/contract.js'
import { setPharmacyWallets } from '../_lib/pharmacies.js'
import { checkPolicy, LAMPORTS_PER_PESO, productHash, setChain, type Chain, type PayArgs, type PayResult, type PolicyView } from '../_lib/solana.js'

const { web3 } = anchor
const address = () => web3.Keypair.generate().publicKey.toBase58()

export const AGENT = address()
export const POLICY = address()
export const WALLETS: Record<PharmacyId, string> = { cruzverde: address(), ahumada: address(), salcobrand: address() }

export function guestPolicy(overrides: Partial<PolicyView> = {}): PolicyView {
  return {
    agent: AGENT,
    paused: false,
    pharmacies: Object.values(WALLETS),
    products: [Buffer.from(productHash('losartan-50mg-30')).toString('hex')],
    perPurchaseCap: 15_000n,
    periodBudget: 40_000n,
    periodSeconds: 3_600n,
    periodStart: BigInt(Math.floor(Date.now() / 1000)),
    spentInPeriod: 0n,
    vaultLamports: 50_000n * LAMPORTS_PER_PESO + 3_000_000n,
    rentMinimum: 3_000_000n,
    ...overrides,
  }
}

// A chain in memory that applies the same rules as the program, in the same order.
export class FakeChain implements Chain {
  readonly policies = new Map<string, PolicyView>()
  readonly payments: PayArgs[] = []

  agentAddress(): string {
    return AGENT
  }

  async readPolicy(addr: string): Promise<PolicyView | null> {
    return this.policies.get(addr) ?? null
  }

  async pay(args: PayArgs): Promise<PayResult> {
    const policy = this.policies.get(args.policy)
    if (!policy) throw new Error('AccountNotInitialized')
    const error = checkPolicy(policy, {
      agent: AGENT,
      pharmacy: args.pharmacy,
      product: args.product,
      amount: BigInt(args.amount),
      now: BigInt(Math.floor(Date.now() / 1000)),
    })
    if (error) return { ok: false, error }
    policy.spentInPeriod += BigInt(args.amount)
    policy.vaultLamports -= BigInt(args.amount) * LAMPORTS_PER_PESO
    this.payments.push(args)
    return { ok: true, signature: `fake-signature-${this.payments.length}` }
  }
}

export function withFakeChain(policy: PolicyView = guestPolicy()): FakeChain {
  const fake = new FakeChain()
  fake.policies.set(POLICY, policy)
  setChain(fake)
  setPharmacyWallets(async (id) => WALLETS[id])
  return fake
}
