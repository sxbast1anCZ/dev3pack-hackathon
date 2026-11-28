import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from '../tools/search-prices.js'
import { toolRequest, withSecret } from './helpers.js'

const body = { policy: 'PolicyAddress111', query: 'losartán de 50' }

test('a call without x-agent-secret is refused with 401', () =>
  withSecret(async () => {
    const res = await POST(toolRequest(body, null))
    assert.equal(res.status, 401)
  }))

test('a call with a wrong x-agent-secret is refused with 401', () =>
  withSecret(async () => {
    const res = await POST(toolRequest(body, 'wrong'))
    assert.equal(res.status, 401)
  }))

test('a deployment without AGENT_TOOL_SECRET refuses every call with 500', async () => {
  const before = process.env.AGENT_TOOL_SECRET
  delete process.env.AGENT_TOOL_SECRET
  try {
    const res = await POST(toolRequest(body, ''))
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'server_misconfigured' })
  } finally {
    if (before !== undefined) process.env.AGENT_TOOL_SECRET = before
  }
})

test('a body that is not JSON is a 400', () =>
  withSecret(async () => {
    const res = await POST(toolRequest('{not json'))
    assert.equal(res.status, 400)
  }))

test('a body without policy or query is a 400', () =>
  withSecret(async () => {
    for (const bad of [{}, { policy: 'x' }, { query: 'x' }, { policy: '', query: 'x' }, []]) {
      const res = await POST(toolRequest(bad))
      assert.equal(res.status, 400, JSON.stringify(bad))
    }
  }))
