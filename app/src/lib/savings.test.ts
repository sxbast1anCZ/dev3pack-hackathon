import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateSavings } from './savings.ts'

const SAMPLE_PRICES = [
  { productId: 'losartan-50mg-30', pharmacy: 'salcobrand', price: 2599, inStock: true },
  { productId: 'losartan-50mg-30', pharmacy: 'cruzverde', price: 2690, inStock: true },
  { productId: 'losartan-50mg-30', pharmacy: 'ahumada', price: 1799, inStock: false },
  { productId: 'atorvastatina-20mg-30', pharmacy: 'cruzverde', price: 3200, inStock: true },
  { productId: 'atorvastatina-20mg-30', pharmacy: 'salcobrand', price: 3800, inStock: true },
]

test('estimateSavings compares against the next cheapest in-stock pharmacy', () => {
  const res = estimateSavings({
    purchases: [{ amount: 2599, productId: 'losartan-50mg-30', pharmacyId: 'salcobrand' }],
    prices: SAMPLE_PRICES,
  })
  assert.deepEqual(res, { total: 91, perPurchase: [91], counted: 1 })
})

test('estimateSavings returns null when no other pharmacy has stock or productId is missing', () => {
  assert.deepEqual(
    estimateSavings({
      purchases: [{ amount: 2599, productId: 'losartan-50mg-30', pharmacyId: 'salcobrand' }],
      prices: [{ productId: 'losartan-50mg-30', pharmacy: 'salcobrand', price: 2599, inStock: true }],
    }),
    { total: 0, perPurchase: [null], counted: 0 },
  )

  assert.deepEqual(
    estimateSavings({
      purchases: [{ amount: 2599, productId: null, pharmacyId: 'salcobrand' }],
      prices: SAMPLE_PRICES,
    }),
    { total: 0, perPurchase: [null], counted: 0 },
  )
})

test('estimateSavings returns null for non-positive savings and sums multiple purchases', () => {
  assert.deepEqual(
    estimateSavings({
      purchases: [{ amount: 2690, productId: 'losartan-50mg-30', pharmacyId: 'cruzverde' }],
      prices: SAMPLE_PRICES,
    }),
    { total: 0, perPurchase: [null], counted: 0 },
  )

  assert.deepEqual(
    estimateSavings({
      purchases: [
        { amount: 2599, productId: 'losartan-50mg-30', pharmacyId: 'salcobrand' },
        { amount: 3200, productId: 'atorvastatina-20mg-30', pharmacyId: 'cruzverde' },
      ],
      prices: SAMPLE_PRICES,
    }),
    { total: 691, perPurchase: [91, 600], counted: 2 },
  )
})
