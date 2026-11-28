import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProposal, parsePurchase, parseSearch, savingsFor } from './toolResults.ts'

test('parseProposal parses a valid contract proposal', () => {
  const json = JSON.stringify({
    ok: true,
    quote_id: '550e8400-e29b-41d4-a716-446655440000',
    product_id: 'losartan-50mg-30',
    pharmacy: 'salcobrand',
    price: 2599,
    expires_in_seconds: 300,
    within_policy: true,
    policy_reason: null,
  })
  assert.deepEqual(parseProposal(json), {
    ok: true,
    productId: 'losartan-50mg-30',
    pharmacy: 'salcobrand',
    price: 2599,
    withinPolicy: true,
    policyReason: null,
  })
})

test('parseProposal parses a proposal outside the policy', () => {
  const json = JSON.stringify({
    ok: true,
    product_id: 'losartan-50mg-30',
    pharmacy: 'salcobrand',
    price: 25990,
    within_policy: false,
    policy_reason: 'OverPurchaseCap',
  })
  assert.deepEqual(parseProposal(json), {
    ok: true,
    productId: 'losartan-50mg-30',
    pharmacy: 'salcobrand',
    price: 25990,
    withinPolicy: false,
    policyReason: 'OverPurchaseCap',
  })
})

test('parseProposal parses a business refusal', () => {
  assert.deepEqual(parseProposal(JSON.stringify({ ok: false, reason: 'OUT_OF_STOCK' })), {
    ok: false,
    reason: 'OUT_OF_STOCK',
  })
})

test('parseProposal returns null for broken JSON', () => {
  assert.equal(parseProposal('{not valid json'), null)
})

test('parsePurchase parses a valid purchase', () => {
  const json = JSON.stringify({
    ok: true,
    signature: '5abc123',
    explorer_url: 'https://explorer.solana.com/tx/5abc123?cluster=devnet',
    price: 2599,
    pharmacy: 'salcobrand',
  })
  assert.deepEqual(parsePurchase(json), {
    ok: true,
    signature: '5abc123',
    explorerUrl: 'https://explorer.solana.com/tx/5abc123?cluster=devnet',
    price: 2599,
    pharmacy: 'salcobrand',
  })
})

test('parsePurchase rejects an explorer_url outside explorer.solana.com', () => {
  const json = JSON.stringify({
    ok: true,
    signature: '5abc123',
    explorer_url: 'https://evil.example/tx/5abc123',
    price: 2599,
    pharmacy: 'salcobrand',
  })
  assert.equal(parsePurchase(json), null)
})

test('parseSearch parses the contract search_prices response', () => {
  const json = JSON.stringify({
    ok: true,
    product: {
      id: 'losartan-50mg-30',
      name: 'Losartán 50 mg, 30 comprimidos',
      requires_prescription: true,
      is_bioequivalent: true,
    },
    offers: [
      { pharmacy: 'salcobrand', price: 2599, in_stock: true },
      { pharmacy: 'cruzverde', price: 2690, in_stock: true },
      { pharmacy: 'ahumada', price: 1799, in_stock: false },
    ],
  })
  assert.deepEqual(parseSearch(json), {
    productId: 'losartan-50mg-30',
    productName: 'Losartán 50 mg, 30 comprimidos',
    offers: [
      { pharmacy: 'salcobrand', price: 2599, inStock: true },
      { pharmacy: 'cruzverde', price: 2690, inStock: true },
      { pharmacy: 'ahumada', price: 1799, inStock: false },
    ],
  })
  assert.equal(parseSearch(JSON.stringify({ ok: false, reason: 'PRODUCT_NOT_IN_CATALOG' })), null)
  assert.equal(parseSearch('{broken'), null)
})

test('savingsFor computes savings against the next cheapest in-stock pharmacy', () => {
  const search = {
    productId: 'losartan-50mg-30',
    productName: 'Losartán 50 mg, 30 comprimidos',
    offers: [
      { pharmacy: 'salcobrand', price: 2599, inStock: true },
      { pharmacy: 'cruzverde', price: 2690, inStock: true },
      { pharmacy: 'ahumada', price: 1799, inStock: false },
    ],
  }
  const proposal = {
    ok: true as const,
    productId: 'losartan-50mg-30',
    pharmacy: 'salcobrand',
    price: 2599,
    withinPolicy: true,
    policyReason: null,
  }

  assert.deepEqual(savingsFor(search, proposal), { amount: 91, vs: 'cruzverde' })
  assert.equal(
    savingsFor({ ...search, offers: [{ pharmacy: 'salcobrand', price: 2599, inStock: true }] }, proposal),
    null,
  )
  assert.equal(savingsFor(search, { ...proposal, productId: 'other-med' }), null)
  assert.equal(savingsFor(search, { ok: false, reason: 'OUT_OF_STOCK' }), null)
  assert.equal(
    savingsFor(search, { ...proposal, pharmacy: 'cruzverde', price: 2690 }),
    null,
  )
})
