import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SearchPricesResponse } from '../_lib/contract.js'
import { POST } from '../tools/search-prices.js'
import { toolRequest, withSecret } from './helpers.js'

test('a medicine in the catalog returns its offers, sorted by price', () =>
  withSecret(async () => {
    const res = await POST(toolRequest({ policy: 'PolicyAddress111', query: 'Necesito mi Losartán de 50' }))
    assert.equal(res.status, 200)
    const out = (await res.json()) as SearchPricesResponse
    assert.ok(out.ok)
    assert.equal(out.product.id, 'losartan-50mg-30')
    const prices = out.offers.map((o) => o.price)
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b))
    assert.equal(out.offers.length, 3)
  }))

test('a medicine outside the catalog is a business refusal, not an HTTP error', () =>
  withSecret(async () => {
    const res = await POST(toolRequest({ policy: 'PolicyAddress111', query: 'paracetamol' }))
    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), { ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' })
  }))
