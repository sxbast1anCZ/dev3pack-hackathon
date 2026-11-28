// End-to-end check of cards A3 and A5 against the real program on devnet. Not a unit test: it
// sends transactions. Run with: npm run check:devnet
//
// It uses throwaway keys only: a family, an agent and three pharmacy addresses. The family is funded
// by airdrop, or by hand when the RPC faucet refuses (it is closed on devnet). To fund it once and
// run the check again, set CHECK_FAMILY_KEYPAIR to a file path outside the repository: the family
// key is created there on the first run and read back after. Never point it at a real wallet. Quotes are kept in memory instead of
// Supabase, and pharmacy addresses come from this script instead of the pharmacies table. Everything
// else is the code the voice agent calls: the propose_purchase and confirm_purchase handlers, and
// the AnchorChain that signs agent_pay.
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import anchor, { type Idl } from '@anchor-lang/core'
import idl from '../../idl/remedio_seguro.json' with { type: 'json' }
import { setCatalogSource } from '../_lib/catalog.js'
import type { ConfirmPurchaseResponse, PharmacyId, ProposePurchaseResponse } from '../_lib/contract.js'
import { setPharmacyWallets } from '../_lib/pharmacies.js'
import { MemoryQuoteStore, setQuoteStore } from '../_lib/quotes.js'
import { AnchorChain, LAMPORTS_PER_PESO, setChain } from '../_lib/solana.js'
import { POST as confirm } from '../tools/confirm-purchase.js'
import { POST as propose } from '../tools/propose-purchase.js'

const { AnchorProvider, BN, Program, Wallet, web3 } = anchor
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const connection = new web3.Connection(RPC, 'confirmed')
const sha256 = (s: string) => [...createHash('sha256').update(s, 'utf8').digest()]
const explorer = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`

function familyKey(): InstanceType<typeof web3.Keypair> {
  const file = process.env.CHECK_FAMILY_KEYPAIR
  if (!file) return web3.Keypair.generate()
  if (existsSync(file)) return web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, 'utf8')) as number[]))
  const kp = web3.Keypair.generate()
  writeFileSync(file, JSON.stringify([...kp.secretKey]), { mode: 0o600 })
  return kp
}

const family = familyKey()
const agent = web3.Keypair.generate()
const wallets: Record<PharmacyId, string> = {
  cruzverde: web3.Keypair.generate().publicKey.toBase58(),
  ahumada: web3.Keypair.generate().publicKey.toBase58(),
  salcobrand: web3.Keypair.generate().publicKey.toBase58(),
}

async function fundFamily(): Promise<void> {
  if ((await connection.getBalance(family.publicKey)) >= 0.2 * web3.LAMPORTS_PER_SOL) return
  try {
    const sig = await connection.requestAirdrop(family.publicKey, 0.5 * web3.LAMPORTS_PER_SOL)
    await connection.confirmTransaction(sig, 'confirmed')
    return
  } catch (err) {
    console.log(`Airdrop refused (${(err as Error).message.slice(0, 80)}).`)
  }
  console.log(`Send at least 0.2 devnet SOL to ${family.publicKey.toBase58()} . Waiting up to 5 minutes...`)
  for (let i = 0; i < 60; i++) {
    if ((await connection.getBalance(family.publicKey)) >= 0.2 * web3.LAMPORTS_PER_SOL) return
    await new Promise((r) => setTimeout(r, 5000))
  }
  throw new Error('the family address was not funded')
}

async function createPolicy(perPurchaseCap: number): Promise<string> {
  const provider = new AnchorProvider(connection, new Wallet(family), { commitment: 'confirmed' })
  const program = new Program(idl as unknown as Idl, provider)
  const seed = new BN(randomBytes(8), 'le')
  const [policy] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), family.publicKey.toBuffer(), seed.toArrayLike(Buffer, 'le', 8)],
    program.programId,
  )
  const sig = await program.methods
    .createPolicy(
      seed,
      agent.publicKey,
      new BN(perPurchaseCap),
      new BN(40_000),
      new BN(3_600),
      Object.values(wallets).map((w) => new web3.PublicKey(w)),
      [sha256('losartan-50mg-30')],
      new BN(20_000),
    )
    .accountsPartial({ family: family.publicKey, policy, systemProgram: web3.SystemProgram.programId })
    .rpc()
  console.log(`create_policy (cap ${perPurchaseCap} pesos): ${explorer(sig)}`)
  return policy.toBase58()
}

function call(handler: (r: Request) => Promise<Response>, body: unknown): Promise<unknown> {
  const request = new Request('http://localhost/api/tools/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agent-secret': process.env.AGENT_TOOL_SECRET ?? '' },
    body: JSON.stringify(body),
  })
  return handler(request).then((res) => res.json())
}

async function main(): Promise<void> {
  process.env.AGENT_TOOL_SECRET = randomBytes(16).toString('hex')
  setQuoteStore(new MemoryQuoteStore())
  setPharmacyWallets(async (id) => wallets[id])
  setCatalogSource(async () => ({
    products: [
      {
        id: 'losartan-50mg-30',
        name: 'Losartán 50 mg, 30 comprimidos',
        active_ingredient: 'losartan',
        dose: '50 mg',
        quantity: 30,
        requires_prescription: true,
        is_bioequivalent: true,
        aliases: ['losartán'],
      },
    ],
    sources: [],
    prices: [{ product_id: 'losartan-50mg-30', pharmacy: 'salcobrand', price: 2599, in_stock: true, read_at: new Date().toISOString() }],
  }))
  setChain(new AnchorChain(RPC, agent))

  console.log(`program: ${(idl as { address: string }).address}`)
  await fundFamily()
  await anchor.web3.sendAndConfirmTransaction(
    connection,
    new web3.Transaction().add(
      web3.SystemProgram.transfer({ fromPubkey: family.publicKey, toPubkey: agent.publicKey, lamports: 0.01 * web3.LAMPORTS_PER_SOL }),
    ),
    [family],
  )

  // 1. A purchase inside the policy: propose, then confirm. The pharmacy must receive the lamports.
  const policy = await createPolicy(15_000)
  const quote = (await call(propose, { policy, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' })) as ProposePurchaseResponse
  console.log('propose_purchase:', JSON.stringify(quote))
  if (!quote.ok || !quote.within_policy) throw new Error('expected a quote within the policy')
  const before = await connection.getBalance(new web3.PublicKey(wallets.salcobrand))
  const paid = (await call(confirm, { quote_id: quote.quote_id })) as ConfirmPurchaseResponse
  console.log('confirm_purchase:', JSON.stringify(paid))
  if (!paid.ok) throw new Error('expected the payment to go through')
  const received = (await connection.getBalance(new web3.PublicKey(wallets.salcobrand), 'confirmed')) - before
  console.log(`salcobrand received ${received} lamports (expected ${BigInt(quote.price) * LAMPORTS_PER_PESO})`)
  if (BigInt(received) !== BigInt(quote.price) * LAMPORTS_PER_PESO) throw new Error('wrong amount received')
  const again = (await call(confirm, { quote_id: quote.quote_id })) as ConfirmPurchaseResponse
  console.log('confirm_purchase again:', JSON.stringify(again))
  if (again.ok || again.reason !== 'QUOTE_ALREADY_USED') throw new Error('a quote paid twice')

  // 2. A purchase over the cap: propose says so, and the program itself refuses the payment.
  const strict = await createPolicy(2_000)
  const over = (await call(propose, { policy: strict, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' })) as ProposePurchaseResponse
  console.log('propose_purchase over the cap:', JSON.stringify(over))
  if (!over.ok || over.within_policy || over.policy_reason !== 'OverPurchaseCap') throw new Error('expected OverPurchaseCap')
  const refused = (await call(confirm, { quote_id: over.quote_id })) as ConfirmPurchaseResponse
  console.log('confirm_purchase over the cap (sent anyway, the program decides):', JSON.stringify(refused))
  if (refused.ok || refused.reason !== 'OverPurchaseCap') throw new Error('expected the program to refuse with OverPurchaseCap')

  console.log('devnet check passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
