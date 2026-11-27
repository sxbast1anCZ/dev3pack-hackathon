import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import type { SearchPricesResponse } from '../_lib/contract.js'
import { setClock } from '../_lib/quotes.js'
import { POST } from '../tools/search-prices.js'
import { guestPolicy, POLICY, withFakeChain } from './fake-chain.js'
import { toolRequest, withSecret } from './helpers.js'

beforeEach(() => {
  withFakeChain()
  setClock(() => new Date('2026-11-28T12:00:00.000Z'))
})

afterEach(() => setClock(() => new Date()))

async function search(query: string): Promise<SearchPricesResponse> {
  const res = await POST(toolRequest({ policy: POLICY, query }))
  assert.equal(res.status, 200)
  return (await res.json()) as SearchPricesResponse
}

test('a spoken request finds its product by alias, with offers sorted by price and their age', () =>
  withSecret(async () => {
    const out = await search('Necesito mi Losartán de 50')
    assert.ok(out.ok)
    assert.equal(out.product.id, 'losartan-50mg-30')
    assert.deepEqual(
      out.offers.map((o) => [o.pharmacy, o.price, o.in_stock, o.read_minutes_ago]),
      [
        ['ahumada', 1799, false, 12],
        ['salcobrand', 2599, true, 10],
        ['cruzverde', 2690, true, 10],
      ],
    )
    assert.equal(out.offers[1].url, 'https://salcobrand.cl/products/losartan')
    assert.equal(out.allowed_by_policy, true)
    assert.equal(out.bioequivalent_available, false)
  }))

test('a brand finds itself, not the generic, and says a cheaper bioequivalent exists', () =>
  withSecret(async () => {
    const out = await search('quiero el corodín de 50')
    assert.ok(out.ok)
    assert.equal(out.product.id, 'corodin-50mg-30')
    assert.equal(out.bioequivalent_available, true)
  }))

test('a product in the catalog but not in the policy is found and marked not allowed', () =>
  withSecret(async () => {
    const out = await search('amlodipino')
    assert.ok(out.ok)
    assert.equal(out.allowed_by_policy, false)
  }))

test('a policy address with no account is not allowed anything', () =>
  withSecret(async () => {
    withFakeChain(guestPolicy())
    const res = await POST(toolRequest({ policy: '11111111111111111111111111111112', query: 'losartán' }))
    const out = (await res.json()) as SearchPricesResponse
    assert.ok(out.ok)
    assert.equal(out.allowed_by_policy, false)
  }))

test('a medicine outside the catalog is a business refusal, not an HTTP error', () =>
  withSecret(async () => {
    assert.deepEqual(await search('ibuprofeno'), { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' })
  }))

test('a policy that is not a base58 address is a malformed body', () =>
  withSecret(async () => {
    const res = await POST(toolRequest({ policy: 'PolicyAddress111!', query: 'losartán' }))
    assert.equal(res.status, 400)
  }))

test('without Supabase settings, search fails with 500 instead of answering from nothing', () =>
  withSecret(async () => {
    const { setCatalogSource } = await import('../_lib/catalog.js')
    setCatalogSource(undefined)
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY }
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const original = console.error
    console.error = () => {}
    try {
      const res = await POST(toolRequest({ policy: POLICY, query: 'losartán' }))
      assert.equal(res.status, 500)
    } finally {
      console.error = original
      if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url
      if (saved.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key
    }
  }))
