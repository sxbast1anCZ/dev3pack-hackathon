import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ConfirmPurchaseResponse, ProposePurchaseResponse } from '../_lib/contract.js'
import { POST as confirm } from '../tools/confirm-purchase.js'
import { POST as propose } from '../tools/propose-purchase.js'
import { toolRequest, withSecret } from './helpers.js'

const policy = 'PolicyAddress111'

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

test('confirm answers the simulated result and says no transaction was sent', () =>
  withSecret(async () => {
    const res = await confirm(toolRequest({ quote_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' }))
    const out = (await res.json()) as ConfirmPurchaseResponse
    assert.ok(out.ok)
    assert.equal(out.signature, 'simulated-no-transaction')
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
