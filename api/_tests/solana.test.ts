import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import anchor from '@anchor-lang/core'
import idl from '../../idl/remedio_seguro.json' with { type: 'json' }
import {
  AnchorChain,
  checkPolicy,
  explorerTxUrl,
  LAMPORTS_PER_PESO,
  parseKeypair,
  productHash,
  quoteHash,
  toPolicyView,
  type PayCheck,
} from '../_lib/solana.js'
import { AGENT, guestPolicy, WALLETS } from './fake-chain.js'

const { BN, web3 } = anchor
const now = BigInt(Math.floor(Date.now() / 1000))
const ok: PayCheck = { agent: AGENT, pharmacy: WALLETS.salcobrand, product: productHash('losartan-50mg-30'), amount: 2_599n, now }

test('a payment inside every rule passes', () => {
  assert.equal(checkPolicy(guestPolicy(), ok), null)
})

test('each rule refuses with the program error name', () => {
  const cases: [string, ReturnType<typeof checkPolicy>, ReturnType<typeof guestPolicy>, PayCheck][] = [
    ['paused', 'Paused', guestPolicy({ paused: true }), ok],
    ['another signer', 'UnauthorizedAgent', guestPolicy(), { ...ok, agent: WALLETS.ahumada }],
    ['pharmacy outside the list', 'PharmacyNotAllowed', guestPolicy({ pharmacies: [WALLETS.cruzverde] }), ok],
    ['product outside the list', 'ProductNotAllowed', guestPolicy(), { ...ok, product: productHash('paracetamol-500mg-16') }],
    ['zero amount', 'ZeroAmount', guestPolicy(), { ...ok, amount: 0n }],
    ['over the cap', 'OverPurchaseCap', guestPolicy(), { ...ok, amount: 15_001n }],
    ['over the period budget', 'OverPeriodBudget', guestPolicy({ spentInPeriod: 39_000n }), ok],
    ['vault without funds', 'InsufficientVault', guestPolicy({ vaultLamports: 2_598n * LAMPORTS_PER_PESO + 3_000_000n }), ok],
  ]
  for (const [label, expected, policy, check] of cases) assert.equal(checkPolicy(policy, check), expected, label)
})

test('rules are checked in the program order: paused wins over everything else', () => {
  const policy = guestPolicy({ paused: true, pharmacies: [], products: [] })
  assert.equal(checkPolicy(policy, { ...ok, agent: WALLETS.cruzverde, amount: 0n }), 'Paused')
})

test('a finished period starts again: the budget spent before no longer counts', () => {
  const policy = guestPolicy({ spentInPeriod: 39_000n, periodStart: now - 3_600n })
  assert.equal(checkPolicy(policy, ok), null)
})

test('the paid amount must leave the rent-exempt minimum in the vault', () => {
  const exact = guestPolicy({ vaultLamports: 2_599n * LAMPORTS_PER_PESO + 3_000_000n })
  assert.equal(checkPolicy(exact, ok), null)
})

test('product hash is sha256 of the product id, as in the program smoke test', () => {
  const expected = [...createHash('sha256').update('losartan-50mg-30', 'utf8').digest()]
  assert.deepEqual(productHash('losartan-50mg-30'), expected)
})

test('quote hash follows the contract and does not depend on how read_at is written', () => {
  const base = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', product_id: 'losartan-50mg-30', pharmacy: 'salcobrand', price: 2599 }
  const text = '7c9e6679-7425-40de-944b-e07fc1f90ae7|losartan-50mg-30|salcobrand|2599|2026-11-28T11:50:00.000Z'
  const expected = [...createHash('sha256').update(text, 'utf8').digest()]
  assert.deepEqual(quoteHash({ ...base, read_at: '2026-11-28T11:50:00.000Z' }), expected)
  assert.deepEqual(quoteHash({ ...base, read_at: '2026-11-28T11:50:00+00:00' }), expected)
})

test('AGENT_KEYPAIR is read from the solana-keygen JSON array or from base58', () => {
  const kp = web3.Keypair.generate()
  assert.equal(parseKeypair(JSON.stringify([...kp.secretKey])).publicKey.toBase58(), kp.publicKey.toBase58())
  assert.equal(parseKeypair(anchor.utils.bytes.bs58.encode(kp.secretKey)).publicKey.toBase58(), kp.publicKey.toBase58())
  assert.throws(() => parseKeypair('[1,2,3]'))
})

test('an empty slot of the policy is not an allowed pharmacy or product', () => {
  const key = web3.Keypair.generate().publicKey
  const view = toPolicyView(
    {
      agent: key,
      paused: false,
      pharmacies: [key, web3.PublicKey.default, web3.PublicKey.default],
      products: [productHash('losartan-50mg-30'), new Array(32).fill(0)],
      perPurchaseCap: new BN(15_000),
      periodBudget: new BN(40_000),
      periodSeconds: new BN(60),
      periodStart: new BN(1),
      spentInPeriod: new BN(0),
    },
    10,
    5,
  )
  assert.deepEqual(view.pharmacies, [key.toBase58()])
  assert.equal(view.products.length, 1)
  assert.equal(view.perPurchaseCap, 15_000n)
})

test('agent_pay is built from the IDL: program id, signer, writable accounts and data', async () => {
  const agent = web3.Keypair.generate()
  const chain = new AnchorChain('http://127.0.0.1:1', agent)
  const policy = web3.Keypair.generate().publicKey.toBase58()
  const ix = await chain
    .payInstruction({ policy, pharmacy: WALLETS.salcobrand, amount: 2599, product: productHash('losartan-50mg-30'), quoteHash: new Array(32).fill(7) })
    .instruction()
  assert.equal(ix.programId.toBase58(), idl.address)
  assert.deepEqual(
    ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    [
      [agent.publicKey.toBase58(), true, true],
      [policy, false, true],
      [WALLETS.salcobrand, false, true],
    ],
  )
  const discriminator = idl.instructions.find((i) => i.name === 'agent_pay')?.discriminator
  assert.deepEqual([...ix.data.subarray(0, 8)], discriminator)
  assert.equal(ix.data.readBigUInt64LE(8), 2599n)
  assert.equal(ix.data.length, 8 + 8 + 32 + 32)
})

test('the explorer link points to the transaction on devnet', () => {
  assert.equal(explorerTxUrl('abc'), 'https://explorer.solana.com/tx/abc?cluster=devnet')
})
