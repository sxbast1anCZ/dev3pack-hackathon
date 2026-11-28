import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import type { ConfirmPurchaseResponse, ProposePurchaseResponse } from '../_lib/contract.js'
import { setClock, type MemoryQuoteStore } from '../_lib/quotes.js'
import { POST as confirm } from '../tools/confirm-purchase.js'
import { POST as propose } from '../tools/propose-purchase.js'
import { POLICY, withFakeChain } from './fake-chain.js'
import { toolRequest, withMemoryQuotes, withSecret } from './helpers.js'

let store: MemoryQuoteStore
let clock = new Date('2026-11-28T12:00:00.000Z')

beforeEach(() => {
  store = withMemoryQuotes()
  withFakeChain()
  clock = new Date('2026-11-28T12:00:00.000Z')
  setClock(() => clock)
})

afterEach(() => setClock(() => new Date()))

async function newQuote(): Promise<string> {
  const res = await propose(toolRequest({ policy: POLICY, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
  const out = (await res.json()) as ProposePurchaseResponse
  assert.ok(out.ok)
  return out.quote_id
}

async function confirmQuote(id: string): Promise<ConfirmPurchaseResponse> {
  return (await (await confirm(toolRequest({ quote_id: id }))).json()) as ConfirmPurchaseResponse
}

test('propose stores the quote with its price, read time and a 5 minute expiry', () =>
  withSecret(async () => {
    const id = await newQuote()
    const row = store.rows.get(id)
    assert.ok(row)
    assert.equal(row.price, 2599)
    assert.equal(row.pharmacy, 'salcobrand')
    assert.equal(row.read_at, '2026-11-28T11:50:00.000Z') // the read time of the price row
    assert.equal(row.expires_at, '2026-11-28T12:05:00.000Z')
    assert.equal(row.used_at, null)
  }))

test('a quote that does not exist is refused', () =>
  withSecret(async () => {
    assert.deepEqual(await confirmQuote('7c9e6679-7425-40de-944b-e07fc1f90ae7'), { ok: false, reason: 'QUOTE_NOT_FOUND' })
  }))

test('an expired quote is refused and stays unused', () =>
  withSecret(async () => {
    const id = await newQuote()
    clock = new Date('2026-11-28T12:05:00.000Z')
    assert.deepEqual(await confirmQuote(id), { ok: false, reason: 'QUOTE_EXPIRED' })
    assert.equal(store.rows.get(id)?.used_at, null)
  }))

test('a quote cannot be confirmed twice', () =>
  withSecret(async () => {
    const id = await newQuote()
    const first = await confirmQuote(id)
    assert.ok(first.ok)
    assert.deepEqual(await confirmQuote(id), { ok: false, reason: 'QUOTE_ALREADY_USED' })
  }))

test('two confirmations at the same time: exactly one succeeds', () =>
  withSecret(async () => {
    const id = await newQuote()
    const results = await Promise.all([confirmQuote(id), confirmQuote(id), confirmQuote(id)])
    assert.equal(results.filter((r) => r.ok).length, 1)
  }))

test('the quote is marked used before the result comes back', () =>
  withSecret(async () => {
    const id = await newQuote()
    await confirmQuote(id)
    assert.equal(store.rows.get(id)?.used_at, '2026-11-28T12:00:00.000Z')
  }))

test('without Supabase settings, propose fails with 500 instead of keeping quotes nowhere', () =>
  withSecret(async () => {
    const { setQuoteStore } = await import('../_lib/quotes.js')
    setQuoteStore(undefined)
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const original = console.error
    console.error = () => {}
    try {
      const res = await propose(toolRequest({ policy: POLICY, product_id: 'losartan-50mg-30', pharmacy: 'salcobrand' }))
      assert.equal(res.status, 500)
    } finally {
      console.error = original
      if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url
      if (saved.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key
    }
  }))

test('propose answers PRICE_UNAVAILABLE for a chain without a reading of that product', () =>
  withSecret(async () => {
    const res = await propose(toolRequest({ policy: POLICY, product_id: 'amlodipino-5mg-30', pharmacy: 'salcobrand' }))
    assert.deepEqual(await res.json(), { ok: false, reason: 'PRICE_UNAVAILABLE' })
  }))
