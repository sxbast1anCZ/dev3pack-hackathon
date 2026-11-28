import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from '../health.js'

test('health answers ok', async () => {
  const res = GET()
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, service: 'remedio-seguro' })
})
