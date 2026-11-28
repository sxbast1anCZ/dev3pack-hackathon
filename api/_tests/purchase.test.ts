import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { ConfirmPurchaseResponse, ProposePurchaseResponse } from '../_lib/contract.js'
import { POST as confirm } from '../tools/confirm-purchase.js'
import { POST as propose } from '../tools/propose-purchase.js'
import { productHash } from '../_lib/solana.js'
import { guestPolicy, POLICY, WALLETS, withFakeChain } from './fake-chain.js'
import { toolRequest, withMemoryQuotes, withSecret } from './helpers.js'

const policy = POLICY

beforeEach(() => {
  withMemoryQuotes()
  withFakeChain()
})

test('propose returns a quote for a product in stock', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
    assert.equal(res.status, 200)
    const out = (await res.json()) as ProposePurchaseResponse
    assert.ok(out.ok)
    assert.equal(out.price, 2599)
    assert.equal(out.expires_in_seconds, 300)
    assert.equal(out.within_policy, true)
    assert.equal(out.policy_reason, null)
    assert.match(out.quote_id, /^[0-9a-f-]{36}$/)
  }))

test('propose refuses a product out of stock', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'ahumada' }))
    assert.deepEqual(await res.json(), { ok: false, reason: 'OUT_OF_STOCK' })
  }))

test('propose refuses a product outside the catalog', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy, product_id: 'paracetamol-500mg-16', pharmacy: 'salcobrand' }))
    assert.deepEqual(await res.json(), { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' })
  }))

test('propose rejects an unknown pharmacy as a malformed body', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'farmacia-x' }))
    assert.equal(res.status, 400)
  }))

test('confirm of a fresh quote pays and returns the signature and explorer link', () =>
  withSecret(async () => {
    const quote = (await (
      await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'cruzverde' }))
    ).json()) as ProposePurchaseResponse
    assert.ok(quote.ok)
    const res = await confirm(toolRequest({ quote_id: quote.quote_id }))
    const out = (await res.json()) as ConfirmPurchaseResponse
    assert.ok(out.ok)
    assert.equal(out.signature, 'fake-signature-1')
    assert.equal(out.explorer_url, 'https://explorer.solana.com/tx/fake-signature-1?cluster=devnet')
    assert.equal(out.price, 2690)
    assert.equal(out.pharmacy, 'cruzverde')
  }))

test('confirm refuses a quote id that is not a uuid', () =>
  withSecret(async () => {
    const res = await confirm(toolRequest({ quote_id: 'abc' }))
    assert.deepEqual(await res.json(), { ok: false, reason: 'QUOTE_NOT_FOUND' })
  }))

test('both tools refuse a call without the secret', () =>
  withSecret(async () => {
    assert.equal((await propose(toolRequest({}, null))).status, 401)
    assert.equal((await confirm(toolRequest({}, null))).status, 401)
  }))

test('propose says when a purchase is outside the policy, with the program error name', () =>
  withSecret(async () => {
    withFakeChain(guestPolicy({ perPurchaseCap: 2_000n }))
    const out = (await (
      await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
    ).json()) as ProposePurchaseResponse
    assert.ok(out.ok)
    assert.equal(out.within_policy, false)
    assert.equal(out.policy_reason, 'OverPurchaseCap')
  }))

test('confirm returns the program refusal when the payment breaks a rule, and sends nothing', () =>
  withSecret(async () => {
    const fake = withFakeChain()
    const quote = (await (
      await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
    ).json()) as ProposePurchaseResponse
    assert.ok(quote.ok)
    fake.policies.get(POLICY)!.paused = true
    const out = (await (await confirm(toolRequest({ quote_id: quote.quote_id }))).json()) as ConfirmPurchaseResponse
    assert.deepEqual(out, { ok: false, reason: 'Paused' })
    assert.equal(fake.payments.length, 0)
  }))

test('confirm pays the quoted price to the quoted pharmacy, with the hashes of the contract', () =>
  withSecret(async () => {
    const fake = withFakeChain()
    const quote = (await (
      await propose(toolRequest({ policy, product_id: 'losartan-50mg-30', pharmacy: 'cruzverde' }))
    ).json()) as ProposePurchaseResponse
    assert.ok(quote.ok)
    await confirm(toolRequest({ quote_id: quote.quote_id }))
    assert.equal(fake.payments.length, 1)
    const paid = fake.payments[0]
    assert.equal(paid.policy, POLICY)
    assert.equal(paid.pharmacy, WALLETS.cruzverde)
    assert.equal(paid.amount, 2690)
    assert.deepEqual(paid.product, productHash('losartan-50mg-30'))
  }))

test('propose refuses a policy that is not a base58 address', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy: 'not-an-address', product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
    assert.equal(res.status, 400)
  }))
