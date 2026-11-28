import { test } from 'node:test'
import assert from 'node:assert/strict'
import { periodState, recentPurchases, type PurchaseRow } from './policyMath.ts'

function makeHistory(): PurchaseRow[] {
  return Array.from({ length: 10 }, (_, idx) => ({
    amount: (idx + 1) * 1000,
    pharmacyIndex: idx % 3,
    productIndex: idx,
    timestamp: 1700000000 + idx * 60,
  }))
}

test('recentPurchases returns empty list when purchaseCount is 0', () => {
  assert.deepEqual(recentPurchases(makeHistory(), 0), [])
})

test('recentPurchases returns newest first when purchaseCount is 2', () => {
  const history = makeHistory()
  assert.deepEqual(recentPurchases(history, 2), [history[1], history[0]])
})

test('recentPurchases wraps around the ring when purchaseCount is 12', () => {
  const history = makeHistory()
  const expectedOrder = [1, 0, 9, 8, 7, 6, 5, 4, 3, 2].map((i) => history[i])
  assert.deepEqual(recentPurchases(history, 12), expectedOrder)
})

test('periodState reports active period with current spent', () => {
  assert.deepEqual(periodState(1000, 3600, 4589, 2000), {
    ended: false,
    spent: 4589,
    renewsAt: 4600,
  })
})

test('periodState resets spent when the period has ended', () => {
  assert.deepEqual(periodState(1000, 3600, 4589, 4600), {
    ended: true,
    spent: 0,
    renewsAt: 4600,
  })
})
